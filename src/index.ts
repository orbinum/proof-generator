/**
 * Orbinum Proof Generator
 *
 * High-performance ZK-SNARK proof generator for Orbinum privacy protocol.
 * Combines snarkjs (witness calculation) with arkworks WASM (proof generation)
 * to produce 128-byte compressed Groth16 proofs.
 *
 * @module @orbinum/proof-generator
 */

import {
  CircuitType,
  CircuitInputs,
  ProofResult,
  CircuitNotFoundError,
  ProofGenerationError,
  InvalidInputsError,
} from './types';
import { getCircuitConfig, validateCircuitArtifacts } from './circuits';
import * as snarkjs from 'snarkjs';
import { compressSnarkjsProofWasm } from './wasm-loader';
import {
  validateInputs,
  validatePublicSignals,
  formatProofHexForDisplay,
  formatPublicSignalsArray,
  validateProofSize,
} from './utils';

/**
 * Generate a ZK-SNARK proof for an Orbinum circuit
 *
 * This is the main entry point for proof generation. It:
 * 1. Validates inputs and circuit artifacts
 * 2. Generates witness + proof using snarkjs.fullProve (.wasm + .zkey)
 * 3. Converts proof to arkworks compressed format (128 bytes)
 * 4. Returns compressed 128-byte proof + public signals
 *
 * @param circuitType - Type of circuit (Unshield, Transfer, Disclosure)
 * @param inputs - Circuit inputs (structure depends on circuit type)
 * @param options - Optional configuration
 * @returns Proof result with proof hex and public signals
 *
 * @example
 * ```typescript
 * const result = await generateProof(CircuitType.Unshield, {
 *   merkle_root: '...',
 *   nullifier: '...',
 *   amount: '100',
 *   recipient: '...',
 *   asset_id: '0',
 *   note_value: '100',
 *   note_asset_id: '0',
 *   note_owner: '...',
 *   note_blinding: '...',
 *   spending_key: '...',
 *   path_elements: [...],
 *   path_indices: [...]
 * });
 *
 * console.log('Proof:', result.proof); // 0x... (128 bytes)
 * console.log('Public signals:', result.publicSignals);
 * ```
 */
export async function generateProof(
  circuitType: CircuitType,
  inputs: CircuitInputs,
  options: {
    verbose?: boolean;
    validateArtifacts?: boolean;
  } = {}
): Promise<ProofResult> {
  const { verbose = false, validateArtifacts = true } = options;

  // Step 1: Get circuit config
  const config = getCircuitConfig(circuitType);
  if (!config) {
    throw new CircuitNotFoundError(circuitType);
  }

  if (verbose) {
    console.log(`\n🔐 Generating proof for circuit: ${config.name}`);
    console.log(`   WASM: ${config.wasmPath}`);
    console.log(`   zkey: ${config.zkeyPath}`);
  }

  // Step 2: Validate inputs
  try {
    validateInputs(inputs);
  } catch (error) {
    throw new InvalidInputsError((error as Error).message);
  }

  // Step 3: Validate artifacts (optional)
  if (validateArtifacts) {
    try {
      validateCircuitArtifacts(config);
    } catch (error) {
      throw new CircuitNotFoundError(circuitType);
    }
  }

  // Step 4: Generate proof with snarkjs
  if (verbose) {
    console.log('\n📊 Step 1: Generating witness + proof with snarkjs...');
  }

  let proofResult;
  try {
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      inputs,
      config.wasmPath,
      config.zkeyPath
    );

    const compressedProofHex = await compressSnarkjsProofWasm(proof as any);
    validateProofSize(compressedProofHex);

    const publicSignalsHex = formatPublicSignalsArray(publicSignals as string[]);

    proofResult = {
      proof: compressedProofHex,
      publicSignals: publicSignalsHex,
    };

    if (verbose) {
      console.log(`   ✅ Proof generated: ${formatProofHexForDisplay(proofResult.proof, 32)}`);
      console.log(`   ✅ Public signals: ${proofResult.publicSignals.length}`);
    }
  } catch (error) {
    throw new ProofGenerationError((error as Error).message);
  }

  // Step 5: Validate public signals count
  try {
    validatePublicSignals(proofResult.publicSignals, config.expectedPublicSignals);
  } catch (error) {
    throw new ProofGenerationError((error as Error).message);
  }

  if (verbose) {
    console.log('\n✅ Proof generation completed successfully!\n');
  }

  return {
    proof: proofResult.proof,
    publicSignals: proofResult.publicSignals,
    circuitType,
  };
}

/**
 * Check if proof generator is ready to use
 *
 * Verifies that WASM module and circuit artifacts are accessible.
 *
 * @returns true if ready, false otherwise
 */
export function isReady(): boolean {
  try {
    const fs = require('fs');

    // Check if Unshield circuit is available (fastest check)
    const config = getCircuitConfig(CircuitType.Unshield);

    return fs.existsSync(config.wasmPath) && fs.existsSync(config.zkeyPath);
  } catch {
    return false;
  }
}

// Re-export types and utilities for convenience
export * from './types'; // CircuitType, CircuitInputs, ProofResult, errors
export { calculateWitness } from './witness'; // Advanced: direct witness calculation
export * from './utils'; // Validation and formatting helpers
