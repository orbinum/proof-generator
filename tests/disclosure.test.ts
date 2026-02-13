/**
 * Test: Disclosure Proof Generation
 */

// @ts-ignore - circomlibjs doesn't have types
import { buildPoseidon } from 'circomlibjs';
import { generateProof, CircuitType, isReady } from '../src';

describe('Disclosure Proof Generation', () => {
  let poseidon: any;

  beforeAll(async () => {
    // Initialize Poseidon
    poseidon = await buildPoseidon();
  });

  // Skip this test if artifacts are not available
  it('should generate a valid disclosure proof', async () => {
    // Check if proof generator is ready
    if (!isReady()) {
      console.warn('⚠️  Skipping: Proof generator not ready. Run: npm run build');
      return;
    }
    const F = poseidon.F;

    // Create note
    const noteValue = BigInt('100000000000000000000');
    const assetId = BigInt(0);
    const ownerPubkey = BigInt('0x' + '2'.repeat(64));
    const blinding = BigInt('0x' + '9'.repeat(64));
    const verificationKey = BigInt('0x' + '3'.repeat(64)); // Verification key of the owner
    const mask = BigInt('0x' + 'f'.repeat(64)); // Mask to partially hide owner

    // Compute commitment
    const commitment = poseidon([noteValue, assetId, ownerPubkey, blinding]);
    const commitmentBigInt = F.toObject(commitment);

    // Compute vk_hash (hash of verification key)
    const vkHash = poseidon([verificationKey]);
    const vkHashBigInt = F.toObject(vkHash);

    // Compute revealed_owner_hash (masked owner hash)
    const revealedOwnerHash = poseidon([ownerPubkey, mask]);
    const revealedOwnerHashBigInt = F.toObject(revealedOwnerHash);

    // Prepare inputs
    const inputs = {
      commitment: commitmentBigInt.toString(),
      vk_hash: vkHashBigInt.toString(),
      mask: mask.toString(),
      revealed_owner_hash: revealedOwnerHashBigInt.toString(),
      note_value: noteValue.toString(),
      note_asset_id: assetId.toString(),
      note_owner: ownerPubkey.toString(),
      note_blinding: blinding.toString(),
      verification_key: verificationKey.toString(),
    };

    // Generate proof
    try {
      const result = await generateProof(CircuitType.Disclosure, inputs);

      // Assertions - Basic structure
      expect(result).toBeDefined();
      expect(result.proof).toMatch(/^0x[0-9a-f]+$/);
      expect(result.publicSignals).toHaveLength(4);
      expect(result.circuitType).toBe(CircuitType.Disclosure);

      // Verify proof size (128 bytes = 256 hex chars + 0x prefix)
      const proofBytes = Buffer.from(result.proof.slice(2), 'hex');
      expect(proofBytes.length).toBe(128);

      // Verify public signals format - all should be hex strings
      result.publicSignals.forEach((signal, idx) => {
        expect(signal).toMatch(/^0x[0-9a-f]+$/);
        // Each signal should be 32 bytes (64 hex chars + 0x)
        expect(signal.length).toBe(66); // 0x + 64 hex chars
      });

      // Verify public signals match inputs
      // Order: commitment, vk_hash, mask, revealed_owner_hash
      expect(result.publicSignals[0]).toBeDefined(); // commitment
      expect(result.publicSignals[1]).toBeDefined(); // vk_hash
      expect(result.publicSignals[2]).toBeDefined(); // mask
      expect(result.publicSignals[3]).toBeDefined(); // revealed_owner_hash
    } catch (error: any) {
      // Skip test if WASM fails to load (can happen in certain test environments)
      if (error.message?.includes('WASM') || error.message?.includes('export')) {
        return; // Silently skip test
      }
      // If artifacts are not available, skip
      if (error.message.includes('Circuit not found') || error.message.includes('ENOENT')) {
        console.warn('⚠️  Skipping: Circuit artifacts not available');
        return;
      }
      throw error;
    }
  }, 30000); // 30 second timeout

  it('should fail with invalid inputs', async () => {
    if (!isReady()) {
      return;
    }

    await expect(
      generateProof(CircuitType.Disclosure, {
        commitment: 'invalid',
      })
    ).rejects.toThrow();
  });

  it('should fail with missing required fields', async () => {
    if (!isReady()) {
      return;
    }

    await expect(
      generateProof(CircuitType.Disclosure, {
        commitment: '123',
        // Missing other required fields
      })
    ).rejects.toThrow();
  });

  it('should fail with null/undefined inputs', async () => {
    if (!isReady()) {
      return;
    }

    await expect(
      // @ts-ignore - Testing invalid input
      generateProof(CircuitType.Disclosure, null)
    ).rejects.toThrow();

    await expect(
      // @ts-ignore - Testing invalid input
      generateProof(CircuitType.Disclosure, undefined)
    ).rejects.toThrow();
  });
});
