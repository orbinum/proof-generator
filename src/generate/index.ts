import { CircuitType, CircuitInputs, ProofResult } from '../circuits/types';
import { InvalidInputsError, ProofGenerationError } from '../errors';
import { getCircuitConfig } from '../circuits/config';
import { validateInputs, validatePublicSignals } from '../utils/validation';
import { GenerateOptions } from './types';
import { resolveProvider } from './provider';
import { runSnarkjsBackend } from './backends/snarkjs';
import { runArkworksBackend } from './backends/arkworks';

export type { GenerateOptions } from './types';

export async function generateProof(
  circuitType: CircuitType,
  inputs: CircuitInputs,
  options: GenerateOptions = {}
): Promise<ProofResult> {
  const { verbose = false, backend = 'snarkjs' } = options;
  const provider = resolveProvider(options.provider);
  const config = getCircuitConfig(circuitType);

  if (verbose) {
    console.log(
      `[proof-generator] Generating proof for circuit: ${config.name} (backend: ${backend})`
    );
  }

  try {
    validateInputs(inputs);
  } catch (error) {
    throw new InvalidInputsError((error as Error).message);
  }

  const proofResult =
    backend === 'arkworks'
      ? await runArkworksBackend(circuitType, inputs, provider, config, verbose)
      : await runSnarkjsBackend(circuitType, inputs, provider, config, verbose);

  try {
    validatePublicSignals(proofResult.publicSignals, config.expectedPublicSignals);
  } catch (error) {
    throw new ProofGenerationError((error as Error).message);
  }

  if (verbose) {
    console.log('[proof-generator] Proof generation completed successfully.');
  }

  return { proof: proofResult.proof, publicSignals: proofResult.publicSignals, circuitType };
}
