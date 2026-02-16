/**
 * WASM loader for universal (Node.js + Browser) environments
 *
 * Provides a unified interface for proof generation using arkworks WASM module.
 * Works identically in Node.js, browsers, Electron, and Tauri.
 *
 * Uses @orbinum/groth16-proofs package from npm.
 */

interface SnarkjsProofLike {
  pi_a: Array<string | number>;
  pi_b: Array<Array<string | number>>;
  pi_c: Array<string | number>;
}

let wasmModule: any = null;

/**
 * Initialize WASM module (idempotent - safe to call multiple times)
 */
export async function initWasm(): Promise<void> {
  if (wasmModule) {
    return; // Already initialized
  }

  try {
    // Import @orbinum/groth16-proofs from npm
    const wasm = await import('@orbinum/groth16-proofs');

    // Initialize WASM
    // For Node.js: Load manually from node_modules
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      const fs = await import('fs');
      const path = await import('path');

      // Resolve path to WASM file in node_modules
      const wasmModulePath = require.resolve('@orbinum/groth16-proofs');
      const wasmDir = path.dirname(wasmModulePath);
      const wasmPath = path.join(wasmDir, 'groth16_proofs_bg.wasm');

      const wasmBuffer = fs.readFileSync(wasmPath);

      if (typeof wasm.initSync === 'function') {
        wasm.initSync({ module: wasmBuffer });
      } else if (typeof wasm.default === 'function') {
        await wasm.default({ module: wasmBuffer });
      }
    } else {
      // For browsers: Use default() which handles fetch automatically
      if (typeof wasm.default === 'function') {
        await wasm.default();
      }
    }

    // Initialize panic hook for better error messages
    if (typeof wasm.init_panic_hook === 'function') {
      wasm.init_panic_hook();
    }

    wasmModule = wasm;
  } catch (error) {
    throw new Error(`Failed to initialize WASM module: ${(error as Error).message}`);
  }
}

/**
 * Compress a snarkjs Groth16 proof to arkworks canonical compressed format (128 bytes)
 *
 * @param proof - snarkjs proof object with pi_a/pi_b/pi_c
 * @returns 0x-prefixed 128-byte compressed proof hex
 */
export async function compressSnarkjsProofWasm(proof: SnarkjsProofLike): Promise<string> {
  if (!wasmModule) {
    await initWasm();
  }

  try {
    const normalizedProof = {
      pi_a: [String(proof.pi_a[0]), String(proof.pi_a[1])],
      pi_b: [
        [String(proof.pi_b[0][0]), String(proof.pi_b[0][1])],
        [String(proof.pi_b[1][0]), String(proof.pi_b[1][1])],
      ],
      pi_c: [String(proof.pi_c[0]), String(proof.pi_c[1])],
    };

    return wasmModule.compress_snarkjs_proof_wasm(JSON.stringify(normalizedProof));
  } catch (error) {
    throw new Error(`WASM proof compression failed: ${(error as Error).message}`);
  }
}
