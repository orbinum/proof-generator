/**
 * WASM loader for universal (Node.js + Browser) environments.
 *
 * Initializes the `@orbinum/groth16-proofs` WASM module and exposes
 * `compressSnarkjsProofWasm`, which converts a snarkjs Groth16 proof
 * (pi_a / pi_b / pi_c) to the 128-byte arkworks canonical compressed format
 * accepted by `pallet-zk-verifier` on-chain.
 */

// The version of the wasm this package was built against, inlined at build
// time by tsup's `define` (see tsup.config.ts).
//
// It used to be `import groth16pkg from '@orbinum/groth16-proofs/package.json'`.
// That works in CommonJS and fails in ESM: Node requires an import attribute
// (`with { type: 'json' }`) for JSON modules, so the ESM build threw
// `ERR_IMPORT_ATTRIBUTE_MISSING` on load — before any function ran. Inlining
// also removes the assumption that the dependency exposes its manifest at all,
// which an `exports` map without a `"./package.json"` entry would break.
declare const __GROTH16_VERSION__: string;
import { getNodeRequire } from '../internal/nodeRequire';

interface SnarkjsProofLike {
  pi_a: Array<string | number>;
  pi_b: Array<Array<string | number>>;
  pi_c: Array<string | number>;
}

// CDN URL for the WASM binary, pinned to the exact version this package was
// built against. `__GROTH16_VERSION__` is substituted by tsup (see
// tsup.config.ts) and by the vitest configs, which read the same manifest — an
// unpinned URL would serve whatever is newest, which is a different wasm than
// the one these tests passed against.
const GROTH16_WASM_CDN = `https://unpkg.com/@orbinum/groth16-proofs@${__GROTH16_VERSION__}/groth16_proofs_bg.wasm`;

let wasmModule: any = null;

/** Initialize the WASM module. Idempotent — safe to call multiple times. */
export async function initWasm(): Promise<void> {
  if (wasmModule) return;

  try {
    const wasm = await import('@orbinum/groth16-proofs');

    if (typeof window === 'undefined' && typeof self === 'undefined') {
      // Node.js: load the WASM binary from disk.
      //
      // `getNodeRequire()` rather than `eval('require')`: the latter works in
      // the CommonJS build and throws `ReferenceError: require is not defined`
      // in the ESM one, from the same source line.
      const requireFn = await getNodeRequire();
      const fs = requireFn('fs') as typeof import('fs');
      const path = requireFn('path') as typeof import('path');
      const wasmDir = path.dirname(requireFn.resolve('@orbinum/groth16-proofs'));
      const wasmBuffer = fs.readFileSync(path.join(wasmDir, 'groth16_proofs_bg.wasm'));

      // The two entry points take differently-named keys: `initSync` destructures
      // `{ module }`, the async default `{ module_or_path }`. Passing the wrong
      // one is not an error — wasm-bindgen reads `undefined` and silently falls
      // back to fetching `groth16_proofs_bg.wasm` relative to its own URL, which
      // in a bundle does not exist. The failure then surfaces as a fetch error
      // naming a file nobody asked for.
      if (typeof wasm.initSync === 'function') {
        wasm.initSync({ module: wasmBuffer });
      } else if (typeof wasm.default === 'function') {
        await wasm.default({ module_or_path: wasmBuffer });
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
      const initFn: ((input: { module_or_path: string }) => Promise<unknown>) | undefined =
        typeof defaultExport === 'function'
          ? defaultExport
          : typeof defaultExport?.default === 'function'
            ? defaultExport.default
            : undefined;

      if (initFn) {
        await initFn({ module_or_path: GROTH16_WASM_CDN });
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
 * Generate a Groth16 proof from a `.ark` v2 artifact and a raw witness.
 *
 * Replaces the 5.x entry point, which produced proofs that never verified.
 * Two things changed and both had to:
 *
 * - **The artifact carries its constraint matrices.** Proving a Circom circuit
 *   needs them as well as the proving key, and a `.ark` v1 has only the key, so
 *   no signature taking one could have been fixed in place.
 * - **The witness arrives as bytes.** The old path serialised ~17,000 field
 *   elements to decimal-string JSON — hundreds of kilobytes of text, parsed back
 *   one big integer at a time. These are the `n × 32` little-endian bytes that a
 *   `.wtns` file already holds.
 *
 * The public-signal count is read from the artifact rather than passed in: it is
 * a property of the circuit, and a caller that gets it wrong produces a proof
 * that fails verification with nothing to explain why.
 *
 * @param artifactBytes - A `.ark` v2 file: proving key plus constraint matrices.
 * @param witnessBytes - The witness as `n × 32` little-endian bytes.
 * @returns `proof` (0x-prefixed 128-byte hex) and `publicSignals` (0x-prefixed
 *   32-byte little-endian hex).
 */
export async function generateProofWasm(
  artifactBytes: Uint8Array,
  witnessBytes: Uint8Array
): Promise<{ proof: string; publicSignals: string[] }> {
  if (!wasmModule) await initWasm();

  let raw: string;
  try {
    raw = wasmModule.generate_proof_wasm(artifactBytes, witnessBytes);
  } catch (error) {
    throw new Error(`WASM proof generation failed: ${(error as Error).message}`);
  }

  try {
    return JSON.parse(raw) as { proof: string; publicSignals: string[] };
  } catch (error) {
    throw new Error(`Failed to parse WASM proof output: ${(error as Error).message}`);
  }
}
