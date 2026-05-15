# Development Guide

Development setup, architecture, and testing for `@orbinum/proof-generator`.

## Getting Started

### Setup

```bash
# Clone and install
git clone https://github.com/orbinum/proof-generator.git
cd proof-generator
pnpm install

# Type-check (includes tests/)
pnpm typecheck

# Run tests
pnpm test
```

### Requirements

- **Node.js**: ≥ 22.0.0
- **pnpm**: ≥ 10.0.0
- **Git**: For version control

## Project Structure

```
proof-generator/
├── src/
│   ├── index.ts                   Public API barrel (no logic)
│   │
│   ├── generate/                  Proof orchestration
│   │   ├── index.ts               generateProof() entry point
│   │   ├── types.ts               GenerateOptions interface
│   │   ├── provider.ts            resolveProvider() — auto-detects environment
│   │   └── backends/
│   │       ├── snarkjs.ts         runSnarkjsBackend()
│   │       └── arkworks.ts        runArkworksBackend()
│   │
│   ├── value_proof/               Value proof helpers
│   │   ├── index.ts               generateValueProof()
│   │   └── types.ts               ValueProofOutput
│   │
│   ├── circuits/                  Circuit configuration
│   │   ├── config.ts              getCircuitConfig()
│   │   ├── index.ts               Re-exports
│   │   └── types.ts               CircuitType, CircuitInputs, ProofResult, CircuitConfig
│   │
│   ├── errors/
│   │   └── index.ts               Error class hierarchy
│   │
│   ├── providers/                 Artifact providers
│   │   ├── interface.ts           ArtifactProvider interface
│   │   ├── node.ts                NodeArtifactProvider
│   │   ├── web.ts                 WebArtifactProvider
│   │   └── index.ts               Re-exports
│   │
│   ├── wasm/                      WASM module management
│   │   ├── index.ts               initWasm, compressSnarkjsProofWasm, generateProofFromWitnessWasm
│   │   ├── loader.ts              Lazy-load groth16-proofs WASM
│   │   └── types.ts               WitnessData
│   │
│   └── utils/
│       ├── encoding.ts            bigIntToBytes32, hexSignalToBigInt, …
│       ├── formatting.ts          normalizeProofHex, formatPublicSignalsArray, …
│       ├── validation.ts          validateInputs, validatePublicSignals, validateProofSize
│       └── index.ts               Re-exports
│
├── tests/                         Mirrors src/ structure
│   ├── generate/
│   │   ├── index.test.ts          generateProof() — 15 tests
│   │   └── provider.test.ts       resolveProvider() — 4 tests
│   ├── value_proof/
│   │   └── index.test.ts          generateValueProof() — 9 tests
│   ├── errors/
│   │   └── index.test.ts          Error class hierarchy — 11 tests
│   ├── circuits/
│   │   └── config.test.ts         Circuit config resolution
│   ├── providers/
│   │   ├── node.test.ts           NodeArtifactProvider
│   │   └── web.test.ts            WebArtifactProvider
│   ├── utils/
│   │   ├── encoding.test.ts
│   │   ├── formatting.test.ts
│   │   └── validation.test.ts
│   ├── wasm/
│   │   └── loader.test.ts
│   └── generate.test.ts           Integration: real proof generation (all 4 circuits)
│
├── scripts/
│   ├── benchmark.ts               Full proof benchmark (all circuits × backends)
│   └── test-ark-backend.ts        arkworks backend smoke test
│
├── docs/
│   ├── api.md                     Complete API reference
│   ├── backends.md                Backend comparison + benchmarks
│   ├── development.md             This file
│   └── usage.md                   Usage guide
│
├── tsconfig.json                  Production TypeScript config
├── tsconfig.test.json             Test TypeScript config (includes tests/)
├── vitest.config.ts               Vitest configuration
├── package.json                   Dependencies and scripts
└── README.md                      Project overview
```

## Development Workflow

### Build

```bash
pnpm build
```

Compiles TypeScript to `dist/`:

