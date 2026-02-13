/**
 * Centralized configuration for proof generator
 * Manages paths to WASM module, artifacts, and circuits
 */

import { CircuitType } from './types';

/**
 * Base paths for WASM module and artifacts
 */
export const PATHS = {
  // WASM module from groth16-proofs
  WASM_MODULE_DIR: '../groth16-proof',
  WASM_MODULE_NAME: 'groth16_proofs',
  WASM_BG_FILE: 'groth16_proofs_bg.wasm',

  // Circuit artifacts (downloaded from orbinum/circuits)
  CIRCUITS_BASE: '../circuits',
} as const;

/**
 * Get full path to circuit WASM file (witness calculator)
 */
export function getCircuitWasmPath(circuit: CircuitType): string {
  return `${PATHS.CIRCUITS_BASE}/${circuit.toLowerCase()}.wasm`;
}

/**
 * Get full path to circuit proving key (arkworks format)
 */
export function getCircuitProvingKeyPath(circuit: CircuitType): string {
  return `${PATHS.CIRCUITS_BASE}/${circuit.toLowerCase()}_pk.ark`;
}

/**
 * Get full path to WASM background WASM file
 */
export function getWasmBgPath(): string {
  return `${PATHS.WASM_MODULE_DIR}/${PATHS.WASM_BG_FILE}`;
}

/**
 * Get WASM module name (for dynamic imports)
 */
export function getWasmModuleName(): string {
  return PATHS.WASM_MODULE_NAME;
}

/**
 * Resolve paths correctly in different environments
 * @internal
 */
export function resolvePath(relativePath: string): string {
  try {
    const path = require('path');
    return path.resolve(__dirname, relativePath);
  } catch {
    // Browser environment or path not available
    return relativePath;
  }
}
