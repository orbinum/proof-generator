/** Circuit types supported by Orbinum */
export enum CircuitType {
  Unshield = 'unshield',
  Transfer = 'transfer',
  ValueProof = 'value_proof',
}

/**
 * On-chain numeric circuit IDs. Single source of truth for mapping the string
 * CircuitType to the id the pallet verifies against. These MUST match the node's
 * `CircuitId` constants (`node/frame/zk-verifier/src/types.rs`):
 *   TRANSFER=1, UNSHIELD=2, VALUE_PROOF=6.
 * Note: VALUE_PROOF is 6 (NOT 4, and not sequential). Ids are never reused, so
 * the gaps are permanent. A version/vk lookup keyed off the wrong id would
 * query a non-existent circuit. A drift test guards this.
 */
export const CIRCUIT_ID: Record<CircuitType, number> = {
  [CircuitType.Transfer]: 1,
  [CircuitType.Unshield]: 2,
  [CircuitType.ValueProof]: 6,
};

/**
 * Maps a CircuitType to its on-chain numeric id. Fail-closed: an unknown circuit
 * throws rather than defaulting to 0 (which would silently query the wrong VK).
 */
export function circuitTypeToId(circuit: CircuitType): number {
  const id = CIRCUIT_ID[circuit];
  if (id === undefined) {
    throw new Error(`Unknown circuit type: ${String(circuit)}`);
  }
  return id;
}

/** Circuit input value types (supports nested arrays for 2D inputs) */
export type CircuitInputValue = string | number | string[] | number[] | string[][] | number[][];

/** Circuit input: any key-value pairs (circuit-specific) */
export type CircuitInputs = Record<string, CircuitInputValue>;

/** Proof generation result */
export interface ProofResult {
  /** Compressed proof bytes (128 bytes as hex string) */
  proof: string;
  /** Public signals (circuit outputs) */
  publicSignals: string[];
  /** Circuit type used */
  circuitType: CircuitType;
}

/** Circuit configuration */
export interface CircuitConfig {
  /** Circuit name (e.g., 'unshield') */
  name: string;
  /** Path to WASM file */
  wasmPath: string;
  /** Path to zkey proving key (snarkjs) */
  zkeyPath: string;
  /** Path to .ark proving key (arkworks compressed format, for arkworks backend) */
  provingKeyPath: string;
  /** Expected number of public signals */
  expectedPublicSignals: number;
}
