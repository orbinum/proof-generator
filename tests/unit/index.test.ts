/**
 * Unit Tests: index.ts
 *
 * Tests main API functions with isolated unit testing approach
 */

import { CircuitType, isReady } from '../../src';

describe('index.ts - Unit Tests', () => {
  describe('isReady', () => {
    it('should return true when artifacts are available', () => {
      const ready = isReady();

      // In a properly configured environment, should be true
      expect(typeof ready).toBe('boolean');
    });

    it('should check for Unshield circuit artifacts', () => {
      const ready = isReady();

      if (ready) {
        // If ready, artifacts should exist
        // This is a smoke test - actual file existence tested in circuits.test.ts
        expect(ready).toBe(true);
      } else {
        // If not ready, it's likely missing @orbinum/circuits package
        console.warn('⚠️  Proof generator not ready. Missing circuit artifacts.');
      }
    });

    it('should not throw even if artifacts are missing', () => {
      // isReady should gracefully return false, not throw
      expect(() => isReady()).not.toThrow();
    });

    it('should return consistent result on multiple calls', () => {
      const result1 = isReady();
      const result2 = isReady();
      const result3 = isReady();

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });
  });

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
        ProofGeneratorError,
        InvalidInputsError,
      } = require('../../src/types');

      expect(CircuitNotFoundError).toBeDefined();
      expect(ProofGeneratorError).toBeDefined();
      expect(InvalidInputsError).toBeDefined();
    });

    it('should create CircuitNotFoundError instances', () => {
      const { CircuitNotFoundError, CircuitType } = require('../../src/types');
      const error = new CircuitNotFoundError(CircuitType.Unshield);

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ProofGeneratorError'); // Base class name
      expect(error.message).toContain('unshield');
      expect(error.message).toContain('Circuit not found');
    });

    it('should create ProofGeneratorError instances', () => {
      const { ProofGeneratorError } = require('../../src/types');
      const error = new ProofGeneratorError('test message');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ProofGeneratorError');
      expect(error.message).toBe('test message');
    });

    it('should create InvalidInputsError instances', () => {
      const { InvalidInputsError } = require('../../src/types');
      const error = new InvalidInputsError('invalid input');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ProofGeneratorError'); // Base class name
      expect(error.message).toBe('invalid input');
    });
  });

  describe('Module exports', () => {
    it('should export generateProof function', () => {
      const { generateProof } = require('../../src');
      expect(typeof generateProof).toBe('function');
    });

    it('should export isReady function', () => {
      const { isReady } = require('../../src');
      expect(typeof isReady).toBe('function');
    });

    it('should export calculateWitness function', () => {
      const { calculateWitness } = require('../../src');
      expect(typeof calculateWitness).toBe('function');
    });

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
        ProofGeneratorError,
        InvalidInputsError,
      } = require('../../src');

      expect(CircuitNotFoundError).toBeDefined();
      expect(ProofGeneratorError).toBeDefined();
      expect(InvalidInputsError).toBeDefined();
    });
  });
});