- Source: `src/**/*.ts`
- Output: `dist/**/*.js`
- Target: ES2022, CommonJS modules

### Testing

```bash
# Run all tests
pnpm test

# Watch mode (rerun on changes)
pnpm test:watch

# With coverage
pnpm test:coverage

# Single file
pnpm test tests/generate/index.test.ts
```

**Test setup:**

- Framework: **Vitest 4.1.3**
- TypeScript: native support (no ts-jest)
- External modules (`snarkjs`, `@orbinum/groth16-proofs`, `circomlibjs`) are mocked in unit tests
- `tests/generate.test.ts` runs real proof generation (integration)

### Code Formatting

```bash
# Format all TypeScript
pnpm format

# Check formatting (no changes)
pnpm format:check

# Type checking (includes tests/)
pnpm typecheck
```

**Tools:**

- Formatter: Prettier 3.8.1
- Type checker: TypeScript compiler (tsc)

### Full pre-publish check

```bash
pnpm check
```

Runs: lint → typecheck → format:check → build → tests.

### Clean Rebuild

```bash
pnpm clean      # Remove dist, node_modules, lockfile
pnpm install    # Reinstall everything
pnpm build      # Rebuild
```

## Key Source Files

### `src/generate/index.ts`

Orchestrator for all proof generation. Validates inputs, resolves provider, dispatches to backend.

```typescript
export async function generateProof(
  circuitType: CircuitType,
  inputs: CircuitInputs,
  options: GenerateOptions = {}
): Promise<ProofResult>
```

Flow:
1. `validateInputs(inputs)` — throws `InvalidInputsError` on bad inputs
2. `resolveProvider(options.provider)` — auto-detect or use override
3. `getCircuitConfig(circuitType)` — resolve artifact paths
4. `runSnarkjsBackend(...)` or `runArkworksBackend(...)` depending on `options.backend`
5. `validatePublicSignals(...)` — throws `ProofGenerationError` on invalid output

### `src/generate/provider.ts`

Auto-detects runtime environment and returns the default provider.

```typescript
export function resolveProvider(override?: ArtifactProvider): ArtifactProvider {
  if (override) return override;
  if (typeof window !== 'undefined' || typeof self !== 'undefined')
    return new WebArtifactProvider(...);
  return new NodeArtifactProvider();
}
```

### `src/generate/backends/snarkjs.ts`

```
provider.getCircuitWasm + getCircuitZkey
  → snarkjs.groth16.fullProve(inputs, wasm, zkey)
  → compressSnarkjsProofWasm(proof)    // 128-byte compression
  → validateProofSize
```

### `src/generate/backends/arkworks.ts`

```
provider.getCircuitWasm + getCircuitProvingKey (.ark)
  → snarkjs.wtns.calculate(inputs, wasm)
  → snarkjs.wtns.exportJson(wtns)
  → generateProofFromWitnessWasm(witness, provingKey)
```

### `src/value_proof/index.ts`

Uses `circomlibjs.buildPoseidon` to compute `owner_hash = Poseidon(ownerPubkey)`, then calls
`generateProof(CircuitType.ValueProof, ...)` and maps raw signals to `ValueProofOutput.decoded`.

### `src/errors/index.ts`

Error hierarchy:

```
ProofGeneratorError (base, has .code)
├── WitnessCalculationError  (code: 'WITNESS_CALCULATION_FAILED')
├── ProofGenerationError     (code: 'PROOF_GENERATION_FAILED')
├── CircuitNotFoundError     (code: 'CIRCUIT_NOT_FOUND')
└── InvalidInputsError       (code: 'INVALID_INPUTS')
```

### `src/wasm/index.ts`

Manages lifecycle of the `@orbinum/groth16-proofs` WASM module. Lazy-initializes on first use; idempotent.

```typescript
export async function initWasm(): Promise<void>
export async function compressSnarkjsProofWasm(proof): Promise<string>
export async function generateProofFromWitnessWasm(witness, provingKey): Promise<{ proof, publicSignals }>
```

## Architecture Overview

