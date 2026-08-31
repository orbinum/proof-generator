import { CircuitType, CircuitInputs, CircuitConfig } from '../../circuits/types';
import { CircuitNotFoundError, ProofGenerationError } from '../../errors';
import { ArtifactProvider } from '../../providers/interface';
import { compressSnarkjsProofWasm } from '../../wasm/loader';
import { validateProofSize } from '../../utils/validation';
import { formatProofHexForDisplay, formatPublicSignalsArray } from '../../utils/formatting';

/**
 * snarkjs, loaded on first use rather than at module scope.
 *
 * A static `import * as snarkjs` is a hard graph edge: it puts ~480 KB into
 * every consumer's bundle, including one that only names `CircuitType` and
 * never proves anything. Measured under 6.0.0: importing that single enum
 * bundled to 1,539,822 bytes.
 *
 * Both call sites are already async, so the load costs nothing a caller was
 * not already awaiting — and proving takes seconds.
 */
async function loadSnarkjs(): Promise<typeof import('snarkjs')> {
  return import('snarkjs');
}

/**
 * Generates a Groth16 proof using the snarkjs backend:
 * fetches WASM + zkey artifacts, runs `groth16.fullProve`,
 * then compresses the proof to the 128-byte arkworks canonical format.
 */
export async function runSnarkjsBackend(
  circuitType: CircuitType,
  inputs: CircuitInputs,
  provider: ArtifactProvider,
  config: CircuitConfig,
  verbose: boolean,
  singleThread = false
): Promise<{ proof: string; publicSignals: string[] }> {
  let wasmBinary: Uint8Array | string;
  let zkeyBinary: Uint8Array | string;

  try {
    if (verbose) console.log('[proof-generator] Fetching circuit artifacts...');
    [wasmBinary, zkeyBinary] = await Promise.all([
      provider.getCircuitWasm(circuitType),
      provider.getCircuitZkey(circuitType),
    ]);
  } catch (error) {
    if (verbose)
      console.error(`[proof-generator] Failed to load artifacts: ${(error as Error).message}`);
    throw new CircuitNotFoundError(circuitType);
  }

  if (verbose) {
    console.log(
      `[proof-generator] Step 1: Generating witness + proof with snarkjs` +
        `${singleThread ? ' (single-threaded)' : ''}...`
    );
  }

  try {
    const snarkjs = await loadSnarkjs();
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      inputs,
      wasmBinary,
      zkeyBinary,
      undefined,
      undefined,
      { singleThread }
    );

    const compressedProofHex = await compressSnarkjsProofWasm(proof as any);
    validateProofSize(compressedProofHex);

    const result = {
      proof: compressedProofHex,
      publicSignals: formatPublicSignalsArray(publicSignals as string[]),
    };

    if (verbose) {
      console.log(
        `[proof-generator] Proof generated: ${formatProofHexForDisplay(result.proof, 32)}`
      );
      console.log(`[proof-generator] Public signals: ${result.publicSignals.length}`);
    }

    return result;
  } catch (error) {
    throw new ProofGenerationError((error as Error).message);
  }
}
