import { describe, it, expect } from 'vitest';
import {
  normalizeProofHex,
  formatProofHexForDisplay,
  formatPublicSignalsArray,
} from '../../src/utils/formatting';

const BN254_PRIME = BigInt(
  '21888242871839275222246405745257275088696311157297823662689037894645226208583'
);

describe('normalizeProofHex', () => {
  it('adds 0x prefix when missing', () => {
    expect(normalizeProofHex('deadbeef')).toBe('0xdeadbeef');
  });

  it('preserves existing 0x prefix', () => {
    expect(normalizeProofHex('0xdeadbeef')).toBe('0xdeadbeef');
  });

  it('lowercases hex characters', () => {
    expect(normalizeProofHex('0xDEADBEEF')).toBe('0xdeadbeef');
  });

  it('lowercases and adds prefix together', () => {
    expect(normalizeProofHex('ABCDEF')).toBe('0xabcdef');
  });
});

describe('formatProofHexForDisplay', () => {
  it('returns full string when shorter than maxLength', () => {
    expect(formatProofHexForDisplay('abc', 10)).toBe('abc');
  });

  it('returns full string when equal to maxLength', () => {
    const str = 'a'.repeat(10);
    expect(formatProofHexForDisplay(str, 10)).toBe(str);
  });

  it('truncates with ... when longer than maxLength', () => {
    const str = '0x' + 'a'.repeat(100);
    const result = formatProofHexForDisplay(str, 20);
    expect(result).toContain('...');
    expect(result.length).toBeLessThan(str.length);
  });

  it('uses default maxLength of 32', () => {
    const str = 'a'.repeat(40);
    const result = formatProofHexForDisplay(str);
    expect(result).toContain('...');
  });

  it('keeps first and last half-length characters', () => {
    const str = 'AAAAABBBBB'; // 10 chars
    const result = formatProofHexForDisplay(str, 4); // halfLen = 2
    expect(result).toBe('AA...BB');
  });
});

describe('formatPublicSignalsArray', () => {
  it('converts decimal string to 32-byte LE hex', () => {
    // value = 1 → LE hex = 01 followed by 31 zero bytes
    const result = formatPublicSignalsArray(['1']);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatch(/^0x/);
    expect(result[0]).toHaveLength(66); // 0x + 64 hex chars
  });

  it('converts 0 to all-zero hex', () => {
    const [result] = formatPublicSignalsArray([0]);
    expect(result).toBe('0x' + '00'.repeat(32));
  });

  it('accepts bigint input', () => {
    const [result] = formatPublicSignalsArray([1n]);
    expect(result).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('accepts number input', () => {
    const [result] = formatPublicSignalsArray([255]);
    expect(result).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('converts value 1 to little-endian: first byte is 01, rest are 00', () => {
    const [result] = formatPublicSignalsArray(['1']);
    // LE: byte[0] = 0x01, bytes[1..31] = 0x00
    expect(result.slice(2, 4)).toBe('01'); // first byte
    expect(result.slice(4)).toBe('00'.repeat(31)); // remaining bytes
  });

  it('converts value 256 to little-endian: bytes [00, 01, 00...]', () => {
    const [result] = formatPublicSignalsArray(['256']);
    expect(result.slice(2, 4)).toBe('00'); // byte 0
    expect(result.slice(4, 6)).toBe('01'); // byte 1
    expect(result.slice(6)).toBe('00'.repeat(30));
  });

  it('processes multiple signals', () => {
    const result = formatPublicSignalsArray(['1', '2', '3']);
    expect(result).toHaveLength(3);
    result.forEach(s => expect(s).toMatch(/^0x[0-9a-f]{64}$/));
  });

  it('throws when value is negative', () => {
    expect(() => formatPublicSignalsArray(['-1'])).toThrow();
  });

  it('throws when value exceeds BN254 prime', () => {
    const tooBig = BN254_PRIME.toString();
    expect(() => formatPublicSignalsArray([tooBig])).toThrow('out of BN254 field range');
  });
});
