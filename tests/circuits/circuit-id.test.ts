import { describe, it, expect } from 'vitest';
import { CircuitType, CIRCUIT_ID, circuitTypeToId } from '../../src/circuits/types';

/**
 * Anti-drift guard for the CircuitType → on-chain id mapping.
 *
 * The numeric ids are the node's source of truth
 * (node/frame/zk-verifier/src/types.rs): TRANSFER=1, UNSHIELD=2, VALUE_PROOF=6.
 * Three layers (node, this package, ts-sdk) must agree — a wrong id silently
 * queries the wrong circuit's VK/version. VALUE_PROOF=6 is the non-obvious one
 * (a prior ts-sdk had it at 4); this test locks it. Ids are never reused, so
 * the gaps in the sequence are permanent.
 */
const NODE_CIRCUIT_IDS: Record<CircuitType, number> = {
  [CircuitType.Transfer]: 1,
  [CircuitType.Unshield]: 2,
  [CircuitType.ValueProof]: 6,
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

  it('value_proof is 6 (not 4, not sequential)', () => {
    expect(circuitTypeToId(CircuitType.ValueProof)).toBe(6);
  });

  it('circuitTypeToId resolves each known circuit', () => {
    expect(circuitTypeToId(CircuitType.Transfer)).toBe(1);
    expect(circuitTypeToId(CircuitType.Unshield)).toBe(2);
    expect(circuitTypeToId(CircuitType.ValueProof)).toBe(6);
  });

  // Id 5 belongs to a retired circuit the runtime no longer implements.
  // Mapping it here would let this package build proofs the chain answers
  // with CircuitNotFound.
  it('does not map id 5', () => {
    expect(Object.values(CIRCUIT_ID)).not.toContain(5);
  });

  it('fails closed on an unknown circuit (throws, never defaults to 0)', () => {
    expect(() => circuitTypeToId('bogus' as CircuitType)).toThrow(/Unknown circuit type/);
  });
});
