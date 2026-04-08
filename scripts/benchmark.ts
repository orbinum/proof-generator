/**
 * Benchmark: proof generation times across all circuits and both backends.
 *
 * Run with:
 *   npx tsx scripts/benchmark.ts
 */

// @ts-ignore
import { buildPoseidon, buildEddsa } from 'circomlibjs';
import * as snarkjs from 'snarkjs';
import { generateProof } from '../src/generate';
import { NodeArtifactProvider } from '../src/providers';
import { CircuitType } from '../src/circuits/types';
import { generateProofFromWitnessWasm, compressSnarkjsProofWasm } from '../src/wasm/loader';
import { getCircuitConfig } from '../src/circuits/config';

const RUNS = 3;
const provider = new NodeArtifactProvider();

// ── Helpers ──────────────────────────────────────────────────────────────────

function median(times: number[]): number {
  const sorted = [...times].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function avg(times: number[]): number {
  return Math.round(times.reduce((s, t) => s + t, 0) / times.length);
}

async function bench(
  label: string,
  circuitType: CircuitType,
  inputs: Record<string, unknown>,
  backend: 'snarkjs' | 'arkworks'
): Promise<number[]> {
  const times: number[] = [];
  process.stdout.write(`  ${label.padEnd(45)}`);

  for (let i = 0; i < RUNS; i++) {
    const t0 = Date.now();
    await generateProof(circuitType, inputs as any, { provider, backend });
    times.push(Date.now() - t0);
    process.stdout.write('.');
  }

  const med = median(times);
  const mean = avg(times);
  console.log(
    `  med=${med}ms  avg=${mean}ms  runs=[${times.join(', ')}]ms`
  );
  return times;
}

// ── Input builders ────────────────────────────────────────────────────────────

async function buildDisclosureInputs(poseidon: any) {
  const F = poseidon.F;
  const value = 1_000_000n;
  const ownerPubkey = 0x1234567890abcdefn;
  const blinding = 0xdeadbeefcafebaben;
  const assetId = 1n;
  const commitment: bigint = F.toObject(poseidon([value, assetId, ownerPubkey, blinding]));
  return {
    commitment: commitment.toString(),
    revealed_value: value.toString(),
    revealed_asset_id: assetId.toString(),
    revealed_owner_hash: '0',
    value: value.toString(),
    asset_id: assetId.toString(),
    owner_pubkey: ownerPubkey.toString(),
    blinding: blinding.toString(),
    disclose_value: '1',
    disclose_asset_id: '1',
    disclose_owner: '0',
  };
}

async function buildPrivateLinkInputs(poseidon: any) {
  const F = poseidon.F;
  // private_link: commitment = Poseidon(Poseidon(chain_id_fe, address_fe), blinding_fe)
  const chainIdFe = 1000n; // chain id as field element
  const addressFe = 0x1234567890abcdefn; // address bytes as LE field element
  const blindingFe = 0xdeadbeefcafebaben;
  const callHashFe = 0x9988776655443322n;

  const inner: bigint = F.toObject(poseidon([chainIdFe, addressFe]));
  const commitment: bigint = F.toObject(poseidon([inner, blindingFe]));

  return {
    commitment: commitment.toString(),
    call_hash_fe: callHashFe.toString(),
    chain_id_fe: chainIdFe.toString(),
    address_fe: addressFe.toString(),
    blinding_fe: blindingFe.toString(),
  };
}

async function buildUnshieldInputs(poseidon: any) {
  const F = poseidon.F;
  const DEPTH = 20;

  const noteValue = 1_000_000n;
  const noteAssetId = 1n;
  const noteOwner = 0x1234567890abcdefn;
  const noteBlinding = 0xdeadbeefcafebaben;
  const spendingKey = 0x9999n;
  const recipient = 0x742d35cc6634c0532925a3b844bc454e4438f44en;

  // commitment = Poseidon4(value, asset_id, owner_pubkey, blinding)
  const commitment: bigint = F.toObject(poseidon([noteValue, noteAssetId, noteOwner, noteBlinding]));

  // nullifier = Poseidon2(commitment, spending_key)
  const nullifier: bigint = F.toObject(poseidon([commitment, spendingKey]));

  // Merkle proof: note at position 0 — all path_indices = 0, all path_elements = 0
  // root = Poseidon2^20(commitment, 0, 0, ...) going up from leaf
  let merkleRoot: bigint = commitment;
  for (let i = 0; i < DEPTH; i++) {
    merkleRoot = F.toObject(poseidon([merkleRoot, 0n]));
  }

  return {
    merkle_root: merkleRoot.toString(),
    nullifier: nullifier.toString(),
    amount: noteValue.toString(),
    recipient: recipient.toString(),
    asset_id: noteAssetId.toString(),
    note_value: noteValue.toString(),
    note_asset_id: noteAssetId.toString(),
    note_owner: noteOwner.toString(),
    note_blinding: noteBlinding.toString(),
    spending_key: spendingKey.toString(),
    path_elements: Array(DEPTH).fill('0'),
    path_indices: Array(DEPTH).fill('0'),
  };
}

async function buildTransferInputs(poseidon: any, eddsa: any) {
  const F = poseidon.F;
  const DEPTH = 20;
  const assetId = 1n;

  // Two input notes, equal value so sum is conserved
  const inputValues = [500_000n, 500_000n];
  const inputBlindings = [0xdeadbeef01n, 0xdeadbeef02n];
  const spendingKeys = [0x1111n, 0x2222n];

  // EdDSA keypairs per input note owner
  const prvKeys = [Buffer.alloc(32), Buffer.alloc(32)];
  prvKeys[0][0] = 1;
  prvKeys[1][0] = 2;
  const pubKeys = prvKeys.map(pk => eddsa.prv2pub(pk));
  const ownerAx = pubKeys.map((pk: any) => eddsa.F.toObject(pk[0]) as bigint);
  const ownerAy = pubKeys.map((pk: any) => eddsa.F.toObject(pk[1]) as bigint);

  // Input commitments: Poseidon4(value, asset_id, owner_pubkey=Ax, blinding)
  const inputCommitments = inputValues.map((v, i) =>
    F.toObject(poseidon([v, assetId, ownerAx[i], inputBlindings[i]])) as bigint
  );

  // EdDSA signatures over each input commitment
  const sigs = inputCommitments.map((c: bigint, i: number) =>
    eddsa.signPoseidon(prvKeys[i], eddsa.F.e(c))
  );

  // Nullifiers: Poseidon2(commitment, spending_key)
  const nullifiers = inputCommitments.map((c: bigint, i: number) =>
    F.toObject(poseidon([c, spendingKeys[i]])) as bigint
  );

  // Merkle tree with 2 leaves:
  //   position 0: inputCommitments[0] (left)
  //   position 1: inputCommitments[1] (right)
  // root = Poseidon2^19(...Poseidon2(c0, c1)..., 0)
  let merkleRoot: bigint = F.toObject(poseidon([inputCommitments[0], inputCommitments[1]]));
  for (let i = 0; i < DEPTH - 1; i++) {
    merkleRoot = F.toObject(poseidon([merkleRoot, 0n]));
  }

  // Path for note 0 (position 0): sibling at level 0 = c1, rest zero
  const pathElements0 = [inputCommitments[1].toString(), ...Array(DEPTH - 1).fill('0')];
  const pathIndices0 = Array(DEPTH).fill('0');

  // Path for note 1 (position 1): path_index[0]=1 (it's right child), sibling = c0
  const pathElements1 = [inputCommitments[0].toString(), ...Array(DEPTH - 1).fill('0')];
  const pathIndices1 = ['1', ...Array(DEPTH - 1).fill('0')];

  // Output notes: same total value, different blindings/owners
  const outputValues = [500_000n, 500_000n];
  const outputBlindings = [0xfeed01n, 0xfeed02n];
  const outputOwnerPubkeys = [0x9876n, 0x5432n];
  const outputCommitments = outputValues.map((v, i) =>
    F.toObject(poseidon([v, assetId, outputOwnerPubkeys[i], outputBlindings[i]])) as bigint
  );

  return {
    merkle_root: merkleRoot.toString(),
    nullifiers: nullifiers.map((n: bigint) => n.toString()),
    commitments: outputCommitments.map((c: bigint) => c.toString()),
    input_values: inputValues.map(v => v.toString()),
    input_asset_ids: [assetId.toString(), assetId.toString()],
    input_blindings: inputBlindings.map(b => b.toString()),
    spending_keys: spendingKeys.map(k => k.toString()),
    input_owner_Ax: ownerAx.map((v: bigint) => v.toString()),
    input_owner_Ay: ownerAy.map((v: bigint) => v.toString()),
    input_sig_R8x: sigs.map((s: any) => eddsa.F.toObject(s.R8[0]).toString()),
    input_sig_R8y: sigs.map((s: any) => eddsa.F.toObject(s.R8[1]).toString()),
    input_sig_S: sigs.map((s: any) => s.S.toString()),
    input_path_elements: [pathElements0, pathElements1],
    input_path_indices: [pathIndices0, pathIndices1],
    output_values: outputValues.map(v => v.toString()),
    output_asset_ids: [assetId.toString(), assetId.toString()],
    output_owner_pubkeys: outputOwnerPubkeys.map(v => v.toString()),
    output_blindings: outputBlindings.map(b => b.toString()),
  };
}

// ── Per-phase timing ─────────────────────────────────────────────────────────

interface PhaseResult {
  /** Artifact loading from disk (both backends) */
  loadMs: number;
  /** snarkjs.wtns.calculate — arkworks only (0 for snarkjs: bundled in fullProve) */
  witnessMs: number;
  /** wtns.exportJson + JSON.stringify — arkworks only (0 for snarkjs) */
  serializeMs: number;
  /** arkworks: WASM groth16-prove (incl. PK deserialization) | snarkjs: fullProve (witness+proof) */
  proveMs: number;
  /** compressSnarkjsProofWasm — snarkjs only (0 for arkworks: already compressed) */
  compressMs: number;
  totalMs: number;
}

/**
 * Run one proof-generation cycle broken down into measurable phases.
 *
 * arkworks phases:  load → witness → serialize → prove
 * snarkjs   phases: load → fullProve (witness+proof bundled) → compress
 */
async function benchPhased(
  circuitType: CircuitType,
  inputs: Record<string, unknown>,
  backend: 'snarkjs' | 'arkworks'
): Promise<PhaseResult> {
  const config = getCircuitConfig(circuitType);
  let t0: number;

  if (backend === 'arkworks') {
    // Phase 1: read .wasm + .ark from disk in parallel
    t0 = Date.now();
    const [wasmBinary, provingKeyBytes] = await Promise.all([
      provider.getCircuitWasm(circuitType),
      provider.getCircuitProvingKey!(circuitType),
    ]);
    const loadMs = Date.now() - t0;

    // Phase 2: calculate witness inside the circuit WASM
    t0 = Date.now();
    const wtnsBuffer: { type: 'mem'; data?: Uint8Array } = { type: 'mem' };
    await (snarkjs as any).wtns.calculate(inputs, wasmBinary, wtnsBuffer);
    const witnessMs = Date.now() - t0;

    // Phase 3: export witness to decimal JSON (JS → WASM serialization cost)
    t0 = Date.now();
    const witnessArray: bigint[] = await (snarkjs as any).wtns.exportJson(wtnsBuffer);
    const witnessDecimalJson = JSON.stringify(witnessArray.map(v => v.toString()));
    const serializeMs = Date.now() - t0;

    // Phase 4: prove inside groth16-proofs WASM
    //   (includes: parse JSON + decimal→field + PK deserialize + Groth16::prove)
    t0 = Date.now();
    await generateProofFromWitnessWasm(
      config.expectedPublicSignals,
      witnessDecimalJson,
      provingKeyBytes
    );
    const proveMs = Date.now() - t0;

    return {
      loadMs, witnessMs, serializeMs, proveMs, compressMs: 0,
      totalMs: loadMs + witnessMs + serializeMs + proveMs,
    };
  } else {
    // Phase 1: read .wasm + .zkey from disk in parallel
    t0 = Date.now();
    const [wasmBinary, zkeyBinary] = await Promise.all([
      provider.getCircuitWasm(circuitType),
      provider.getCircuitZkey(circuitType),
    ]);
    const loadMs = Date.now() - t0;

    // Phase 2: snarkjs fullProve — witness generation + proof bundled together
    t0 = Date.now();
    const { proof } = await snarkjs.groth16.fullProve(inputs as any, wasmBinary, zkeyBinary);
    const proveMs = Date.now() - t0;

    // Phase 3: compress snarkjs ec-points to arkworks 128-byte format
    t0 = Date.now();
    await compressSnarkjsProofWasm(proof as any);
    const compressMs = Date.now() - t0;

    return {
      loadMs, witnessMs: 0, serializeMs: 0, proveMs, compressMs,
      totalMs: loadMs + proveMs + compressMs,
    };
  }
}

// ── Results table ─────────────────────────────────────────────────────────────

interface BenchResult {
  circuit: string;
  backend: string;
  median: number;
  avg: number;
  times: number[];
}

const results: BenchResult[] = [];

async function record(
  circuit: CircuitType,
  circuitLabel: string,
  inputs: Record<string, unknown>,
  backend: 'snarkjs' | 'arkworks'
) {
  const label = `${circuitLabel} (${backend})`;
  try {
    const times = await bench(label, circuit, inputs, backend);
    results.push({ circuit: circuitLabel, backend, median: median(times), avg: avg(times), times });
  } catch (err: any) {
    console.log(`  ${'SKIP'.padStart(45)}  (${err.message.slice(0, 60)})`);
    results.push({ circuit: circuitLabel, backend, median: -1, avg: -1, times: [] });
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  console.log('=== proof-generator benchmark ===');
  console.log(`Circuits: Disclosure, PrivateLink, Unshield, Transfer  |  Backends: snarkjs, arkworks  |  Runs: ${RUNS} each\n`);

  const poseidon = await buildPoseidon();
  const eddsa = await buildEddsa();
  const disclosureInputs = await buildDisclosureInputs(poseidon);
  const privateLinkInputs = await buildPrivateLinkInputs(poseidon);
  const unshieldInputs = await buildUnshieldInputs(poseidon);
  const transferInputs = await buildTransferInputs(poseidon, eddsa);

  // Warm-up: first run loads WASM modules — exclude from results
  console.log('Warm-up (excluded from results)...');
  await generateProof(CircuitType.Disclosure, disclosureInputs as any, {
    provider,
    backend: 'snarkjs',
  }).catch(() => {});
  await generateProof(CircuitType.Disclosure, disclosureInputs as any, {
    provider,
    backend: 'arkworks',
  }).catch(() => {});
  console.log('Done.\n');

  console.log('Results (median / avg across 3 runs):');
  console.log('-'.repeat(80));

  await record(CircuitType.Disclosure, 'Disclosure ', disclosureInputs, 'snarkjs');
  await record(CircuitType.Disclosure, 'Disclosure ', disclosureInputs, 'arkworks');
  await record(CircuitType.PrivateLink, 'PrivateLink', privateLinkInputs, 'snarkjs');
  await record(CircuitType.PrivateLink, 'PrivateLink', privateLinkInputs, 'arkworks');
  await record(CircuitType.Unshield, 'Unshield   ', unshieldInputs, 'snarkjs');
  await record(CircuitType.Unshield, 'Unshield   ', unshieldInputs, 'arkworks');
  await record(CircuitType.Transfer, 'Transfer   ', transferInputs, 'snarkjs');
  await record(CircuitType.Transfer, 'Transfer   ', transferInputs, 'arkworks');

  // ── Summary table ────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(
    `${'Circuit'.padEnd(14)} ${'Backend'.padEnd(10)} ${'Median (ms)'.padStart(12)} ${'Avg (ms)'.padStart(10)}`
  );
  console.log('-'.repeat(50));

  for (const r of results) {
    if (r.median === -1) {
      console.log(`${r.circuit.padEnd(14)} ${r.backend.padEnd(10)} ${'SKIP'.padStart(12)} ${'SKIP'.padStart(10)}`);
    } else {
      console.log(
        `${r.circuit.padEnd(14)} ${r.backend.padEnd(10)} ${r.median.toString().padStart(12)} ${r.avg.toString().padStart(10)}`
      );
    }
  }

  // Speedup comparison
  console.log('\nSpeedup (snarkjs → arkworks):');
  const circuits = [...new Set(results.map(r => r.circuit))];
  for (const c of circuits) {
    const s = results.find(r => r.circuit === c && r.backend === 'snarkjs');
    const a = results.find(r => r.circuit === c && r.backend === 'arkworks');
    if (s && a && s.median > 0 && a.median > 0) {
      const speedup = (s.median / a.median).toFixed(2);
      const diff = s.median - a.median;
      console.log(`  ${c}: ${s.median}ms → ${a.median}ms  (${speedup}x, ${diff > 0 ? '-' : '+'}${Math.abs(diff)}ms)`);
    }
  }

  // ── Phase breakdown (1 run per circuit × backend) ────────────────────────────
  console.log('\n' + '='.repeat(85));
  console.log('PHASE BREAKDOWN  (1 run — shows where each backend spends its time)');
  console.log('='.repeat(85));
  console.log(
    `${'Circuit'.padEnd(13)} ${'Backend'.padEnd(9)}` +
    `${'Load'.padStart(8)} ${'Witness'.padStart(9)} ${'Serialize'.padStart(11)} ${'Prove'.padStart(10)} ${'Compress'.padStart(10)} ${'Total'.padStart(10)}`
  );
  console.log(
    '  Witness   = snarkjs.wtns.calculate            (arkworks only; bundled in Prove for snarkjs)'
  );
  console.log(
    '  Serialize = wtns.exportJson + JSON.stringify  (arkworks only)'
  );
  console.log(
    '  Prove     = groth16-proofs WASM prove (incl. PK deserializ.)  OR  snarkjs fullProve (witness+proof)'
  );
  console.log(
    '  Compress  = compressSnarkjsProofWasm          (snarkjs only)'
  );
  console.log('-'.repeat(85));

  const phaseCircuits: Array<{ type: CircuitType; label: string; inputs: Record<string, unknown> }> = [
    { type: CircuitType.Disclosure,  label: 'Disclosure',  inputs: disclosureInputs },
    { type: CircuitType.PrivateLink, label: 'PrivateLink', inputs: privateLinkInputs },
    { type: CircuitType.Unshield,    label: 'Unshield',    inputs: unshieldInputs },
    { type: CircuitType.Transfer,    label: 'Transfer',    inputs: transferInputs },
  ];

  for (const { type, label, inputs } of phaseCircuits) {
    for (const be of ['snarkjs', 'arkworks'] as const) {
      try {
        const p = await benchPhased(type, inputs as any, be);
        const ms = (v: number, w: number) => (v === 0 ? '—' : `${v}ms`).padStart(w);
        console.log(
          `${label.padEnd(13)} ${be.padEnd(9)}` +
          `${ms(p.loadMs, 8)} ${ms(p.witnessMs, 9)} ${ms(p.serializeMs, 11)} ${ms(p.proveMs, 10)} ${ms(p.compressMs, 10)} ${ms(p.totalMs, 10)}`
        );
      } catch (err: any) {
        console.log(`${label.padEnd(13)} ${be.padEnd(9)}  SKIP  (${(err as Error).message.slice(0, 50)})`);
      }
    }
  }

  console.log('\n=== Done ===');
})();
