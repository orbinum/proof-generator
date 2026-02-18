import { CircuitType } from './types';

/**
 * Interface for providing circuit artifacts (WASM, zkey)
 * allows abstracting file system access for browser compatibility.
 */
export interface ArtifactProvider {
  /**
   * Get circuit WASM binary
   */
  getCircuitWasm(circuitType: CircuitType): Promise<Uint8Array | string>;

  /**
   * Get circuit zkey binary
   */
  getCircuitZkey(circuitType: CircuitType): Promise<Uint8Array | string>;
}
