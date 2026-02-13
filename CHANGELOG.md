# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
