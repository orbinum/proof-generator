# Development Guide

Development setup, architecture, and testing for `@orbinum/proof-generator`.

## Getting Started

### Setup

```bash
# Clone and install
git clone https://github.com/orbinum/proof-generator.git
cd proof-generator
npm install

# Build TypeScript
npm run build

# Run tests
npm test
```

### Requirements

- **Node.js**: ≥ 22.0.0
- **Git**: For version control
- **npm**: ≥ 9.0.0

## Project Structure

```
proof-generator/
├── src/
│   ├── index.ts              Main API export point
│   ├── config.ts             Centralized path configuration
│   ├── wasm-loader.ts        Unified WASM module initialization
│   ├── witness.ts            snarkjs integration (witness generation)
│   ├── circuits.ts           Circuit metadata and validation
│   ├── types.ts              TypeScript type definitions
│   ├── utils.ts              Shared utilities
│   └── proof-generator.ts    Deprecated
│
├── scripts/
│   ├── download-artifacts.ts Download orchestrator (circuits + WASM)
│   ├── download-circuits.ts  Fetch from orbinum/circuits releases
│   ├── download-wasm.ts      Fetch from orbinum/groth16-proofs releases
│   └── utils.ts              GitHub API utilities
│
├── tests/
│   ├── unshield.test.ts      Unshield circuit tests
│   ├── transfer.test.ts      Transfer circuit tests (if exists)
│   ├── disclosure.test.ts    Disclosure circuit tests (if exists)
│   ├── utils.test.ts         Utility function tests
│   └── wasm-build.test.ts    WASM module integration tests
│
├── docs/
│   ├── api.md                Complete API reference
│   └── development.md        This file
│
├── .github/
│   └── workflows/            GitHub Actions CI/CD
│
├── .husky/                   Pre-commit hook configuration
├── dist/                     Compiled JavaScript (build output)
├── node_modules/
│   ├── circuits/             Auto-downloaded Circom compiled WASM
│   └── groth16-proof/        Auto-downloaded arkworks WASM
│
├── jest.config.js            Jest test configuration
├── tsconfig.json             TypeScript configuration
├── package.json              Dependencies and scripts
└── README.md                 Project overview
```

## Development Workflow

### Build

```bash
npm run build
```

Compiles TypeScript to JavaScript:

- Source: `src/**/*.ts`
- Output: `dist/**/*.js`
- Target: ES2020, CommonJS modules

### Testing

```bash
# Run all tests
npm test

# Watch mode (rerun on changes)
npm run test:watch

# Single test file
npm test -- unshield.test.ts

# With coverage
npm test -- --coverage

# Verbose output
npm test -- --verbose
```

**Test Setup:**

- Framework: Jest 29.7.0
- TypeScript: ts-jest 29.2.5
- Uses real WASM modules
- Uses real proving keys from groth16-proofs
- No mocks - integration tests only

### Code Formatting

```bash
# Format all TypeScript
npm run format

# Check formatting (no changes)
npm run format:check

# Type checking
npm run lint

# Combined check (before commit)
npm run format && npm run lint
```

**Tools:**

- Formatter: Prettier 3.4.2
- Linter: TypeScript compiler (tsc)

### Clean Rebuild

```bash
npm run clean      # Remove build artifacts and node_modules
npm install        # Reinstall everything
npm run build      # Rebuild
```

## Pre-commit Hooks

Uses **Husky 9.1.7** + **lint-staged 15.2.11**:

Automatically runs on `git commit`:

1. Format TypeScript files
2. Validate types with tsc
3. Ensure no syntax errors

**Configuration:** `.husky/pre-commit`

**Skip hooks (if needed):**

```bash
git commit --no-verify
```

## Key Source Files

### `src/config.ts`

Centralized configuration for artifact paths and module names.

```typescript
export const PATHS = {
  WASM_MODULE_DIR: '../groth16-proof', // Directory
  WASM_MODULE_NAME: 'groth16_proofs', // Module name
  WASM_BG_FILE: 'groth16_proofs_bg.wasm', // WASM binary
  CIRCUITS_BASE: '../circuits', // Circuits base
};

export function getWasmBgPath(): string {
  /* ... */
}
export function getCircuitWasmPath(circuit: string): string {
  /* ... */
}
export function getCircuitProvingKeyPath(circuit: string): string {
  /* ... */
}
```

**Usage:** Import to get artifact paths globally.

### `src/wasm-loader.ts`

Manages WASM module initialization (lazy loading).

```typescript
export async function initWasm(): Promise<void> {
  // Idempotent: Only initializes once
  // Dynamically imports WASM module
  // Works identically in Node.js and browsers
}

export async function generateProofWasm(input: Float64Array, pk: Uint8Array): Promise<Uint8Array> {
  // Low-level proof generation
}
```

**Key Design:**

- Lazy initialization (on first use)
- Unified code path (no environment checks)
- Dynamic imports work everywhere

### `src/witness.ts`

snarkjs integration for witness calculation.

```typescript
export async function calculateWitness(
  inputs: Record<string, any>,
  wasmPath: string
): Promise<string[]> {
  // Uses snarkjs wtns functions
  // Returns witness array (11,808 elements)
}
```

### `src/index.ts`

Main public API.

```typescript
export { generateProof } from './proof-generator';
export { calculateWitness } from './witness';
export { isReady } from './utils';
export { CircuitType } from './types';
export * from './types'; // All type exports
```

