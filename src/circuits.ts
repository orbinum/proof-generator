/**
 * Circuit Configuration
 *
 * Defines paths and metadata for all supported circuits using versioned npm packages.
 */

import { CircuitType, CircuitConfig } from './types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Get circuit configuration from local workspace artifacts
 */
export function getCircuitConfig(circuitType: CircuitType): CircuitConfig {
  const circuitName = circuitType.toLowerCase();
  const paths = getPackageCircuitPaths(circuitName);

  return {
    name: circuitName,
    wasmPath: paths.wasm,
    zkeyPath: paths.zkey,
    provingKeyPath: paths.ark,
    expectedPublicSignals: getExpectedPublicSignals(circuitType),
  };
}

/**
 * Resolve circuit artifact paths from the @orbinum/circuits npm package
 *
 * Searches for circuit artifacts (.wasm, _pk.ark, _pk.zkey) in common
 * package layouts: root, artifacts/, pkg/ directories.
 *
 * @param circuitName - Circuit name (e.g., 'unshield', 'transfer')
 * @returns Paths to circuit artifacts
 * @throws Error if package or artifacts not found
 */
function getPackageCircuitPaths(circuitName: string): { wasm: string; ark: string; zkey: string } {
  // Try to resolve @orbinum/circuits or orbinum-circuits package
  const packageCandidates = ['@orbinum/circuits/package.json', 'orbinum-circuits/package.json'];

  let packageRoot: string | null = null;
  let packageName: string | null = null;

  for (const candidate of packageCandidates) {
    try {
      packageRoot = path.dirname(require.resolve(candidate));
      packageName = candidate.replace('/package.json', '');
      break;
    } catch {
      continue;
    }
  }

  if (!packageRoot || !packageName) {
    throw new Error(
      'Cannot resolve @orbinum/circuits package. Install with: npm install @orbinum/circuits'
    );
  }

  // Search in common artifact locations
  const searchDirs = [
    packageRoot,
    path.join(packageRoot, 'artifacts'),
    path.join(packageRoot, 'pkg'),
  ];

  for (const dir of searchDirs) {
    const wasmPath = path.join(dir, `${circuitName}.wasm`);
    const arkPath = path.join(dir, `${circuitName}_pk.ark`);
    const zkeyPath = path.join(dir, `${circuitName}_pk.zkey`);

    if (fs.existsSync(wasmPath) && fs.existsSync(arkPath) && fs.existsSync(zkeyPath)) {
      return { wasm: wasmPath, ark: arkPath, zkey: zkeyPath };
    }
  }

  throw new Error(
    `Circuit artifacts for "${circuitName}" not found in ${packageName}. ` +
      `Searched directories: ${searchDirs.join(', ')}`
  );
}

/**
 * Get expected number of public signals for each circuit
 */
function getExpectedPublicSignals(circuitType: CircuitType): number {
  switch (circuitType) {
    case CircuitType.Unshield:
      return 5; // merkle_root, nullifier, amount, recipient, asset_id
    case CircuitType.Transfer:
      return 5; // merkle_root, input_nullifiers(2), output_commitments(2)
    case CircuitType.Disclosure:
      return 4; // commitment, vk_hash, mask, revealed_owner_hash
    default:
      throw new Error(`Unknown circuit type: ${circuitType}`);
  }
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

  if (!fs.existsSync(config.zkeyPath)) {
    throw new Error(`zkey not found: ${config.zkeyPath}`);
  }
}
