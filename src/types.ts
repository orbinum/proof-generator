/**
 * Types for Orbinum Proof Generator
 */

/** Circuit types supported by Orbinum */
export enum CircuitType {
  Unshield = 'unshield',
  Transfer = 'transfer',
  Disclosure = 'disclosure',
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

// ============================================================================
// Disclosure types
// ============================================================================

/**
 * Which fields to reveal to the auditor.
 *
 * At least one of `discloseValue`, `discloseAssetId`, or `discloseOwner`
 * must be `true`.
 */
export interface DisclosureMask {
  /** Reveal the note value (u64) */
  discloseValue: boolean;
  /** Reveal the asset ID (u32) */
  discloseAssetId: boolean;
  /** Reveal the owner identity hash (Poseidon(owner_pubkey)) */
  discloseOwner: boolean;
}

/** Proof output returned by `generateDisclosureProof`. */
export interface DisclosureProofOutput {
  /** 128-byte compressed Groth16 proof as 0x-prefixed hex string */
  proof: string;
  /**
   * Raw public signals in hex (0x-prefixed, 32 bytes each).
   * Order: [commitment, revealed_value, revealed_asset_id, revealed_owner_hash]
   */
  publicSignals: string[];
  /** Human-readable revealed data */
  revealedData: {
    /** Revealed note value as decimal string, or undefined if not disclosed */
    value?: string;
    /** Revealed asset ID as number, or undefined if not disclosed */
    assetId?: number;
    /** Revealed owner hash as 0x-prefixed hex, or undefined if not disclosed */
    ownerHash?: string;
    /** Note commitment (always present) */
    commitment: string;
  };
}
