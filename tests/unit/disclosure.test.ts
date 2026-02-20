/**
 * Unit Tests: disclosure.ts
 *
 * Tests the high-level `generateDisclosureProof` API and its helpers.
 *
 * Strategy:
 *   - Mock `circomlibjs` to avoid running real Poseidon (no circuit artifacts needed).
 *   - Mock `../../src/index` (generateProof) to return crafted public signals.
 *   - Test everything the disclosure orchestrator does:
 *       1. Mask validation (all-false must throw)
 *       2. Circuit inputs built with correct values and viewing_key
 *       3. `revealedData` decoded correctly from public signals for all mask combos
 *       4. Proof / publicSignals forwarded as-is
 *       5. Helper round-trips: bigIntToBytes32 ↔ bytes32ToBigInt
 */

import { generateDisclosureProof } from '../../src/disclosure';
import { DisclosureMask, CircuitType } from '../../src/types';
import { bigIntToBytes32, bytes32ToBigInt } from '../../src/utils';

// ============================================================================
// Mocks
// ============================================================================

// Fixed mock viewing key returned by the mocked Poseidon hasher.
// Using 999n so it's easy to recognise in assertions.
const MOCK_VIEWING_KEY = 999n;

// Little-endian hex encoding of MOCK_VIEWING_KEY (32 bytes):
// 999 = 0x3E7 → byte[0]=0xE7, byte[1]=0x03, rest 0
const MOCK_VIEWING_KEY_LE_HEX =
  '0xe703000000000000000000000000000000000000000000000000000000000000';

// Little-endian hex for 0n (all zeros, same byte order either way)
const ZERO_LE_HEX = '0x0000000000000000000000000000000000000000000000000000000000000000';

// Little-endian hex for value=100n (0x64 → byte[0]=0x64, rest 0)
const VALUE_100_LE_HEX = '0x6400000000000000000000000000000000000000000000000000000000000000';

// Little-endian hex for assetId=7n (0x07 → byte[0]=0x07, rest 0)
const ASSET_7_LE_HEX = '0x0700000000000000000000000000000000000000000000000000000000000000';

// Commitment: just use a fixed LE hex (any non-zero value)
const COMMITMENT_HEX = '0x0102030400000000000000000000000000000000000000000000000000000000';

// Mock circomlibjs: buildPoseidon returns a minimal Poseidon stand-in.
jest.mock('circomlibjs', () => ({
  buildPoseidon: jest.fn().mockResolvedValue(
    Object.assign((_inputs: any[]) => ({ _isMockFieldElement: true }), {
      F: {
        // toObject always returns the mock viewing key — enough to exercise the flow.
        toObject: (_: any) => BigInt(999),
      },
    })
  ),
}));

// generateProof is mocked at the module level so that no artifacts are needed.
// Tests can override the resolved value for individual scenarios.
const mockGenerateProof = jest.fn();

jest.mock('../../src/index', () => {
  const original = jest.requireActual('../../src/index');
  return {
    ...original,
    generateProof: (...args: any[]) => mockGenerateProof(...args),
  };
});

// ============================================================================
// Test data
// ============================================================================

const NOTE_VALUE = 100n;
const OWNER_PUBKEY = BigInt('0x' + '2'.repeat(64));
const BLINDING = BigInt('0x' + '9'.repeat(64));
const ASSET_ID = 7n;
const COMMITMENT = BigInt('0x0102030400000000000000000000000000000000000000000000000000000000');

/** Build a mock ProofResult whose public signals reflect the given mask. */
function buildMockResult(mask: DisclosureMask) {
  return {
    proof: '0x' + 'ab'.repeat(128),
    publicSignals: [
      COMMITMENT_HEX,
      mask.discloseValue ? VALUE_100_LE_HEX : ZERO_LE_HEX,
      mask.discloseAssetId ? ASSET_7_LE_HEX : ZERO_LE_HEX,
      mask.discloseOwner ? MOCK_VIEWING_KEY_LE_HEX : ZERO_LE_HEX,
    ],
    circuitType: CircuitType.Disclosure,
  };
}

// ============================================================================
// Helper tests (pure functions — no mocks needed)
// ============================================================================

