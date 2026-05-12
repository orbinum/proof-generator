/**
 * Tests: disclosure/index.ts — generateDisclosureProof()
 *
 * generateProof is mocked so no real circuit artifacts
 * or cryptographic operations are required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateDisclosureProof } from '../../src/disclosure';
import type { DisclosureMask } from '../../src/disclosure';
import type { ArtifactProvider } from '../../src/providers/interface';

// ─── Mock generateProof ───────────────────────────────────────────────────────

vi.mock('../../src/generate', () => ({
  generateProof: vi.fn().mockResolvedValue({
    proof: '0x' + 'aa'.repeat(128),
    publicSignals: [
      // epk_x, epk_y, enc_value, enc_asset_id, enc_owner_hash, commitment, auditor_pk_x, auditor_pk_y
      '0x' + '01'.repeat(32), // epk_x
      '0x' + '02'.repeat(32), // epk_y
      '0x' + '03'.repeat(32), // enc_value
      '0x' + '04'.repeat(32), // enc_asset_id
      '0x' + '05'.repeat(32), // enc_owner_hash
      '0x' + '06'.repeat(32), // commitment
      '0x' + '07'.repeat(32), // auditor_pk_x
      '0x' + '08'.repeat(32), // auditor_pk_y
    ],
    circuitType: 'disclosure',
  }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALUE = 1000n;
const OWNER_PUBKEY = 12345n;
const BLINDING = 999n;
const ASSET_ID = 1n;
const COMMITMENT = 42n;
const AUDITOR_PK_X = 111n;
const AUDITOR_PK_Y = 222n;
const R = 333n;

const MASK_ALL: DisclosureMask = {
  discloseValue: true,
  discloseAssetId: true,
  discloseOwner: true,
};

const MOCK_PROVIDER: ArtifactProvider = {
  getCircuitWasm: vi.fn(),
  getCircuitZkey: vi.fn(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('generateDisclosureProof', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns proof, publicSignals and encryptedData', async () => {
    const result = await generateDisclosureProof(
      VALUE,
      OWNER_PUBKEY,
      BLINDING,
      ASSET_ID,
      COMMITMENT,
      AUDITOR_PK_X,
      AUDITOR_PK_Y,
      R,
      MASK_ALL,
      { provider: MOCK_PROVIDER }
    );
    expect(result.proof).toBe('0x' + 'aa'.repeat(128));
    expect(result.publicSignals).toHaveLength(8);
    expect(result.encryptedData.commitment).toBeDefined();
  });

  it('encryptedData contains epk and encrypted fields', async () => {
    const result = await generateDisclosureProof(
      VALUE,
      OWNER_PUBKEY,
      BLINDING,
      ASSET_ID,
      COMMITMENT,
      AUDITOR_PK_X,
      AUDITOR_PK_Y,
      R,
      MASK_ALL,
      { provider: MOCK_PROVIDER }
    );
    expect(result.encryptedData.epkX).toBeDefined();
    expect(result.encryptedData.epkY).toBeDefined();
    expect(result.encryptedData.encValue).toBeDefined();
    expect(result.encryptedData.encAssetId).toBeDefined();
    expect(result.encryptedData.encOwnerHash).toBeDefined();
  });

  it('encryptedData maps correctly to publicSignals positions', async () => {
    const result = await generateDisclosureProof(
      VALUE,
      OWNER_PUBKEY,
      BLINDING,
      ASSET_ID,
      COMMITMENT,
      AUDITOR_PK_X,
      AUDITOR_PK_Y,
      R,
      MASK_ALL,
      { provider: MOCK_PROVIDER }
    );
    const s = result.publicSignals;
    expect(result.encryptedData.epkX).toBe(s[0]);
    expect(result.encryptedData.epkY).toBe(s[1]);
    expect(result.encryptedData.encValue).toBe(s[2]);
    expect(result.encryptedData.encAssetId).toBe(s[3]);
    expect(result.encryptedData.encOwnerHash).toBe(s[4]);
    expect(result.encryptedData.commitment).toBe(s[5]);
  });

  it('throws when all mask fields are false', async () => {
    const emptyMask: DisclosureMask = {
      discloseValue: false,
      discloseAssetId: false,
      discloseOwner: false,
    };
    await expect(
      generateDisclosureProof(
        VALUE,
        OWNER_PUBKEY,
        BLINDING,
        ASSET_ID,
        COMMITMENT,
        AUDITOR_PK_X,
        AUDITOR_PK_Y,
        R,
        emptyMask
      )
    ).rejects.toThrow('DisclosureMask');
  });

  it('passes the provider option through to generateProof', async () => {
    const { generateProof } = await import('../../src/generate');
    await generateDisclosureProof(
      VALUE,
      OWNER_PUBKEY,
      BLINDING,
      ASSET_ID,
      COMMITMENT,
      AUDITOR_PK_X,
      AUDITOR_PK_Y,
      R,
      MASK_ALL,
      { provider: MOCK_PROVIDER }
    );
    expect(generateProof).toHaveBeenCalledWith(
      'disclosure',
      expect.any(Object),
      expect.objectContaining({ provider: MOCK_PROVIDER })
    );
  });

  it('passes auditor pk and r as circuit inputs', async () => {
    const { generateProof } = await import('../../src/generate');
    await generateDisclosureProof(
      VALUE,
      OWNER_PUBKEY,
      BLINDING,
      ASSET_ID,
      COMMITMENT,
      AUDITOR_PK_X,
      AUDITOR_PK_Y,
      R,
      MASK_ALL,
      { provider: MOCK_PROVIDER }
    );
    expect(generateProof).toHaveBeenCalledWith(
      'disclosure',
      expect.objectContaining({
        auditor_pk_x: AUDITOR_PK_X.toString(),
        auditor_pk_y: AUDITOR_PK_Y.toString(),
        r: R.toString(),
      }),
      expect.any(Object)
    );
  });

  it('sets disclose_* inputs correctly from mask', async () => {
    const { generateProof } = await import('../../src/generate');
    const mask: DisclosureMask = {
      discloseValue: true,
      discloseAssetId: false,
      discloseOwner: false,
    };
    await generateDisclosureProof(
      VALUE,
      OWNER_PUBKEY,
      BLINDING,
      ASSET_ID,
      COMMITMENT,
      AUDITOR_PK_X,
      AUDITOR_PK_Y,
      R,
      mask,
      { provider: MOCK_PROVIDER }
    );
    expect(generateProof).toHaveBeenCalledWith(
      'disclosure',
      expect.objectContaining({ disclose_value: '1', disclose_asset_id: '0', disclose_owner: '0' }),
      expect.any(Object)
    );
  });
});
