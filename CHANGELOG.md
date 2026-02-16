# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