describe('disclosure.ts helpers - bigIntToBytes32 / bytes32ToBigInt', () => {
  it('should round-trip zero', () => {
    const bytes = bigIntToBytes32(0n);
    expect(bytes).toHaveLength(32);
    expect(bytes.every(b => b === 0)).toBe(true);
    expect(bytes32ToBigInt(bytes)).toBe(0n);
  });

  it('should round-trip small values', () => {
    for (const n of [1n, 100n, 255n, 256n, 65535n]) {
      expect(bytes32ToBigInt(bigIntToBytes32(n))).toBe(n);
    }
  });

  it('should round-trip large BN254 field element', () => {
    // BN254 prime - 1
    const big = 21888242871839275222246405745257275088548364400416034343698204186575808495616n;
    expect(bytes32ToBigInt(bigIntToBytes32(big))).toBe(big);
  });

  it('should encode in big-endian (MSB at index 0)', () => {
    const bytes = bigIntToBytes32(256n); // 0x0100
    expect(bytes[30]).toBe(1);
    expect(bytes[31]).toBe(0);
  });
});

// ============================================================================
// Mask validation
// ============================================================================

describe('generateDisclosureProof - mask validation', () => {
  beforeEach(() => {
    mockGenerateProof.mockResolvedValue(
      buildMockResult({ discloseValue: true, discloseAssetId: false, discloseOwner: false })
    );
  });

  it('should throw when all mask flags are false', async () => {
    const mask: DisclosureMask = {
      discloseValue: false,
      discloseAssetId: false,
      discloseOwner: false,
    };

    await expect(
      generateDisclosureProof(NOTE_VALUE, OWNER_PUBKEY, BLINDING, ASSET_ID, COMMITMENT, mask)
    ).rejects.toThrow(/DisclosureMask/);
  });

  it('should NOT throw when at least one flag is true (discloseValue)', async () => {
    const mask: DisclosureMask = {
      discloseValue: true,
      discloseAssetId: false,
      discloseOwner: false,
    };

    await expect(
      generateDisclosureProof(NOTE_VALUE, OWNER_PUBKEY, BLINDING, ASSET_ID, COMMITMENT, mask)
    ).resolves.toBeDefined();
  });

  it('should NOT throw when at least one flag is true (discloseOwner)', async () => {
    mockGenerateProof.mockResolvedValue(
      buildMockResult({ discloseValue: false, discloseAssetId: false, discloseOwner: true })
    );
    const mask: DisclosureMask = {
      discloseValue: false,
      discloseAssetId: false,
      discloseOwner: true,
    };

    await expect(
      generateDisclosureProof(NOTE_VALUE, OWNER_PUBKEY, BLINDING, ASSET_ID, COMMITMENT, mask)
    ).resolves.toBeDefined();
  });
});

// ============================================================================
// Circuit inputs built correctly
// ============================================================================

