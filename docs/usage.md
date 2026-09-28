# Usage Guide

Practical guide to generating ZK-SNARK proofs with `@orbinum/proof-generator`.

## Installation

```bash
npm install @orbinum/proof-generator
```

Dependencies are installed automatically:
- `@orbinum/circuits` — circuit artifacts (WASM, proving keys)
- `@orbinum/groth16-proofs` — arkworks WASM proof generator

---

## Basic Usage

### Generating a proof (snarkjs backend — default)

```typescript
import { generateProof, CircuitType } from '@orbinum/proof-generator';

const result = await generateProof(CircuitType.Unshield, {
  merkle_root: '12345678...',
  nullifier: '98765432...',
  amount: '1000000000000000000',
  secret: '11223344...',
  path_elements: ['0x...', '0x...'],
  path_index: '0',
});

console.log(result.proof);         // "0xabcd..." (128 bytes, hex)
console.log(result.publicSignals); // ["0x...", "0x...", ...] (hex, LE-encoded)
console.log(result.circuitType);   // "unshield"
```

All inputs must be decimal strings or numbers. Public signals are returned as 0x-prefixed 32-byte little-endian hex strings, ready for on-chain submission.

### Switching to the arkworks backend

Pass `backend: 'arkworks'` in the options object. Everything else stays the same:

```typescript
const result = await generateProof(
  CircuitType.Unshield,
  {
    merkle_root: '12345678...',
    // ... same inputs as above
  },
  { backend: 'arkworks' }
);
```

The arkworks backend uses `.ark` proving keys instead of `.zkey`. Both backends produce identical 128-byte Groth16 proofs — the output format is the same.

See [backends.md](./backends.md) for a full comparison of speed and artifact size.

---

## Supported Circuits

| Circuit | `CircuitType` | Public signals | Use case |
|---------|--------------|----------------|----------|
| Unshield | `CircuitType.Unshield` | 7 (v1) / 8 (v2, `memo_hash`) | Withdraw from pool to public address |
| Transfer | `CircuitType.Transfer` | 7 (v1) / 8 (v2, `memo_hash`) | Private-to-private transfer |

---

## Provider Options

By default, the library auto-detects the environment:
- **Node.js**: reads artifacts from `node_modules/@orbinum/circuits` on disk.
- **Browser / Web Worker**: fetches the pinned `@orbinum/circuits` release from the npm CDN (unpkg).

Both go through the package's `manifest.json`, which picks each circuit's version
and file names, and verify every artifact's sha256 against it.

### Custom artifact directory (Node.js)

```typescript
import { generateProof, NodeArtifactProvider, CircuitType } from '@orbinum/proof-generator';

const provider = new NodeArtifactProvider({ packageRoot: '/path/to/circuits-package' });

const result = await generateProof(CircuitType.Transfer, inputs, { provider });
```

### Self-hosted artifacts (browser)

```typescript
import { generateProof, WebArtifactProvider, CircuitType } from '@orbinum/proof-generator';

const provider = new WebArtifactProvider({
  baseUrl: 'https://my-cdn.example.com/circuits',
});

const result = await generateProof(CircuitType.Transfer, inputs, { provider });
```

### Circuit versions

Each provider serves the manifest's `active_version` (v2 for transfer and
unshield since `@orbinum/circuits` 0.15.0) unless a circuit is pinned:

```typescript
const provider = new WebArtifactProvider({
  circuitVersions: { unshield: 1 }, // v1 unshield artifacts
});
```

`generateProof` asks the provider which version it serves and checks the proof
against that version's public-signal count. v2 transfer/unshield take an extra
`memo_hash` input and emit 8 signals. Passing `circuitVersion` is optional; if
given, it must match the provider's version, else `CircuitVersionMismatchError`.

---

## Error Handling

```typescript
import {
  generateProof,
  CircuitType,
  CircuitNotFoundError,
  ProofGenerationError,
  InvalidInputsError,
} from '@orbinum/proof-generator';

try {
  const result = await generateProof(CircuitType.Unshield, inputs);
} catch (error) {
  if (error instanceof InvalidInputsError) {
    // A required input field is null, undefined, or missing
    console.error('Bad inputs:', error.message);
  } else if (error instanceof CircuitNotFoundError) {
    // Artifact files could not be loaded (wrong path, network error, etc.)
    console.error('Artifacts unavailable:', error.message);
  } else if (error instanceof ProofGenerationError) {
    // The proof failed to generate (invalid witness, corrupt key, etc.)
    console.error('Proof failed:', error.message);
  } else {
    throw error;
  }
}
```

All error classes extend `ProofGeneratorError`, which exposes a `code` string alongside the message:

| Class | `code` |
|---|---|
| `WitnessCalculationError` | `WITNESS_CALCULATION_FAILED` |
| `ProofGenerationError` | `PROOF_GENERATION_FAILED` |
| `CircuitNotFoundError` | `CIRCUIT_NOT_FOUND` |
| `InvalidInputsError` | `INVALID_INPUTS` |

---

## Verbose Logging

Pass `verbose: true` to log each step to the console — useful for debugging or understanding where time is spent:

```typescript
const result = await generateProof(CircuitType.Unshield, inputs, { verbose: true });
// [proof-generator] Generating proof for circuit: unshield (backend: snarkjs)
// [proof-generator] Fetching circuit artifacts...
// [proof-generator] Step 1: Generating witness + proof with snarkjs...
// [proof-generator] Proof generated: 0xabcd1234...ef56 (truncated)
// [proof-generator] Public signals: 5
// [proof-generator] Proof generation completed successfully.
```

---

## WASM Initialisation

The first proof call in a process incurs a one-time WASM initialisation cost (~1.5–2s for the arkworks backend). You can pre-warm it explicitly to avoid latency on the first user-facing proof:

```typescript
import { initWasm } from '@orbinum/proof-generator';

// Call at app startup, before the first proof request
await initWasm();
```

`initWasm` is idempotent — safe to call multiple times.

---

## Complete Options Reference

```typescript
await generateProof(
  circuitType: CircuitType,
  inputs: Record<string, string | number | string[] | number[] | string[][] | number[][]>,
  options?: {
    backend?: 'snarkjs' | 'arkworks'; // default: 'snarkjs'
    provider?: ArtifactProvider;      // default: auto-detected
    verbose?: boolean;                // default: false
  }
): Promise<{
  proof: string;           // 0x-prefixed 128-byte hex
  publicSignals: string[]; // 0x-prefixed 32-byte LE hex per signal
  circuitType: CircuitType;
}>
```
