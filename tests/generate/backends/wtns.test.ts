/**
 * The `.wtns` parser, driven directly through the arkworks backend.
 *
 * This is the only binary parsing this package does, and it runs on a buffer
 * that snarkjs produced in memory — so in practice the input is well-formed.
 * The reason to test the malformed cases anyway is that the failure mode is
 * silent: a wrong offset yields a witness of plausible length whose values are
 * garbage, and the proof built from it is exactly 128 bytes and never verifies.
 * That bug is indistinguishable from a bad proving key at every layer above.
 *
 * The section table is walked rather than assumed, so the tests cover a data
 * section that is not first, lengths that run past the end, and a count that
 * would overrun — each of which returns a different wrong answer if the bounds
 * checks are dropped.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateProof } from '../../../src/generate';
import { CircuitType } from '../../../src/circuits/types';
import { ProofGenerationError } from '../../../src/errors';
import type { ArtifactProvider } from '../../../src/providers/interface';

vi.mock('@orbinum/groth16-proofs', () => ({
  default: vi.fn().mockResolvedValue(undefined),
  init_panic_hook: vi.fn(),
  initSync: vi.fn(),
  compress_snarkjs_proof_wasm: vi.fn().mockReturnValue('0x' + 'ab'.repeat(128)),
  generate_proof_wasm: vi.fn().mockReturnValue(
    JSON.stringify({
      proof: '0x' + 'cd'.repeat(128),
      publicSignals: Array.from(
        { length: 7 },
        (_, i) =>
          '0x' +
          String(i + 1)
            .padStart(2, '0')
            .repeat(32)
      ),
    })
  ),
}));

/** The witness buffer the mocked snarkjs will hand back on the next call. */
let nextWtns: Uint8Array;

vi.mock('snarkjs', () => ({
  groth16: { fullProve: vi.fn() },
  wtns: {
    calculate: vi.fn().mockImplementation(async (_i, _w, buffer) => {
      buffer.data = nextWtns;
    }),
  },
}));

const FIELD_BYTES = 32;

/** One (u32 type, u64 length) section header followed by its payload. */
interface Section {
  type: number;
  payload: Uint8Array;
  /** Override the declared length — for the "runs past the end" cases. */
  declaredLength?: number;
}

/** Assemble a `.wtns` from raw sections, so a test can build a broken one. */
function wtns(
  sections: Section[],
  opts: { magic?: string; sectionCount?: number } = {}
): Uint8Array {
  const body = sections.reduce((n, s) => n + 12 + s.payload.length, 0);
  const bytes = new Uint8Array(12 + body);
  const view = new DataView(bytes.buffer);

  const magic = opts.magic ?? 'wtns';
  for (let i = 0; i < 4; i++) bytes[i] = magic.charCodeAt(i);
  view.setUint32(4, 2, true);
  view.setUint32(8, opts.sectionCount ?? sections.length, true);

  let off = 12;
  for (const s of sections) {
    view.setUint32(off, s.type, true);
    view.setBigUint64(off + 4, BigInt(s.declaredLength ?? s.payload.length), true);
    off += 12;
    bytes.set(s.payload, off);
    off += s.payload.length;
  }
  return bytes;
}

/** `n` field elements, each the little-endian encoding of its index. */
function witness(n: number): Uint8Array {
  const out = new Uint8Array(n * FIELD_BYTES);
  for (let i = 0; i < n; i++) out[i * FIELD_BYTES] = i;
  return out;
}

/** A plausible section-1 header: field size, prime, witness count. */
const headerSection = (count: number): Section => {
  const payload = new Uint8Array(4 + FIELD_BYTES + 4);
  new DataView(payload.buffer).setUint32(0, FIELD_BYTES, true);
  new DataView(payload.buffer).setUint32(4 + FIELD_BYTES, count, true);
  return { type: 1, payload };
};

