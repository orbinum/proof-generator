/**
 * Tests: generateProof — backend option ('snarkjs' | 'arkworks')
 *
 * Both backends are exercised with a minimal stub provider and mocked
 * snarkjs / WASM modules so no real circuit artifacts are required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateProof } from '../../src/generate';
import { CircuitType } from '../../src/circuits/types';
import { CircuitNotFoundError, ProofGenerationError, InvalidInputsError } from '../../src/errors';
import type { ArtifactProvider } from '../../src/providers/interface';

// ─── Mock @orbinum/groth16-proofs ─────────────────────────────────────────────

vi.mock('@orbinum/groth16-proofs', () => ({
  default: vi.fn().mockResolvedValue(undefined),
  init_panic_hook: vi.fn(),
  compress_snarkjs_proof_wasm: vi.fn().mockReturnValue('0x' + 'ab'.repeat(128)),
  generate_proof_from_decimal_wasm: vi.fn().mockReturnValue(
    JSON.stringify({
      proof: '0x' + 'cd'.repeat(128),
      publicSignals: [
        '0x' + '01'.repeat(32),
        '0x' + '02'.repeat(32),
        '0x' + '03'.repeat(32),
        '0x' + '04'.repeat(32),
        '0x' + '05'.repeat(32),
        '0x' + '06'.repeat(32),
        '0x' + '07'.repeat(32),
      ],
    })
  ),
  initSync: vi.fn(),
}));

// ─── Mock snarkjs ─────────────────────────────────────────────────────────────

vi.mock('snarkjs', () => ({
  groth16: {
    fullProve: vi.fn().mockResolvedValue({
      proof: {
        pi_a: ['1', '2', '1'],
        pi_b: [
          ['3', '4'],
          ['5', '6'],
          ['1', '0'],
        ],
        pi_c: ['7', '8', '1'],
      },
      publicSignals: ['10', '20', '30', '40', '50', '60', '70'],
    }),
  },
  wtns: {
    calculate: vi.fn().mockResolvedValue(undefined),
    exportJson: vi.fn().mockResolvedValue([1n, 10n, 20n, 30n, 40n, 50n, 60n, 70n]),
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FAKE_WASM = new Uint8Array([1, 2, 3]);
const FAKE_ZKEY = new Uint8Array([4, 5, 6]);
const FAKE_ARK = new Uint8Array([7, 8, 9]);

const VALID_INPUTS = { commitment: '12345', nullifier: '67890' };

function makeSnarkjsProvider(): ArtifactProvider {
  return {
    getCircuitWasm: vi.fn().mockResolvedValue(FAKE_WASM),
    getCircuitZkey: vi.fn().mockResolvedValue(FAKE_ZKEY),
  };
}

function makeArkworksProvider(): ArtifactProvider {
  return {
    getCircuitWasm: vi.fn().mockResolvedValue(FAKE_WASM),
    getCircuitZkey: vi.fn().mockResolvedValue(FAKE_ZKEY),
    getCircuitProvingKey: vi.fn().mockResolvedValue(FAKE_ARK),
  };
}

// ─── snarkjs backend (default) ───────────────────────────────────────────────

describe('generateProof — snarkjs backend (default)', () => {
  let provider: ArtifactProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = makeSnarkjsProvider();
  });

  it('returns ProofResult with proof and publicSignals', async () => {
    const result = await generateProof(CircuitType.Unshield, VALID_INPUTS, { provider });
    expect(result.proof).toMatch(/^0x[0-9a-f]+$/i);
    expect(result.publicSignals).toHaveLength(7);
    expect(result.circuitType).toBe(CircuitType.Unshield);
  });

  it('uses snarkjs backend by default (no backend option)', async () => {
    const snarkjs = await import('snarkjs');
    await generateProof(CircuitType.Unshield, VALID_INPUTS, { provider });
    expect(snarkjs.groth16.fullProve).toHaveBeenCalledTimes(1);
  });

  it('explicit backend: snarkjs also uses snarkjs', async () => {
    const snarkjs = await import('snarkjs');
    await generateProof(CircuitType.Unshield, VALID_INPUTS, { provider, backend: 'snarkjs' });
    expect(snarkjs.groth16.fullProve).toHaveBeenCalledTimes(1);
  });

  it('fetches WASM and zkey from provider', async () => {
    await generateProof(CircuitType.Unshield, VALID_INPUTS, { provider });
    expect(provider.getCircuitWasm).toHaveBeenCalledWith(CircuitType.Unshield);
    expect(provider.getCircuitZkey).toHaveBeenCalledWith(CircuitType.Unshield);
  });

  it('throws CircuitNotFoundError when provider rejects', async () => {
    const badProvider: ArtifactProvider = {
      getCircuitWasm: vi.fn().mockRejectedValue(new Error('not found')),
      getCircuitZkey: vi.fn().mockRejectedValue(new Error('not found')),
    };
    await expect(
      generateProof(CircuitType.Unshield, VALID_INPUTS, { provider: badProvider })
    ).rejects.toBeInstanceOf(CircuitNotFoundError);
  });

  it('throws InvalidInputsError for null input value', async () => {
    await expect(
      generateProof(CircuitType.Unshield, { commitment: null as any }, { provider })
    ).rejects.toBeInstanceOf(InvalidInputsError);
  });

  it('throws ProofGenerationError when snarkjs fullProve throws', async () => {
    const snarkjs = await import('snarkjs');
    vi.mocked(snarkjs.groth16.fullProve).mockRejectedValueOnce(new Error('proving failed'));
    await expect(
      generateProof(CircuitType.Unshield, VALID_INPUTS, { provider })
    ).rejects.toBeInstanceOf(ProofGenerationError);
  });
});

// ─── arkworks backend ─────────────────────────────────────────────────────────

describe('generateProof — arkworks backend', () => {
  let provider: ArtifactProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = makeArkworksProvider();
  });

  it('returns ProofResult with proof and publicSignals', async () => {
    const result = await generateProof(CircuitType.Unshield, VALID_INPUTS, {
      provider,
      backend: 'arkworks',
    });
    expect(result.proof).toMatch(/^0x[0-9a-f]+$/i);
    expect(result.publicSignals).toHaveLength(7);
    expect(result.circuitType).toBe(CircuitType.Unshield);
  });

  it('uses snarkjs wtns.calculate (not fullProve) for witness', async () => {
    const snarkjs = await import('snarkjs');
    await generateProof(CircuitType.Unshield, VALID_INPUTS, { provider, backend: 'arkworks' });
    expect(snarkjs.wtns.calculate).toHaveBeenCalledTimes(1);
    expect(snarkjs.groth16.fullProve).not.toHaveBeenCalled();
  });

  it('fetches WASM and .ark proving key from provider', async () => {
    await generateProof(CircuitType.Unshield, VALID_INPUTS, { provider, backend: 'arkworks' });
    expect(provider.getCircuitWasm).toHaveBeenCalledWith(CircuitType.Unshield);
    expect(provider.getCircuitProvingKey).toHaveBeenCalledWith(CircuitType.Unshield);
    expect(provider.getCircuitZkey).not.toHaveBeenCalled();
  });

  it('passes witness decimal JSON and .ark bytes to WASM', async () => {
    const wasm = await import('@orbinum/groth16-proofs');
    await generateProof(CircuitType.Unshield, VALID_INPUTS, { provider, backend: 'arkworks' });
    expect(wasm.generate_proof_from_decimal_wasm).toHaveBeenCalledTimes(1);
    const [numSigs, witnessJson, pkBytes] = (
      wasm.generate_proof_from_decimal_wasm as ReturnType<typeof vi.fn>
    ).mock.calls[0];
    expect(numSigs).toBe(7);
    const parsed = JSON.parse(witnessJson);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0]).toBe('1');
    expect(pkBytes).toBe(FAKE_ARK);
  });

  it('throws CircuitNotFoundError when provider rejects on proving key fetch', async () => {
    const badProvider: ArtifactProvider = {
      getCircuitWasm: vi.fn().mockResolvedValue(FAKE_WASM),
      getCircuitZkey: vi.fn().mockResolvedValue(FAKE_ZKEY),
      getCircuitProvingKey: vi.fn().mockRejectedValue(new Error('ark not found')),
    };
    await expect(
      generateProof(CircuitType.Unshield, VALID_INPUTS, {
        provider: badProvider,
        backend: 'arkworks',
      })
    ).rejects.toBeInstanceOf(CircuitNotFoundError);
  });

  it('throws CircuitNotFoundError when provider has no getCircuitProvingKey', async () => {
    const noArkProvider: ArtifactProvider = {
      getCircuitWasm: vi.fn().mockResolvedValue(FAKE_WASM),
      getCircuitZkey: vi.fn().mockResolvedValue(FAKE_ZKEY),
    };
    await expect(
      generateProof(CircuitType.Unshield, VALID_INPUTS, {
        provider: noArkProvider,
        backend: 'arkworks',
      })
    ).rejects.toBeInstanceOf(CircuitNotFoundError);
  });

  it('throws ProofGenerationError when WASM proof generation throws', async () => {
    const wasm = await import('@orbinum/groth16-proofs');
    vi.mocked(wasm.generate_proof_from_decimal_wasm).mockImplementationOnce(() => {
      throw new Error('bad proving key');
    });
    await expect(
      generateProof(CircuitType.Unshield, VALID_INPUTS, { provider, backend: 'arkworks' })
    ).rejects.toBeInstanceOf(ProofGenerationError);
  });

  it('throws InvalidInputsError for null input value', async () => {
    await expect(
      generateProof(
        CircuitType.Unshield,
        { commitment: null as any },
        {
          provider,
          backend: 'arkworks',
        }
      )
    ).rejects.toBeInstanceOf(InvalidInputsError);
  });
});
