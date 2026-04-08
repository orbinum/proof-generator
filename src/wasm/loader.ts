/**
 * WASM loader for universal (Node.js + Browser) environments.
 *
 * Initializes the `@orbinum/groth16-proofs` WASM module and exposes
 * `compressSnarkjsProofWasm`, which converts a snarkjs Groth16 proof
 * (pi_a / pi_b / pi_c) to the 128-byte arkworks canonical compressed format
 * accepted by `pallet-zk-verifier` on-chain.
 */

// Read the installed version at build time so the CDN URL stays in sync.
// resolveJsonModule must be enabled in tsconfig (it is).
import groth16pkg from '@orbinum/groth16-proofs/package.json';

interface SnarkjsProofLike {
  pi_a: Array<string | number>;
  pi_b: Array<Array<string | number>>;
  pi_c: Array<string | number>;
}

// CDN URL pattern for the WASM binary.
// `groth16pkg.version` is resolved at build time from the installed package.json,
// so this stays in sync automatically whenever the dependency is upgraded.
const GROTH16_WASM_CDN = `https://unpkg.com/@orbinum/groth16-proofs@${groth16pkg.version}/groth16_proofs_bg.wasm`;

let wasmModule: any = null;

/** Initialize the WASM module. Idempotent — safe to call multiple times. */
export async function initWasm(): Promise<void> {
  if (wasmModule) return;

  try {
    const wasm = await import('@orbinum/groth16-proofs');

    if (typeof window === 'undefined' && typeof self === 'undefined') {
      // Node.js: load the WASM binary from disk via dynamic require.
      const requireFn = eval('require');
      const fs = requireFn('fs');
      const path = requireFn('path');
      const wasmDir = path.dirname(requireFn.resolve('@orbinum/groth16-proofs'));
      const wasmBuffer = fs.readFileSync(path.join(wasmDir, 'groth16_proofs_bg.wasm'));

      if (typeof wasm.initSync === 'function') {
        wasm.initSync({ module: wasmBuffer });
      } else if (typeof wasm.default === 'function') {
        await wasm.default({ module: wasmBuffer });
      }
    } else {
      // Browser: pass the WASM CDN URL directly to the init function.
      //
      // Relying on `new URL('groth16_proofs_bg.wasm', import.meta.url)` (the
      // wasm-pack default) breaks in Vite dev mode because the bundler moves the
      // JS out of its original node_modules path while the .wasm binary stays
      // behind, producing a 404. Loading from CDN is the same strategy already
      // used for @orbinum/circuits artifacts and avoids all import.meta.url /
      // Vite asset-serving issues entirely.
      //
      // TypeScript (module: "CommonJS") compiles dynamic import() to
      // __importStar(require()), which causes Vite's CJS→ESM interop to wrap the
      // namespace and reassign `wasm.default` to the namespace object. Resolve the
      // actual __wbg_init function defensively (direct ESM or CJS-interop path).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const defaultExport = (wasm as any).default;
      const initFn: ((url: string) => Promise<unknown>) | undefined =
        typeof defaultExport === 'function'
          ? defaultExport
          : typeof defaultExport?.default === 'function'
            ? defaultExport.default
            : undefined;

      if (initFn) {
        await initFn(GROTH16_WASM_CDN);
      }
    }

    if (typeof wasm.init_panic_hook === 'function') {
      try {
        wasm.init_panic_hook();
      } catch {
        // init_panic_hook is a developer-aid only; safe to swallow.
      }
    }

    wasmModule = wasm;
  } catch (error) {
    throw new Error(`Failed to initialize WASM module: ${(error as Error).message}`);
  }
}

/**
 * Compress a snarkjs Groth16 proof to the arkworks canonical compressed
 * format (128 bytes, 0x-prefixed hex).
 */
export async function compressSnarkjsProofWasm(proof: SnarkjsProofLike): Promise<string> {
  if (!wasmModule) await initWasm();

  const normalizedProof = {
    pi_a: [String(proof.pi_a[0]), String(proof.pi_a[1])],
    pi_b: [
      [String(proof.pi_b[0][0]), String(proof.pi_b[0][1])],
      [String(proof.pi_b[1][0]), String(proof.pi_b[1][1])],
    ],
    pi_c: [String(proof.pi_c[0]), String(proof.pi_c[1])],
  };

  try {
    return wasmModule.compress_snarkjs_proof_wasm(JSON.stringify(normalizedProof));
  } catch (error) {
    throw new Error(`WASM proof compression failed: ${(error as Error).message}`);
  }
}

/**
 * Generate a Groth16 proof entirely within arkworks using a pre-computed
 * witness (decimal string array) and an `.ark` compressed proving key.
 *
 * @param numPublicSignals - Number of public signals to extract from the witness.
 * @param witnessDecimalJson - JSON array of witness values as decimal strings,
 *   e.g. `["1","12345","67890"]` (snarkjs native format).
 * @param provingKeyBytes - Serialized arkworks compressed proving key (.ark file).
 * @returns Object with `proof` (0x-prefixed 128-byte hex) and `publicSignals`
 *   (array of 0x-prefixed 32-byte little-endian hex strings).
 */
export async function generateProofFromWitnessWasm(
  numPublicSignals: number,
  witnessDecimalJson: string,
  provingKeyBytes: Uint8Array
): Promise<{ proof: string; publicSignals: string[] }> {
  if (!wasmModule) await initWasm();

  let raw: string;
  try {
    raw = wasmModule.generate_proof_from_decimal_wasm(
      numPublicSignals,
      witnessDecimalJson,
      provingKeyBytes
    );
  } catch (error) {
    throw new Error(`WASM proof generation failed: ${(error as Error).message}`);
  }

  try {
    return JSON.parse(raw) as { proof: string; publicSignals: string[] };
  } catch (error) {
    throw new Error(`Failed to parse WASM proof output: ${(error as Error).message}`);
  }
}
