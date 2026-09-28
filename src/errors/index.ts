import { CircuitType } from '../circuits/types';

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

/** The caller asked for one circuit version and the provider serves another. */
export class CircuitVersionMismatchError extends ProofGeneratorError {
  constructor(circuitType: CircuitType, requested: number, served: number) {
    super(
      `Circuit ${circuitType}: requested version ${requested}, but the provider serves version ${served}`,
      'CIRCUIT_VERSION_MISMATCH'
    );
  }
}

export class InvalidInputsError extends ProofGeneratorError {
  constructor(message: string) {
    super(message, 'INVALID_INPUTS');
  }
}