### Two-Backend Design

```
User Input
    ↓
generateProof()
    ↓ [validateInputs]
    ↓ [resolveProvider]
    ↓ [getCircuitConfig]
    ├── backend: 'snarkjs' (default) ──────────────────────────────────▮
    │   getCircuitWasm + getCircuitZkey                              │
    │   → snarkjs.groth16.fullProve                                  │
    │   → compressSnarkjsProofWasm (128-byte)                        │
    │                                                                │
    └── backend: 'arkworks' ────────────────────────────────────────▮
        getCircuitWasm + getCircuitProvingKey (.ark)             │
        → snarkjs.wtns.calculate → snarkjs.wtns.exportJson       │
        → generateProofFromWitnessWasm (arkworks WASM)            │
                                                                 ↓
                             ProofResult { proof, publicSignals, circuitType }
```

### Module Integration

- **snarkjs 0.7.6**: Witness calculation for all circuits; also the full prover in the `snarkjs` backend
- **@orbinum/groth16-proofs 2.1.0**: Arkworks Groth16 WASM — proof generation in `arkworks` backend, and 128-byte compression for `snarkjs` backend
- **circomlibjs 0.1.7**: Poseidon hash implementation — used exclusively in `src/value_proof/`

### Provider System

```
ArtifactProvider (interface)
├── NodeArtifactProvider   — reads from node_modules/@orbinum/circuits via fs
└── WebArtifactProvider    — fetches over HTTP (configurable base URL)
```

## Artifact Management

### npm Package Dependencies

**Circuit artifacts are managed via npm packages:**

1. **@orbinum/circuits** (0.4.4)

   - Circuit WASM files (witness calculators)
   - Proving keys (`.ark` for arkworks backend)
   - Verification keys (`.zkey` for snarkjs backend)
   - Installed automatically as dependency

2. **@orbinum/groth16-proofs** (2.1.0)
   - Precompiled Arkworks Groth16 WASM
   - Proof generation and 128-byte compression
   - Installed automatically as dependency

**No manual downloads or postinstall scripts required.**

### Artifact Locations

After `pnpm install`, artifacts are in `node_modules/`:

```
node_modules/
├── @orbinum/circuits/
│   ├── unshield.wasm
│   ├── unshield_pk.ark
│   ├── unshield_pk.zkey
│   ├── transfer.wasm
│   ├── transfer_pk.ark
│   ├── transfer_pk.zkey
│   ├── value_proof.wasm
│   ├── value_proof_pk.ark
│   ├── value_proof_pk.zkey
│   ├── private_link.wasm
│   ├── private_link_pk.ark
│   └── private_link_pk.zkey
└── @orbinum/groth16-proofs/
    ├── groth16_proofs_bg.wasm
    ├── groth16_proofs.js
    └── groth16_proofs.d.ts
```

### Version Management

Update versions in `package.json`, then:

```bash
pnpm update
pnpm install
```

## Testing Strategy

**Framework:** Vitest 4.1.3  
**Total:** 144 tests across 11 suites

### Test Organization

```
tests/
├── generate/
│   ├── index.test.ts     (15 tests)  generateProof — mocked provider & backends
│   └── provider.test.ts  ( 4 tests)  resolveProvider — environment detection
├── value_proof/
│   └── index.test.ts     ( 9 tests)  generateValueProof — mocked Poseidon
├── errors/
│   └── index.test.ts     (11 tests)  Error hierarchy and .code values
├── circuits/
│   └── config.test.ts                Circuit config resolution
├── providers/
│   ├── node.test.ts                  NodeArtifactProvider
│   └── web.test.ts                   WebArtifactProvider
├── utils/
│   ├── encoding.test.ts
│   ├── formatting.test.ts
│   └── validation.test.ts
├── wasm/
│   └── loader.test.ts
└── generate.test.ts              Integration: real proof generation (all 4 circuits)
```

### Mocking Approach

External dependencies are mocked with `vi.mock`:

