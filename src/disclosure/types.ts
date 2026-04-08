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
   * Order: [commitment, revealed_value, revealed_asset_id, revealed_owner_hash]
   */
  publicSignals: string[];
  /** Human-readable revealed data */
  revealedData: {
    /** Revealed note value as decimal string, or undefined if not disclosed */
    value?: string;
    /** Revealed asset ID as number, or undefined if not disclosed */
    assetId?: number;
    /** Revealed owner hash as 0x-prefixed hex, or undefined if not disclosed */
    ownerHash?: string;
    /** Note commitment (always present) */
    commitment: string;
  };
}
