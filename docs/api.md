# API Reference

Complete API documentation for `@orbinum/proof-generator`.

## Installation

```bash
npm install @orbinum/proof-generator
```

Automatically downloads during installation:

- Circuit WASM modules (witness calculators)
- Proving keys (arkworks format)
- Groth16 proof generation WASM

### Requirements

- **Node.js**: ≥ 22.0.0
- **RAM**: ≥ 2GB (for proof generation)
- **Storage**: ~100MB (circuits + WASM artifacts)

**No build tools required** - WASM is pre-compiled.

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

Calculate witness array separately (usually internal, advanced use).

**Parameters:**

```typescript
const witness = await calculateWitness(
  inputs: Record<string, string | number | bigint>,
  wasmPath: string  // Path to circuit WASM file
)
```

**Returns:**

```typescript
string[]  // Witness array (11,808 elements for Orbinum circuits)
```

**Example:**

```typescript
import { calculateWitness } from '@orbinum/proof-generator';

const witness = await calculateWitness(
  { merkle_root: '0x...', nullifier: '0x...' },
  'circuits/unshield.wasm'
);
```

### `isReady()`

Check if all artifacts (WASM + circuits) are available.

**Returns:** `boolean`

**Example:**

```typescript
import { isReady } from '@orbinum/proof-generator';

if (isReady()) {
  console.log('Safe to generate proofs');
} else {
  console.log('Run npm install to download artifacts');
}
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
  WitnessCalculationError,
  ProofGenerationError,
  InvalidInputsError,
  ArtifactNotFoundError,
} from '@orbinum/proof-generator';
```

### `InvalidInputsError`

Thrown when circuit inputs are invalid (missing fields, wrong types).

```typescript
try {
  await generateProof(CircuitType.Unshield, {
    merkle_root: '0x...', // missing other required inputs
  });
} catch (error) {
  if (error instanceof InvalidInputsError) {
    console.error('Missing or invalid inputs:', error.message);
  }
}
```

### `CircuitNotFoundError`

Thrown when circuit WASM file is missing.

```typescript
try {
  await generateProof(CircuitType.Unshield, inputs);
} catch (error) {
  if (error instanceof CircuitNotFoundError) {
    console.error('Circuit not found. Run: npm install');
  }
}
```

### `WitnessCalculationError`

Thrown during witness generation (snarkjs step).

```typescript
try {
  await generateProof(CircuitType.Unshield, inputs);
} catch (error) {
  if (error instanceof WitnessCalculationError) {
    console.error('Witness generation failed:', error.message);
  }
}
```

### `ProofGenerationError`

Thrown during proof generation (WASM step).

```typescript
try {
  await generateProof(CircuitType.Unshield, inputs);
} catch (error) {
  if (error instanceof ProofGenerationError) {
    console.error('Proof generation failed:', error.message);
  }
}
```

### `ArtifactNotFoundError`

Thrown when WASM or proving key files are missing.

```typescript
try {
  await generateProof(CircuitType.Unshield, inputs, {
    validateArtifacts: true, // Enabled by default
  });
} catch (error) {
  if (error instanceof ArtifactNotFoundError) {
    console.error('Missing artifacts. Run: npm install');
  }
}
```

## Configuration

### Environment Variables

```bash
# Specify circuits version (default: latest)
export CIRCUITS_VERSION=v0.2.0
npm install

# Specify WASM version (default: latest)
export WASM_VERSION=v0.1.0
npm install
```

### Custom Paths

Modify `src/config.ts` to use custom artifact locations:

```typescript
export const PATHS = {
  WASM_MODULE_DIR: '../groth16-proof', // Directory containing WASM
  WASM_MODULE_NAME: 'groth16_proofs', // Module name (no suffix)
  WASM_BG_FILE: 'groth16_proofs_bg.wasm', // WASM binary filename
  CIRCUITS_BASE: '../circuits', // Circuits base directory
};
```

## Supported Circuits

| Circuit        | Public Signals | Inputs                                                                           | Use Case                             |
| -------------- | -------------- | -------------------------------------------------------------------------------- | ------------------------------------ |
| **Unshield**   | 5              | `merkle_root`, `nullifier`, `amount`, `secret`, `path_elements`, `path_index`    | Withdraw from pool to public address |
| **Transfer**   | 5              | `merkle_root`, `nullifier_input`, `amount`, `secret`, `path_*`, `recipient_hash` | Private-to-private transfer          |
| **Disclosure** | 4              | `merkle_root`, `nullifier`, `amount`, `secret`                                   | Selective revelation                 |

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

### "Cannot find module 'groth16_proofs'"

Artifacts not downloaded:

```bash
npm install
node scripts/download-artifacts.js
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

Check that all required fields are present and properly formatted:

```typescript
// ✅ Correct format
const inputs = {
  merkle_root: '0x123abc...',
  nullifier: '0x456def...',
  amount: '1000000000000000000', // As string
  secret: '0x789012...',
};

// ✅ Also valid
const inputs = {
  merkle_root: 123456n, // BigInt
  nullifier: 456789n,
  amount: 1000000000000000000n,
  secret: 789012n,
};

// ❌ Avoid
const inputs = {
  merkle_root: 0x123abc, // Not prefixed string
  amount: 1000000000000000000, // Number (precision loss)
};
```

---

See [Supported Circuits](#supported-circuits) for detailed input requirements per circuit.
