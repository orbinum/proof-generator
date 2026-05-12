/**
 * Selective Disclosure – Proof Orchestrator
 *
 * Generates Groth16 proofs for the `disclosure.circom` circuit.
 *
 * ## Circuit Public Inputs (in order, from snarkjs publicSignals)
 *   0. epk_x           – Ephemeral public key x (Baby Jubjub)
 *   1. epk_y           – Ephemeral public key y (Baby Jubjub)
 *   2. enc_value       – Encrypted note value (0 if not disclosed)
 *   3. enc_asset_id    – Encrypted asset ID (0 if not disclosed)
 *   4. enc_owner_hash  – Encrypted Poseidon(owner_pubkey) (0 if not disclosed)
 *   5. commitment      – Note commitment (always present)
 *   6. auditor_pk_x    – Auditor Baby Jubjub public key x
 *   7. auditor_pk_y    – Auditor Baby Jubjub public key y
 *
 * @module @orbinum/proof-generator/disclosure
 */

import { generateProof } from '../generate';
import { CircuitType, ProofResult } from '../circuits/types';
import { u64ToFieldStr } from '../utils';
import { ArtifactProvider } from '../providers/interface';
import { DisclosureMask, DisclosureProofOutput } from './types';

export type { DisclosureMask, DisclosureProofOutput } from './types';

// ============================================================================
// Internal: circuit input builder
// ============================================================================

/**
 * Build the snarkjs-compatible inputs object for the disclosure circuit.
 *
 * All values are decimal BigInt strings — the native format that snarkjs
 * expects for scalar field elements.
 */
function buildCircuitInputs(
  value: bigint,
  ownerPubkey: bigint,
  blinding: bigint,
  assetId: bigint,
  commitment: bigint,
  auditorPkX: bigint,
  auditorPkY: bigint,
  r: bigint,
  mask: DisclosureMask
): Record<string, string> {
  return {
    // Public inputs
    commitment: commitment.toString(),
    auditor_pk_x: auditorPkX.toString(),
    auditor_pk_y: auditorPkY.toString(),
    // Private inputs
    value: u64ToFieldStr(value),
    asset_id: u64ToFieldStr(assetId),
    owner_pubkey: ownerPubkey.toString(),
    blinding: blinding.toString(),
    disclose_value: mask.discloseValue ? '1' : '0',
    disclose_asset_id: mask.discloseAssetId ? '1' : '0',
    disclose_owner: mask.discloseOwner ? '1' : '0',
    r: r.toString(),
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate a selective disclosure Groth16 proof.
 *
 * The circuit encrypts the selected fields on-circuit using ECDH over Baby
 * Jubjub. The auditor decrypts offline with their spending key:
 *   shared = sk_A · epk
 *   plaintext_i = enc_i - Poseidon(shared.x, shared.y, i)  (mod BN254_P)
 *
 * @param value       – Note value as BigInt (u64 field element)
 * @param ownerPubkey – Owner public key as BigInt (BN254 scalar)
 * @param blinding    – Blinding factor as BigInt
 * @param assetId     – Asset ID as BigInt (u32)
 * @param commitment  – Note commitment as BigInt
 * @param auditorPkX  – Auditor Baby Jubjub public key x-coordinate
 * @param auditorPkY  – Auditor Baby Jubjub public key y-coordinate
 * @param r           – Ephemeral scalar (must be random, < Baby Jubjub order)
 * @param mask        – Which fields to disclose to the auditor
 * @param options     – Optional artifact provider override
 */
export async function generateDisclosureProof(
  value: bigint,
  ownerPubkey: bigint,
  blinding: bigint,
  assetId: bigint,
  commitment: bigint,
  auditorPkX: bigint,
  auditorPkY: bigint,
  r: bigint,
  mask: DisclosureMask,
  options: { provider?: ArtifactProvider; verbose?: boolean } = {}
): Promise<DisclosureProofOutput> {
  if (!mask.discloseValue && !mask.discloseAssetId && !mask.discloseOwner) {
    throw new Error(
      'DisclosureMask: at least one field (discloseValue, discloseAssetId, discloseOwner) must be true'
    );
  }

  const inputs = buildCircuitInputs(
    value,
    ownerPubkey,
    blinding,
    assetId,
    commitment,
    auditorPkX,
    auditorPkY,
    r,
    mask
  );

  // Public signal order from disclosure.circom (outputs first, then public inputs):
  //   [0] epk_x  [1] epk_y  [2] enc_value  [3] enc_asset_id  [4] enc_owner_hash
  //   [5] commitment  [6] auditor_pk_x  [7] auditor_pk_y
  const result: ProofResult = await generateProof(CircuitType.Disclosure, inputs, {
    provider: options.provider,
    verbose: options.verbose,
  });

  const [sigEpkX, sigEpkY, sigEncValue, sigEncAssetId, sigEncOwnerHash, sigCommitment] =
    result.publicSignals;

  return {
    proof: result.proof,
    publicSignals: result.publicSignals,
    encryptedData: {
      epkX: sigEpkX,
      epkY: sigEpkY,
      encValue: sigEncValue,
      encAssetId: sigEncAssetId,
      encOwnerHash: sigEncOwnerHash,
      commitment: sigCommitment,
    },
  };
}
