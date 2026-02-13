/**
 * Circuit Configuration
 *
 * Defines paths and metadata for all supported circuits
 */

import * as path from 'path';
import { CircuitType, CircuitConfig } from './types';

/** Base path to circuits directory (relative to this file) */
const CIRCUITS_BASE = path.join(__dirname, '../circuits');

/** Circuit configurations */
export const CIRCUIT_CONFIGS: Record<CircuitType, CircuitConfig> = {
  [CircuitType.Unshield]: {
    name: 'unshield',
    wasmPath: path.join(CIRCUITS_BASE, 'unshield.wasm'),
    provingKeyPath: path.join(CIRCUITS_BASE, 'unshield_pk.ark'),
    expectedPublicSignals: 5, // merkle_root, nullifier, amount, recipient, asset_id
  },

  [CircuitType.Transfer]: {
    name: 'transfer',
    wasmPath: path.join(CIRCUITS_BASE, 'transfer.wasm'),
    provingKeyPath: path.join(CIRCUITS_BASE, 'transfer_pk.ark'),
    expectedPublicSignals: 5, // merkle_root, input_nullifiers(2), output_commitments(2)
  },

  [CircuitType.Disclosure]: {
    name: 'disclosure',
    wasmPath: path.join(CIRCUITS_BASE, 'disclosure.wasm'),
    provingKeyPath: path.join(CIRCUITS_BASE, 'disclosure_pk.ark'),
    expectedPublicSignals: 4, // commitment, vk_hash, mask, revealed_owner_hash
  },
};

/**
 * Get circuit configuration
 */
export function getCircuitConfig(circuitType: CircuitType): CircuitConfig {
  return CIRCUIT_CONFIGS[circuitType];
}

/**
 * Validate that circuit artifacts exist
 */
export function validateCircuitArtifacts(config: CircuitConfig): void {
  const fs = require('fs');

  if (!fs.existsSync(config.wasmPath)) {
    throw new Error(`WASM not found: ${config.wasmPath}`);
  }

  if (!fs.existsSync(config.provingKeyPath)) {
    throw new Error(`Proving key not found: ${config.provingKeyPath}`);
  }
}
