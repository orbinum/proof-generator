import { CircuitType, CircuitConfig } from './types';

/**
 * Public signals per circuit and version. A version is a published circuit, so
 * its arity is fixed forever; a new layout is a new version.
 *
 * v2 appends `memo_hash` to transfer and unshield, binding the encrypted memos
 * to the proof.
 */
const PUBLIC_SIGNALS: Record<CircuitType, Record<number, number>> = {
  // v1: [merkle_root, nullifier, amount, recipient, asset_id, fee, change_commitment]
  [CircuitType.Unshield]: { 1: 7, 2: 8 },
  // v1: [merkle_root, nullifiers[2], commitments[2], asset_id, fee]
  [CircuitType.Transfer]: { 1: 7, 2: 8 },
};

/**
 * The shape (name, expected public signals) of one version of a circuit
 * (default version 1).
 *
 * Fail-closed: an unknown circuit or version throws rather than guessing an
 * arity, since a wrong count would validate a proof against the wrong statement.
 */
export function getCircuitConfig(circuitType: CircuitType, circuitVersion = 1): CircuitConfig {
  const byVersion = PUBLIC_SIGNALS[circuitType];
  if (!byVersion) {
    throw new Error(`Unknown circuit type: ${circuitType}`);
  }
  const expectedPublicSignals = byVersion[circuitVersion];
  if (expectedPublicSignals === undefined) {
    throw new Error(`Unknown version ${circuitVersion} for circuit ${circuitType}`);
  }
  return { name: circuitType, version: circuitVersion, expectedPublicSignals };
}
