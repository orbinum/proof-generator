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
  generate_proof_wasm: vi.fn().mockReturnValue(
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
    // The arkworks backend reads the raw `.wtns` bytes rather than calling
    // exportJson, so the mock has to produce a real one — see buildWtns below.
    calculate: vi.fn().mockImplementation(async (_inputs, _wasm, buffer) => {
      buffer.data = buildWtns([1n, 10n, 20n, 30n, 40n, 50n, 60n, 70n]);
    }),
    exportJson: vi.fn().mockResolvedValue([1n, 10n, 20n, 30n, 40n, 50n, 60n, 70n]),
  },
}));

/**
 * A minimal but structurally real `.wtns` buffer.
 *
 * The backend parses the section table for the data section, so a mock that
 * returned an arbitrary blob would test the error path instead of the happy one.
 * Layout: "wtns" magic, u32 version, u32 section count, then (u32 type, u64
 * length) per section — 1 is the header, 2 is the data.
 */
function buildWtns(values: bigint[]): Uint8Array {
  const FIELD_BYTES = 32;
  const headerSection = 4 + FIELD_BYTES + 4; // field size, prime, witness count
  const dataSection = values.length * FIELD_BYTES;
  const total = 12 + 12 + headerSection + 12 + dataSection;

  const bytes = new Uint8Array(total);
  const view = new DataView(bytes.buffer);
  let off = 0;

  bytes.set([0x77, 0x74, 0x6e, 0x73], off); // "wtns"
  off += 4;
  view.setUint32(off, 2, true); // version
  off += 4;
  view.setUint32(off, 2, true); // two sections
  off += 4;

  view.setUint32(off, 1, true); // section 1: header
  view.setBigUint64(off + 4, BigInt(headerSection), true);
  off += 12;
  view.setUint32(off, FIELD_BYTES, true);
  off += 4 + FIELD_BYTES; // field size, then the prime (zeroes are fine here)
  view.setUint32(off, values.length, true);
  off += 4;

  view.setUint32(off, 2, true); // section 2: data
  view.setBigUint64(off + 4, BigInt(dataSection), true);
  off += 12;
  for (const v of values) {
    let rest = v;
    for (let i = 0; i < FIELD_BYTES; i++) {
      bytes[off + i] = Number(rest & 0xffn);
      rest >>= 8n;
    }
    off += FIELD_BYTES;
  }
  return bytes;
}

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

  it('passes the .ark artifact and a raw little-endian witness to WASM', async () => {
    const wasm = await import('@orbinum/groth16-proofs');
    await generateProof(CircuitType.Unshield, VALID_INPUTS, { provider, backend: 'arkworks' });
    expect(wasm.generate_proof_wasm).toHaveBeenCalledTimes(1);

    const [artifactBytes, witnessBytes] = (wasm.generate_proof_wasm as ReturnType<typeof vi.fn>)
      .mock.calls[0];
    expect(artifactBytes).toBe(FAKE_ARK);

    // Bytes, not decimal strings: the old ABI stringified ~17,000 field
    // elements into JSON on every proof.
    expect(witnessBytes).toBeInstanceOf(Uint8Array);
    expect(witnessBytes.length % 32).toBe(0);
    expect(witnessBytes.length / 32).toBe(8);

    // The witness opens with the constant 1, little-endian.
    expect(witnessBytes[0]).toBe(1);
    expect(witnessBytes.subarray(1, 32).every((b: number) => b === 0)).toBe(true);
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
    vi.mocked(wasm.generate_proof_wasm).mockImplementationOnce(() => {
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

/**
 * Single-threaded proving — the mobile fix.
 *
 * snarkjs takes `proverOptions` as its SIXTH positional argument and forwards
 * `singleThread` to `buildBn128`, which is what stops `ffjavascript` from
 * spawning one Worker per core. The position matters: passing the object in the
 * wrong slot is silently ignored, so these tests assert the argument index and
 * not merely that the call happened.
 */
describe('generateProof — singleThread', () => {
  let provider: ArtifactProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = makeSnarkjsProvider();
  });

  /** The `proverOptions` snarkjs received on the last call. */
  async function proverOptionsFromLastCall(): Promise<unknown> {
    const snarkjs = await import('snarkjs');
    const call = (snarkjs.groth16.fullProve as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0];
    return call?.[5];
  }

  it('forwards singleThread: true in the proverOptions slot', async () => {
    await generateProof(CircuitType.Unshield, VALID_INPUTS, { provider, singleThread: true });

    expect(await proverOptionsFromLastCall()).toEqual({ singleThread: true });
  });

  it('forwards singleThread: false when the caller opts out explicitly', async () => {
    // An explicit `false` must survive: a desktop app that measured its own
    // environment should never be silently downgraded by the heuristic.
    await generateProof(CircuitType.Unshield, VALID_INPUTS, { provider, singleThread: false });

    expect(await proverOptionsFromLastCall()).toEqual({ singleThread: false });
  });

  it('still passes proverOptions when the caller says nothing', async () => {
    // Absent means "let the device decide" — the option object is always sent,
    // so snarkjs never falls back to its own default path.
    await generateProof(CircuitType.Unshield, VALID_INPUTS, { provider });

    expect(await proverOptionsFromLastCall()).toMatchObject({
      singleThread: expect.any(Boolean),
    });
  });

  it('leaves the logger and witness-calculator slots untouched', async () => {
    // Those two arguments belong to snarkjs; overriding them by accident would
    // change witness calculation rather than thread count.
    const snarkjs = await import('snarkjs');
    await generateProof(CircuitType.Unshield, VALID_INPUTS, { provider, singleThread: true });

    const call = (snarkjs.groth16.fullProve as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0];
    expect(call?.[3]).toBeUndefined();
    expect(call?.[4]).toBeUndefined();
  });

  it('does not reach snarkjs at all on the arkworks backend', async () => {
    // arkworks is single-threaded already; the option is meaningless there.
    const snarkjs = await import('snarkjs');
    await generateProof(CircuitType.Unshield, VALID_INPUTS, {
      provider: makeArkworksProvider(),
      backend: 'arkworks',
      singleThread: true,
    });

    expect(snarkjs.groth16.fullProve).not.toHaveBeenCalled();
  });
});
