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
│   │   ├── index.ts               initWasm, compressSnarkjsProofWasm, generateProofWasm
│   │   └── loader.ts              Lazy-load groth16-proofs WASM
│   │
│   └── utils/
│       ├── encoding.ts            bigIntToBytes32, hexSignalToBigInt, …
│       ├── formatting.ts          normalizeProofHex, formatPublicSignalsArray, …
│       └── validation.ts          validateInputs, validatePublicSignals, validateProofSize
│
├── tests/                         Mirrors src/ structure
│   ├── e2e/                       Real proofs — no mocks, run separately
│   ├── generate/
│   │   ├── index.test.ts          generateProof()
│   │   ├── provider.test.ts       resolveProvider()
│   │   └── backends/wtns.test.ts  .wtns section-table parsing
│   ├── errors/
│   │   └── index.test.ts          Error class hierarchy
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
│   └── e2e/proving.test.ts        Real proofs for all three circuits, both backends
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

It removes `dist/` first. `tsc` only writes, never deletes, so a file dropped
from `src/` keeps shipping out of `dist/` until something happens to clean —
which is how two removed modules ended up in a 6.0.0 tarball.

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
- External modules (`snarkjs`, `@orbinum/groth16-proofs`) are mocked in the unit suite
- `tests/e2e/` runs real proof generation against the published packages, and mocks nothing

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
  → generateProofWasm(artifactBytes, witnessBytes)
```

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
export async function generateProofWasm(artifactBytes, witnessBytes): Promise<{ proof, publicSignals }>
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
        → generateProofWasm (arkworks WASM)                       │
                                                                 ↓
                             ProofResult { proof, publicSignals, circuitType }
```

### Module Integration

- **snarkjs 0.7.6**: Witness calculation for all circuits; also the full prover in the `snarkjs` backend
- **@orbinum/groth16-proofs 4.0.0**: Arkworks Groth16 WASM — proof generation in the `arkworks` backend, and 128-byte compression for the `snarkjs` backend
- **@orbinum/circuits 0.14.0**: Circuit artifacts — `.wasm`, `.zkey`, and the `.ark` v2 files the arkworks backend proves from

### Provider System

```
ArtifactProvider (interface)
├── NodeArtifactProvider   — reads from node_modules/@orbinum/circuits via fs
└── WebArtifactProvider    — fetches over HTTP (configurable base URL)
```

## Artifact Management

### npm Package Dependencies

**Circuit artifacts are managed via npm packages:**

1. **@orbinum/circuits** (0.14.0)

   - Circuit `.wasm` files (witness calculators)
   - Proving keys in both formats: `.zkey` for snarkjs, `.ark` v2 for arkworks
   - `verification_key_<circuit>.json` — the verifying keys
   - Installed automatically as a dependency

   The `.ark` must be **v2**: it carries the circuit's constraint matrices as
   well as the proving key, and arkworks cannot prove a Circom circuit without
   them. A v1 artifact is rejected by name.

2. **@orbinum/groth16-proofs** (4.0.0)
   - Precompiled Arkworks Groth16 WASM
   - Proof generation and 128-byte compression
   - Installed automatically as a dependency

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

Two suites, run by different commands, because they answer different questions
and cost three orders of magnitude apart.

| Suite | Command | Cost | Mocks |
| --- | --- | --- | --- |
| Unit | `pnpm test` | ~300 ms | `snarkjs`, `@orbinum/groth16-proofs` |
| End-to-end | `pnpm test:e2e` | ~27 s | none |

The split is deliberate, and so is the fact that the unit suite mocks the
prover. It keeps the common case fast and runnable without 27 MB of proving
keys — but it means every unit test would pass against a wasm module that
returned 128 bytes of zeroes. That is not hypothetical: this package shipped
exactly that for two major versions, and only `tests/e2e/` can catch it.

### Test Organization

```
tests/
├── e2e/
│   ├── inputs.ts                 Circuit inputs, copied from the circuits repo
│   └── proving.test.ts           Real proofs, both backends, verified with snarkjs
├── environments/
│   ├── wasm-init.test.ts         Which init entry point runs per environment
│   └── bundling.test.ts          Static checks on the built package
├── generate/
│   ├── index.test.ts             generateProof — mocked provider & backends
│   ├── provider.test.ts          resolveProvider — environment detection
│   └── backends/
│       └── wtns.test.ts          .wtns section-table parsing, incl. malformed input
├── errors/
│   └── index.test.ts             Error hierarchy and .code values
├── circuits/
│   ├── circuit-id.test.ts        CIRCUIT_ID drift against the node's constants
│   └── config.test.ts            Circuit config resolution
├── providers/
│   ├── node.test.ts              NodeArtifactProvider
│   └── web.test.ts               WebArtifactProvider
├── utils/
│   ├── encoding.test.ts
│   ├── formatting.test.ts
│   └── validation.test.ts
└── wasm/
    └── loader.test.ts
```

