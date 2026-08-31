/**
 * Circuit input and proof validation functions.
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

export function validatePublicSignals(signals: string[], expected: number): void {
  if (signals.length !== expected) {
    throw new Error(`Invalid public signals count: expected ${expected}, got ${signals.length}`);
  }
}

/** A compressed BN254 Groth16 proof is 128 bytes — 256 hex characters. */
const PROOF_HEX_CHARS = 256;

/**
 * Check that a proof is a 128-byte hex string.
 *
 * Both the length and the alphabet matter. This runs on the string a wasm
 * boundary handed back, and the only thing downstream of it is an extrinsic:
 * a value that is the right length but not hex reaches the chain as a proof
 * that cannot decode, where the error names neither this package nor the
 * circuit. Checking here costs one regex and names the actual problem.
 */
export function validateProofSize(proofHex: string): void {
  const cleanHex = /^0x/i.test(proofHex) ? proofHex.slice(2) : proofHex;

  if (cleanHex.length !== PROOF_HEX_CHARS) {
    throw new Error(
      `Invalid proof size: expected ${PROOF_HEX_CHARS} hex chars (128 bytes), ` +
        `got ${cleanHex.length} chars`
    );
  }
  if (!/^[0-9a-f]+$/i.test(cleanHex)) {
    throw new Error('Invalid proof: expected hexadecimal characters only');
  }
}
