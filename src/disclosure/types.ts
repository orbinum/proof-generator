/**
 * Which fields to reveal to the auditor.
 *
 * At least one of `discloseValue`, `discloseAssetId`, or `discloseOwner`
 * must be `true`.
 */
export interface DisclosureMask {
  /** Reveal the note value (u64) */
  discloseValue: boolean;
  /** Reveal the asset ID (u32) */
  discloseAssetId: boolean;
  /** Reveal the owner identity hash (Poseidon(owner_pubkey)) */
  discloseOwner: boolean;
}

/** Proof output returned by `generateDisclosureProof`. */
export interface DisclosureProofOutput {
  /** 128-byte compressed Groth16 proof as 0x-prefixed hex string */
  proof: string;
  /**
   * Raw public signals in hex (0x-prefixed, 32 bytes each).
   * Order: [epk_x, epk_y, enc_value, enc_asset_id, enc_owner_hash, commitment, auditor_pk_x, auditor_pk_y]
   */
  publicSignals: string[];
  /**
   * ECDH-encrypted disclosure data.
   * The auditor decrypts offline using their Baby Jubjub spending key:
   *   shared = sk_A · epk
   *   plaintext_i = enc_i - Poseidon(shared.x, shared.y, i)  (mod BN254_P)
   */
  encryptedData: {
    /** Ephemeral public key x-coordinate (Baby Jubjub) */
    epkX: string;
    /** Ephemeral public key y-coordinate (Baby Jubjub) */
    epkY: string;
    /** Encrypted note value (0 if not disclosed) */
    encValue: string;
    /** Encrypted asset ID (0 if not disclosed) */
    encAssetId: string;
    /** Encrypted owner hash Poseidon(owner_pubkey) (0 if not disclosed) */
    encOwnerHash: string;
    /** Note commitment (always present, not encrypted) */
    commitment: string;
  };
}
