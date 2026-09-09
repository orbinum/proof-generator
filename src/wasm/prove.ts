/**
 * Groth16 proving through the arkworks WASM backend.
 */

import { getWasm } from './init';

/**
 * Generate a Groth16 proof from a `.ark` v2 artifact and a raw witness.
 *
 * Replaces the 5.x entry point, which produced proofs that never verified.
 * Two things changed and both had to:
 *
 * - **The artifact carries its constraint matrices.** Proving a Circom circuit
 *   needs them as well as the proving key, and a `.ark` v1 has only the key, so
 *   no signature taking one could have been fixed in place.
 * - **The witness arrives as bytes.** The old path serialised ~17,000 field
 *   elements to decimal-string JSON — hundreds of kilobytes of text, parsed back
 *   one big integer at a time. These are the `n × 32` little-endian bytes that a
 *   `.wtns` file already holds.
 *
 * The public-signal count is read from the artifact rather than passed in: it is
 * a property of the circuit, and a caller that gets it wrong produces a proof
 * that fails verification with nothing to explain why.
 *
 * @param artifactBytes - A `.ark` v2 file: proving key plus constraint matrices.
 * @param witnessBytes - The witness as `n × 32` little-endian bytes.
 * @returns `proof` (0x-prefixed 128-byte hex) and `publicSignals` (0x-prefixed
 *   32-byte little-endian hex).
 */
export async function generateProofWasm(
  artifactBytes: Uint8Array,
  witnessBytes: Uint8Array
): Promise<{ proof: string; publicSignals: string[] }> {
  const wasm = await getWasm();

  let raw: string;
  try {
    raw = wasm.generate_proof_wasm(artifactBytes, witnessBytes);
  } catch (error) {
    throw new Error(`WASM proof generation failed: ${(error as Error).message}`);
  }

  try {
    return JSON.parse(raw) as { proof: string; publicSignals: string[] };
  } catch (error) {
    throw new Error(`Failed to parse WASM proof output: ${(error as Error).message}`);
  }
}
