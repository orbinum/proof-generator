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

const result = await generateProof(CircuitType.Unshield, {
  merkle_root: '0x...',
  nullifier: '0x...',
  amount: '100',
  // ... circuit-specific inputs
});

console.log('Proof:', result.proof); // 0x... (128 bytes)
console.log('Signals:', result.publicSignals); // ['0x...', ...]
```

## Core API

### `generateProof(circuitType, inputs, options?)`

Generates a **128-byte Groth16 proof** from circuit inputs.

**Parameters:**

```typescript
await generateProof(
  circuitType: CircuitType,
  inputs: Record<string, string | number | bigint>,
  options?: {
    verbose?: boolean;          // Log progress (default: false)
    validateArtifacts?: boolean; // Verify files exist (default: true)
  }
)
```

**Returns:**

```typescript
{
  proof: string;              // 128-byte hex proof (0x...)
  publicSignals: string[];    // Public signals (4-5 elements, hex encoded)
  circuitType: string;        // Circuit identifier (lowercase)
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
  { verbose: true }
);

console.log(result.proof);
// "0xabcd1234ef56..."
console.log(result.publicSignals);
// ['0x...', '0x...', '0x...', '0x...', '0x...']
```

### `calculateWitness(inputs, wasmPath)`

**Advanced use only.** Calculate witness array separately from proof generation.

Most users should use `generateProof()` instead, which handles witness calculation internally.

**Parameters:**

```typescript
const witness = await calculateWitness(
  inputs: Record<string, string | number | bigint>,
  wasmPath: string  // Path to circuit WASM file
)
```

**Returns:**

```typescript
string[]  // Witness array (decimal strings)
```

**Example:**

```typescript
import { calculateWitness } from '@orbinum/proof-generator';
import { getCircuitConfig, CircuitType } from '@orbinum/proof-generator';

const config = getCircuitConfig(CircuitType.Unshield);
const witness = await calculateWitness(
  { merkle_root: '0x...', nullifier: '0x...' /* ... */ },
  config.wasmPath
);
```

### `isReady()`

Check if circuit artifacts are available for proof generation.

**Returns:** `boolean` - `true` if artifacts exist, `false` otherwise

**Example:**

```typescript
import { isReady } from '@orbinum/proof-generator';

if (!isReady()) {
  console.error('Circuit artifacts missing. Run: npm install');
  process.exit(1);
}

// Safe to generate proofs
await generateProof(CircuitType.Unshield, inputs);
```

## Enumerations

### `CircuitType`

Supported circuits:

```typescript
enum CircuitType {
  Unshield = 'unshield', // Withdrawal to public address
  Transfer = 'transfer', // Private transfer
  Disclosure = 'disclosure', // Selective revelation
}
```

**Usage:**

```typescript
import { CircuitType } from '@orbinum/proof-generator';

await generateProof(CircuitType.Unshield, inputs);
await generateProof(CircuitType.Transfer, inputs);
await generateProof(CircuitType.Disclosure, inputs);
```

## Error Handling

### Error Types

```typescript
import {
  CircuitNotFoundError,
  ProofGenerationError,
  InvalidInputsError,
} from '@orbinum/proof-generator';
```

### `InvalidInputsError`

Thrown when circuit inputs are invalid (missing required fields, null values, wrong types).

```typescript
try {
  await generateProof(CircuitType.Unshield, {
    merkle_root: '0x...', // missing other required inputs
  });
} catch (error) {
  if (error instanceof InvalidInputsError) {
    console.error('Invalid inputs:', error.message);
  }
}
```

### `CircuitNotFoundError`

Thrown when circuit artifacts are missing (WASM file not found).

```typescript
try {
  await generateProof(CircuitType.Unshield, inputs);
} catch (error) {
  if (error instanceof CircuitNotFoundError) {
    console.error('Circuit artifacts missing. Run: npm install');
  }
}
```

### `ProofGenerationError`

Thrown during proof generation (witness calculation or WASM proof generation).

```typescript
try {
  await generateProof(CircuitType.Unshield, inputs);
} catch (error) {
  if (error instanceof ProofGenerationError) {
    console.error('Proof generation failed:', error.message);
  }
}
```

## Supported Circuits

| Circuit        | Public Signals | Key Inputs                                                                           | Use Case                             |
| -------------- | -------------- | ------------------------------------------------------------------------------------ | ------------------------------------ |
| **Unshield**   | 5              | `merkle_root`, `nullifier`, `amount`, `recipient`, `asset_id`, note fields, `path_*` | Withdraw from pool to public address |
| **Transfer**   | 5              | `merkle_root`, input/output nullifiers and commitments, note fields, `path_*`        | Private-to-private transfer          |
| **Disclosure** | 4              | `commitment`, `viewing_key`, revealed fields, disclosure masks, note fields          | Selective revelation                 |

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

### Benchmarks

| Operation                    | Time        |
| ---------------------------- | ----------- |
| Witness generation (snarkjs) | ~500ms      |
| Proof generation (WASM)      | ~5-8s       |
| **Total**                    | **~6-8.5s** |
| Module load (cold start)     | ~1s         |
| Module load (cached)         | ~0ms        |

### Memory Usage

- Peak: ~2GB during proof generation
- WASM module size: ~5MB
- Circuits total: ~20-50MB resident

## Troubleshooting

### "Cannot find module '@orbinum/circuits'"

Dependency not installed:

```bash
rm -rf node_modules package-lock.json
npm install
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
- **Disclosure**: ~0.8s

For faster proofs, ensure:

- Node.js ≥ 22.0.0 (latest V8 optimizations)
- Sufficient RAM (≥ 2GB available)
- No CPU throttling

---

**See [docs/development.md](development.md) for development setup and architecture details.**
