import { CircuitType } from '../circuits/types';

/**
 * The circuit version a provider serves artifacts for, plus the identifiers a
 * consumer needs to cross-check integrity against the chain before proving.
 */
export type ResolvedCircuitVersion = {
  /** The resolved circuit version. */
  version: number;
  /** The `@orbinum/circuits` package version the artifacts come from. */
  packageVersion: string;
  /** The on-chain VK hash the manifest declares for this version. */
  vkHash: string;
};

/**
 * Interface for providing circuit artifacts (WASM, zkey, ark proving key).
 * Abstracts file system access for browser / mobile / Node.js compatibility.
 */
export interface ArtifactProvider {
  getCircuitWasm(circuitType: CircuitType): Promise<Uint8Array | string>;
  getCircuitZkey(circuitType: CircuitType): Promise<Uint8Array | string>;
  /** Optional: fetch the arkworks compressed proving key (.ark) for the arkworks backend. */
  getCircuitProvingKey?(circuitType: CircuitType): Promise<Uint8Array>;
  /**
   * Optional: the version the artifacts belong to. When present, `generateProof`
   * checks the proof against that version's shape, so artifacts and expected
   * arity cannot disagree.
   */
  getResolvedVersion?(circuitType: CircuitType): Promise<ResolvedCircuitVersion>;
}
