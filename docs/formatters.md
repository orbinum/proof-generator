# Data Formatters Guide

Helper functions to format data into the correct format for **@orbinum/proof-generator**.

## Overview

The proof generator requires specific data formats:

- **Circuit Inputs**: String or string arrays (decimal)
- **Witness**: String array (decimal format)
- **Proof**: Hex string (0x... 256 chars = 128 bytes)
- **Public Signals**: String array (decimal format) - returned by library

These helpers convert from common formats to what the library expects.

---

## Circuit Input Formatters

### `formatInputValue()`

Convert a single value to circuit input format (decimal string).

```typescript
function formatInputValue(value: string | number | bigint): string;
```

**Examples:**

```typescript
import { formatInputValue } from '@orbinum/proof-generator';

formatInputValue(100); // "100"
formatInputValue(0x64); // "100" (hex → decimal)
formatInputValue('100'); // "100" (passthrough)
formatInputValue(100n); // "100" (BigInt → string)
formatInputValue('0x64'); // "100" (hex string → decimal)
```

---

### `formatInputArray()`

Convert array of values to circuit input format.

```typescript
function formatInputArray(values: (string | number | bigint)[]): string[];
```

**Examples:**

```typescript
import { formatInputArray } from '@orbinum/proof-generator';

formatInputArray([1, 2, 3]); // ["1", "2", "3"]
formatInputArray([0x01, 0x02, 0x03]); // ["1", "2", "3"]
formatInputArray([1n, 2n, 3n]); // ["1", "2", "3"]
formatInputArray(['0x01', '0x02']); // ["1", "2"]
```

---

### `formatCircuitInputs()`

Format entire circuit inputs object.

```typescript
function formatCircuitInputs(
  inputs: Record<string, string | number | bigint | (string | number | bigint)[]>
): Record<string, string | string[]>;
```

**Examples:**

```typescript
import { formatCircuitInputs } from '@orbinum/proof-generator';

const inputs = {
  amount: 100,
  nullifier: 0x123,
  pathElements: [1, 2, 3],
  recipient: '0xabc',
};

const formatted = formatCircuitInputs(inputs);
// {
//   amount: "100",
//   nullifier: "291",
//   pathElements: ["1", "2", "3"],
//   recipient: "2748"
// }
```

---

## Witness Formatters

### `formatWitness()`

Convert witness from various formats to decimal string array.

```typescript
function formatWitness(witness: (bigint | number | string)[]): string[];
```

**Accepts:**

- `BigInt[]` - From native JS crypto
- `number[]` - Small values
- `string[]` - Decimal or hex strings

**Examples:**

```typescript
import { formatWitness } from '@orbinum/proof-generator';

formatWitness([1n, 2n, 3n]); // ["1", "2", "3"]
formatWitness([1, 2, 3]); // ["1", "2", "3"]
formatWitness(['1', '2', '3']); // ["1", "2", "3"] (passthrough)
formatWitness(['0x01', '0x02']); // ["1", "2"] (hex → decimal)
```

---

## Proof Formatters

### `formatProofToHex()`

Convert proof bytes to hex string.

```typescript
function formatProofToHex(proofBytes: Uint8Array): string;
```

**Examples:**

```typescript
import { formatProofToHex } from '@orbinum/proof-generator';

const proofBytes = new Uint8Array(128); // Your proof bytes
const proofHex = formatProofToHex(proofBytes);
// "0xabcd1234..." (256 hex chars)
```

---

### `parseProofHex()`

Convert proof hex string to bytes.

```typescript
function parseProofHex(proofHex: string): Uint8Array;
```

**Examples:**

```typescript
import { parseProofHex } from '@orbinum/proof-generator';

const proofHex = '0xabcd1234...'; // 256 hex chars
const proofBytes = parseProofHex(proofHex);
// Uint8Array(128)
```

---

### `normalizeProofHex()`

Normalize proof hex (ensure 0x prefix, lowercase).

```typescript
function normalizeProofHex(proofHex: string): string;
```

**Examples:**

```typescript
import { normalizeProofHex } from '@orbinum/proof-generator';

normalizeProofHex('ABCD1234...'); // "0xabcd1234..."
normalizeProofHex('0xABCD1234...'); // "0xabcd1234..."
normalizeProofHex('abcd1234...'); // "0xabcd1234..."
```

---

### `formatProofHexForDisplay()`

Truncate proof hex for console display.

```typescript
function formatProofHexForDisplay(proofHex: string, maxLength?: number): string;
```

**Examples:**