describe('generateDisclosureProof - circuit inputs', () => {
  beforeEach(() => {
    mockGenerateProof.mockResolvedValue(
      buildMockResult({ discloseValue: true, discloseAssetId: true, discloseOwner: true })
    );
  });

  it('should call generateProof with CircuitType.Disclosure', async () => {
    const mask: DisclosureMask = {
      discloseValue: true,
      discloseAssetId: true,
      discloseOwner: true,
    };

    await generateDisclosureProof(NOTE_VALUE, OWNER_PUBKEY, BLINDING, ASSET_ID, COMMITMENT, mask);

    expect(mockGenerateProof).toHaveBeenCalledWith(
      CircuitType.Disclosure,
      expect.any(Object),
      expect.any(Object)
    );
  });

  it('should include commitment in circuit inputs', async () => {
    const mask: DisclosureMask = {
      discloseValue: true,
      discloseAssetId: false,
      discloseOwner: false,
    };
    mockGenerateProof.mockResolvedValue(buildMockResult(mask));

    await generateDisclosureProof(NOTE_VALUE, OWNER_PUBKEY, BLINDING, ASSET_ID, COMMITMENT, mask);

    const [, inputs] = mockGenerateProof.mock.calls.at(-1)!;
    expect(inputs.commitment).toBe(COMMITMENT.toString());
  });

  it('should include viewing_key = mocked Poseidon(owner_pubkey)', async () => {
    const mask: DisclosureMask = {
      discloseValue: true,
      discloseAssetId: false,
      discloseOwner: false,
    };

    await generateDisclosureProof(NOTE_VALUE, OWNER_PUBKEY, BLINDING, ASSET_ID, COMMITMENT, mask);

    const [, inputs] = mockGenerateProof.mock.calls.at(-1)!;
    expect(inputs.viewing_key).toBe(MOCK_VIEWING_KEY.toString());
  });

  it('should set disclose_value=1 when mask.discloseValue is true', async () => {
    const mask: DisclosureMask = {
      discloseValue: true,
      discloseAssetId: false,
      discloseOwner: false,
    };

    await generateDisclosureProof(NOTE_VALUE, OWNER_PUBKEY, BLINDING, ASSET_ID, COMMITMENT, mask);

    const [, inputs] = mockGenerateProof.mock.calls.at(-1)!;
    expect(inputs.disclose_value).toBe('1');
    expect(inputs.disclose_asset_id).toBe('0');
    expect(inputs.disclose_owner).toBe('0');
  });

  it('should set all disclose flags correctly for all-reveal mask', async () => {
    const mask: DisclosureMask = {
      discloseValue: true,
      discloseAssetId: true,
      discloseOwner: true,
    };

    await generateDisclosureProof(NOTE_VALUE, OWNER_PUBKEY, BLINDING, ASSET_ID, COMMITMENT, mask);

    const [, inputs] = mockGenerateProof.mock.calls.at(-1)!;
    expect(inputs.disclose_value).toBe('1');
    expect(inputs.disclose_asset_id).toBe('1');
    expect(inputs.disclose_owner).toBe('1');
  });

  it('should set revealed_value=0 in public inputs when discloseValue is false', async () => {
    const mask: DisclosureMask = {
      discloseValue: false,
      discloseAssetId: true,
      discloseOwner: false,
    };
    mockGenerateProof.mockResolvedValue(buildMockResult(mask));

    await generateDisclosureProof(NOTE_VALUE, OWNER_PUBKEY, BLINDING, ASSET_ID, COMMITMENT, mask);

    const [, inputs] = mockGenerateProof.mock.calls.at(-1)!;
    expect(inputs.revealed_value).toBe('0');
  });

  it('should set revealed_value=value in public inputs when discloseValue is true', async () => {
    const mask: DisclosureMask = {
      discloseValue: true,
      discloseAssetId: false,
      discloseOwner: false,
    };

    await generateDisclosureProof(NOTE_VALUE, OWNER_PUBKEY, BLINDING, ASSET_ID, COMMITMENT, mask);

    const [, inputs] = mockGenerateProof.mock.calls.at(-1)!;
    expect(inputs.revealed_value).toBe(NOTE_VALUE.toString());
  });

  it('should set revealed_asset_id=asset_id when discloseAssetId is true', async () => {
    const mask: DisclosureMask = {
      discloseValue: false,
      discloseAssetId: true,
      discloseOwner: false,
    };
    mockGenerateProof.mockResolvedValue(buildMockResult(mask));

    await generateDisclosureProof(NOTE_VALUE, OWNER_PUBKEY, BLINDING, ASSET_ID, COMMITMENT, mask);

    const [, inputs] = mockGenerateProof.mock.calls.at(-1)!;
    expect(inputs.revealed_asset_id).toBe(ASSET_ID.toString());
  });

  it('should set revealed_owner_hash=viewingKey when discloseOwner is true', async () => {
    const mask: DisclosureMask = {
      discloseValue: false,
      discloseAssetId: false,
      discloseOwner: true,
    };
    mockGenerateProof.mockResolvedValue(buildMockResult(mask));

    await generateDisclosureProof(NOTE_VALUE, OWNER_PUBKEY, BLINDING, ASSET_ID, COMMITMENT, mask);

    const [, inputs] = mockGenerateProof.mock.calls.at(-1)!;
    expect(inputs.revealed_owner_hash).toBe(MOCK_VIEWING_KEY.toString());
  });

  it('should set revealed_asset_id=0 when discloseAssetId is false', async () => {
    const mask: DisclosureMask = {
      discloseValue: true,
      discloseAssetId: false,
      discloseOwner: false,
    };

    await generateDisclosureProof(NOTE_VALUE, OWNER_PUBKEY, BLINDING, ASSET_ID, COMMITMENT, mask);

    const [, inputs] = mockGenerateProof.mock.calls.at(-1)!;
    expect(inputs.revealed_asset_id).toBe('0');
  });

  it('should set revealed_owner_hash=0 when discloseOwner is false', async () => {
    const mask: DisclosureMask = {
      discloseValue: true,
      discloseAssetId: false,
      discloseOwner: false,
    };

    await generateDisclosureProof(NOTE_VALUE, OWNER_PUBKEY, BLINDING, ASSET_ID, COMMITMENT, mask);

    const [, inputs] = mockGenerateProof.mock.calls.at(-1)!;
    expect(inputs.revealed_owner_hash).toBe('0');
  });

  it('should include all private inputs (value, asset_id, owner_pubkey, blinding)', async () => {
    const mask: DisclosureMask = {
      discloseValue: true,
      discloseAssetId: true,
      discloseOwner: true,
    };

    await generateDisclosureProof(NOTE_VALUE, OWNER_PUBKEY, BLINDING, ASSET_ID, COMMITMENT, mask);

    const [, inputs] = mockGenerateProof.mock.calls.at(-1)!;
    expect(inputs.value).toBeDefined();
    expect(inputs.asset_id).toBeDefined();
    expect(inputs.owner_pubkey).toBe(OWNER_PUBKEY.toString());
    expect(inputs.blinding).toBe(BLINDING.toString());
  });

  it('should forward options.provider to generateProof as 3rd argument', async () => {
    const mask: DisclosureMask = {
      discloseValue: true,
      discloseAssetId: false,
      discloseOwner: false,
    };
    const fakeProvider = { getCircuitWasm: jest.fn(), getCircuitZkey: jest.fn() } as any;

    await generateDisclosureProof(NOTE_VALUE, OWNER_PUBKEY, BLINDING, ASSET_ID, COMMITMENT, mask, {
      provider: fakeProvider,
    });

    const [, , opts] = mockGenerateProof.mock.calls.at(-1)!;
    expect(opts.provider).toBe(fakeProvider);
  });
});

