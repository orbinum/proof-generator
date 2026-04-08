/**
 * BigInt ↔ byte-array ↔ hex encoding helpers.
 *
 * All functions that convert between BigInt values and binary representations
 * used by snarkjs, Poseidon, and the chain extrinsics live here.
 */

/** Convert a BigInt to a 32-byte Uint8Array (big-endian). */
export function bigIntToBytes32(n: bigint): Uint8Array {
  const buf = new Uint8Array(32);
  let remaining = n;
  for (let i = 31; i >= 0; i--) {
    buf[i] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return buf;
}

/** Convert a 32-byte big-endian Uint8Array to a BigInt. */
export function bytes32ToBigInt(buf: Uint8Array): bigint {
  let result = 0n;
  for (let i = 0; i < 32; i++) {
    result = (result << 8n) | BigInt(buf[i]);
  }
  return result;
}

/** Encode a u64 value as a BN254 field element decimal string for snarkjs. */
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
  const padded = clean.padStart(64, '0');
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(padded.slice(i * 2, i * 2 + 2), 16);
  }
  // reverse bytes (little-endian → big-endian) then interpret as BigInt
  bytes.reverse();
  return bytes32ToBigInt(bytes);
}

/** Convert a BigInt to a 0x-prefixed 64-hex-char big-endian string. */
export function bigIntToHex(n: bigint): string {
  return '0x' + n.toString(16).padStart(64, '0');
}
