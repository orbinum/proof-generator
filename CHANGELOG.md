# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **`generateDisclosureProof()`** (`src/disclosure.ts`) — new proof generation function for selective disclosure circuit:
  - Accepts `value`, `ownerPubkey`, `blinding`, `assetId`, `commitment` as `bigint` + `DisclosureMask` flags
  - Computes `viewing_key = Poseidon(owner_pubkey)` via circomlibjs for ZK-friendly key derivation
  - Generates Groth16 proof via `disclosure.wasm` + `disclosure_pk.zkey` artifacts
  - Returns `DisclosureProofOutput` with 128-byte compressed proof, 4 public signals (LE hex), and `revealedData` decoded to human-readable values
  - Validates mask: throws if all flags are `false`
- **New types exported** from `src/index.ts`:
  - `DisclosureMask` — three boolean disclosure flags (`discloseValue`, `discloseAssetId`, `discloseOwner`)
  - `DisclosureProofOutput` — proof + publicSignals + revealedData
  - `bigIntToBytes32()` / `bytes32ToBigInt()` — big-endian field element helpers
  - `hexSignalToBigInt()` — decode LE hex public signals back to BigInt
  - `bigIntToHex()` — BigInt to 0x-prefixed 64-char big-endian hex
- **`CircuitType.Disclosure`** added to `src/circuits.ts` with `expectedPublicSignals: 4`
- **30 unit tests** in `tests/unit/disclosure.test.ts` across 5 describe blocks — all pass in 1.4s
- **Integration test** `tests/integration/disclosure.test.ts` with real circuit artifacts (graceful skip if artifacts unavailable)

## [3.1.1] - 2026-02-18

### Fixed

- **CI/CD Release Workflow**: Fixed GitHub Actions release workflow to properly trigger npm publish
  - Previous release (v3.1.0) was merged without triggering the release CI pipeline
  - Updated release workflow to ensure proper npm package publishing
  - Verified all release steps execute correctly: build → lint → test → npm publish

### Changed

- Applied force rebuild to ensure clean dist files for npm package

## [3.1.0] - 2026-02-18

### Added

- **ArtifactProvider Pattern**: New abstraction for loading circuit artifacts
  - `ArtifactProvider` interface for implementing custom artifact loading strategies
  - `NodeArtifactProvider` - Load artifacts from npm packages using Node.js `fs` module
  - `WebArtifactProvider` - Load artifacts via HTTP fetch (browser-compatible)
- **Browser Support**: Full browser compatibility with web-based proof generation
  - Automatic provider detection (Node.js vs browser environment)
- **New Unit Tests**: `provider.test.ts` for WebArtifactProvider URL construction and error handling

### Changed

- **generateProof()**: Now accepts optional `provider` parameter for custom artifact loading
  - Automatically selects appropriate provider if not specified
  - Enables flexible artifact resolution (npm packages, HTTP, custom implementations)
- **circuits.ts**: Complete refactoring to use ArtifactProvider pattern
  - Replaced static file system logic with dynamic provider-based loading
  - Circuit config now returns relative file paths instead of absolute paths
- **TypeScript Configuration**: Added `"dom"` library for browser compatibility

### Improved

- Better artifact loading abstraction for extensibility
- More flexible deployment options (node packages, CDN, custom servers)
- Cleaner separation of concerns between circuit config and artifact loading
- Better error handling for missing artifacts with provider-specific messages

### Removed

- **Deprecated Functions**:
  - `isReady()` - No longer needed with provider-based architecture
  - `calculateWitness()` - Use `generateProof()` with verbose logging instead
  - `validateCircuitArtifacts()` - Validation now handled by providers

### Fixed

- Fixed TypeScript strict mode compatibility in test files
- Improved error messages when artifacts cannot be loaded

### Dependencies Updated

- `@orbinum/circuits`: ^0.3.0 → ^0.3.1
- `typescript`: 5.7.3 → ^5.9.3 (pinned to caret for compatibility)
- Minor updates: `b4a` 1.7.4 → 1.7.5, `get-east-asian-width` 1.4.0 → 1.5.0

### Migration Guide

**From v3.0 to v3.1**: No breaking changes for most users. The API remains fully compatible:

```typescript
// Still works - automatic provider selection
const result = await generateProof(CircuitType.Unshield, inputs);

// New in v3.1 - custom provider
import { WebArtifactProvider } from '@orbinum/proof-generator';
const provider = new WebArtifactProvider('https://my-cdn.com/circuits');
const result = await generateProof(CircuitType.Unshield, inputs, { provider });
```

