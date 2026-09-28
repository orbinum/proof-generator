import { describe, it, expect } from 'vitest';
import { getCircuitConfig } from '../../src/circuits/config';
import { CircuitType } from '../../src/circuits/types';

describe('getCircuitConfig', () => {
  it('v1: seven public signals for unshield and transfer', () => {
    // unshield: [merkle_root, nullifier, amount, recipient, asset_id, fee, change_commitment]
    expect(getCircuitConfig(CircuitType.Unshield, 1)).toEqual({
      name: 'unshield',
      version: 1,
      expectedPublicSignals: 7,
    });
    // transfer: [merkle_root, nullifiers[2], commitments[2], asset_id, fee]
    expect(getCircuitConfig(CircuitType.Transfer, 1).expectedPublicSignals).toBe(7);
  });

  it('v2: memo_hash is an extra, last public signal', () => {
    expect(getCircuitConfig(CircuitType.Unshield, 2)).toEqual({
      name: 'unshield',
      version: 2,
      expectedPublicSignals: 8,
    });
    expect(getCircuitConfig(CircuitType.Transfer, 2).expectedPublicSignals).toBe(8);
  });

  it('defaults to version 1', () => {
    expect(getCircuitConfig(CircuitType.Transfer)).toEqual(
      getCircuitConfig(CircuitType.Transfer, 1)
    );
  });

  it('rejects an unknown version rather than guessing an arity', () => {
    expect(() => getCircuitConfig(CircuitType.Unshield, 3)).toThrow('Unknown version 3');
    expect(() => getCircuitConfig(CircuitType.Transfer, 0)).toThrow('Unknown version 0');
  });

  it('rejects an unknown circuit, including the removed value_proof', () => {
    expect(() => getCircuitConfig('value_proof' as CircuitType)).toThrow('Unknown circuit type');
  });
});
