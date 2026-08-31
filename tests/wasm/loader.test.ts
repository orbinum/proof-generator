/**
 * Tests: wasm/loader.ts
 *
 * The actual WASM init requires @orbinum/groth16-proofs binary to be present.
 * We mock the module to test the loader logic in isolation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock @orbinum/groth16-proofs before importing loader ────────────────────

vi.mock('@orbinum/groth16-proofs', () => ({
  default: vi.fn().mockResolvedValue(undefined),
  init_panic_hook: vi.fn(),
  compress_snarkjs_proof_wasm: vi.fn().mockReturnValue('0x' + 'ab'.repeat(128)),
  generate_proof_wasm: vi.fn().mockReturnValue(
    JSON.stringify({
      proof: '0x' + 'cd'.repeat(128),
      publicSignals: ['0x' + '01'.repeat(32), '0x' + '02'.repeat(32)],
    })
  ),
  initSync: vi.fn(),
}));

// Import after mock is set up
import { initWasm, compressSnarkjsProofWasm, generateProofWasm } from '../../src/wasm/loader';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('initWasm', () => {
  it('initializes without throwing', async () => {
    await expect(initWasm()).resolves.toBeUndefined();
  });

  it('is idempotent — calling twice does not throw', async () => {
    await initWasm();
    await expect(initWasm()).resolves.toBeUndefined();
  });
});

describe('compressSnarkjsProofWasm', () => {
  const validProof = {
    pi_a: ['1', '2', '1'],
    pi_b: [
      ['3', '4'],
      ['5', '6'],
    ],
    pi_c: ['7', '8', '1'],
  };

  it('returns a 0x-prefixed hex string', async () => {
    const result = await compressSnarkjsProofWasm(validProof);
    expect(result).toMatch(/^0x[0-9a-f]+$/i);
  });

  it('calls the WASM compress function with serialized JSON', async () => {
    const wasm = await import('@orbinum/groth16-proofs');
    vi.mocked(wasm.compress_snarkjs_proof_wasm).mockClear();

    await compressSnarkjsProofWasm(validProof);

    expect(wasm.compress_snarkjs_proof_wasm).toHaveBeenCalledTimes(1);
    const arg = (wasm.compress_snarkjs_proof_wasm as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const parsed = JSON.parse(arg);
    expect(parsed).toHaveProperty('pi_a');
    expect(parsed).toHaveProperty('pi_b');
    expect(parsed).toHaveProperty('pi_c');
  });

  it('normalizes numeric pi_a fields to strings', async () => {
    const wasm = await import('@orbinum/groth16-proofs');
    vi.mocked(wasm.compress_snarkjs_proof_wasm).mockClear();

    const proofWithNumbers = {
      pi_a: [1, 2, 1] as any,
      pi_b: [
        [3, 4],
        [5, 6],
      ] as any,
      pi_c: [7, 8, 1] as any,
    };

    await compressSnarkjsProofWasm(proofWithNumbers);

    const arg = (wasm.compress_snarkjs_proof_wasm as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const parsed = JSON.parse(arg);
    expect(typeof parsed.pi_a[0]).toBe('string');
    expect(typeof parsed.pi_c[0]).toBe('string');
  });

  it('throws when WASM compress function throws', async () => {
    const wasm = await import('@orbinum/groth16-proofs');
    vi.mocked(wasm.compress_snarkjs_proof_wasm).mockImplementationOnce(() => {
      throw new Error('invalid G1 point');
    });

    await expect(compressSnarkjsProofWasm(validProof)).rejects.toThrow(
      'WASM proof compression failed: invalid G1 point'
    );
  });
});

// ─── generateProofWasm ───────────────────────────────────────────────────────

describe('generateProofWasm', () => {
  const artifactBytes = new Uint8Array([1, 2, 3, 4]);
  // A witness is n × 32 little-endian bytes; two elements is enough to pin the
  // shape without building a real one.
  const witnessBytes = new Uint8Array(64);

  it('returns proof and publicSignals from WASM output', async () => {
    const result = await generateProofWasm(artifactBytes, witnessBytes);

    expect(result).toHaveProperty('proof');
    expect(result).toHaveProperty('publicSignals');
    expect(result.proof).toMatch(/^0x[0-9a-f]+$/i);
    expect(Array.isArray(result.publicSignals)).toBe(true);
  });

  it('passes the artifact and witness through untouched', async () => {
    const wasm = await import('@orbinum/groth16-proofs');
    vi.mocked(wasm.generate_proof_wasm).mockClear();

    await generateProofWasm(artifactBytes, witnessBytes);

    expect(wasm.generate_proof_wasm).toHaveBeenCalledTimes(1);
    const [artifact, witness] = (wasm.generate_proof_wasm as ReturnType<typeof vi.fn>).mock
      .calls[0];

    // Identity, not equality: a copy here would double the memory cost of every
    // proof for no reason.
    expect(artifact).toBe(artifactBytes);
    expect(witness).toBe(witnessBytes);
  });

  it('throws when WASM function throws', async () => {
    const wasm = await import('@orbinum/groth16-proofs');
    vi.mocked(wasm.generate_proof_wasm).mockImplementationOnce(() => {
      throw new Error('deserialize error');
    });

    await expect(generateProofWasm(artifactBytes, witnessBytes)).rejects.toThrow(
      'WASM proof generation failed: deserialize error'
    );
  });

  it('throws when WASM returns invalid JSON', async () => {
    const wasm = await import('@orbinum/groth16-proofs');
    vi.mocked(wasm.generate_proof_wasm).mockReturnValueOnce('not-json{{');

    await expect(generateProofWasm(artifactBytes, witnessBytes)).rejects.toThrow(
      'Failed to parse WASM proof output'
    );
  });
});
