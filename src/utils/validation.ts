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

export function validateProofSize(proofHex: string): void {
  const cleanHex = proofHex.startsWith('0x') ? proofHex.slice(2) : proofHex;
  if (cleanHex.length !== 256) {
    throw new Error(
      `Invalid proof size: expected 256 hex chars (128 bytes), got ${cleanHex.length} chars`
    );
  }
}
