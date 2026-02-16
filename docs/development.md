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
│   ├── wasm-loader.ts        WASM module initialization (arkworks)
│   ├── witness.ts            snarkjs integration (witness calculation)
│   ├── circuits.ts           Circuit configuration and validation
│   ├── types.ts              TypeScript type definitions
│   └── utils.ts              Validation and formatting utilities
│
├── tests/
│   ├── unit/                 Unit tests (55 tests)
│   │   ├── circuits.test.ts  Circuit configuration tests (13 tests)
│   │   ├── index.test.ts     API exports and error types (18 tests)
│   │   └── utils.test.ts     Utility functions tests (24 tests)
│   └── integration/          Integration tests (9 tests)
│       ├── unshield.test.ts  Unshield proof generation (4 tests)
│       ├── transfer.test.ts  Transfer proof generation (4 tests)
│       └── disclosure.test.ts Disclosure proof generation (4 tests)
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
│   ├── @orbinum/circuits/    Circuit artifacts (npm package)
│   └── @orbinum/groth16-proofs/ Proof generation WASM (npm package)
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

### `src/wasm-loader.ts`

Manages WASM module initialization (lazy loading).

```typescript
export async function initWasm(): Promise<void> {
  // Idempotent: Only initializes once
  // Dynamically imports WASM module from @orbinum/groth16-proofs
  // Works identically in Node.js and browsers
}

export async function compressSnarkjsProofWasm(proof: SnarkjsProofLike): Promise<string> {
  // Compress snarkjs proof to arkworks 128-byte format
}
```

**Key Design:**

- Lazy initialization (on first use)
- Universal environment support (Node.js, Browser, Electron, Tauri)
- Dynamic imports with environment-specific initialization
- Auto-initialization on first proof compression call

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
export async function generateProof(
  circuitType: CircuitType,
  inputs: CircuitInputs,
  options?: GenerateProofOptions
): Promise<ProofResult>;

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

### npm Package Dependencies

**Circuit artifacts are managed via npm packages:**

1. **@orbinum/circuits** (v0.3.0+)

   - Circuit WASM files (witness calculators)
   - Proving keys (.ark format for arkworks)
   - Verification keys (.zkey format for snarkjs)
   - Installed automatically as dependency

2. **@orbinum/groth16-proofs** (v2.0.0+)
   - Precompiled WASM module (arkworks Groth16)
   - Proof generation and compression
   - Installed automatically as dependency

**No manual downloads or postinstall scripts required!**

### Artifact Locations

After `npm install`, artifacts are in `node_modules/`:

```
node_modules/
├── @orbinum/circuits/
│   ├── unshield.wasm
│   ├── unshield_pk.ark
│   ├── unshield_pk.zkey
│   ├── transfer.wasm
│   ├── transfer_pk.ark
│   ├── transfer_pk.zkey
│   ├── disclosure.wasm
│   ├── disclosure_pk.ark
│   └── disclosure_pk.zkey
└── @orbinum/groth16-proofs/
    ├── groth16_proofs_bg.wasm
    ├── groth16_proofs.js
    └── groth16_proofs.d.ts
```

### Version Management

Update versions in `package.json`:

```json
{
  "dependencies": {
    "@orbinum/circuits": "^0.3.0",
    "@orbinum/groth16-proofs": "^2.0.0"
  }
}
```

Then:

```bash
npm update
npm install
```

## Testing Strategy

### Test Organization

**Two-tier test structure:**

1. **Unit Tests** (`tests/unit/`): Fast, isolated component testing

   - `circuits.test.ts` (13 tests): Circuit configuration resolution
   - `index.test.ts` (18 tests): API exports, error types, isReady()
   - `utils.test.ts` (24 tests): Validation and formatting utilities

2. **Integration Tests** (`tests/integration/`): End-to-end proof generation
   - `unshield.test.ts` (4 tests): Complete unshield proof flow
   - `transfer.test.ts` (4 tests): Complete transfer proof flow
   - `disclosure.test.ts` (4 tests): Complete disclosure proof flow

**Total: 64 tests (55 unit + 9 integration)**

### Test Structure

**Unit Test Example:**

```typescript
describe('circuits.ts - Unit Tests', () => {
  test('should resolve circuit config from package', () => {
    const config = getCircuitConfig(CircuitType.Unshield);
    expect(config.wasmPath).toContain('unshield.wasm');
    expect(config.zkeyPath).toContain('unshield_pk.zkey');
  });
});
```

**Integration Test Example:**

```typescript
describe('Integration: Unshield Proof Generation', () => {
  test('should generate valid proof for unshield', async () => {
    const result = await generateProof(CircuitType.Unshield, inputs);
    expect(result.proof).toBeDefined();
    expect(result.proof.length).toBe(258); // 0x + 256 hex chars
    expect(result.publicSignals.length).toBe(5);
  });
});
```

### Test Coverage

**Unit Tests:**

- ✅ Circuit artifact path resolution
- ✅ Configuration validation
- ✅ Public API exports
- ✅ Error class instantiation
- ✅ Utility function behavior
- ✅ Input validation and formatting

**Integration Tests:**

- ✅ Valid proof generation for all 3 circuits
- ✅ Invalid input handling
- ✅ Missing required fields detection
- ✅ Null/undefined input rejection
- ✅ Real WASM module integration
- ✅ Real circuit artifacts usage

**Run tests:**

```bash
# All tests
npm test

# Unit tests only
npm test -- tests/unit

# Integration tests only
npm test -- tests/integration

# Specific test file
npm test -- tests/unit/circuits.test.ts
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

1. Add circuit type to `src/types.ts` (CircuitType enum)
2. Update `getExpectedPublicSignals()` in `src/circuits.ts`
3. Add unit tests in `tests/unit/`
4. Add integration test in `tests/integration/{circuit}.test.ts`
5. Ensure @orbinum/circuits package includes new circuit artifacts
6. Update documentation in `docs/api.md`

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
