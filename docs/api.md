# API Reference

Complete API documentation for `@orbinum/proof-generator`.

## Installation

```bash
npm install @orbinum/proof-generator
```

**Dependencies installed automatically:**

- `@orbinum/circuits` - Circuit artifacts (WASM, proving keys)
- `@orbinum/groth16-proofs` - Arkworks WASM proof generator
- `snarkjs` - Witness calculation

### Requirements

- **Node.js**: ≥ 22.0.0
- **RAM**: ≥ 2GB (for proof generation)
- **Storage**: ~50MB (circuit artifacts)

**No build tools or manual downloads required.**

## Quick Start

```typescript
import { generateProof, CircuitType } from '@orbinum/proof-generator';

// Default backend (snarkjs) — fastest
const result = await generateProof(CircuitType.Unshield, {
  merkle_root: '0x...',
  nullifier: '0x...',
  amount: '100',
  // ... circuit-specific inputs
});

// Arkworks backend — smaller artifacts
const result2 = await generateProof(CircuitType.Transfer, inputs, {
  backend: 'arkworks',
});

console.log(result.proof);         // '0xabcd...' (128-byte hex)
console.log(result.publicSignals); // ['0x...', ...]
console.log(result.circuitType);   // CircuitType.Unshield
```

## Core API

### `generateProof(circuitType, inputs, options?)`

Generates a **128-byte Groth16 proof** from circuit inputs.

**Parameters:**

```typescript
await generateProof(
  circuitType: CircuitType,
  inputs: CircuitInputs,
  options?: GenerateOptions
)
```

**`GenerateOptions`:**

```typescript
interface GenerateOptions {
  verbose?:  boolean;                 // Log progress to console (default: false)
  circuitVersion?: number;           // Circuit version; must match the provider's when it reports one (default: the provider's, else 1)
  provider?: ArtifactProvider;        // Override artifact source (default: auto-detected)
  backend?:  'snarkjs' | 'arkworks'; // Proof backend (default: 'snarkjs')
}
```

**Returns:** `Promise<ProofResult>`

```typescript
interface ProofResult {
  proof: string;              // 128-byte hex proof (0x-prefixed)
  publicSignals: string[];    // Public signals (hex-encoded, 0x-prefixed)
  circuitType: CircuitType;   // Circuit used
}
```

**Example:**

```typescript
import { generateProof, CircuitType } from '@orbinum/proof-generator';

const result = await generateProof(
  CircuitType.Unshield,
  {
    merkle_root: '0x123abc...',
    nullifier: '0x456def...',
    amount: '1000000000000000000', // 1 ETH in wei
    secret: '0x789012...',
    path_elements: ['0x...', '0x...'],
    path_index: '0',
  },
  { verbose: true, backend: 'snarkjs' }
);

console.log(result.proof);
// "0xabcd1234ef56..."
console.log(result.publicSignals);
// ['0x...', '0x...', '0x...', '0x...', '0x...']
```

---

## Enumerations

### `CircuitType`

Supported circuits:

```typescript
enum CircuitType {
  Unshield = 'unshield', // Withdrawal to public address
  Transfer = 'transfer', // Private transfer
  Shield = 'shield', // Deposit bound to its value and asset
}
```

**Usage:**

```typescript
import { CircuitType } from '@orbinum/proof-generator';

await generateProof(CircuitType.Unshield, inputs);
await generateProof(CircuitType.Transfer, inputs);
```

## Providers

### Auto-detection

By default the library detects the runtime environment and picks the appropriate provider:

- **Node.js** → `NodeArtifactProvider` (reads from `node_modules/@orbinum/circuits` via `fs`)
- **Browser / Web Worker** (`window` or `self` defined) → `WebArtifactProvider` (fetches over HTTP)

Both read the `@orbinum/circuits` manifest: it picks each circuit's version (the
manifest's `active_version` unless pinned) and names its files, and every file is
checked against the manifest's sha256 before it is used.

### `NodeArtifactProvider`

```typescript
import { NodeArtifactProvider } from '@orbinum/proof-generator';

// The installed @orbinum/circuits, active versions
const provider = new NodeArtifactProvider();

// A package directory elsewhere, with transfer pinned to v1
const custom = new NodeArtifactProvider({
  packageRoot: '/path/to/circuits',
  circuitVersions: { transfer: 1 },
});
// A bare string is still accepted as the package root.

const result = await generateProof(CircuitType.Unshield, inputs, { provider });
```

### `WebArtifactProvider`

Fetches artifacts over HTTP. Suitable for browsers, React Native, or any environment without a local filesystem.
By default it reads the `@orbinum/circuits` release this package depends on
(`CIRCUITS_PACKAGE_VERSION`) from unpkg; `baseUrl` points it at a mirror serving
`manifest.json` and the artifacts side by side.

```typescript
import { WebArtifactProvider } from '@orbinum/proof-generator';

const provider = new WebArtifactProvider({
  baseUrl: 'https://cdn.example.com/circuits', // optional; pin a version in the URL
  circuitVersions: { unshield: 1 },            // optional per-circuit version pin
});

const result = await generateProof(CircuitType.Unshield, inputs, { provider });
```

### `getResolvedVersion`

Both providers report the version, package version and on-chain `vk_hash` they
serve for a circuit — for checking the `vk_hash` against the chain before proving:

```typescript
const { version, packageVersion, vkHash } = await provider.getResolvedVersion(CircuitType.Transfer);
```

`generateProof` uses it too: the proof is checked against that version's arity,
and a `circuitVersion` option that disagrees throws `CircuitVersionMismatchError`
before any proving.

### `ArtifactProvider` Interface

