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
  WitnessCalculationError,
  ProofGenerationError,
  InvalidInputsError,
} from './types';
import { getCircuitConfig } from './circuits';
import * as circuitsInternal from './circuits';
import { calculateWitness } from './witness';
import { validateInputs, validatePublicSignals, formatProofHex } from './utils';
import { initWasm, generateProofWasm } from './wasm-loader';
import { getCircuitProvingKeyPath } from './config';

/**
 * Generate a ZK-SNARK proof for an Orbinum circuit
 *
 * This is the main entry point for proof generation. It:
 * 1. Validates inputs and circuit artifacts
 * 2. Calculates witness using snarkjs
 * 3. Generates proof using Rust/arkworks
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

  // Step 0: Initialize WASM
  if (verbose) {
    console.log('⚙️  Initializing WASM module for proof generation');
  }
  await initWasm();

  // Step 1: Get circuit config
  const config = getCircuitConfig(circuitType);
  if (!config) {
    throw new CircuitNotFoundError(circuitType);
  }

  if (verbose) {
    console.log(`\n🔐 Generating proof for circuit: ${config.name}`);
    console.log(`   WASM: ${config.wasmPath}`);
    console.log(`   Proving key: ${config.provingKeyPath}`);
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
      circuitsInternal.validateCircuitArtifacts(config);
    } catch (error) {
      throw new CircuitNotFoundError(circuitType);
    }
  }

  // Step 4: Calculate witness with snarkjs
  if (verbose) {
    console.log('\n📊 Step 1: Calculating witness...');
  }

  let witnessData;
  try {
    witnessData = await calculateWitness(inputs, config.wasmPath);

    if (verbose) {
      console.log(`   ✅ Witness calculated: ${witnessData.witness.length} elements`);
    }
  } catch (error) {
    throw new WitnessCalculationError((error as Error).message);
  }

  // Step 5: Generate proof using WASM
  if (verbose) {
    console.log('\n🔐 Step 2: Generating proof with WASM...');
  }

  let proofResult;
  try {
    const fs = await import('fs/promises');
    const provingKeyPath = getCircuitProvingKeyPath(circuitType);
    const provingKeyBytes = await fs.readFile(provingKeyPath);

    const output = await generateProofWasm(
      circuitType.toLowerCase() as 'unshield' | 'transfer' | 'disclosure',
      JSON.stringify(witnessData.witness),
      new Uint8Array(provingKeyBytes)
    );

    proofResult = {
      proof: output.proof,
      publicSignals: output.publicSignals,
    };

    if (verbose) {
      console.log(`   ✅ Proof generated: ${formatProofHex(proofResult.proof, 32)}`);
      console.log(`   ✅ Public signals: ${proofResult.publicSignals.length}`);
    }
  } catch (error) {
    throw new ProofGenerationError((error as Error).message);
  }

  // Step 6: Validate public signals count
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
 * Quick check if proof generator is ready to use
 * Checks if WASM is compiled and circuits are available
 */
function isReady(): boolean {
  try {
    const fs = require('fs');
    const path = require('path');

    // Check if WASM was compiled
    const wasmPath = path.join(__dirname, '../groth16-proof/groth16_proofs_bg.wasm');
    if (!fs.existsSync(wasmPath)) {
      return false;
    }

    // Check if random circuit is available (lazy validation)
    const allCircuitTypes = [CircuitType.Unshield, CircuitType.Transfer, CircuitType.Disclosure];
    const randomCircuitType = allCircuitTypes[Math.floor(Math.random() * allCircuitTypes.length)];
    const config = getCircuitConfig(randomCircuitType);

    if (!fs.existsSync(config.provingKeyPath)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// Re-export types and utilities for convenience
export * from './types'; // CircuitType, CircuitInputs, etc.
export { isReady }; // Check if WASM and circuits are ready
export { calculateWitness } from './witness'; // Advanced: direct witness calculation
export * from './utils'; // Validation helpers for users
