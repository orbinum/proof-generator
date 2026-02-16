/**
 * Utility Functions for Proof Generation
 *
 * Provides validation and formatting helpers for:
 * - Circuit inputs
 * - Proof hex strings
 * - Public signals
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