If using removed functions (`isReady()`, `calculateWitness()`):

- Remove `isReady()` checks - providers handle artifact validation
- Replace `calculateWitness()` with `generateProof(..., { verbose: true })`

## [3.0.0] - 2026-02-16

### Major Changes

- **npm package dependencies**: Artifacts now installed automatically from npm
  - `@orbinum/circuits@^0.2.1` - Circuit artifacts (WASM, proving keys, verification keys)
  - `@orbinum/groth16-proofs@^1.1.0` - Arkworks WASM proof generator
  - No more postinstall downloads from GitHub releases

### Changed

- Removed postinstall script that downloaded from GitHub
- Updated circuit loader to import from `@orbinum/circuits` package
- Updated WASM loader to import from `@orbinum/groth16-proofs` package
- Simplified `config.ts` (deprecated path resolution functions)
- Updated `circuits.ts` to use `getCircuitPaths()` from `@orbinum/circuits`
- Cleaner package: Removed `circuits/` and `groth16-proof/` directories

### Added

- Documentation for npm package migration
- `scripts/README.md` explaining deprecated download scripts

### Improved

- Faster installation (npm cache vs GitHub API)
- More reliable (no GitHub rate limits)
- Offline-friendly (works after first install)
- Better CI/CD (reproducible builds)
- Semantic versioning for all dependencies

### Migration Guide

**From v1.x to v2.0**:

```bash
# Update package
npm install @orbinum/proof-generator@latest

# Clean old directories (optional)
rm -rf circuits/ groth16-proof/

# No code changes needed - API is compatible
```

**Breaking Changes**: None for users (internal refactoring only)

## [2.0.0] - 2026-02-15

### Added

- **Formatter utilities**: Comprehensive helpers for data format conversion
  - `formatInputValue()`, `formatInputArray()`, `formatCircuitInputs()` - Convert various input formats to circuit format
  - `formatWitness()` - Convert witness arrays (BigInt/number/string) to decimal format
  - `formatProofToHex()`, `parseProofHex()`, `normalizeProofHex()` - Proof hex utilities
  - `formatProofHexForDisplay()` - Display-friendly proof truncation
- New documentation: [docs/formatters.md](docs/formatters.md) with complete formatter API reference

### Changed

- **Performance improvement**: Now uses decimal witness format directly from snarkjs
- Updated to use `generate_proof_from_decimal_wasm()` from groth16-proofs (eliminates conversion overhead)
- Witness calculation returns native snarkjs decimal format (no hex LE conversion)
- Updated `WitnessData` interface to reflect decimal string format
- Updated test suite: 36 → 46 tests (added formatter tests)
- Simplified utils.ts: removed unnecessary format converters that don't align with decimal-first architecture

### Removed

- **Public signal formatters**: `formatPublicSignal()`, `parsePublicSignal()`, `formatPublicSignalsArray()`, `parsePublicSignalsArray()` - not needed as library returns decimal strings directly
- **Deprecated functions**: `bigIntToHexLE()`, `witnessToHexLE()`, `formatProofHex()`, `hexToBytes()`, `bytesToHex()` - removed legacy hex LE conversion utilities

### Improved

- Simplified witness pipeline: snarkjs → decimal → groth16-proofs (removed intermediate hex LE conversion)
- Better integration with updated groth16-proofs library
- Cleaner API surface - only formatters that align with decimal-first format
- Updated documentation to reflect decimal-only approach for public signals

## [1.0.3] - 2026-02-13

### Fixed

- Create GitHub release immediately after npm publish
- Release workflow now generates GitHub releases automatically

## [1.0.2] - 2026-02-13

### Fixed

- Publish as public npm package (added `--access public` flag)
- Added `publishConfig` to package.json for public scoped packages
- Added id-token permission to release workflow
- Removed paths filter from release workflow to ensure it triggers on all main branch changes

### Changed

- Updated TypeScript dependencies
- Fixed dependency typo (ls-jest → ts-jest)

## [1.0.1] - 2026-02-13

### Added

- Initial release
- Support for unshield, transfer, and disclosure circuits
- WASM-based proof generation using arkworks
- Comprehensive test suite with 36 tests
- Automatic artifact download from GitHub releases
- TypeScript support with full type definitions
- snarkjs integration for witness calculation
