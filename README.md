# @orbinum/proof-generator

> Fast ZK-SNARK proof generator for Orbinum privacy protocol.
> Witness calculation (TypeScript/snarkjs) + Proof generation (WASM/arkworks)

[![npm version](https://img.shields.io/npm/v/%40orbinum/proof-generator)](https://www.npmjs.com/package/@orbinum/proof-generator)
[![License](https://img.shields.io/badge/License-Apache%202.0%20%7C%20GPL%203.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org/)

Generate **128-byte Groth16 ZK-SNARK proofs** in ~6-8.5 seconds. Same TypeScript code runs identically in Node.js, browsers, Electron, and Tauri.

## Quick Start

```bash
npm install @orbinum/proof-generator
```

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

- **[API Reference](docs/api.md)** - Complete API, error handling, configuration
- **[Development Guide](docs/development.md)** - Setup, testing, architecture details

## Features

- ✅ **Fast**: ~8.5s end-to-end (500ms witness + 5-8s proof)
- ✅ **Compact**: 128-byte proofs (50% smaller than snarkjs)
- ✅ **Universal**: Node.js, browsers, Electron, Tauri - same code
- ✅ **Simple**: No build tools, no Rust, no setup
- ✅ **Type-Safe**: Full TypeScript types
- ✅ **Tested**: 32+ passing tests

## Supported Circuits

| Circuit    | Use Case                             |
| ---------- | ------------------------------------ |
| Unshield   | Withdraw from pool to public address |
| Transfer   | Private-to-private transfer          |
| Disclosure | Selective revelation                 |

## Related Repositories

- [orbinum/groth16-proofs](https://github.com/orbinum/groth16-proofs) - WASM compilation
- [orbinum/circuits](https://github.com/orbinum/circuits) - Circuit definitions
- [orbinum/node](https://github.com/orbinum/node) - Main implementation

## License

Dual-licensed under Apache 2.0 or GPL 3.0. See [LICENSE-APACHE2](LICENSE-APACHE2) and [LICENSE-GPL3](LICENSE-GPL3).
