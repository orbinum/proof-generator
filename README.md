# @orbinum/proof-generator

> Fast ZK-SNARK proof generator for Orbinum privacy protocol.
> Witness calculation (TypeScript/snarkjs) + Proof generation (WASM/arkworks)

[![npm version](https://img.shields.io/npm/v/%40orbinum/proof-generator)](https://www.npmjs.com/package/@orbinum/proof-generator)
[![License](https://img.shields.io/badge/License-Apache%202.0%20%7C%20GPL%203.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org/)

Generate **128-byte Groth16 ZK-SNARK proofs** in ~400ms (small circuits, post-warmup). Same TypeScript code runs identically in Node.js, browsers, Electron, and Tauri.

**New in v2.0**: Circuit artifacts and WASM modules are now installed automatically as npm dependencies (`@orbinum/circuits` and `@orbinum/groth16-proofs`). No more manual downloads!

## Quick Start

```bash
npm install @orbinum/proof-generator
```

Dependencies are installed automatically:

- `@orbinum/circuits` - Circuit artifacts (WASM, proving keys)
- `@orbinum/groth16-proofs` - Arkworks WASM proof generator

```typescript
import { generateProof, CircuitType } from '@orbinum/proof-generator';

const result = await generateProof(CircuitType.Unshield, {
  merkle_root: '0x...',
  nullifier: '0x...',
  amount: '100',
  // ... more inputs
});

console.log('Proof:', result.proof); // 0x... (128 bytes)
console.log('Signals:', result.publicSignals); // ['0x...', ...]
```

## Documentation

- **[API Reference](docs/api.md)** - Complete API, error handling, and usage examples
- **[Development Guide](docs/development.md)** - Setup, testing, architecture, and contribution guide

## Features

- ✅ **Fast**: ~80ms per proof (small circuits, snarkjs backend); ~253ms with arkworks backend
- ✅ **Optimized**: Direct decimal format pipeline (no conversion overhead)
- ✅ **Compact**: 128-byte proofs (50% smaller than snarkjs)
- ✅ **Universal**: Node.js, browsers, Electron, Tauri - same code
- ✅ **Simple**: No build tools, no Rust, no setup
- ✅ **Type-Safe**: Full TypeScript types

## Performance

Benchmarked on Apple M-series (Node.js, 3 runs post-warmup):

| Circuit | snarkjs backend | arkworks backend | First call overhead |
|---------|----------------|-----------------|---------------------|
| Disclosure | ~80ms | ~253ms | +1.5–2s (WASM init) |
| PrivateLink | ~73ms | ~234ms | +1.5–2s (WASM init) |
| Unshield | ~407ms | ~2.1s | +1.5–2s (WASM init) |
| Transfer | ~1.2s | ~7.2s | +1.5–2s (WASM init) |

> **snarkjs backend** (default): uses snarkjs `fullProve` with `.zkey` proving keys — fastest option post-warmup.
>
> **arkworks backend**: uses snarkjs witness-only + arkworks WASM with `.ark` proving keys — ~3× slower for small circuits (Disclosure, PrivateLink), ~5× slower for large circuits (Unshield, Transfer). `.ark` artifacts are 2–3× smaller than `.zkey`.

The first proof call in a process incurs the WASM initialization overhead (~1.5–2s). All subsequent proofs skip this.

**Phase breakdown — where each backend spends its time (1 run):**

| Circuit | Backend | Load | Witness | Serialize | Prove | Compress | Total |
|---------|---------|------|---------|-----------|-------|----------|-------|
| Disclosure | snarkjs | 9ms | — | — | 78ms | — | 87ms |
| Disclosure | arkworks | 2ms | 20ms | 3ms | 228ms | — | 253ms |
| PrivateLink | snarkjs | 8ms | — | — | 75ms | — | 83ms |
| PrivateLink | arkworks | 2ms | 14ms | 2ms | 216ms | — | 234ms |
| Unshield | snarkjs | 21ms | — | — | 367ms | — | 388ms |
| Unshield | arkworks | 8ms | 28ms | 26ms | 1965ms | — | 2027ms |
| Transfer | snarkjs | 54ms | — | — | 1212ms | — | 1266ms |
| Transfer | arkworks | 24ms | 94ms | 101ms | 6901ms | — | 7120ms |

> `Prove` represents 97% of total time for large circuits (Unshield, Transfer). Load, witness calculation, and serialization are negligible. For arkworks, `Prove` includes PK deserialization + `Groth16::prove` inside WASM.

## Supported Circuits

| Circuit     | Use Case                                         |
| ----------- | ------------------------------------------------ |
| Unshield    | Withdraw from pool to public address             |
| Transfer    | Private-to-private transfer                      |
| Disclosure  | Selective revelation                             |
| PrivateLink | Privacy-preserving cross-chain identity dispatch |

## Related Packages

- [@orbinum/circuits](https://www.npmjs.com/package/@orbinum/circuits) - Circuit artifacts (installed automatically)
- [@orbinum/groth16-proofs](https://www.npmjs.com/package/@orbinum/groth16-proofs) - WASM proof generator (installed automatically)
- [orbinum/node](https://github.com/orbinum/node) - Substrate blockchain node

## Migration from v1.x

If you're upgrading from v1.x:

- ✅ No code changes required
- ✅ Artifacts now come from npm instead of GitHub releases
- ✅ Faster installation (npm cache)
- ✅ Offline-friendly
- ❌ Old `circuits/` and `groth16-proof/` directories can be deleted

## License

Dual-licensed under Apache 2.0 or GPL 3.0. See [LICENSE-APACHE2](LICENSE-APACHE2) and [LICENSE-GPL3](LICENSE-GPL3).
