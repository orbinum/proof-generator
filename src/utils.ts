/**
 * Utility functions for proof generation
 */

/**
 * Convert bigint to hex string (little-endian, 32 bytes)
 */
export function bigIntToHexLE(value: bigint): string {
  // Convert to hex (big-endian)
  let hex = value.toString(16).padStart(64, '0');

  // Reverse byte order to little-endian
  const bytes: string[] = [];
  for (let i = hex.length - 2; i >= 0; i -= 2) {
    bytes.push(hex.substr(i, 2));
  }

  return '0x' + bytes.join('');
}

/**
 * Convert witness array to hex little-endian format
 */
export function witnessToHexLE(witness: bigint[]): string[] {
  return witness.map(w => bigIntToHexLE(w));
}

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
 * Format proof hex for display (truncated)
 */
export function formatProofHex(proofHex: string, maxLength: number = 32): string {
  if (proofHex.length <= maxLength) {
    return proofHex;
  }

  const start = proofHex.slice(0, maxLength / 2);
  const end = proofHex.slice(-maxLength / 2);
  return `${start}...${end}`;
}

/**
 * Convert hex string to bytes
 */
export function hexToBytes(hex: string): Uint8Array {
  // Remove 0x prefix if present
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;

  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Convert bytes to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return (
    '0x' +
    Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Validate proof size (should be 128 bytes)
 */
export function validateProofSize(proofHex: string): void {
  const bytes = hexToBytes(proofHex);

  if (bytes.length !== 128) {
    throw new Error(`Invalid proof size: expected 128 bytes, got ${bytes.length} bytes`);
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