## Architecture Overview

### Proof Generation Flow

```
User Input (JSON)
    ↓
[1] Validate inputs
    ↓
[2] Load circuit WASM (witness calculator)
    ↓
[3] snarkjs: Calculate witness (decimal format)
    ↓ [OPTIMIZED: No conversion needed!]
    ↓
[4] Load proving key (arkworks format .ark)
    ↓
[5] Load groth16-proofs WASM (proof generation)
    ↓
[6] groth16-proofs: Convert decimal → field elements
    ↓
[7] arkworks: Generate 128-byte proof
    ↓
Output (proof + publicSignals)
```

### Module Integration

- **snarkjs 0.7.5**: Witness calculation from Circom circuits
  - Consumes: circuit WASM, inputs
  - Produces: witness array (decimal strings - native format)
- **groth16-proofs**: Groth16 proof generation (compiled WASM)
  - Consumes: witness (decimal), proving key
  - Internally converts: decimal → field elements (LE)
  - Produces: 128-byte proof + public signals
- **TypeScript wrapper**: Orchestrates the pipeline
  - Handles paths, validation, error handling
  - No witness format conversion needed ✅
  - Same code everywhere

### Data Types

**Circuit Inputs:**

```typescript
Record<string, string | number | bigint>;
```

**Witness (Updated):**

```typescript
string[]  // 11,808 elements (decimal strings: "1", "12345", etc.)
```

**Proof Output:**

```typescript
{
  proof: string,           // '0x...' (256 hex chars)
  publicSignals: string[], // 4-5 elements, hex encoded
}
```

## Artifact Management

### Circuits

Downloaded from [orbinum/circuits releases](https://github.com/orbinum/circuits/releases):

```
circuits/
├── unshield.wasm        (witness calculator)
├── unshield_pk.ark      (proving key)
├── transfer.wasm
├── transfer_pk.ark
├── disclosure.wasm
└── disclosure_pk.ark
```

**Download command:**

```bash
node scripts/download-circuits.ts
```

### WASM Module

Downloaded from [orbinum/groth16-proofs releases](https://github.com/orbinum/groth16-proofs):

```
groth16-proof/
├── groth16_proofs_bg.wasm   (proof generation)
├── groth16_proofs.js         (module wrapper)
└── groth16_proofs.d.ts       (TypeScript types)
```

**Download command:**

```bash
node scripts/download-wasm.ts
```

### Version Management

**Postinstall hook** (in `package.json`):

```json
"postinstall": "node scripts/download-artifacts.ts"
```

Automatically runs during `npm install` to fetch latest artifacts.

**Manual override:**

```bash
export CIRCUITS_VERSION=v0.2.0
export WASM_VERSION=v0.1.0
npm install
```

## Testing Strategy

### Test Structure

```typescript
describe('Unshield Circuit', () => {
  test('should generate valid proof for unshield', async () => {
    const result = await generateProof(CircuitType.Unshield, inputs);
    expect(result.proof).toBeDefined();
    expect(result.publicSignals.length).toBe(5);
  });
});
```

### Test Coverage

- ✅ Valid proof generation for all 3 circuits
- ✅ Invalid input handling
- ✅ Artifact verification
- ✅ WASM module integration
- ✅ Output format validation
- ✅ Error type handling

**Run tests:**

```bash
npm test
```

## Dependencies

### Runtime

- **snarkjs**: 0.7.5 (witness calculation)
- **arkworks**: Compiled as groth16-proofs WASM

### Development

- **TypeScript**: 5.7.3
- **Jest**: 29.7.0 (testing)
- **Prettier**: 3.4.2 (formatting)
- **Husky**: 9.1.7 (Git hooks)
- **lint-staged**: 15.2.11 (pre-commit filtering)

**See:** `package.json` for complete dependency list.

## Compilation Targets

TypeScript configured for:

- **Target:** ES2020
- **Module:** CommonJS
- **Lib:** ES2020, DOM (for browser WASM)
- **Strict:** true

See `tsconfig.json` for full configuration.

## GitHub Actions CI/CD

Workflows in `.github/workflows/`:

- **ci.yml**: Run tests on every push/PR
- **release.yml**: Publish package on tagged release

**Trigger:**

```bash
git tag v1.0.0
git push --tags
```

Automatically publishes to npm.

## Common Development Tasks

### Add new circuit support

1. Add circuit type to `src/types.ts`
2. Add circuit metadata to `src/circuits.ts`
3. Add test file `tests/{circuit}.test.ts`
4. Ensure artifacts are downloaded (circuit WASM + proving key)

### Update dependencies

```bash
npm update
npm run format
npm test
```

### Release new version

```bash
npm version patch  # or minor, major
git push --tags
# GitHub Actions automatically publishes
```

### Debug failing test

```bash
npm test -- --verbose unshield.test.ts
NODE_DEBUG=* npm test -- unshield.test.ts
```

## Resources

- **Circom Documentation**: [docs.circom.io](https://docs.circom.io)
- **snarkjs**: [github.com/iden3/snarkjs](https://github.com/iden3/snarkjs)
- **arkworks**: [github.com/arkworks-rs/ark-groth16](https://github.com/arkworks-rs/ark-groth16)
- **Orbinum Node**: [github.com/orbinum/node](https://github.com/orbinum/node)

---

See [docs/api.md](api.md) for complete API reference.
