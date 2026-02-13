/**
 * Test: Utils
 */

import {
  bigIntToHexLE,
  witnessToHexLE,
  validateInputs,
  validateProofSize,
  validatePublicSignals,
  hexToBytes,
  bytesToHex,
} from '../src/utils';

describe('Utils', () => {
  describe('bigIntToHexLE', () => {
    it('should convert bigint to hex little-endian', () => {
      const value = BigInt(1);
      const hex = bigIntToHexLE(value);

      expect(hex).toMatch(/^0x[0-9a-f]{64}$/);
      expect(hex).toBe('0x0100000000000000000000000000000000000000000000000000000000000000');
    });

    it('should handle large numbers', () => {
      const value = BigInt('123456789012345678901234567890');
      const hex = bigIntToHexLE(value);

      expect(hex).toMatch(/^0x[0-9a-f]{64}$/);
      // Verify always 32 bytes (64 hex chars + 0x)
      expect(hex.length).toBe(66);
    });

    it('should handle zero', () => {
      const value = BigInt(0);
      const hex = bigIntToHexLE(value);

      expect(hex).toBe('0x' + '0'.repeat(64));
    });

    it('should maintain correct byte order (little-endian)', () => {
      // 256 in little-endian is 0x0001... (256 = 0x100)
      const value = BigInt(256);
      const hex = bigIntToHexLE(value);

      // In LE: first byte is 0x00, second is 0x01
      expect(hex.substring(0, 6)).toBe('0x0001');
    });
  });

  describe('witnessToHexLE', () => {
    it('should convert witness array to hex LE', () => {
      const witness = [BigInt(1), BigInt(2), BigInt(3)];
      const hexArray = witnessToHexLE(witness);

      expect(hexArray).toHaveLength(3);
      hexArray.forEach(hex => {
        expect(hex).toMatch(/^0x[0-9a-f]{64}$/);
      });
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

  describe('hexToBytes / bytesToHex', () => {
    it('should convert hex to bytes', () => {
      const hex = '0x0102030405';
      const bytes = hexToBytes(hex);

      expect(bytes).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
    });

    it('should convert bytes to hex', () => {
      const bytes = new Uint8Array([1, 2, 3, 4, 5]);
      const hex = bytesToHex(bytes);

      expect(hex).toBe('0x0102030405');
    });

    it('should roundtrip correctly', () => {
      const original = '0xabcdef1234567890';
      const bytes = hexToBytes(original);
      const result = bytesToHex(bytes);

      expect(result.toLowerCase()).toBe(original.toLowerCase());
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
        /Invalid proof size.*expected 128 bytes.*got 64 bytes/
      );
    });

    it('should reject 256-byte proof (uncompressed)', () => {
      const proof = '0x' + '00'.repeat(256);
      expect(() => validateProofSize(proof)).toThrow(
        /Invalid proof size.*expected 128 bytes.*got 256 bytes/
      );
    });

    it('should reject empty proof', () => {
      const proof = '0x';
      expect(() => validateProofSize(proof)).toThrow(
        /Invalid proof size.*expected 128 bytes.*got 0 bytes/
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
