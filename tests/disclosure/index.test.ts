/**
 * Tests: disclosure/index.ts — generateDisclosureProof()
 *
 * generateProof and circomlibjs are mocked so no real circuit artifacts
 * or cryptographic operations are required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateDisclosureProof } from '../../src/disclosure';
import type { DisclosureMask } from '../../src/disclosure';
import type { ArtifactProvider } from '../../src/providers/interface';

// ─── Mock circomlibjs ─────────────────────────────────────────────────────────

vi.mock('circomlibjs', () => {
  const poseidon = Object.assign(vi.fn().mockReturnValue('stub'), {
    F: { toObject: vi.fn().mockReturnValue(999n) },
  });
  return {
    buildPoseidon: vi.fn().mockResolvedValue(poseidon),
  };
});

// ─── Mock generateProof ───────────────────────────────────────────────────────

vi.mock('../../src/generate', () => ({
  generateProof: vi.fn().mockResolvedValue({
    proof: '0x' + 'aa'.repeat(128),
    publicSignals: [
      // commitment, revealed_value, revealed_asset_id, revealed_owner_hash
      '0x' + '01'.repeat(32),
      '0x' + '02'.repeat(32),
      '0x' + '03'.repeat(32),
      '0x' + '04'.repeat(32),
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

  it('returns proof, publicSignals and revealedData', async () => {
    const result = await generateDisclosureProof(
      VALUE,
      OWNER_PUBKEY,
      BLINDING,
      ASSET_ID,
      COMMITMENT,
      MASK_ALL,
      { provider: MOCK_PROVIDER }
    );
    expect(result.proof).toBe('0x' + 'aa'.repeat(128));
    expect(result.publicSignals).toHaveLength(4);
    expect(result.revealedData.commitment).toBeDefined();
  });

  it('populates revealedData.value when discloseValue is true', async () => {
    const result = await generateDisclosureProof(
      VALUE,
      OWNER_PUBKEY,
      BLINDING,
      ASSET_ID,
      COMMITMENT,
      MASK_ALL,
      { provider: MOCK_PROVIDER }
    );
    expect(result.revealedData.value).toBeDefined();
    expect(typeof result.revealedData.value).toBe('string');
  });

  it('populates revealedData.assetId when discloseAssetId is true', async () => {
    const result = await generateDisclosureProof(
      VALUE,
      OWNER_PUBKEY,
      BLINDING,
      ASSET_ID,
      COMMITMENT,
      MASK_ALL,
      { provider: MOCK_PROVIDER }
    );
    expect(result.revealedData.assetId).toBeDefined();
    expect(typeof result.revealedData.assetId).toBe('number');
  });

  it('populates revealedData.ownerHash when discloseOwner is true', async () => {
    const result = await generateDisclosureProof(
      VALUE,
      OWNER_PUBKEY,
      BLINDING,
      ASSET_ID,
      COMMITMENT,
      MASK_ALL,
      { provider: MOCK_PROVIDER }
    );
    expect(result.revealedData.ownerHash).toBeDefined();
    expect(result.revealedData.ownerHash).toMatch(/^0x/);
  });

  it('omits revealedData.value when discloseValue is false', async () => {
    const mask: DisclosureMask = {
      discloseValue: false,
      discloseAssetId: true,
      discloseOwner: false,
    };
    const result = await generateDisclosureProof(
      VALUE,
      OWNER_PUBKEY,
      BLINDING,
      ASSET_ID,
      COMMITMENT,
      mask,
      { provider: MOCK_PROVIDER }
    );
    expect(result.revealedData.value).toBeUndefined();
  });

  it('omits revealedData.assetId when discloseAssetId is false', async () => {
    const mask: DisclosureMask = {
      discloseValue: true,
      discloseAssetId: false,
      discloseOwner: false,
    };
    const result = await generateDisclosureProof(
      VALUE,
      OWNER_PUBKEY,
      BLINDING,
      ASSET_ID,
      COMMITMENT,
      mask,
      { provider: MOCK_PROVIDER }
    );
    expect(result.revealedData.assetId).toBeUndefined();
  });

  it('omits revealedData.ownerHash when discloseOwner is false', async () => {
    const mask: DisclosureMask = {
      discloseValue: true,
      discloseAssetId: false,
      discloseOwner: false,
    };
    const result = await generateDisclosureProof(
      VALUE,
      OWNER_PUBKEY,
      BLINDING,
      ASSET_ID,
      COMMITMENT,
      mask,
      { provider: MOCK_PROVIDER }
    );
    expect(result.revealedData.ownerHash).toBeUndefined();
  });

  it('throws when all mask fields are false', async () => {
    const emptyMask: DisclosureMask = {
      discloseValue: false,
      discloseAssetId: false,
      discloseOwner: false,
    };
    await expect(
      generateDisclosureProof(VALUE, OWNER_PUBKEY, BLINDING, ASSET_ID, COMMITMENT, emptyMask)
    ).rejects.toThrow('DisclosureMask');
  });

  it('passes the provider option through to generateProof', async () => {
    const { generateProof } = await import('../../src/generate');
    await generateDisclosureProof(VALUE, OWNER_PUBKEY, BLINDING, ASSET_ID, COMMITMENT, MASK_ALL, {
      provider: MOCK_PROVIDER,
    });
    expect(generateProof).toHaveBeenCalledWith(
      'disclosure',
      expect.any(Object),
      expect.objectContaining({ provider: MOCK_PROVIDER })
    );
  });
});
