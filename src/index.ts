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
import { getCircuitConfig, NodeArtifactProvider, WebArtifactProvider } from './circuits';
import * as snarkjs from 'snarkjs';
import { compressSnarkjsProofWasm } from './wasm-loader';
import {
  validateInputs,
  validatePublicSignals,
  formatProofHexForDisplay,
  formatPublicSignalsArray,
  validateProofSize,
} from './utils';
import { ArtifactProvider } from './provider';

/**
 * Generate a ZK-SNARK proof for an Orbinum circuit
 *
 * @param circuitType - Type of circuit (Unshield, Transfer, Disclosure)
 * @param inputs - Circuit inputs (structure depends on circuit type)
 * @param options - Configuration including artifact provider
 */
export async function generateProof(
  circuitType: CircuitType,
  inputs: CircuitInputs,
  options: {
    verbose?: boolean;
    provider?: ArtifactProvider;
  } = {}
): Promise<ProofResult> {
  const { verbose = false } = options;

  // Step 0: Determine provider
  let provider = options.provider;

  if (!provider) {
    if (typeof window !== 'undefined' || typeof self !== 'undefined') {
      // Browser environment: Use WebArtifactProvider (Fetch)
      provider = new WebArtifactProvider();
    } else {
      // Node.js environment: Use NodeArtifactProvider (FS)
      provider = new NodeArtifactProvider();
    }
  }

  // provider is guaranteed to be defined here
  const activeProvider = provider!;

  // Step 1: Get circuit config
  const config = getCircuitConfig(circuitType);

  if (verbose) {
    console.log(`\n🔐 Generating proof for circuit: ${config.name}`);
  }

  // Step 2: Validate inputs
  try {
    validateInputs(inputs);
  } catch (error) {
    throw new InvalidInputsError((error as Error).message);
  }

  // Step 3: Fetch artifacts via provider
  let wasmBinary: Uint8Array | string;
  let zkeyBinary: Uint8Array | string;

  try {
    if (verbose) console.log('   Fetching circuit artifacts...');
    [wasmBinary, zkeyBinary] = await Promise.all([
      activeProvider.getCircuitWasm(circuitType),
      activeProvider.getCircuitZkey(circuitType),
    ]);
  } catch (error) {
    if (verbose) console.error(`Failed to load artifacts: ${(error as Error).message}`);
    throw new CircuitNotFoundError(circuitType);
  }

  // Step 4: Generate proof with snarkjs
  if (verbose) {
    console.log('\n📊 Step 1: Generating witness + proof with snarkjs...');
  }

  let proofResult;
  try {
    // snarkjs fullProve accepts Buffers/Uint8Arrays directly
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      inputs,
      wasmBinary,
      zkeyBinary
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

// Re-export types and utilities for convenience
export * from './types';
export * from './utils';
export * from './provider';
export { NodeArtifactProvider, WebArtifactProvider } from './circuits';
export { generateDisclosureProof } from './disclosure';
