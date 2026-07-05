/**
 * @orbinum/proof-generator — public API barrel.
 *
 * All public exports are re-exported from their respective modules.
 * No logic lives here.
 */

// ── Core API ─────────────────────────────────────────────────────────────────
export { generateProof, type GenerateOptions } from './generate';

// ── Types ─────────────────────────────────────────────────────────────────────
export * from './circuits/types';
export * from './wasm/types';
export * from './errors';

// ── Circuits ──────────────────────────────────────────────────────────────────
export { getCircuitConfig } from './circuits';

// ── Providers ─────────────────────────────────────────────────────────────────
export { NodeArtifactProvider, WebArtifactProvider } from './providers';
export type { ArtifactProvider, WebProviderOptions, ResolvedCircuitVersion } from './providers';

// ── Utils ─────────────────────────────────────────────────────────────────────
export { validateInputs, validatePublicSignals, validateProofSize } from './utils/validation';
export {
  normalizeProofHex,
  formatProofHexForDisplay,
  formatPublicSignalsArray,
} from './utils/formatting';
export {
  bigIntToBytes32,
  bytes32ToBigInt,
  u64ToFieldStr,
  hexSignalToBigInt,
  bigIntToHex,
} from './utils/encoding';
export { initWasm, compressSnarkjsProofWasm, generateProofFromWitnessWasm } from './wasm';
