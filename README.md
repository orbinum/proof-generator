# @orbinum/proof-generator

> Fast ZK-SNARK proof generator for Orbinum privacy protocol.
> Witness calculation (TypeScript/snarkjs) + Proof generation (WASM/arkworks)

[![npm version](https://img.shields.io/npm/v/%40orbinum/proof-generator)](https://www.npmjs.com/package/@orbinum/proof-generator)
[![License](https://img.shields.io/badge/license-GPL--3.0--or--later-blue)](./LICENSE)
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
| ValueProof | ~91ms | ~262ms | +1.5–2s (WASM init) |
| Unshield | ~407ms | ~2.1s | +1.5–2s (WASM init) |
| Transfer | ~1.1s | ~7.2s | +1.5–2s (WASM init) |

> **snarkjs backend** (default): uses snarkjs `fullProve` with `.zkey` proving keys — fastest option post-warmup.
>
> **arkworks backend**: uses snarkjs witness-only + arkworks WASM with `.ark` proving keys — ~3× slower for small circuits (ValueProof), ~5× slower for large circuits (Unshield, Transfer). `.ark` artifacts are 2–3× smaller than `.zkey`.

The first proof call in a process incurs the WASM initialization overhead (~1.5–2s). All subsequent proofs skip this.

**Phase breakdown — where each backend spends its time (1 run):**

| Circuit | Backend | Load | Witness | Serialize | Prove | Compress | Total |
|---------|---------|------|---------|-----------|-------|----------|-------|
| ValueProof | snarkjs | 9ms | — | — | 91ms | — | 100ms |
| ValueProof | arkworks | — | 24ms | 3ms | 234ms | — | 262ms |
| Unshield | snarkjs | 21ms | — | — | 367ms | — | 388ms |
| Unshield | arkworks | 8ms | 28ms | 26ms | 1965ms | — | 2027ms |
| Transfer | snarkjs | 54ms | — | — | 1094ms | — | 1148ms |
| Transfer | arkworks | 24ms | 94ms | 101ms | 6901ms | — | 7120ms |

> `Prove` represents 97% of total time for large circuits (Unshield, Transfer). Load, witness calculation, and serialization are negligible. For arkworks, `Prove` includes PK deserialization + `Groth16::prove` inside WASM.

## Supported Circuits

| Circuit     | Use Case                                         |
| ----------- | ------------------------------------------------ |
| Unshield    | Withdraw from pool to public address             |
| Transfer    | Private-to-private transfer                      |
| ValueProof  | Prove note value without revealing full details  |

## Related Packages

- [@orbinum/circuits](https://www.npmjs.com/package/@orbinum/circuits) - Circuit artifacts (installed automatically)
- [@orbinum/groth16-proofs](https://www.npmjs.com/package/@orbinum/groth16-proofs) - WASM proof generator (installed automatically)
- [orbinum/node](https://github.com/orbinum/node) - Substrate blockchain node

## License

GNU General Public License v3.0 or later ([LICENSE](LICENSE)).

Not dual-licensed: `@orbinum/circuits` and `@orbinum/groth16-proofs` are both
GPL-3.0, and this package cannot be used without them.
