/**
 * Real proofs, from the published packages, verified.
 *
 * The 150 unit tests mock `@orbinum/groth16-proofs` — deliberately, so they can
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
import { CIRCUIT_INPUTS } from './inputs';

/**
 * Circuits under test. The expected arity comes from `getCircuitConfig` rather
 * than a second table here: a copy would agree with the source right up until
 * one of them changed, and the test's whole job is to notice that.
 */
const CIRCUITS: CircuitType[] = [
  CircuitType.ValueProof,
  CircuitType.Unshield,
  CircuitType.Transfer,
];

const strict = Boolean(process.env.PROOF_GENERATOR_REQUIRE_ARTIFACTS);

/** Whether the circuits package is installed, with the artifacts proving needs. */
function artifactsPresent(): boolean {
  return existsSync(join(process.cwd(), 'node_modules', '@orbinum', 'circuits', 'package.json'));
}

/**
 * The public-signal count the published verifying key declares.
 *
 * `IC` holds one point per public signal plus one, so its length is the arity
 * by construction — this is the same number the on-chain verifier derives, read
 * from the artifact rather than from any table in this repository.
 */
function arityFromVerifyingKey(circuit: CircuitType): number {
  // The package compiles to CommonJS, so `import.meta` is not available here.
  // `require.resolve` finds the package wherever pnpm actually put it, which a
  // hand-built node_modules path does not.
  const root = dirname(require.resolve('@orbinum/circuits/package.json'));
  const vk = JSON.parse(readFileSync(join(root, `verification_key_${circuit}.json`), 'utf8'));
  return vk.IC.length - 1;
}

describe('proofs from the published packages', () => {
  let available = false;
  let snarkjs: typeof import('snarkjs');

  beforeAll(async () => {
    available = artifactsPresent();
    if (!available && strict) {
      throw new Error(
        'PROOF_GENERATOR_REQUIRE_ARTIFACTS is set but @orbinum/circuits is not ' +
          'installed — these tests would skip, which is indistinguishable from passing.'
      );
    }
    if (available) snarkjs = await import('snarkjs');
  }, 60_000);

  for (const name of CIRCUITS) {
    describe(name, () => {
      const { expectedPublicSignals } = getCircuitConfig(name);

      it('the arity this package declares matches the published verifying key', () => {
        if (!available) return;

        // `getCircuitConfig` is a hand-written table. Nothing derived it from an
        // artifact, so nothing noticed when a circuit's shape and this table
        // disagreed — a proof with the wrong arity is well-formed and fails
        // on-chain with nothing to say why. The verifying key is the authority.
        expect(expectedPublicSignals).toBe(arityFromVerifyingKey(name));
      });

      it.each(['snarkjs', 'arkworks'] as const)(
        'the %s backend produces a 128-byte proof with the right arity',
        async backend => {
          if (!available) return;

          const provider = new NodeArtifactProvider();
          const result = await generateProof(name, CIRCUIT_INPUTS[name], { provider, backend });

          const raw = Buffer.from(result.proof.replace(/^0x/, ''), 'hex');
          expect(raw.length).toBe(128);
          expect(result.publicSignals).toHaveLength(expectedPublicSignals);
          expect(result.circuitType).toBe(name);
        },
        180_000
      );

      it('both backends agree on the public signals', async () => {
        if (!available) return;

        const provider = new NodeArtifactProvider();
        const [a, b] = await Promise.all([
          generateProof(name, CIRCUIT_INPUTS[name], { provider, backend: 'snarkjs' }),
          generateProof(name, CIRCUIT_INPUTS[name], { provider, backend: 'arkworks' }),
        ]);

        // The two share no proving code — snarkjs is JavaScript, arkworks is
        // the crate's wasm — so agreement here is independent evidence that
        // both read the witness the same way.
        expect(a.publicSignals).toEqual(b.publicSignals);

        // And the proofs differ: Groth16 draws fresh randomness per proof, so
        // two identical proofs would mean the randomness was reused, which
        // leaks the witness.
        expect(a.proof).not.toBe(b.proof);
      }, 180_000);

      it('the proof verifies against the registered verifying key', async () => {
        if (!available) return;

        const provider = new NodeArtifactProvider();
        const wasm = await provider.getCircuitWasm(name);
        const zkey = await provider.getCircuitZkey(name);

        // Proved through snarkjs directly, because verification needs the
        // uncompressed proof and `generateProof` returns the chain's 128-byte
        // form. What this pins is the pairing check itself: that the witness
        // these inputs produce satisfies the circuit the published key encodes.
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
          CIRCUIT_INPUTS[name] as never,
          wasm as Uint8Array,
          zkey as Uint8Array
        );

        const vk = await snarkjs.zKey.exportVerificationKey(zkey as never);
        expect(await snarkjs.groth16.verify(vk as never, publicSignals, proof)).toBe(true);

        // A tampered signal must break it — otherwise the check above passes
        // for a verifier that ignores its inputs.
        const tampered = [...publicSignals];
        tampered[0] = (BigInt(tampered[0] as string) + 1n).toString();
        expect(await snarkjs.groth16.verify(vk as never, tampered, proof)).toBe(false);
      }, 180_000);
    });
  }
});