```typescript
import { formatProofHexForDisplay } from '@orbinum/proof-generator';

const proof = '0xabcd1234...9876fedc'; // 256 chars
formatProofHexForDisplay(proof, 32);
// "0xabcd1234...9876fedc" (truncated)
```

---

## Validation Functions

### `validateInputs()`

Validate circuit inputs structure.

```typescript
function validateInputs(inputs: Record<string, any>): void;
```

**Throws:** Error if inputs are invalid (null, undefined values)

**Examples:**

```typescript
import { validateInputs } from '@orbinum/proof-generator';

validateInputs({ amount: '100', nullifier: '0x123' }); // OK
validateInputs({ amount: null }); // Throws error
```

---

### `validatePublicSignals()`

Validate public signals count matches expected.

```typescript
function validatePublicSignals(signals: string[], expected: number): void;
```

**Throws:** Error if count doesn't match

**Examples:**

```typescript
import { validatePublicSignals } from '@orbinum/proof-generator';

validatePublicSignals(['1', '2', '3'], 3); // OK
validatePublicSignals(['1', '2'], 3); // Throws error
```

---

### `validateProofSize()`

Validate proof size (must be 128 bytes = 256 hex chars).

```typescript
function validateProofSize(proofHex: string): void;
```

**Throws:** Error if proof is not 128 bytes (256 hex chars)

**Examples:**

```typescript
import { validateProofSize } from '@orbinum/proof-generator';

validateProofSize('0x' + '00'.repeat(128)); // OK
validateProofSize('0x' + '00'.repeat(64)); // Throws error
```

---

## Complete Example

```typescript
import {
  generateProof,
  CircuitType,
  formatCircuitInputs,
  validateInputs,
} from '@orbinum/proof-generator';

// User provides inputs in various formats
const rawInputs = {
  amount: 100, // number
  nullifier: 0x123456, // hex number
  recipient: '0xabcdef', // hex string
  pathElements: [1, 2, 3, 4], // number array
  pathIndices: [0n, 1n, 0n, 1n], // BigInt array
};

// Format to correct types
const inputs = formatCircuitInputs(rawInputs);

// Validate before using
validateInputs(inputs);

// Generate proof
const result = await generateProof(CircuitType.Unshield, inputs);

console.log('Proof:', formatProofHexForDisplay(result.proof));
console.log('Public signals:', result.publicSignals); // Already in decimal format
```

---

## Public Signals Format

**Important**: Public signals are returned by the library as **decimal strings** (`string[]`). You don't need to convert them - they're ready to use directly.

```typescript
const result = await generateProof(CircuitType.Unshield, inputs);

// Public signals are already decimal strings
console.log(result.publicSignals); // ["1194684", "100", "11259375", "0"]

// Use directly in computations
const amount = BigInt(result.publicSignals[1]); // 100n
```

---

## Format Summary

| Data Type               | Input Format                 | Output Format          | Helper Function         |
| ----------------------- | ---------------------------- | ---------------------- | ----------------------- |
| **Circuit Input**       | number, BigInt, hex          | Decimal string         | `formatInputValue()`    |
| **Circuit Input Array** | number[], BigInt[], string[] | Decimal string[]       | `formatInputArray()`    |
| **All Inputs**          | Mixed object                 | String/string[] object | `formatCircuitInputs()` |
| **Witness**             | BigInt[], number[], string[] | Decimal string[]       | `formatWitness()`       |
| **Proof**               | Uint8Array (128 bytes)       | Hex string (256 chars) | `formatProofToHex()`    |
| **Proof**               | Hex string                   | Uint8Array             | `parseProofHex()`       |
| **Public Signals**      | -                            | Decimal string[]       | _(returned by library)_ |

---

## Best Practices

1. ✅ **Always format inputs** before passing to `generateProof()`
2. ✅ **Use type-safe formatters** instead of manual string conversion
3. ✅ **Validate after parsing** to catch errors early
4. ✅ **Keep witness in decimal** format (no conversion overhead)
5. ✅ **Public signals are already decimal** - no conversion needed

---

## Migration Guide

If you were using the old hex LE format for witness/public signals:

**Before (deprecated):**

```typescript
// Old: Manual hex LE conversion ❌
const witnessHex = witnessToHexLE(witness);
const signalHex = formatPublicSignal(signal);
```

**After (current):**

```typescript
// New: Use decimal format directly ✅
const witnessDecimal = formatWitness(witness);
// Public signals already decimal from library
console.log(result.publicSignals); // ["100", "200"]
```

The library now handles all internal conversions, so you only work with decimal strings.
