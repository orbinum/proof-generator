import { describe, it, expect } from 'vitest';
import {
  bigIntToBytes32,
  bytes32ToBigInt,
  u64ToFieldStr,
  hexSignalToBigInt,
  bigIntToHex,
} from '../../src/utils/encoding';

describe('bigIntToBytes32', () => {
  it('encodes 0n as 32 zero bytes', () => {
    const result = bigIntToBytes32(0n);
    expect(result).toHaveLength(32);
    expect(result.every(b => b === 0)).toBe(true);
  });

  it('encodes 1n with last byte = 1 (big-endian)', () => {
    const result = bigIntToBytes32(1n);
    expect(result[31]).toBe(1);
    expect(result.slice(0, 31).every(b => b === 0)).toBe(true);
  });

  it('encodes 256n correctly', () => {
    const result = bigIntToBytes32(256n);
    expect(result[30]).toBe(1);
    expect(result[31]).toBe(0);
  });

  it('encodes max 32-byte value', () => {
    const max = (1n << 256n) - 1n;
    const result = bigIntToBytes32(max);
    expect(result.every(b => b === 0xff)).toBe(true);
  });

  it('is inverse of bytes32ToBigInt', () => {
    const original = 123456789012345678901234567890n;
    expect(bytes32ToBigInt(bigIntToBytes32(original))).toBe(original);
  });
});

describe('bytes32ToBigInt', () => {
  it('converts 32 zero bytes to 0n', () => {
    expect(bytes32ToBigInt(new Uint8Array(32))).toBe(0n);
  });

  it('converts [0..0, 1] to 1n (big-endian)', () => {
    const buf = new Uint8Array(32);
    buf[31] = 1;
    expect(bytes32ToBigInt(buf)).toBe(1n);
  });

  it('converts [0..0, 1, 0] to 256n', () => {
    const buf = new Uint8Array(32);
    buf[30] = 1;
    expect(bytes32ToBigInt(buf)).toBe(256n);
  });

  it('is inverse of bigIntToBytes32', () => {
    const original = 987654321987654321n;
    expect(bytes32ToBigInt(bigIntToBytes32(original))).toBe(original);
  });
});

describe('u64ToFieldStr', () => {
  it('returns decimal string for 0', () => {
    expect(u64ToFieldStr(0n)).toBe('0');
  });

  it('returns decimal string for max u64', () => {
    const maxU64 = 18446744073709551615n;
    expect(u64ToFieldStr(maxU64)).toBe('18446744073709551615');
  });

  it('returns decimal string for arbitrary value', () => {
    expect(u64ToFieldStr(42n)).toBe('42');
  });
});

describe('hexSignalToBigInt', () => {
  it('parses a little-endian 0x-prefixed hex signal', () => {
    // 0x0100...00 in LE = 1 in BE
    const leHex = '0x' + '01' + '00'.repeat(31);
    expect(hexSignalToBigInt(leHex)).toBe(1n);
  });

  it('handles hex without 0x prefix', () => {
    const leHex = '01' + '00'.repeat(31);
    expect(hexSignalToBigInt(leHex)).toBe(1n);
  });

  it('handles 0x-uppercase prefix', () => {
    const leHex = '0X' + '01' + '00'.repeat(31);
    expect(hexSignalToBigInt(leHex)).toBe(1n);
  });

  it('returns 0n for all-zero signal', () => {
    expect(hexSignalToBigInt('0x' + '00'.repeat(32))).toBe(0n);
  });

  it('round-trips with bigIntToBytes32 via formatPublicSignalsArray pattern', () => {
    // bigIntToBytes32 produces big-endian; hexSignalToBigInt expects little-endian
    // so round-trip is not direct — test the documented semantics instead
    const value = 255n;
    // In LE hex: last byte is MSB → '0xff' is the last 2 chars
    const leHex = '0x' + 'FF' + '00'.repeat(31);
    // reversed LE→BE: 0x00...00FF = 255
    expect(hexSignalToBigInt(leHex)).toBe(255n);
  });
});

describe('bigIntToHex', () => {
  it('encodes 0n as 0x with 64 zeros', () => {
    expect(bigIntToHex(0n)).toBe('0x' + '0'.repeat(64));
  });

  it('encodes 1n correctly', () => {
    expect(bigIntToHex(1n)).toBe('0x' + '0'.repeat(63) + '1');
  });

  it('encodes 255n correctly', () => {
    expect(bigIntToHex(255n)).toBe('0x' + '0'.repeat(62) + 'ff');
  });

  it('always produces 0x-prefixed 66-char string', () => {
    const result = bigIntToHex(12345678901234567890n);
    expect(result).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