// ============================================================================
// revealedData decoding
// ============================================================================

describe('generateDisclosureProof - revealedData decoding', () => {
  it('should include commitment in revealedData regardless of mask', async () => {
    const mask: DisclosureMask = {
      discloseValue: true,
      discloseAssetId: false,
      discloseOwner: false,
    };
    mockGenerateProof.mockResolvedValue(buildMockResult(mask));

    const result = await generateDisclosureProof(
      NOTE_VALUE,
      OWNER_PUBKEY,
      BLINDING,
      ASSET_ID,
      COMMITMENT,
      mask
    );

    expect(result.revealedData.commitment).toBe(COMMITMENT_HEX);
  });

  it('should decode value when discloseValue=true', async () => {
    const mask: DisclosureMask = {
      discloseValue: true,
      discloseAssetId: false,
      discloseOwner: false,
    };
    mockGenerateProof.mockResolvedValue(buildMockResult(mask));

    const result = await generateDisclosureProof(
      NOTE_VALUE,
      OWNER_PUBKEY,
      BLINDING,
      ASSET_ID,
      COMMITMENT,
      mask
    );

    // value=100n → LE hex → decoded back to '100'
    expect(result.revealedData.value).toBe('100');
    expect(result.revealedData.assetId).toBeUndefined();
    expect(result.revealedData.ownerHash).toBeUndefined();
  });

  it('should decode assetId when discloseAssetId=true', async () => {
    const mask: DisclosureMask = {
      discloseValue: false,
      discloseAssetId: true,
      discloseOwner: false,
    };
    mockGenerateProof.mockResolvedValue(buildMockResult(mask));

    const result = await generateDisclosureProof(
      NOTE_VALUE,
      OWNER_PUBKEY,
      BLINDING,
      ASSET_ID,
      COMMITMENT,
      mask
    );

    // assetId=7n → LE hex → decoded back to 7
    expect(result.revealedData.assetId).toBe(7);
    expect(result.revealedData.value).toBeUndefined();
    expect(result.revealedData.ownerHash).toBeUndefined();
  });

  it('should decode ownerHash when discloseOwner=true', async () => {
    const mask: DisclosureMask = {
      discloseValue: false,
      discloseAssetId: false,
      discloseOwner: true,
    };
    mockGenerateProof.mockResolvedValue(buildMockResult(mask));

    const result = await generateDisclosureProof(
      NOTE_VALUE,
      OWNER_PUBKEY,
      BLINDING,
      ASSET_ID,
      COMMITMENT,
      mask
    );

    // ownerHash → decoded from LE hex of MOCK_VIEWING_KEY = 999n
    expect(result.revealedData.ownerHash).toBe(
      '0x' + MOCK_VIEWING_KEY.toString(16).padStart(64, '0')
    );
    expect(result.revealedData.value).toBeUndefined();
    expect(result.revealedData.assetId).toBeUndefined();
  });

  it('should decode all 3 fields when mask is all-true', async () => {
    const mask: DisclosureMask = {
      discloseValue: true,
      discloseAssetId: true,
      discloseOwner: true,
    };
    mockGenerateProof.mockResolvedValue(buildMockResult(mask));

    const result = await generateDisclosureProof(
      NOTE_VALUE,
      OWNER_PUBKEY,
      BLINDING,
      ASSET_ID,
      COMMITMENT,
      mask
    );

    expect(result.revealedData.value).toBe('100');
    expect(result.revealedData.assetId).toBe(7);
    expect(result.revealedData.ownerHash).toBeDefined();
    expect(result.revealedData.commitment).toBe(COMMITMENT_HEX);
  });

  it('should forward proof and publicSignals as-is from generateProof', async () => {
    const mask: DisclosureMask = {
      discloseValue: true,
      discloseAssetId: false,
      discloseOwner: false,
    };
    const mockResult = buildMockResult(mask);
    mockGenerateProof.mockResolvedValue(mockResult);

    const result = await generateDisclosureProof(
      NOTE_VALUE,
      OWNER_PUBKEY,
      BLINDING,
      ASSET_ID,
      COMMITMENT,
      mask
    );

    expect(result.proof).toBe(mockResult.proof);
    expect(result.publicSignals).toEqual(mockResult.publicSignals);
  });
});

