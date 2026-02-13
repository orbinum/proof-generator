/**
 * Utility functions for proof generation
 */

// ============================================================================
// Input Formatting Helpers
// ============================================================================

/**
 * Format circuit input value to string (required format for circuits)
 *
 * Accepts: string, number, bigint, hex string
 * Returns: decimal string
 *
 * @example
 * formatInputValue(100) // "100"
 * formatInputValue(0x64) // "100"
 * formatInputValue("100") // "100"
 * formatInputValue(100n) // "100"
 * formatInputValue("0x64") // "100"
 */
export function formatInputValue(value: string | number | bigint): string {
  if (typeof value === 'string') {
    // If hex string, convert to decimal
    if (value.startsWith('0x')) {
      return BigInt(value).toString();
    }
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  return String(value);
}

/**
 * Format circuit input array to string array
 *
 * @example
 * formatInputArray([1, 2, 3]) // ["1", "2", "3"]
 * formatInputArray([0x01, 0x02]) // ["1", "2"]
 */
export function formatInputArray(values: (string | number | bigint)[]): string[] {
  return values.map(v => formatInputValue(v));
}

/**
 * Format all circuit inputs to required format
 *
 * @example
 * formatCircuitInputs({
 *   amount: 100,
 *   nullifier: 0x123,
 *   pathElements: [1, 2, 3]
 * })
 * // Returns: {
 * //   amount: "100",
 * //   nullifier: "291",
 * //   pathElements: ["1", "2", "3"]
 * // }
 */
export function formatCircuitInputs(
  inputs: Record<string, string | number | bigint | (string | number | bigint)[]>
): Record<string, string | string[]> {
  const formatted: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(inputs)) {
    if (Array.isArray(value)) {
      formatted[key] = formatInputArray(value);
    } else {
      formatted[key] = formatInputValue(value);
    }
  }

  return formatted;
}

// ============================================================================
// Witness Formatting Helpers
// ============================================================================

/**
 * Format witness from various sources to decimal string array (groth16-proofs format)
 *
 * Accepts: BigInt[], number[], string[] (decimal or hex)
 * Returns: string[] (decimal)
 *
 * @example
 * formatWitness([1n, 2n, 3n]) // ["1", "2", "3"]
 * formatWitness([1, 2, 3]) // ["1", "2", "3"]
 * formatWitness(["1", "2", "3"]) // ["1", "2", "3"]
 * formatWitness(["0x01", "0x02"]) // ["1", "2"]
 */
export function formatWitness(witness: (bigint | number | string)[]): string[] {
  return witness.map(w => {
    if (typeof w === 'string') {
      // If hex string, convert to decimal
      if (w.startsWith('0x')) {
        return BigInt(w).toString();
      }
      return w;
    }

    if (typeof w === 'bigint') {
      return w.toString();
    }

    return String(w);
  });
}

// ============================================================================
// Proof Formatting Helpers
// ============================================================================

/**
 * Format proof bytes to hex string
 *
 * @example
 * const proofBytes = new Uint8Array([0xab, 0xcd, ...]) // 128 bytes
 * formatProofToHex(proofBytes) // "0xabcd..."
 */
