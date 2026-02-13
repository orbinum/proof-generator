/**
 * WASM loader for universal (Node.js + Browser) environments
 *
 * Provides a unified interface for proof generation using arkworks WASM module.
 * Works identically in Node.js, browsers, Electron, and Tauri.
 */

import { getWasmModuleName } from './config';

interface WasmProofOutput {
  proof: string;
  publicSignals: string[];
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
    // Dynamic import: works in Node.js and browsers uniformly
    // The WASM module is pre-compiled and downloaded during `npm install`
    const moduleName = getWasmModuleName();
    // @ts-ignore - WASM module is dynamically generated
    const wasm = await import(`../groth16-proof/${moduleName}`);

    // Initialize WASM and panic hooks
    if (typeof wasm.default === 'function') {
      await wasm.default();
    }
    if (typeof wasm.init_panic_hook === 'function') {
      wasm.init_panic_hook();
    }

    wasmModule = wasm;
  } catch (error) {
    throw new Error(`Failed to initialize WASM module: ${(error as Error).message}`);
  }
}

/**
 * Generate proof using WASM module with decimal witness format (recommended)
 *
 * This function accepts witness in snarkjs native format (decimal strings),
 * eliminating the need for manual hex conversion.
 *
 * @param numPublicSignals - Number of public signals to extract
 * @param witnessJson - JSON stringified witness array (decimal strings)
 * @param provingKeyBytes - Binary proving key in arkworks format
 * @returns Proof and public signals
 */
export async function generateProofFromDecimalWasm(
  numPublicSignals: number,
  witnessJson: string,
  provingKeyBytes: Uint8Array
): Promise<WasmProofOutput> {
  if (!wasmModule) {
    await initWasm();
  }

  try {
    // Call WASM function: generate_proof_from_decimal_wasm(num_public_signals, witness_json, proving_key_bytes)
    const resultJson = wasmModule.generate_proof_from_decimal_wasm(
      numPublicSignals,
      witnessJson,
      provingKeyBytes
    );
    return JSON.parse(resultJson);
  } catch (error) {
    throw new Error(`WASM proof generation failed: ${(error as Error).message}`);
  }
}

/**
 * Generate proof using WASM module with hex LE witness format (legacy)
 *
 * @deprecated Use generateProofFromDecimalWasm() instead
 * @param circuitType - Type of circuit (unshield, transfer, or disclosure)
 * @param witnessJson - JSON stringified witness array (hex LE strings)
 * @param provingKeyBytes - Binary proving key in arkworks format
 * @returns Proof and public signals
 */
export async function generateProofWasm(
  circuitType: 'unshield' | 'transfer' | 'disclosure',
  witnessJson: string,
  provingKeyBytes: Uint8Array
): Promise<WasmProofOutput> {
  if (!wasmModule) {
    await initWasm();
  }

  try {
    // Call WASM function: generate_proof_wasm(circuit_type, witness_json, proving_key_bytes)
    const resultJson = wasmModule.generate_proof_wasm(circuitType, witnessJson, provingKeyBytes);
    return JSON.parse(resultJson);
  } catch (error) {
    throw new Error(`WASM proof generation failed: ${(error as Error).message}`);
  }
}

/**
 * Check if WASM module is initialized
 * @internal
 */
export function isWasmReady(): boolean {
  return wasmModule !== null;
}