`vitest.e2e.config.ts` exists rather than a `--exclude` flag because vitest
applies `exclude` before any path filter, so a filter-based split silently
matches nothing.

### Browser and server

Everything else imports from `src/` under Node — the one environment where
nothing can go wrong. The failures that matter live at the boundary:

- **`wasm-init.test.ts`** — `initWasm` branches on `window`/`self` and calls a
  different wasm-bindgen entry point on each side, with a differently-named
  argument key (`{ module }` vs `{ module_or_path }`). Passing the wrong one is
  not an error: wasm-bindgen reads `undefined` and falls back to fetching the
  binary relative to its own URL, so the symptom is a request for a file nobody
  asked for. These assert the exact shape, plus that a Web Worker (`self`
  without `window`) takes the browser path.
- **`bundling.test.ts`** — static checks on `dist/`: no Node builtin reachable
  from a module a browser loads, `fs`/`path` required lazily rather than at
  module scope, every export downstream packages import still present, and no
  leftovers from deleted sources. Skips without `dist/`; fails instead under
  `PROOF_GENERATOR_REQUIRE_ARTIFACTS`.

Both were written against a real `vite` bundle of the package running in a
browser-shaped context — that is what surfaced the argument-key bug. The bundle
itself is not in the suite: it takes ~10 s and the bundler's Node API, while the
properties it demonstrated are checkable directly.

`PROOF_GENERATOR_REQUIRE_ARTIFACTS=1` turns the e2e suite's skip into a failure.
CI sets it: a suite that skips everything looks exactly like one that passes
everything.

### Mocking Approach

External dependencies are mocked with `vi.mock`:

- `snarkjs` — `groth16.fullProve`, `wtns.calculate`
- `@orbinum/groth16-proofs` — `generate_proof_wasm`, `compress_snarkjs_proof_wasm`

Providers return `Uint8Array` stubs in unit tests — no real artifacts required.

One mock is not a stub: the arkworks backend parses the `.wtns` section table
itself, so `wtns.calculate` has to produce a structurally real buffer. A mock
returning an arbitrary blob would exercise the error path while appearing to
test the happy one. `tests/generate/backends/wtns.test.ts` builds those buffers
deliberately — including malformed ones — and asserts each is rejected.

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

### End-to-End Test Example

```typescript
it('the proof verifies against the registered verifying key', async () => {
  const provider = new NodeArtifactProvider();
  const zkey = await provider.getCircuitZkey(name);

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(inputs, wasm, zkey);
  const vk = await snarkjs.zKey.exportVerificationKey(zkey);

  expect(await snarkjs.groth16.verify(vk, publicSignals, proof)).toBe(true);

  // A tampered signal must break it — otherwise the check above also passes
  // for a verifier that ignores its inputs.
  const tampered = [...publicSignals];
  tampered[0] = (BigInt(tampered[0]) + 1n).toString();
  expect(await snarkjs.groth16.verify(vk, tampered, proof)).toBe(false);
});
```

### Run Tests

```bash
pnpm test                               # Unit suite (mocked, ~300 ms)
pnpm test:e2e                           # Real proofs (~27 s, needs artifacts)
pnpm test tests/generate/               # Only the generate suite
pnpm test tests/generate/index.test.ts  # Single file
pnpm test:coverage                      # With coverage report
```

## Dependencies

### Runtime

| Package | Version | Purpose |
| --- | --- | --- |
| `@orbinum/circuits` | `0.14.0` | Circuit `.wasm`, `.zkey`, and `.ark` v2 artifacts |
| `@orbinum/groth16-proofs` | `4.0.0` | Arkworks WASM proof generation and 128-byte compression |
| `snarkjs` | `0.7.6` | Witness calculation + snarkjs proving |

### Development

| Package | Version | Purpose |
| --- | --- | --- |
| `vitest` | `4.1.3` | Test runner |
| `@vitest/coverage-v8` | `4.1.3` | Coverage reports |
| `typescript` | `6.0.2` | Compiler |
| `prettier` | `3.8.1` | Code formatting |
| `@types/node` | `25.5.2` | Node.js type definitions |
| `@types/snarkjs` | `0.7.9` | snarkjs type definitions |

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
5. Add the circuit to `tests/e2e/proving.test.ts` and its inputs to `tests/e2e/inputs.ts`
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

### Measure proving cost

There is no benchmark script; `pnpm test:e2e` proves all three circuits with
both backends and vitest reports each duration, which is the same measurement
without a second thing to keep in sync.

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
