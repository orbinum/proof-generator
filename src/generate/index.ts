import { CircuitType, CircuitInputs, ProofResult } from '../circuits/types';
import { InvalidInputsError, ProofGenerationError } from '../errors';
import { getCircuitConfig } from '../circuits/config';
import { validateInputs, validatePublicSignals } from '../utils/validation';
import { GenerateOptions } from './types';
import { resolveProvider } from './provider';
import { runSnarkjsBackend } from './backends/snarkjs';
import { runArkworksBackend } from './backends/arkworks';
import { shouldProveSingleThreaded } from './environment';
import { resolveCircuitVersion } from './version';

export type { GenerateOptions } from './types';
export { shouldProveSingleThreaded } from './environment';

/**
 * Proves `inputs` against one circuit and returns the 128-byte compressed proof.
 *
 * The circuit version is the provider's when it reports one (`circuitVersion`,
 * if given, must match), else `circuitVersion`, else 1; the proof is checked
 * against that version's public-signal count. The version, its shape and the
 * inputs are validated before any proving.
 */
export async function generateProof(
  circuitType: CircuitType,
  inputs: CircuitInputs,
  options: GenerateOptions = {}
): Promise<ProofResult> {
  const { verbose = false, backend = 'snarkjs' } = options;
  const singleThread = options.singleThread ?? shouldProveSingleThreaded();
  const provider = resolveProvider(options.provider);
  // Resolved before any proving: an unknown or mismatched version fails in
  // milliseconds instead of after seconds of work.
  const version = await resolveCircuitVersion(provider, circuitType, options.circuitVersion);
  const config = getCircuitConfig(circuitType, version);

  if (verbose) {
    console.log(
      `[proof-generator] Generating proof for circuit: ${config.name} v${version} (backend: ${backend})`
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
      : await runSnarkjsBackend(circuitType, inputs, provider, config, verbose, singleThread);

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
