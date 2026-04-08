import { describe, it, expect } from 'vitest';
import {
  validateInputs,
  validatePublicSignals,
  validateProofSize,
} from '../../src/utils/validation';

describe('validateInputs', () => {
  it('passes for a valid inputs object', () => {
    expect(() => validateInputs({ a: '1', b: '2' })).not.toThrow();
  });

  it('throws when inputs is null', () => {
    expect(() => validateInputs(null as any)).toThrow('Inputs must be an object');
  });

  it('throws when inputs is not an object', () => {
    expect(() => validateInputs('string' as any)).toThrow('Inputs must be an object');
    expect(() => validateInputs(42 as any)).toThrow('Inputs must be an object');
  });

  it('throws when a field is undefined', () => {
    expect(() => validateInputs({ a: undefined })).toThrow('"a" is undefined or null');
  });

  it('throws when a field is null', () => {
    expect(() => validateInputs({ commitment: null })).toThrow('"commitment" is undefined or null');
  });

  it('passes for numeric and array values', () => {
    expect(() =>
      validateInputs({ scalar: 1, array: ['1', '2'], nested: [['1'], ['2']] })
    ).not.toThrow();
  });

  it('passes for empty object', () => {
    expect(() => validateInputs({})).not.toThrow();
  });
});

describe('validatePublicSignals', () => {
  it('passes when count matches expected', () => {
    expect(() => validatePublicSignals(['a', 'b', 'c'], 3)).not.toThrow();
  });

  it('throws when count is too low', () => {
    expect(() => validatePublicSignals(['a'], 3)).toThrow(
      'Invalid public signals count: expected 3, got 1'
    );
  });

  it('throws when count is too high', () => {
    expect(() => validatePublicSignals(['a', 'b', 'c', 'd'], 3)).toThrow(
      'Invalid public signals count: expected 3, got 4'
    );
  });

  it('passes for empty signals when expected is 0', () => {
    expect(() => validatePublicSignals([], 0)).not.toThrow();
  });
});

describe('validateProofSize', () => {
  const validProof = '0x' + 'ab'.repeat(128); // 256 hex chars = 128 bytes

  it('passes for a valid 128-byte proof (with 0x prefix)', () => {
    expect(() => validateProofSize(validProof)).not.toThrow();
  });

  it('passes for a valid 128-byte proof (without 0x prefix)', () => {
    expect(() => validateProofSize('ab'.repeat(128))).not.toThrow();
  });

  it('throws when proof is too short', () => {
    expect(() => validateProofSize('0x' + 'ab'.repeat(64))).toThrow('Invalid proof size');
  });

  it('throws when proof is too long', () => {
    expect(() => validateProofSize('0x' + 'ab'.repeat(200))).toThrow('Invalid proof size');
  });

  it('throws for empty string', () => {
    expect(() => validateProofSize('')).toThrow('Invalid proof size');
  });

  it('includes expected and actual length in error message', () => {
    const shortProof = '0xabcd'; // 2 bytes
    expect(() => validateProofSize(shortProof)).toThrow('expected 256 hex chars');
  });
});
