import { CircuitType, CircuitInputs, CircuitConfig } from '../../circuits/types';
import { CircuitNotFoundError, ProofGenerationError } from '../../errors';
import { ArtifactProvider } from '../../providers/interface';
import { generateProofWasm } from '../../wasm/loader';
import { validateProofSize } from '../../utils/validation';

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

/** A `.wtns` header is 4-byte magic, u32 version, u32 section count. */
const WTNS_HEADER_BYTES = 12;
/** Section table entries are a u32 type followed by a u64 length. */
const WTNS_SECTION_HEADER_BYTES = 12;
/** The section holding the witness values themselves. */
const WTNS_DATA_SECTION = 2;
/** BN254 field elements are 32 bytes, little-endian, in a `.wtns`. */
const FIELD_BYTES = 32;

/**
 * Extract the raw witness values from an in-memory `.wtns` buffer.
 *
 * snarkjs offers `wtns.exportJson`, which returns bigints that then have to be
 * stringified into a JSON array — for the unshield circuit that is ~17,000
 * decimal strings, hundreds of kilobytes of text, allocated and parsed twice on
 * the way to a WASM boundary that wants bytes. The `.wtns` already stores those
 * values as 32-byte little-endian words, which is exactly the layout arkworks
 * reads, so the fastest correct thing to do is hand over that slice untouched.
 *
 * The format is stable and documented: a header, then a section table of
 * (type, length) pairs. Section 1 is the header (field size, prime, count),
 * section 2 is the data.
 */
function witnessBytesFromWtns(buffer: Uint8Array): Uint8Array {
  if (buffer.length < WTNS_HEADER_BYTES) {
    throw new Error('witness buffer is too short to be a .wtns file');
  }
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  const magic = String.fromCharCode(...buffer.subarray(0, 4));
  if (magic !== 'wtns') {
    throw new Error(`expected a .wtns buffer, got magic "${magic}"`);
  }

  const sectionCount = view.getUint32(8, true);
  let offset = WTNS_HEADER_BYTES;

  for (let i = 0; i < sectionCount; i++) {
    if (offset + WTNS_SECTION_HEADER_BYTES > buffer.length) {
      throw new Error('.wtns section table runs past the end of the buffer');
    }
    const type = view.getUint32(offset, true);
    // Lengths are u64; a witness that overflows Number is not one we could hold
    // in memory anyway, so narrowing here is safe.
    const length = Number(view.getBigUint64(offset + 4, true));
    offset += WTNS_SECTION_HEADER_BYTES;

    if (type === WTNS_DATA_SECTION) {
      if (offset + length > buffer.length) {
        throw new Error('.wtns data section runs past the end of the buffer');
      }
      if (length % FIELD_BYTES !== 0) {
        throw new Error(`.wtns data section is ${length} bytes, not a multiple of ${FIELD_BYTES}`);
      }
      // A witness always opens with the constant 1, so it is never empty. An
      // empty section would otherwise be handed to the prover, which reports a
      // width mismatch that says nothing about the witness being truncated.
      if (length === 0) {
        throw new Error('.wtns data section is empty');
      }
      return buffer.subarray(offset, offset + length);
    }
    offset += length;
  }

  throw new Error('.wtns buffer has no data section');
}

/**
 * Generate a Groth16 proof through arkworks: witness from snarkjs, proof from
 * the arkworks WASM module using a `.ark` v2 artifact.
 *
 * The artifact carries the circuit's constraint matrices as well as its proving
 * key. Both are required — arkworks cannot prove a Circom circuit from the key
 * alone — which is why a `.ark` v1 is rejected here by name.
 */
export async function runArkworksBackend(
  circuitType: CircuitType,
  inputs: CircuitInputs,
  provider: ArtifactProvider,
  config: CircuitConfig,
  verbose: boolean
): Promise<{ proof: string; publicSignals: string[] }> {
  let wasmBinary: Uint8Array | string;
  let artifactBytes: Uint8Array;

  try {
    if (verbose) console.log('[proof-generator] Fetching circuit WASM + .ark v2 artifact...');
    if (!provider.getCircuitProvingKey) {
      throw new Error(
        'Provider does not support getCircuitProvingKey (required for arkworks backend)'
      );
    }
    [wasmBinary, artifactBytes] = await Promise.all([
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
    const snarkjs = await loadSnarkjs();
    await (snarkjs as any).wtns.calculate(inputs, wasmBinary, wtnsBuffer);
    if (!wtnsBuffer.data) {
      throw new Error('snarkjs returned no witness data');
    }

    if (verbose) console.log('[proof-generator] Step 2: Generating proof with arkworks WASM...');
    const witnessBytes = witnessBytesFromWtns(wtnsBuffer.data);
    const result = await generateProofWasm(artifactBytes, witnessBytes);

    validateProofSize(result.proof);

    // The artifact decides the arity, so a mismatch means the published artifact
    // and this package's circuit config disagree — worth failing on rather than
    // returning a proof against the wrong statement.
    if (result.publicSignals.length !== config.expectedPublicSignals) {
      throw new Error(
        `artifact produced ${result.publicSignals.length} public signals, ` +
          `but ${circuitType} expects ${config.expectedPublicSignals}`
      );
    }

    return result;
  } catch (error) {
    throw new ProofGenerationError((error as Error).message);
  }
}
