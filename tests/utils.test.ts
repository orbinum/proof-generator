/**
 * Test: Utils
 */

import {
  validateInputs,
  validateProofSize,
  validatePublicSignals,
  formatInputValue,
  formatInputArray,
  formatCircuitInputs,
  formatWitness,
  formatProofToHex,
  parseProofHex,
  normalizeProofHex,
  formatProofHexForDisplay,
} from '../src/utils';

describe('Utils', () => {
  describe('formatInputValue', () => {
    it('should convert number to string', () => {
      expect(formatInputValue(100)).toBe('100');
      expect(formatInputValue(0)).toBe('0');
      expect(formatInputValue(256)).toBe('256');
    });

    it('should convert bigint to string', () => {
      expect(formatInputValue(BigInt(100))).toBe('100');
      expect(formatInputValue(BigInt('123456789012345678901234567890'))).toBe(
        '123456789012345678901234567890'
      );
    });

    it('should pass through decimal strings', () => {
      expect(formatInputValue('100')).toBe('100');
      expect(formatInputValue('0')).toBe('0');
    });

    it('should convert hex strings to decimal', () => {
      expect(formatInputValue('0x64')).toBe('100');
      expect(formatInputValue('0x100')).toBe('256');
      expect(formatInputValue('0x0')).toBe('0');
    });
  });

  describe('formatInputArray', () => {
    it('should convert array of values', () => {
      expect(formatInputArray([1, 2, 3])).toEqual(['1', '2', '3']);
      expect(formatInputArray([BigInt(100), BigInt(200)])).toEqual(['100', '200']);
      expect(formatInputArray(['0x64', '0xc8'])).toEqual(['100', '200']);
    });
  });

  describe('formatCircuitInputs', () => {
    it('should format circuit inputs', () => {
      const inputs = {
        amount: 100,
        nullifier: 0x123,
        pathElements: [1, 2, 3],
      };
      const formatted = formatCircuitInputs(inputs);

      expect(formatted).toEqual({
        amount: '100',
        nullifier: '291',
        pathElements: ['1', '2', '3'],
      });
    });
  });

  describe('formatWitness', () => {
    it('should convert bigint array to decimal strings', () => {
      const witness = [BigInt(1), BigInt(2), BigInt(3)];
      const formatted = formatWitness(witness);

      expect(formatted).toEqual(['1', '2', '3']);
    });

    it('should convert number array to decimal strings', () => {
      const witness = [1, 2, 3];
      const formatted = formatWitness(witness);

      expect(formatted).toEqual(['1', '2', '3']);
    });

    it('should pass through decimal string array', () => {
      const witness = ['1', '2', '3'];
      const formatted = formatWitness(witness);

      expect(formatted).toEqual(['1', '2', '3']);
    });

    it('should convert hex strings to decimal', () => {
      const witness = ['0x01', '0x02', '0x03'];
      const formatted = formatWitness(witness);

      expect(formatted).toEqual(['1', '2', '3']);
    });
  });

  describe('formatProofToHex', () => {
    it('should convert proof bytes to hex', () => {
      const bytes = new Uint8Array(128);
      bytes[0] = 0xab;
      bytes[1] = 0xcd;

      const hex = formatProofToHex(bytes);

      expect(hex).toMatch(/^0x[0-9a-f]{256}$/);
      expect(hex.substring(0, 6)).toBe('0xabcd');
    });

    it('should reject invalid proof size', () => {
      const bytes = new Uint8Array(64);

      expect(() => formatProofToHex(bytes)).toThrow(/Invalid proof size/);
    });
  });

  describe('parseProofHex', () => {
    it('should parse valid proof hex', () => {
      const hex = '0x' + '00'.repeat(128);
      const bytes = parseProofHex(hex);

      expect(bytes.length).toBe(128);
      expect(bytes[0]).toBe(0);
    });

    it('should reject invalid hex length', () => {
      const hex = '0x' + '00'.repeat(64);

      expect(() => parseProofHex(hex)).toThrow(/Invalid proof hex length/);
    });
  });

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
