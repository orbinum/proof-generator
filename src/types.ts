/**
 * Types for Orbinum Proof Generator
 */

/** Circuit types supported by Orbinum */
export enum CircuitType {
  Unshield = 'unshield',
  Transfer = 'transfer',
  Disclosure = 'disclosure',
}

/** Circuit input: any key-value pairs (circuit-specific) */
export type CircuitInputs = Record<string, string | string[] | number | number[]>;

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
  /** Path to .ark proving key */
  provingKeyPath: string;
  /** Expected number of public signals */
  expectedPublicSignals: number;
}

/** Witness data (decimal strings from snarkjs) */
export interface WitnessData {
  /** Array of witness elements as decimal strings (snarkjs native format) */
  witness: string[];
}

/** Error types */
export class ProofGeneratorError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'ProofGeneratorError';
  }
}

export class WitnessCalculationError extends ProofGeneratorError {
  constructor(message: string) {
    super(message, 'WITNESS_CALCULATION_FAILED');
  }
}

export class ProofGenerationError extends ProofGeneratorError {
  constructor(message: string) {
    super(message, 'PROOF_GENERATION_FAILED');
  }
}

export class CircuitNotFoundError extends ProofGeneratorError {
  constructor(circuitType: CircuitType) {
    super(`Circuit not found: ${circuitType}`, 'CIRCUIT_NOT_FOUND');
  }
}

export class InvalidInputsError extends ProofGeneratorError {
  constructor(message: string) {
    super(message, 'INVALID_INPUTS');
  }
}
