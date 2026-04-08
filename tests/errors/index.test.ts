/**
 * Tests: errors/index.ts
 *
 * Verifies that each error class carries the correct name, message,
 * error code, and inheritance chain.
 */

import { describe, it, expect } from 'vitest';
import {
  ProofGeneratorError,
  WitnessCalculationError,
  ProofGenerationError,
  CircuitNotFoundError,
  InvalidInputsError,
} from '../../src/errors';
import { CircuitType } from '../../src/circuits/types';

describe('ProofGeneratorError', () => {
  it('sets message, code and name', () => {
    const err = new ProofGeneratorError('something went wrong', 'SOME_CODE');
    expect(err.message).toBe('something went wrong');
    expect(err.code).toBe('SOME_CODE');
    expect(err.name).toBe('ProofGeneratorError');
  });

  it('is an instance of Error', () => {
    expect(new ProofGeneratorError('msg', 'CODE')).toBeInstanceOf(Error);
  });
});

describe('WitnessCalculationError', () => {
  it('sets code to WITNESS_CALCULATION_FAILED', () => {
    const err = new WitnessCalculationError('bad witness');
    expect(err.code).toBe('WITNESS_CALCULATION_FAILED');
    expect(err.message).toBe('bad witness');
  });

  it('extends ProofGeneratorError', () => {
    expect(new WitnessCalculationError('msg')).toBeInstanceOf(ProofGeneratorError);
  });
});

describe('ProofGenerationError', () => {
  it('sets code to PROOF_GENERATION_FAILED', () => {
    const err = new ProofGenerationError('proving failed');
    expect(err.code).toBe('PROOF_GENERATION_FAILED');
    expect(err.message).toBe('proving failed');
  });

  it('extends ProofGeneratorError', () => {
    expect(new ProofGenerationError('msg')).toBeInstanceOf(ProofGeneratorError);
  });
});

describe('CircuitNotFoundError', () => {
  it('builds message from CircuitType', () => {
    const err = new CircuitNotFoundError(CircuitType.Unshield);
    expect(err.message).toBe('Circuit not found: unshield');
    expect(err.code).toBe('CIRCUIT_NOT_FOUND');
  });

  it('works for every CircuitType variant', () => {
    for (const ct of Object.values(CircuitType)) {
      const err = new CircuitNotFoundError(ct);
      expect(err.message).toContain(ct);
    }
  });

  it('extends ProofGeneratorError', () => {
    expect(new CircuitNotFoundError(CircuitType.Transfer)).toBeInstanceOf(ProofGeneratorError);
  });
});

describe('InvalidInputsError', () => {
  it('sets code to INVALID_INPUTS', () => {
    const err = new InvalidInputsError('missing field');
    expect(err.code).toBe('INVALID_INPUTS');
    expect(err.message).toBe('missing field');
  });

  it('extends ProofGeneratorError', () => {
    expect(new InvalidInputsError('msg')).toBeInstanceOf(ProofGeneratorError);
  });
});
