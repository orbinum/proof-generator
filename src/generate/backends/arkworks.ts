import * as snarkjs from 'snarkjs';
import { CircuitType, CircuitInputs, CircuitConfig } from '../../circuits/types';
import { CircuitNotFoundError, ProofGenerationError } from '../../errors';
import { ArtifactProvider } from '../../providers/interface';
import { generateProofFromWitnessWasm } from '../../wasm/loader';
import { validateProofSize } from '../../utils/validation';

/**
 * Generates a Groth16 proof using the arkworks backend:
 * calculates the witness with snarkjs (in-memory), then delegates
 * proof generation to the arkworks WASM module via the .ark proving key.
 */
export async function runArkworksBackend(
  circuitType: CircuitType,
  inputs: CircuitInputs,
  provider: ArtifactProvider,
  config: CircuitConfig,
  verbose: boolean
): Promise<{ proof: string; publicSignals: string[] }> {
  let wasmBinary: Uint8Array | string;
  let provingKeyBytes: Uint8Array;

  try {
    if (verbose) console.log('[proof-generator] Fetching WASM + .ark proving key...');
    if (!provider.getCircuitProvingKey) {
      throw new Error(
        'Provider does not support getCircuitProvingKey (required for arkworks backend)'
      );
    }
    [wasmBinary, provingKeyBytes] = await Promise.all([
      provider.getCircuitWasm(circuitType),
      provider.getCircuitProvingKey(circuitType),
    ]);
  } catch (error) {
    if (verbose)
      console.error(`[proof-generator] Failed to load artifacts: ${(error as Error).message}`);
    throw new CircuitNotFoundError(circuitType);
  }

  try {
    if (verbose) console.log('[proof-generator] Step 1: Calculating witness with snarkjs...');
    const wtnsBuffer: { type: 'mem'; data?: Uint8Array } = { type: 'mem' };
    await (snarkjs as any).wtns.calculate(inputs, wasmBinary, wtnsBuffer);

    if (verbose) console.log('[proof-generator] Step 2: Generating proof with arkworks WASM...');
    const witnessArray: bigint[] = await (snarkjs as any).wtns.exportJson(wtnsBuffer);
    const witnessDecimalJson = JSON.stringify(witnessArray.map(v => v.toString()));

    const arkResult = await generateProofFromWitnessWasm(
      config.expectedPublicSignals,
      witnessDecimalJson,
      provingKeyBytes
    );
    validateProofSize(arkResult.proof);

    return arkResult;
  } catch (error) {
    throw new ProofGenerationError((error as Error).message);
  }
}