- `snarkjs` — `groth16.fullProve`, `wtns.calculate`, `wtns.exportJson`
- `@orbinum/groth16-proofs` — `generate_proof_from_witness`, `compress_snarkjs_proof`
- `circomlibjs` — `buildPoseidon` returns `Object.assign(vi.fn(), { F: { toObject: vi.fn() } })`

Providers return `Uint8Array` stubs in unit tests — no real artifacts required.

### Unit Test Example

```typescript
describe('generateProof', () => {
  it('should dispatch to snarkjs backend by default', async () => {
    await generateProof(CircuitType.Unshield, validInputs);
    expect(runSnarkjsBackend).toHaveBeenCalledOnce();
    expect(runArkworksBackend).not.toHaveBeenCalled();
  });
});
```

### Integration Test Example

```typescript
describe('Integration: real proofs', () => {
  it('should generate valid unshield proof', async () => {
    const result = await generateProof(CircuitType.Unshield, inputs);
    expect(result.proof).toMatch(/^0x[0-9a-f]{256}$/);
    expect(result.publicSignals).toHaveLength(5);
  });
});
```

### Run Tests

```bash
pnpm test                                # All 144 tests
pnpm test tests/generate/               # Only generate suite
pnpm test tests/generate/index.test.ts  # Single file
pnpm test:coverage                      # With coverage report
```

## Dependencies

### Runtime

| Package | Version | Purpose |
| --- | --- | --- |
| `@orbinum/circuits` | `0.4.4` | Circuit WASM + proving keys |
| `@orbinum/groth16-proofs` | `2.1.0` | Arkworks WASM proof generation |
| `snarkjs` | `0.7.6` | Witness calculation + snarkjs proving |

### Development

| Package | Version | Purpose |
| --- | --- | --- |
| `vitest` | `4.1.3` | Test runner |
| `@vitest/coverage-v8` | `4.1.3` | Coverage reports |
| `typescript` | `6.0.2` | Compiler |
| `prettier` | `3.8.1` | Code formatting |
| `circomlibjs` | `0.1.7` | Poseidon hash (value_proof module) |
| `@types/node` | `25.5.2` | Node.js type definitions |
| `@types/snarkjs` | `0.7.9` | snarkjs type definitions |
| `@types/circomlibjs` | `0.1.6` | circomlibjs type definitions |

**See:** `package.json` for the complete list.

## Compilation Targets

TypeScript configured for:

- **Target:** ES2022
- **Module:** CommonJS
- **moduleResolution:** node
- **Strict:** true
- **types:** ["node"]

`tsconfig.test.json` extends the base config and adds `tests/**` to `include`.

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

### Add a new circuit

1. Add the circuit type to `src/circuits/types.ts` (`CircuitType` enum)
2. Add its config entry in `src/circuits/config.ts` (`getCircuitConfig` switch)
3. Ensure `@orbinum/circuits` package includes the new artifact files
4. Add unit tests in `tests/circuits/config.test.ts`
5. Add integration test in `tests/generate.test.ts`
6. Update `docs/api.md` (Supported Circuits table)

### Update dependencies

```bash
pnpm update
pnpm format
pnpm test
```

### Release a new version

```bash
npm version patch  # or minor, major
git push --tags
# GitHub Actions automatically publishes to npm
```

### Run benchmarks

```bash
npx tsx scripts/benchmark.ts
```

Runs all 4 circuits × 2 backends and prints timing per phase.

### Debug a failing test

```bash
pnpm test -- --reporter=verbose tests/generate/index.test.ts
```

## Resources

- **Circom Documentation**: [docs.circom.io](https://docs.circom.io)
- **snarkjs**: [github.com/iden3/snarkjs](https://github.com/iden3/snarkjs)
- **arkworks**: [github.com/arkworks-rs/ark-groth16](https://github.com/arkworks-rs/ark-groth16)
- **Backend comparison**: [docs/backends.md](backends.md)
- **Usage guide**: [docs/usage.md](usage.md)
- **API reference**: [docs/api.md](api.md)

---

See [docs/api.md](api.md) for complete API reference.
