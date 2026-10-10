/**
 * Build-time constants shared by tsup and both vitest configs.
 *
 * A browser loads the groth16 wasm and the circuit artifacts from a CDN or a
 * host's mirror, so it cannot trust whatever hashes that source also serves.
 * These are taken from the exactly-pinned dependencies when the package is
 * built, and inlined through `define`: a JSON import in `src/` throws under
 * ESM without an import attribute (see src/wasm/source.ts).
 *
 * Outside `src/`, so it is never part of the published package.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);

const SHA256_HEX = /^[0-9a-f]{64}$/;

type ManifestVersion = {
  vk_hash: string;
  artifacts: Record<string, { sha256: string }>;
};

type Manifest = {
  circuits: Record<string, { versions: Record<string, ManifestVersion> }>;
};

/** Matches `CircuitsPins` in src/providers/pins.ts. */
type CircuitsPins = Record<
  string,
  Record<string, { vk_hash: string; sha256: Record<string, string> }>
>;

/** sha256 of the wasm binary shipped in the installed `@orbinum/groth16-proofs`. */
function groth16WasmSha256(): string {
  const file = require_.resolve('@orbinum/groth16-proofs/groth16_proofs_bg.wasm');
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

/** vk_hash and artifact sha256 of every circuit version in the installed `@orbinum/circuits`. */
function circuitsPins(): CircuitsPins {
  const manifest = require_('@orbinum/circuits/manifest.json') as Manifest;
  const pins: CircuitsPins = {};
  for (const [circuit, { versions }] of Object.entries(manifest.circuits)) {
    pins[circuit] = {};
    for (const [version, { vk_hash, artifacts }] of Object.entries(versions)) {
      if (!/^0x[0-9a-f]{64}$/i.test(vk_hash)) {
        throw new Error(`circuits manifest: ${circuit} v${version} has a malformed vk_hash`);
      }
      const sha256: Record<string, string> = {};
      for (const [kind, entry] of Object.entries(artifacts)) {
        if (!SHA256_HEX.test(entry.sha256)) {
          throw new Error(`circuits manifest: ${circuit} v${version} ${kind} has a malformed sha256`);
        }
        sha256[kind] = entry.sha256;
      }
      pins[circuit][version] = { vk_hash, sha256 };
    }
  }
  return pins;
}

/** The `define` map: every build-time global `src/` declares. */
export function buildDefines(): Record<string, string> {
  const { version } = require_('@orbinum/groth16-proofs/package.json') as { version: string };
  return {
    __GROTH16_VERSION__: JSON.stringify(version),
    __GROTH16_WASM_SHA256__: JSON.stringify(groth16WasmSha256()),
    __CIRCUITS_PINS__: JSON.stringify(circuitsPins()),
  };
}
