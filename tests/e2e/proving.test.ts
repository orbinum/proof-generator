/**
 * Real proofs, from the published packages, verified.
 *
 * The unit tests mock `@orbinum/groth16-proofs` — deliberately, so they can
 * run without artifacts and stay fast. The cost is that they would all pass
 * against a wasm module that returns 128 bytes of nothing, which is not a
 * hypothetical failure: this stack shipped exactly that for two major versions.
 * Every proof was well-formed, exactly 128 bytes, and never verified.
 *
 * So this file mocks nothing. It resolves the real `@orbinum/circuits` and
 * `@orbinum/groth16-proofs` from node_modules, drives `generateProof` through
 * its public API, and hands the result to snarkjs — an implementation that
 * shares no proving code with the arkworks path.
 *
 * Both backends are run over identical inputs. They agree on the public signals
 * or they do not; agreement is independent evidence in a way that self-checking
 * is not.
 *
 * Skips when the artifacts are absent, since `@orbinum/circuits` is 27 MB and a
 * contributor may not have installed it. `PROOF_GENERATOR_REQUIRE_ARTIFACTS=1`
 * turns that skip into a failure, which is what CI sets — a suite that skips
 * everything looks exactly like a suite that passes everything.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { generateProof, NodeArtifactProvider, getCircuitConfig } from '../../src/index';
import { CircuitType } from '../../src/circuits/types';
import { inputsFor } from './inputs';

/**
 * Circuit versions under test: every version the published package ships. The
 * expected arity comes from `getCircuitConfig` rather than a second table here:
 * a copy would agree with the source right up until one of them changed, and
 * the test's whole job is to notice that.
 */
const CASES = [
  ...([CircuitType.Unshield, CircuitType.Transfer] as const).flatMap(circuit =>
    [1, 2].map(version => ({ circuit, version }))
  ),
  { circuit: CircuitType.Shield, version: 1 },
];

const strict = Boolean(process.env.PROOF_GENERATOR_REQUIRE_ARTIFACTS);

/** Where pnpm put the circuits package, if it is installed. */
function packageRoot(): string | null {
  try {
    // The package compiles to CommonJS, so `import.meta` is not available here.
    return dirname(require.resolve('@orbinum/circuits/package.json'));
  } catch {
    return null;
  }
}

/**
 * The public-signal count a published verifying key declares.
 *
 * `IC` holds one point per public signal plus one, so its length is the arity
 * by construction — the same number the on-chain verifier derives, read from
 * the artifact rather than from any table in this repository.
 */
function arityFromVerifyingKey(root: string, circuit: CircuitType, version: number): number {
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  const file = manifest.circuits[circuit].versions[String(version)].artifacts.vk_json.file;
  return JSON.parse(readFileSync(join(root, file), 'utf8')).IC.length - 1;
}

describe('proofs from the published packages', () => {
  let root: string | null = null;
  let snarkjs: typeof import('snarkjs');

  beforeAll(async () => {
    root = packageRoot();
    if (root && !existsSync(join(root, 'manifest.json'))) root = null;
    if (!root && strict) {
      throw new Error(
        'PROOF_GENERATOR_REQUIRE_ARTIFACTS is set but @orbinum/circuits is not ' +
          'installed — these tests would skip, which is indistinguishable from passing.'
      );
    }
    if (root) snarkjs = await import('snarkjs');
  }, 60_000);

  for (const { circuit, version } of CASES) {
    describe(`${circuit} v${version}`, () => {
      const { expectedPublicSignals } = getCircuitConfig(circuit, version);
      const inputs = inputsFor(circuit, version);
      const provider = () => new NodeArtifactProvider({ circuitVersions: { [circuit]: version } });

      it('the arity this package declares matches the published verifying key', () => {
        if (!root) return;

        // `getCircuitConfig` is a hand-written table. A proof with the wrong
        // arity is well-formed and fails on-chain with nothing to say why, so
        // the verifying key is the authority.
        expect(expectedPublicSignals).toBe(arityFromVerifyingKey(root, circuit, version));
      });

      it.each(['snarkjs', 'arkworks'] as const)(
        'the %s backend produces a 128-byte proof with the right arity',
        async backend => {
          if (!root) return;

          const result = await generateProof(circuit, inputs, { provider: provider(), backend });

          const raw = Buffer.from(result.proof.replace(/^0x/, ''), 'hex');
          expect(raw.length).toBe(128);
          expect(result.publicSignals).toHaveLength(expectedPublicSignals);
          expect(result.circuitType).toBe(circuit);
        },
        180_000
      );

      it('both backends agree on the public signals', async () => {
        if (!root) return;

        const [a, b] = await Promise.all([
          generateProof(circuit, inputs, { provider: provider(), backend: 'snarkjs' }),
          generateProof(circuit, inputs, { provider: provider(), backend: 'arkworks' }),
        ]);

        // The two share no proving code — snarkjs is JavaScript, arkworks is
        // the crate's wasm — so agreement is independent evidence that both
        // read the witness the same way.
        expect(a.publicSignals).toEqual(b.publicSignals);

        // And the proofs differ: Groth16 draws fresh randomness per proof, so
        // two identical proofs would mean reused randomness, which leaks the
        // witness.
        expect(a.proof).not.toBe(b.proof);
      }, 180_000);

      it('the proof verifies, and binds every public signal', async () => {
        if (!root) return;

        const p = provider();
        const wasm = await p.getCircuitWasm(circuit);
        const zkey = await p.getCircuitZkey(circuit);

        // Proved through snarkjs directly, because verification needs the
        // uncompressed proof and `generateProof` returns the chain's 128-byte
        // form. This pins the pairing check itself.
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
          inputs as never,
          wasm,
          zkey
        );
        const vk = await snarkjs.zKey.exportVerificationKey(zkey as never);
        expect(await snarkjs.groth16.verify(vk as never, publicSignals, proof)).toBe(true);

        // Every signal must break it when changed — in v2 that includes
        // memo_hash, the last one. Otherwise the check above would pass for a
        // verifier that ignores some of its inputs.
        for (let i = 0; i < publicSignals.length; i++) {
          const tampered = [...publicSignals];
          tampered[i] = (BigInt(tampered[i] as string) + 1n).toString();
          expect(await snarkjs.groth16.verify(vk as never, tampered, proof), `signal ${i}`).toBe(
            false
          );
        }
      }, 180_000);
    });
  }

  it('the provider defaults to the manifest active version (v2)', async () => {
    if (!root) return;
    const { version } = await new NodeArtifactProvider().getResolvedVersion(CircuitType.Transfer);
    expect(version).toBe(2);
  });

  it('v1 inputs cannot prove against v2 artifacts', async () => {
    if (!root) return;
    // A caller that forgot memo_hash fails at the witness, not on-chain.
    await expect(
      generateProof(CircuitType.Unshield, inputsFor(CircuitType.Unshield, 1), {
        provider: new NodeArtifactProvider(),
      })
    ).rejects.toThrow();
  }, 180_000);
});
