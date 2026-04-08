/**
 * Proof and public signal formatting functions.
 */

/** BN254 scalar field modulus */
const BN254_PRIME = BigInt(
  '21888242871839275222246405745257275088696311157297823662689037894645226208583'
);

export function normalizeProofHex(proofHex: string): string {
  const withPrefix = proofHex.startsWith('0x') ? proofHex : '0x' + proofHex;
  return withPrefix.toLowerCase();
}

export function formatProofHexForDisplay(proofHex: string, maxLength: number = 32): string {
  if (proofHex.length <= maxLength) return proofHex;
  const halfLen = maxLength / 2;
  return `${proofHex.slice(0, halfLen)}...${proofHex.slice(-halfLen)}`;
}

/**
 * Converts an array of snarkjs public signals (decimal strings) to
 * 0x-prefixed 32-byte little-endian hex strings for use in extrinsics.
 */
export function formatPublicSignalsArray(signals: (bigint | number | string)[]): string[] {
  return signals.map(value => {
    const bigIntValue: bigint =
      typeof value === 'string' ? BigInt(value) : typeof value === 'bigint' ? value : BigInt(value);

    if (bigIntValue < 0n || bigIntValue >= BN254_PRIME) {
      throw new Error(`Value out of BN254 field range: ${bigIntValue.toString()}`);
    }

    const hex = bigIntValue.toString(16).padStart(64, '0');
    const bytes: string[] = [];
    for (let i = hex.length - 2; i >= 0; i -= 2) {
      bytes.push(hex.substr(i, 2));
    }
    return '0x' + bytes.join('');
  });
}
