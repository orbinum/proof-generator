import { CircuitType, CircuitConfig } from './types';

/**
 * Returns the circuit configuration (artifact filenames, expected public
 * signals) for the given circuit type.
 */
export function getCircuitConfig(circuitType: CircuitType): CircuitConfig {
  const name = circuitType.toLowerCase();
  return {
    name,
    wasmPath: `${name}.wasm`,
    zkeyPath: `${name}_pk.zkey`,
    provingKeyPath: `${name}_pk.ark`,
    expectedPublicSignals: getExpectedPublicSignals(circuitType),
  };
}

function getExpectedPublicSignals(circuitType: CircuitType): number {
  switch (circuitType) {
    case CircuitType.Unshield:
      // [merkle_root, nullifier, amount, recipient, asset_id, fee, change_commitment]
      return 7;
    case CircuitType.Transfer:
      // [merkle_root, nullifiers[2], commitments[2], asset_id, fee]
      return 7;
    case CircuitType.Disclosure:
      // outputs: [epk_x, epk_y, enc_value, enc_asset_id, enc_owner_hash] + inputs: [commitment, auditor_pk_x, auditor_pk_y]
      return 8;
    case CircuitType.PrivateLink:
      return 2;
    default:
      throw new Error(`Unknown circuit type: ${circuitType}`);
  }
}