export function formatProofToHex(proofBytes: Uint8Array): string {
  if (proofBytes.length !== 128) {
    throw new Error(`Invalid proof size: expected 128 bytes, got ${proofBytes.length}`);
  }

  return (
    '0x' +
    Array.from(proofBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Parse proof hex string to bytes
 *
 * @example
 * parseProofHex("0xabcd...") // Uint8Array(128)
 */
export function parseProofHex(proofHex: string): Uint8Array {
  const cleanHex = proofHex.startsWith('0x') ? proofHex.slice(2) : proofHex;

  if (cleanHex.length !== 256) {
    // 128 bytes * 2 hex chars
    throw new Error(`Invalid proof hex length: expected 256 chars, got ${cleanHex.length}`);
  }

  const bytes = new Uint8Array(128);
  for (let i = 0; i < 128; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }

  return bytes;
}

/**
 * Normalize proof hex (ensure 0x prefix, lowercase)
 *
 * @example
 * normalizeProofHex("ABCD...") // "0xabcd..."
 * normalizeProofHex("0xABCD...") // "0xabcd..."
 */
export function normalizeProofHex(proofHex: string): string {
  const withPrefix = proofHex.startsWith('0x') ? proofHex : '0x' + proofHex;
  return withPrefix.toLowerCase();
}

// ============================================================================
// Public Signals Formatting Helpers
// ============================================================================

/**
 * Format public signal value to hex string
 *
 * @example
 * formatPublicSignal(100n) // "0x6400000000000000000000000000000000000000000000000000000000000000"
 * formatPublicSignal(100) // "0x6400000000000000000000000000000000000000000000000000000000000000"
 * formatPublicSignal("100") // "0x6400000000000000000000000000000000000000000000000000000000000000"
 */
export function formatPublicSignal(value: bigint | number | string): string {
  let bigIntValue: bigint;

  if (typeof value === 'string') {
    if (value.startsWith('0x')) {
      bigIntValue = BigInt(value);
    } else {
      bigIntValue = BigInt(value);
    }
  } else if (typeof value === 'bigint') {
    bigIntValue = value;
  } else {
    bigIntValue = BigInt(value);
  }

  // Convert to 32-byte hex (little-endian for BN254)
  const hex = bigIntValue.toString(16).padStart(64, '0');

  // Reverse byte order to little-endian
  const bytes: string[] = [];
  for (let i = hex.length - 2; i >= 0; i -= 2) {
    bytes.push(hex.substr(i, 2));
  }

  return '0x' + bytes.join('');
}

/**
 * Parse public signal hex to decimal string
 *
 * @example
 * parsePublicSignal("0x6400...00") // "100"
 */
export function parsePublicSignal(signalHex: string): string {
  const cleanHex = signalHex.startsWith('0x') ? signalHex.slice(2) : signalHex;

  // Reverse byte order from little-endian
  const bytes: string[] = [];
  for (let i = cleanHex.length - 2; i >= 0; i -= 2) {
    bytes.push(cleanHex.substr(i, 2));
  }

  const bigEndianHex = bytes.join('');
  return BigInt('0x' + bigEndianHex).toString();
}

/**
 * Format array of public signals to hex strings
 *
 * @example
 * formatPublicSignals([100n, 200n]) // ["0x64...", "0xc8..."]
 */
export function formatPublicSignalsArray(signals: (bigint | number | string)[]): string[] {
  return signals.map(s => formatPublicSignal(s));
}

/**
 * Parse array of public signal hex strings to decimal strings
 *
 * @example
 * parsePublicSignalsArray(["0x64...", "0xc8..."]) // ["100", "200"]
 */
export function parsePublicSignalsArray(signalsHex: string[]): string[] {
  return signalsHex.map(s => parsePublicSignal(s));
}

// ============================================================================
// General Validation & Helpers
// ============================================================================

/**
 * Validate circuit inputs structure
 */
export function validateInputs(inputs: Record<string, any>): void {
  if (!inputs || typeof inputs !== 'object') {
    throw new Error('Inputs must be an object');
  }

  // Check for common issues
  for (const [key, value] of Object.entries(inputs)) {
    if (value === undefined || value === null) {
      throw new Error(`Input "${key}" is undefined or null`);
    }
  }
}

/**
 * Validate public signals count
 */
export function validatePublicSignals(signals: string[], expected: number): void {
  if (signals.length !== expected) {
    throw new Error(`Invalid public signals count: expected ${expected}, got ${signals.length}`);
  }
}

/**
 * Validate proof size (should be 128 bytes)
 */
export function validateProofSize(proofHex: string): void {
  const cleanHex = proofHex.startsWith('0x') ? proofHex.slice(2) : proofHex;

  if (cleanHex.length !== 256) {
    // 128 bytes * 2 hex chars
    throw new Error(
      `Invalid proof size: expected 256 hex chars (128 bytes), got ${cleanHex.length} chars`
    );
  }
}

/**
 * Format proof hex for display (truncated)
 *
 * @example
 * formatProofHexForDisplay("0xabcd...1234") // "0xabcd...1234" (truncated)
 */
export function formatProofHexForDisplay(proofHex: string, maxLength: number = 32): string {
  if (proofHex.length <= maxLength) {
    return proofHex;
  }

  const start = proofHex.slice(0, maxLength / 2);
  const end = proofHex.slice(-maxLength / 2);
  return `${start}...${end}`;
}
