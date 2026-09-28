/** Lowercase hex sha256 of the given bytes, via WebCrypto (browser + Node ≥ 20). */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copy);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Returns `bytes` if their sha256 is `expected`, else throws — no bytes leave a
 * failed check, so a tampered or stale artifact can never reach the prover.
 */
export async function verifySha256(
  bytes: Uint8Array,
  expected: string,
  source: string
): Promise<Uint8Array> {
  const actual = await sha256Hex(bytes);
  if (actual !== expected.toLowerCase()) {
    throw new Error(
      `Integrity check failed for ${source}: expected sha256 ${expected}, got ${actual}`
    );
  }
  return bytes;
}
