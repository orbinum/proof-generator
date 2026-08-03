# Backend Comparison: snarkjs vs arkworks

`@orbinum/proof-generator` supports two proof generation backends that can be selected per call. This document explains how each backend works, when to use each one, and what the performance numbers look like.

## Overview

| | snarkjs | arkworks |
|---|---|---|
| **Proving key format** | `.zkey` | `.ark` |
| **Proof generation** | JavaScript (snarkjs `groth16.fullProve`) | WASM (arkworks `Groth16::prove`) |
| **Artifact size** | Larger (`.zkey`) | 2–3× smaller (`.ark`) |
| **Speed (small circuits)** | ~80ms | ~250–280ms |
| **Speed (large circuits)** | ~380ms–1.1s | ~2s–7s |
| **Default** | ✅ Yes | No |

---

## How Each Backend Works

### snarkjs (default)

```
inputs → snarkjs.groth16.fullProve(inputs, wasm, zkey)
       → { proof (G1/G2 points), publicSignals }
       → compressSnarkjsProofWasm(proof)
       → 128-byte compressed Groth16 proof
```

`fullProve` handles everything internally: it calculates the witness using the circuit WASM, then generates the proof using the `.zkey` proving key — all within the same snarkjs call. The raw snarkjs output is then compressed to the 128-byte arkworks canonical format via a small WASM helper.

**Phase breakdown (1 run, Apple M-series):**

| Circuit | Load | Prove (fullProve) | Compress | Total |
|---------|------|-------------------|----------|-------|
| ValueProof | 9ms | 82ms | 1ms | ~91ms |
| Unshield | 21ms | 365ms | — | ~386ms |
| Transfer | 54ms | 1094ms | — | ~1148ms |

### arkworks

```
inputs → snarkjs.wtns.calculate(inputs, wasm, buffer)
       → snarkjs.wtns.exportJson(buffer) → bigint[]
       → JSON.stringify(witness.map(v => v.toString()))
       → generateProofFromWitnessWasm(numSignals, witnessJson, arkBytes)
       → 128-byte compressed Groth16 proof
```

The arkworks backend splits the work in two: snarkjs calculates the witness in memory using the circuit WASM, then the pre-serialised witness is handed off to an arkworks WASM module that performs the actual Groth16 proof using a smaller `.ark` proving key.

**Phase breakdown (1 run, Apple M-series):**

| Circuit | Load | Witness | Serialize | Prove (WASM) | Total |
|---------|------|---------|-----------|--------------|-------|
| ValueProof | — | 24ms | 3ms | 234ms | ~262ms |
| Unshield | 8ms | 29ms | 27ms | 1955ms | ~2019ms |
| Transfer | 27ms | 78ms | 99ms | 7093ms | ~7297ms |

> `Prove` represents 97% of total time for large circuits. Load, witness calculation, and serialization are negligible.

---

## Benchmark Results

Measured on Apple M-series, Node.js ≥ 22, 3 runs post-warmup (median reported):

| Circuit | snarkjs | arkworks | Ratio |
|---------|---------|----------|-------|
| ValueProof | 91ms | 262ms | 0.35× |
| Unshield | 380ms | 2061ms | 0.18× |
| Transfer | 1148ms | 7041ms | 0.16× |

snarkjs is consistently **3–5× faster** than arkworks post-warmup.

### First-call overhead

Both backends incur a one-time WASM initialisation cost the first time they are used in a process:

- **snarkjs**: minimal (JS module, no WASM init)
- **arkworks**: +1.5–2s (WASM binary loaded and compiled once, then cached)

Subsequent calls within the same process skip this overhead entirely.

---

## Key Differences

### Proving key format

- **`.zkey`** (snarkjs): larger files, self-contained, widely compatible.
- **`.ark`** (arkworks): 2–3× smaller because the key uses a compressed representation. Both formats provide identical security.

### Where proof generation happens

- **snarkjs**: pure JavaScript running in the Node.js / browser JS engine.
- **arkworks**: native Rust code compiled to WASM — fully sandboxed, same binary in Node.js and browser.

### Why snarkjs is faster

snarkjs `fullProve` is highly optimised for BN254 in JavaScript and has had years of performance tuning. The arkworks WASM module includes pk deserialization inside the proof call, which adds overhead particularly visible on large circuits like `Transfer`.

### Why you might choose arkworks anyway

- **Smaller artifacts**: `.ark` files reduce bandwidth and storage — relevant for browser or mobile deployments.
- **Consistency**: the same WASM binary runs identically in every environment with no JS engine differences.
- **Future**: as the arkworks WASM module matures, the performance gap is expected to narrow.

---

## Choosing a Backend

| Scenario | Recommended backend |
|---|---|
| Server-side Node.js, latency matters | `snarkjs` (default) |
| Browser / mobile, bandwidth matters | `arkworks` (smaller `.ark` keys) |
| Offline / air-gapped environments | Either (both work offline) |
| You need the fastest possible proof | `snarkjs` |
| Artifact storage is constrained | `arkworks` |

In practice, default to `snarkjs`. Switch to `arkworks` only when artifact size or environment constraints make it the better trade-off.
