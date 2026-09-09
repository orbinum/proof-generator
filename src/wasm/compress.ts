/**
 * Converting a snarkjs Groth16 proof to the arkworks canonical compressed
 * format accepted by `pallet-zk-verifier` on-chain.
 */

import { getWasm } from './init';
import type { SnarkjsProofLike } from './types';

/**
 * Compress a snarkjs Groth16 proof to the arkworks canonical compressed
 * format (128 bytes, 0x-prefixed hex).
 */
export async function compressSnarkjsProofWasm(proof: SnarkjsProofLike): Promise<string> {
  const wasm = await getWasm();

  const normalizedProof = {
    pi_a: [String(proof.pi_a[0]), String(proof.pi_a[1])],
    pi_b: [
      [String(proof.pi_b[0][0]), String(proof.pi_b[0][1])],
      [String(proof.pi_b[1][0]), String(proof.pi_b[1][1])],
    ],
    pi_c: [String(proof.pi_c[0]), String(proof.pi_c[1])],
  };

  try {
    return wasm.compress_snarkjs_proof_wasm(JSON.stringify(normalizedProof));
  } catch (error) {
    throw new Error(`WASM proof compression failed: ${(error as Error).message}`);
  }
}