// ============================================================================
// All 7 valid mask combinations (2^3 - 1)
// ============================================================================

describe('generateDisclosureProof - all 7 valid mask combinations', () => {
  const VALID_MASKS: DisclosureMask[] = [
    { discloseValue: true, discloseAssetId: false, discloseOwner: false },
    { discloseValue: false, discloseAssetId: true, discloseOwner: false },
    { discloseValue: false, discloseAssetId: false, discloseOwner: true },
    { discloseValue: true, discloseAssetId: true, discloseOwner: false },
    { discloseValue: true, discloseAssetId: false, discloseOwner: true },
    { discloseValue: false, discloseAssetId: true, discloseOwner: true },
    { discloseValue: true, discloseAssetId: true, discloseOwner: true },
  ];

  test.each(VALID_MASKS)('mask V=%s A=%s O=%s should resolve without error', async mask => {
    mockGenerateProof.mockResolvedValue(buildMockResult(mask));

    const result = await generateDisclosureProof(
      NOTE_VALUE,
      OWNER_PUBKEY,
      BLINDING,
      ASSET_ID,
      COMMITMENT,
      mask
    );

    expect(result).toBeDefined();
    expect(result.proof).toBeDefined();
    expect(result.publicSignals).toHaveLength(4);
    expect(result.revealedData.commitment).toBeDefined();

    // Fields present iff their mask flag is true
    if (mask.discloseValue) {
      expect(result.revealedData.value).toBeDefined();
    } else {
      expect(result.revealedData.value).toBeUndefined();
    }
    if (mask.discloseAssetId) {
      expect(result.revealedData.assetId).toBeDefined();
    } else {
      expect(result.revealedData.assetId).toBeUndefined();
    }
    if (mask.discloseOwner) {
      expect(result.revealedData.ownerHash).toBeDefined();
    } else {
      expect(result.revealedData.ownerHash).toBeUndefined();
    }
  });
});

// ============================================================================
// Error propagation from generateProof
// ============================================================================

describe('generateDisclosureProof - error propagation', () => {
  it('should propagate errors from generateProof', async () => {
    const mask: DisclosureMask = {
      discloseValue: true,
      discloseAssetId: false,
      discloseOwner: false,
    };
    mockGenerateProof.mockRejectedValue(new Error('Circuit not found'));

    await expect(
      generateDisclosureProof(NOTE_VALUE, OWNER_PUBKEY, BLINDING, ASSET_ID, COMMITMENT, mask)
    ).rejects.toThrow('Circuit not found');
  });
});
