import { describe, it, expect } from 'vitest';
import { CircuitType, CIRCUIT_ID, circuitTypeToId } from '../../src/circuits/types';

/**
 * Anti-drift guard for the CircuitType → on-chain id mapping.
 *
 * The numeric ids are the node's source of truth
 * (node/frame/zk-verifier/src/types.rs): TRANSFER=1, UNSHIELD=2. Three layers
 * (node, this package, wallet-sdk) must agree — a wrong id silently queries the
 * wrong circuit's VK/version. Ids are never reused, so retired ones leave
 * permanent gaps.
 */
const NODE_CIRCUIT_IDS: Record<CircuitType, number> = {
  [CircuitType.Transfer]: 1,
  [CircuitType.Unshield]: 2,
};

describe('CircuitType → on-chain id mapping', () => {
  it('matches the node CircuitId constants exactly', () => {
    expect(CIRCUIT_ID).toEqual(NODE_CIRCUIT_IDS);
  });

  it('covers every CircuitType (no circuit left unmapped)', () => {
    for (const circuit of Object.values(CircuitType)) {
      expect(CIRCUIT_ID[circuit]).toBeTypeOf('number');
    }
  });

  it('circuitTypeToId resolves each known circuit', () => {
    expect(circuitTypeToId(CircuitType.Transfer)).toBe(1);
    expect(circuitTypeToId(CircuitType.Unshield)).toBe(2);
  });

  // Ids 5 (private_link) and 6 (value_proof) belong to retired circuits the
  // runtime no longer implements. Mapping them would let this package build
  // proofs the chain answers with CircuitNotFound.
  it('does not map a retired id', () => {
    expect(Object.values(CIRCUIT_ID)).not.toContain(5);
    expect(Object.values(CIRCUIT_ID)).not.toContain(6);
  });

  it('fails closed on an unknown circuit (throws, never defaults to 0)', () => {
    expect(() => circuitTypeToId('bogus' as CircuitType)).toThrow(/Unknown circuit type/);
  });
});
