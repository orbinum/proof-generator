/** Circuit types supported by Orbinum */
export enum CircuitType {
  Unshield = 'unshield',
  Transfer = 'transfer',
  ValueProof = 'value_proof',
  PrivateLink = 'private_link',
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
