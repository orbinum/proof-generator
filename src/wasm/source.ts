/**
 * Where the browser loads `groth16_proofs_bg.wasm` from.
 *
 * Separate from the init sequence because the two have different lifetimes: a
 * host states the URL once at startup, and every later init — including the
 * lazy ones the proving functions trigger — reads it.
 */

// The version of the wasm this package was built against, inlined at build
// time by tsup's `define` (see tsup.config.ts).
//
// It used to be `import groth16pkg from '@orbinum/groth16-proofs/package.json'`.
// That works in CommonJS and fails in ESM: Node requires an import attribute
// (`with { type: 'json' }`) for JSON modules, so the ESM build threw
// `ERR_IMPORT_ATTRIBUTE_MISSING` on load — before any function ran. Inlining
// also removes the assumption that the dependency exposes its manifest at all,
// which an `exports` map without a `"./package.json"` entry would break.
declare const __GROTH16_VERSION__: string;

// CDN URL for the WASM binary, pinned to the exact version this package was
// built against. `__GROTH16_VERSION__` is substituted by tsup (see
// tsup.config.ts) and by the vitest configs, which read the same manifest — an
// unpinned URL would serve whatever is newest, which is a different wasm than
// the one these tests passed against.
export const GROTH16_WASM_CDN = `https://unpkg.com/@orbinum/groth16-proofs@${__GROTH16_VERSION__}/groth16_proofs_bg.wasm`;

/**
 * The URL a host configured, used by every later init including the lazy ones.
 *
 * This exists because `compressSnarkjsProofWasm` and `generateProofWasm` both
 * initialize on demand, with no options to pass along. Without somewhere to
 * keep the host's choice, a host that never calls `initWasm` explicitly — the
 * ordinary case, since proving works without it — would silently get the CDN
 * back, and the override would only work if called in the right order.
 */
let configuredWasmUrl: string | undefined;

/**
 * Sets where the WASM is loaded from, for this module's lifetime.
 *
 * Call at startup. Separate from `initWasm` so a host can state the policy
 * without also forcing instantiation — an extension registers this next to the
 * prover and lets the first proof do the loading.
 */
export function setWasmUrl(url: string): void {
  configuredWasmUrl = url;
}

/** The configured URL, or the pinned CDN when no host set one. */
export function resolveWasmUrl(): string {
  return configuredWasmUrl ?? GROTH16_WASM_CDN;
}
