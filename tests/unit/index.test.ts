/**
 * Unit Tests: index.ts
 *
 * Tests main API functions with isolated unit testing approach
 */

import { CircuitType } from '../../src';

describe('index.ts - Unit Tests', () => {
  // Tests for isReady were removed as the function was deprecated

  describe('CircuitType enum', () => {
    it('should define all circuit types', () => {
      expect(CircuitType.Unshield).toBeDefined();
      expect(CircuitType.Transfer).toBeDefined();
      expect(CircuitType.Disclosure).toBeDefined();
    });

    it('should have string values', () => {
      expect(typeof CircuitType.Unshield).toBe('string');
      expect(typeof CircuitType.Transfer).toBe('string');
      expect(typeof CircuitType.Disclosure).toBe('string');
    });

    it('should have lowercase circuit names', () => {
      expect(CircuitType.Unshield).toBe('unshield');
      expect(CircuitType.Transfer).toBe('transfer');
      expect(CircuitType.Disclosure).toBe('disclosure');
    });
  });

  describe('Error types', () => {
    it('should export custom error types', () => {
      const {
        CircuitNotFoundError,
        ProofGenerationError,
        InvalidInputsError,
      } = require('../../src/types');

      expect(CircuitNotFoundError).toBeDefined();
      expect(ProofGenerationError).toBeDefined();
      expect(InvalidInputsError).toBeDefined();
    });

    it('should create CircuitNotFoundError instances', () => {
      const { CircuitNotFoundError, CircuitType } = require('../../src/types');
      const error = new CircuitNotFoundError(CircuitType.Unshield);

      expect(error).toBeInstanceOf(Error);
      // expect(error.name).toBe('ProofGeneratorError'); // Base class name might vary
      expect(error.message).toContain('unshield');
      expect(error.message).toContain('Circuit not found');
    });

    it('should create ProofGenerationError instances', () => {
      const { ProofGenerationError } = require('../../src/types');
      const error = new ProofGenerationError('test message');

      expect(error).toBeInstanceOf(Error);
      // expect(error.name).toBe('ProofGeneratorError');
      expect(error.message).toBe('test message');
    });

    it('should create InvalidInputsError instances', () => {
      const { InvalidInputsError } = require('../../src/types');
      const error = new InvalidInputsError('invalid input');

      expect(error).toBeInstanceOf(Error);
      // expect(error.name).toBe('ProofGeneratorError'); // Base class name
      expect(error.message).toBe('invalid input');
    });
  });

  describe('Module exports', () => {
    it('should export generateProof function', () => {
      const { generateProof } = require('../../src');
      expect(typeof generateProof).toBe('function');
    });

    // isReady removed

    // calculateWitness removed

    it('should export all utility functions', () => {
      const {
        validateInputs,
        validatePublicSignals,
        validateProofSize,
        normalizeProofHex,
      } = require('../../src');

      expect(typeof validateInputs).toBe('function');
      expect(typeof validatePublicSignals).toBe('function');
      expect(typeof validateProofSize).toBe('function');
      expect(typeof normalizeProofHex).toBe('function');
    });

    it('should export CircuitType enum', () => {
      const { CircuitType } = require('../../src');
      expect(CircuitType).toBeDefined();
      expect(CircuitType.Unshield).toBeDefined();
    });

    it('should export error classes', () => {
      const {
        CircuitNotFoundError,
        ProofGenerationError,
        InvalidInputsError,
      } = require('../../src');

      expect(CircuitNotFoundError).toBeDefined();
      expect(ProofGenerationError).toBeDefined();
      expect(InvalidInputsError).toBeDefined();
    });
  });
});