const provider = (): ArtifactProvider => ({
  getCircuitWasm: vi.fn().mockResolvedValue(new Uint8Array([1])),
  getCircuitZkey: vi.fn().mockResolvedValue(new Uint8Array([2])),
  getCircuitProvingKey: vi.fn().mockResolvedValue(new Uint8Array([3])),
});

/** Prove with the arkworks backend over whatever `nextWtns` currently holds. */
const prove = () =>
  generateProof(CircuitType.Unshield, { a: '1' }, { provider: provider(), backend: 'arkworks' });

/** The witness bytes the wasm boundary received on the last call. */
async function witnessSeenByWasm(): Promise<Uint8Array> {
  const wasm = await import('@orbinum/groth16-proofs');
  return (wasm.generate_proof_wasm as ReturnType<typeof vi.fn>).mock.calls[0][1];
}

describe('.wtns parsing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('extracts the data section verbatim', async () => {
    nextWtns = wtns([headerSection(7), { type: 2, payload: witness(7) }]);
    await prove();

    const seen = await witnessSeenByWasm();
    expect(seen.length).toBe(7 * FIELD_BYTES);
    // Values survive byte for byte — the parser slices, it does not re-encode.
    for (let i = 0; i < 7; i++) expect(seen[i * FIELD_BYTES]).toBe(i);
  });

  it('finds the data section when it is not the first', async () => {
    // Section order is not guaranteed by the format, and a parser that assumed
    // "data is section 2 at a fixed offset" would return the header's bytes:
    // the right length, entirely wrong values.
    nextWtns = wtns([
      { type: 9, payload: new Uint8Array(40).fill(0xee) },
      headerSection(3),
      { type: 2, payload: witness(3) },
    ]);
    await prove();

    const seen = await witnessSeenByWasm();
    expect(seen.length).toBe(3 * FIELD_BYTES);
    expect(seen.every((b, i) => (i % FIELD_BYTES === 0 ? b === i / FIELD_BYTES : b === 0))).toBe(
      true
    );
  });

  it('reads a witness that is a view into a larger buffer', async () => {
    // snarkjs hands back a subarray, so byteOffset is routinely non-zero. A
    // DataView built on `.buffer` without it reads from the wrong place.
    const inner = wtns([headerSection(2), { type: 2, payload: witness(2) }]);
    const outer = new Uint8Array(64 + inner.length);
    outer.set(inner, 64);
    nextWtns = outer.subarray(64);
    await prove();

    expect((await witnessSeenByWasm()).length).toBe(2 * FIELD_BYTES);
  });

  it.each([
    ['a buffer too short to hold a header', new Uint8Array(8)],
    ['the wrong magic', wtns([{ type: 2, payload: witness(1) }], { magic: 'ZKEY' })],
    ['no data section at all', wtns([headerSection(1)])],
    [
      'a data section running past the end',
      wtns([{ type: 2, payload: witness(1), declaredLength: 4096 }]),
    ],
    ['a section count larger than the table', wtns([headerSection(1)], { sectionCount: 99 })],
    [
      'a data length that is not a multiple of the field size',
      wtns([{ type: 2, payload: new Uint8Array(33), declaredLength: 33 }]),
    ],
    ['an empty data section', wtns([headerSection(0), { type: 2, payload: new Uint8Array(0) }])],
  ])('rejects %s', async (_label, buffer) => {
    nextWtns = buffer as Uint8Array;
    await expect(prove()).rejects.toBeInstanceOf(ProofGenerationError);
  });

  it('does not hang on an absurd section length', async () => {
    // A u64 length is attacker-controlled in principle and cannot be trusted to
    // fit in a Number. The walk must terminate rather than loop or allocate.
    nextWtns = wtns([{ type: 1, payload: new Uint8Array(0), declaredLength: 2 ** 53 }]);
    await expect(prove()).rejects.toBeInstanceOf(ProofGenerationError);
  });
});