Implement this interface to supply artifacts from any source (IPFS, S3, embedded buffers, etc.):

```typescript
interface ArtifactProvider {
  getCircuitWasm(circuitType: CircuitType): Promise<Uint8Array | string>;
  getCircuitZkey(circuitType: CircuitType): Promise<Uint8Array | string>;
  getCircuitProvingKey?(circuitType: CircuitType): Promise<Uint8Array>; // required for arkworks backend
  getResolvedVersion?(circuitType: CircuitType): Promise<ResolvedCircuitVersion>; // the version served
}
```

## Error Handling

All errors extend `ProofGeneratorError`, which carries a machine-readable `code` string.

```typescript
import {
  ProofGeneratorError,
  WitnessCalculationError,
  ProofGenerationError,
  CircuitNotFoundError,
  CircuitVersionMismatchError,
  InvalidInputsError,
} from '@orbinum/proof-generator';
```

| Error class | `code` | Thrown when |
| --- | --- | --- |
| `InvalidInputsError` | `INVALID_INPUTS` | Missing or malformed circuit inputs |
| `CircuitNotFoundError` | `CIRCUIT_NOT_FOUND` | Circuit artifacts not found |
| `CircuitVersionMismatchError` | `CIRCUIT_VERSION_MISMATCH` | `circuitVersion` differs from the version the provider serves |
| `WitnessCalculationError` | `WITNESS_CALCULATION_FAILED` | snarkjs witness step fails |
| `ProofGenerationError` | `PROOF_GENERATION_FAILED` | Backend proof step fails |

**Example:**

```typescript
try {
  await generateProof(CircuitType.Unshield, inputs);
} catch (error) {
  if (error instanceof InvalidInputsError) {
    console.error('Bad inputs:', error.message); // error.code === 'INVALID_INPUTS'
  } else if (error instanceof CircuitNotFoundError) {
    console.error('Missing artifacts. Run: pnpm install');
  } else if (error instanceof ProofGeneratorError) {
    console.error(`Proof failed [${error.code}]:`, error.message);
  }
}
```

## Supported Circuits

| Circuit         | Public Signals | Key Inputs                                                                           | Use Case                                         |
| --------------- | -------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------ |
| **Unshield**    | 7 (v1) / 8 (v2, v3) | `merkle_root`, `nullifier`, `amount`, `recipient`, `asset_id`, note fields, `path_*`; v2 adds `memo_hash`; v3 requires a canonical `spending_key` | Withdraw from pool to public address |
| **Transfer**    | 7 (v1) / 8 (v2) / 9 (v3) | `merkle_root`, input/output nullifiers and commitments, note fields, `path_*`; v2 adds `memo_hash`; v3 takes `merkle_roots[2]` (one per input) in place of `merkle_root` and requires canonical `spending_keys` | Private-to-private transfer |

### Output Format

All public signals returned as **0x-prefixed hex strings**:

```typescript
{
  proof: '0xabcd1234...', // 128 bytes = 256 hex chars (+ 0x prefix)
  publicSignals: [
    '0x...',  // Signal 1
    '0x...',  // Signal 2
    // ...
  ],
}
```

## Performance

See [docs/backends.md](backends.md) for a full benchmark analysis.

### By backend

| Circuit | snarkjs | arkworks |
| --- | --- | --- |
| Unshield | ~1.3 s | ~7 s |
| Transfer | ~4.7 s | ~20 s |
```

- **snarkjs** — default, fastest, uses `.zkey` proving keys
- **arkworks** — 2–3× smaller proof artifacts, uses `.ark` proving keys

### WASM initialization

The arkworks WASM module is initialized lazily on first use. Pre-initialize for latency-sensitive apps:

```typescript
import { initWasm } from '@orbinum/proof-generator';

await initWasm(); // call once at startup
```

### Memory

- Peak: ~2 GB during proof generation
- WASM module: ~5 MB
- Circuit artifacts: ~20–50 MB total

## Troubleshooting

### "Cannot find module '@orbinum/circuits'"

Dependency not installed:

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### "Out of memory" error

Increase Node.js heap:

```bash
NODE_OPTIONS="--max-old-space-size=4096" node your-script.js
```

### WASM not loading in browser

Configure your bundler:

**Webpack:**

```js
module.exports = {
  experiments: { asyncWebAssembly: true },
};
```

**Vite:**

```js
export default {
  build: { target: 'esnext' },
};
```

**Next.js:**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: config => {
    config.experiments = { asyncWebAssembly: true };
    return config;
  },
};
module.exports = nextConfig;
```

### Circuit inputs validation fails

Ensure all required fields are present and properly formatted:

```typescript
// ✅ Correct - string values
const inputs = {
  merkle_root: '0x123abc...',
  nullifier: '0x456def...',
  amount: '1000000000000000000', // String (18 decimals)
  // ... other required fields
};

// ✅ Also valid - BigInt values
const inputs = {
  merkle_root: 123456n,
  nullifier: 456789n,
  amount: 1000000000000000000n,
};

// ❌ Avoid - number can lose precision
const inputs = {
  amount: 1000000000000000000, // May lose precision
};
```

### Performance issues

Proof generation is compute-intensive. Expected times:

- **Unshield**: ~1.5s
- **Transfer**: ~3s

For faster proofs, ensure:

- Node.js ≥ 22.0.0 (latest V8 optimizations)
- Sufficient RAM (≥ 2GB available)
- No CPU throttling

---

**See [docs/backends.md](backends.md) for backend architecture and benchmark analysis.**  
**See [docs/usage.md](usage.md) for usage examples with both backends.**  
**See [docs/development.md](development.md) for development setup and contributing guide.**
