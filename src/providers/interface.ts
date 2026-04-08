import { CircuitType } from '../circuits/types';

/**
 * Interface for providing circuit artifacts (WASM, zkey, ark proving key).
 * Abstracts file system access for browser / mobile / Node.js compatibility.
 */
export interface ArtifactProvider {
  getCircuitWasm(circuitType: CircuitType): Promise<Uint8Array | string>;
  getCircuitZkey(circuitType: CircuitType): Promise<Uint8Array | string>;
  /** Optional: fetch the arkworks compressed proving key (.ark) for the arkworks backend. */
  getCircuitProvingKey?(circuitType: CircuitType): Promise<Uint8Array>;
}
