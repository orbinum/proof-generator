/**
 * Selective Disclosure – Proof Orchestrator
 *
 * Generates Groth16 proofs for the `disclosure.circom` circuit.
 *
 * ## Circuit Public Inputs (in order)
 *   0. commitment          – Note commitment (always revealed)
 *   1. revealed_value      – Note value, or 0 if not disclosed
 *   2. revealed_asset_id   – Asset ID, or 0 if not disclosed
 *   3. revealed_owner_hash – Poseidon(owner_pubkey), or 0 if not disclosed
 *
 * @module @orbinum/proof-generator/disclosure
 */

// @ts-ignore - circomlibjs has no type declarations
import { buildPoseidon } from 'circomlibjs';
import { generateProof, CircuitType } from './index';
import { DisclosureMask, DisclosureProofOutput, ProofResult } from './types';
import {
  bigIntToHex,
  bigIntToBytes32,
  bytes32ToBigInt,
  hexSignalToBigInt,
  u64ToFieldStr,
} from './utils';
import { ArtifactProvider } from './provider';

// ============================================================================
// Internal: circuit input builder
// ============================================================================

/**
 * Build the snarkjs-compatible inputs object for the disclosure circuit.
 *
 * All values are decimal BigInt strings — the native format that snarkjs
 * expects for scalar field elements.
 */
async function buildCircuitInputs(
  value: bigint,
  ownerPubkey: bigint,
  blinding: bigint,
  assetId: bigint,
  commitment: bigint,
  mask: DisclosureMask
): Promise<Record<string, string>> {
  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  // viewing_key = Poseidon(owner_pubkey) — matches the circom constraint
  const viewingKey: bigint = F.toObject(poseidon([ownerPubkey]));

  return {
    // Public inputs
    commitment: commitment.toString(),
    revealed_value: (mask.discloseValue ? value : 0n).toString(),
    revealed_asset_id: (mask.discloseAssetId ? assetId : 0n).toString(),
    revealed_owner_hash: (mask.discloseOwner ? viewingKey : 0n).toString(),
    // Private inputs
    value: u64ToFieldStr(value),
    asset_id: u64ToFieldStr(assetId),
    owner_pubkey: ownerPubkey.toString(),
    blinding: blinding.toString(),
    viewing_key: viewingKey.toString(),
    disclose_value: mask.discloseValue ? '1' : '0',
    disclose_asset_id: mask.discloseAssetId ? '1' : '0',
    disclose_owner: mask.discloseOwner ? '1' : '0',
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate a selective disclosure Groth16 proof.
 *
 * @param value       – Note value as BigInt (u64 field element)
 * @param ownerPubkey – Owner public key as BigInt (BN254 scalar)
 * @param blinding    – Blinding factor as BigInt
 * @param assetId     – Asset ID as BigInt (u32)
 * @param commitment  – Note commitment as BigInt
 * @param mask        – Which fields to disclose to the auditor
 * @param options     – Optional artifact provider override
 */
export async function generateDisclosureProof(
  value: bigint,
  ownerPubkey: bigint,
  blinding: bigint,
  assetId: bigint,
  commitment: bigint,
  mask: DisclosureMask,
  options: { provider?: ArtifactProvider; verbose?: boolean } = {}
): Promise<DisclosureProofOutput> {
  if (!mask.discloseValue && !mask.discloseAssetId && !mask.discloseOwner) {
    throw new Error(
      'DisclosureMask: at least one field (discloseValue, discloseAssetId, discloseOwner) must be true'
    );
  }

  const inputs = await buildCircuitInputs(value, ownerPubkey, blinding, assetId, commitment, mask);

  // Public signal order from disclosure.circom:
  //   [0] commitment  [1] revealed_value  [2] revealed_asset_id  [3] revealed_owner_hash
  const result: ProofResult = await generateProof(CircuitType.Disclosure, inputs, {
    provider: options.provider,
    verbose: options.verbose,
  });

  const [sigCommitment, sigValue, sigAssetId, sigOwnerHash] = result.publicSignals;

  const revealedData: DisclosureProofOutput['revealedData'] = { commitment: sigCommitment };
  if (mask.discloseValue) revealedData.value = hexSignalToBigInt(sigValue).toString(10);
  if (mask.discloseAssetId) revealedData.assetId = Number(hexSignalToBigInt(sigAssetId));
  if (mask.discloseOwner) revealedData.ownerHash = bigIntToHex(hexSignalToBigInt(sigOwnerHash));

  return { proof: result.proof, publicSignals: result.publicSignals, revealedData };
}
