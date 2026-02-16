/**
 * Unit Tests: utils.ts
 *
 * Tests for validation and formatting utilities
 */

import {
  validateInputs,
  validateProofSize,
  validatePublicSignals,
  normalizeProofHex,
  formatProofHexForDisplay,
} from '../../src/utils';

describe('Utils', () => {
  describe('normalizeProofHex', () => {
    it('should add 0x prefix', () => {
      const hex = 'ABCD' + '00'.repeat(126);
      const normalized = normalizeProofHex(hex);

      expect(normalized).toMatch(/^0x[0-9a-f]{256}$/);
      expect(normalized.substring(0, 6)).toBe('0xabcd');
    });

    it('should lowercase hex', () => {
      const hex = '0xABCD' + '00'.repeat(126);
      const normalized = normalizeProofHex(hex);

      expect(normalized.substring(0, 6)).toBe('0xabcd');
    });
  });

  describe('formatProofHexForDisplay', () => {
    it('should truncate long hex', () => {
      const hex = '0x' + 'ab'.repeat(128);
      const display = formatProofHexForDisplay(hex, 20);

      expect(display.length).toBeLessThan(hex.length);
      expect(display).toContain('...');
    });

    it('should not truncate short hex', () => {
      const hex = '0xabcd';
      const display = formatProofHexForDisplay(hex, 20);

      expect(display).toBe(hex);
    });
  });

  describe('validateInputs', () => {
    it('should accept valid inputs', () => {
      const inputs = { a: '1', b: '2', c: ['3', '4'] };
      expect(() => validateInputs(inputs)).not.toThrow();
    });

    it('should accept nested objects', () => {
      const inputs = { a: '1', b: { nested: '2' }, c: ['3', '4'] };
      expect(() => validateInputs(inputs)).not.toThrow();
    });

    it('should reject null inputs', () => {
      expect(() => validateInputs(null as any)).toThrow('Inputs must be an object');
    });

    it('should reject undefined inputs', () => {
      expect(() => validateInputs(undefined as any)).toThrow('Inputs must be an object');
    });

    it('should reject undefined values', () => {
      const inputs = { a: '1', b: undefined };
      expect(() => validateInputs(inputs)).toThrow(/is undefined or null/);
    });

    it('should reject null values', () => {
      const inputs = { a: '1', b: null };
      expect(() => validateInputs(inputs)).toThrow(/is undefined or null/);
    });
  });

  describe('validateProofSize', () => {
    it('should accept 128-byte proof', () => {
      const proof = '0x' + '00'.repeat(128);
      expect(() => validateProofSize(proof)).not.toThrow();
    });

    it('should accept proof without 0x prefix', () => {
      const proof = '00'.repeat(128);
      expect(() => validateProofSize(proof)).not.toThrow();
    });

    it('should reject 64-byte proof', () => {
      const proof = '0x' + '00'.repeat(64);
      expect(() => validateProofSize(proof)).toThrow(
        /Invalid proof size.*expected 256 hex chars.*got 128 chars/
      );
    });

    it('should reject 256-byte proof (uncompressed)', () => {
      const proof = '0x' + '00'.repeat(256);
      expect(() => validateProofSize(proof)).toThrow(
        /Invalid proof size.*expected 256 hex chars.*got 512 chars/
      );
    });

    it('should reject empty proof', () => {
      const proof = '0x';
      expect(() => validateProofSize(proof)).toThrow(
        /Invalid proof size.*expected 256 hex chars.*got 0 chars/
      );
    });
  });

  describe('validatePublicSignals', () => {
    it('should accept correct count', () => {
      const signals = ['1', '2', '3', '4', '5'];
      expect(() => validatePublicSignals(signals, 5)).not.toThrow();
    });

    it('should reject wrong count (too few)', () => {
      const signals = ['1', '2', '3'];
      expect(() => validatePublicSignals(signals, 5)).toThrow(
        /Invalid public signals count.*expected 5.*got 3/
      );
    });

    it('should reject wrong count (too many)', () => {
      const signals = ['1', '2', '3', '4', '5', '6', '7'];
      expect(() => validatePublicSignals(signals, 5)).toThrow(
        /Invalid public signals count.*expected 5.*got 7/
      );
    });

    it('should accept empty signals when expected is 0', () => {
      const signals: string[] = [];
      expect(() => validatePublicSignals(signals, 0)).not.toThrow();
    });

    it('should handle disclosure circuit (4 signals)', () => {
      const signals = ['1', '2', '3', '4'];
      expect(() => validatePublicSignals(signals, 4)).not.toThrow();
    });
  });
});
