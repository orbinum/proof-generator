/**
 * Utility Functions for Proof Generation
 *
 * Provides validation and formatting helpers for:
 * - Circuit inputs
 * - Proof hex strings
 * - Public signals
 * - BigInt / byte-array conversions
 */

/** BN254 scalar field modulus */
const BN254_PRIME = BigInt(
  '21888242871839275222246405745257275088696311157297823662689037894645226208583'
);

// ============================================================================
// Input Validation
// ============================================================================

/**
 * Validate circuit inputs structure
 *
 * Ensures all required fields are present and non-null
 */
export function validateInputs(inputs: Record<string, any>): void {
  if (!inputs || typeof inputs !== 'object') {
    throw new Error('Inputs must be an object');
  }

  for (const [key, value] of Object.entries(inputs)) {
    if (value === undefined || value === null) {
      throw new Error(`Input "${key}" is undefined or null`);
    }
  }
}

/**
 * Validate public signals count matches expected
 */
export function validatePublicSignals(signals: string[], expected: number): void {
  if (signals.length !== expected) {
    throw new Error(`Invalid public signals count: expected ${expected}, got ${signals.length}`);
  }
}

/**
 * Validate proof size (must be 128 bytes = 256 hex chars)
 */
export function validateProofSize(proofHex: string): void {
  const cleanHex = proofHex.startsWith('0x') ? proofHex.slice(2) : proofHex;

  if (cleanHex.length !== 256) {
    throw new Error(
      `Invalid proof size: expected 256 hex chars (128 bytes), got ${cleanHex.length} chars`
    );
  }
}

// ============================================================================
// Proof Formatting
// ============================================================================

/**
 * Normalize proof hex string (ensure 0x prefix, lowercase)
 *
 * @example
 * normalizeProofHex("ABCD...") // "0xabcd..."
 * normalizeProofHex("0xABCD...") // "0xabcd..."
 */
export function normalizeProofHex(proofHex: string): string {
  const withPrefix = proofHex.startsWith('0x') ? proofHex : '0x' + proofHex;
  return withPrefix.toLowerCase();
}

/**
 * Format proof hex for display (truncated)
 *
 * @param proofHex - Full proof hex string
 * @param maxLength - Maximum length for display (default: 32)
 * @returns Truncated hex string
 *
 * @example
 * formatProofHexForDisplay("0xabcd...1234", 20) // "0xabcd...1234"
 */
export function formatProofHexForDisplay(proofHex: string, maxLength: number = 32): string {
  if (proofHex.length <= maxLength) {
    return proofHex;
  }

  const halfLen = maxLength / 2;
  const start = proofHex.slice(0, halfLen);
  const end = proofHex.slice(-halfLen);
  return `${start}...${end}`;
}

/**
 * Format array of public signals to hex strings
 *
 * @param signals - Array of signal values (decimal strings, hex, or BigInt)
 * @returns Array of 32-byte hex strings
 */
export function formatPublicSignalsArray(signals: (bigint | number | string)[]): string[] {
  return signals.map(value => {
    let bigIntValue: bigint;

    if (typeof value === 'string') {
      bigIntValue = value.startsWith('0x') ? BigInt(value) : BigInt(value);
    } else if (typeof value === 'bigint') {
      bigIntValue = value;
    } else {
      bigIntValue = BigInt(value);
    }

    // Validate within BN254 field
    if (bigIntValue < BigInt(0) || bigIntValue >= BN254_PRIME) {
      throw new Error(`Value out of BN254 field range: ${bigIntValue.toString()}`);
    }

    // Convert to 32-byte hex (little-endian)
    const hex = bigIntValue.toString(16).padStart(64, '0');

    // Reverse bytes for little-endian
    const bytes: string[] = [];
    for (let i = hex.length - 2; i >= 0; i -= 2) {
      bytes.push(hex.substr(i, 2));
    }

    return '0x' + bytes.join('');
  });
}

// ============================================================================
// BigInt / byte-array conversions
// ============================================================================

/**
 * Convert a BigInt to a 32-byte Uint8Array (big-endian).
 */
export function bigIntToBytes32(n: bigint): Uint8Array {
  const buf = new Uint8Array(32);
  let remaining = n;
  for (let i = 31; i >= 0; i--) {
    buf[i] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return buf;
}

/**
 * Convert a 32-byte Uint8Array (big-endian) to a BigInt.
 */
export function bytes32ToBigInt(buf: Uint8Array): bigint {
  let result = 0n;
  for (let i = 0; i < 32; i++) {
    result = (result << 8n) | BigInt(buf[i]);
  }
  return result;
}

/**
 * Encode a u64 value as a BN254 field element decimal string for snarkjs.
 */
export function u64ToFieldStr(value: bigint): string {
  return value.toString(10);
}

/**
 * Parse a little-endian hex public signal (0x-prefixed, 32 bytes) back to BigInt.
 *
 * Public signals returned by the proof generator are little-endian; this
 * function reverses the bytes before interpreting as a field element.
 */
export function hexSignalToBigInt(hex: string): bigint {
  const clean = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex;
  const buf = Buffer.from(clean.padStart(64, '0'), 'hex');
  const reversed = Buffer.from(buf).reverse();
  return bytes32ToBigInt(new Uint8Array(reversed));
}

/**
 * Convert a BigInt to a 0x-prefixed 64-hex-char big-endian string.
 */
export function bigIntToHex(n: bigint): string {
  return '0x' + n.toString(16).padStart(64, '0');
}
