/**
 * What a bundler does with this package.
 *
 * Unit tests import from `src/` under Node, which is the one environment where
 * nothing can go wrong. The failures that matter happen at the boundary: a
 * browser bundle that pulls in `fs`, a Node-only builtin that a bundler cannot
 * polyfill, an entry point a bundler cannot resolve.
 *
 * These are static checks on the built output rather than a live bundle. A real
 * `vite build` takes ~10 seconds and needs the bundler's Node API, which is not
 * worth it in the default suite — but the properties it would verify are
 * checkable directly, and they are the ones that actually break consumers.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIST = join(process.cwd(), 'dist');
const built = existsSync(join(DIST, 'index.js'));

// `pnpm check` builds before testing, so these always run there. A bare
// `pnpm test` on a fresh checkout has no dist/ and would skip the whole file —
// which reads exactly like a pass. Under the strict flag CI sets, that becomes
// a failure instead.
if (!built && process.env.PROOF_GENERATOR_REQUIRE_ARTIFACTS) {
  throw new Error(
    'dist/ is missing and PROOF_GENERATOR_REQUIRE_ARTIFACTS is set — run `pnpm build` first. ' +
      'These checks would have skipped silently.'
  );
}

/** Every emitted .js file, flattened. */
function distFiles(): string[] {
  const walk = (dir: string): string[] =>
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('node:fs')
      .readdirSync(dir, { withFileTypes: true })
      .flatMap((e: { name: string; isDirectory: () => boolean }) =>
        e.isDirectory()
          ? walk(join(dir, e.name))
          : e.name.endsWith('.js')
            ? [join(dir, e.name)]
            : []
      );
  return walk(DIST);
}

describe.skipIf(!built)('the built package', () => {
  let files: string[];

  beforeAll(() => {
    files = distFiles();
  });

  it('emits the entry point package.json declares', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    expect(existsSync(join(process.cwd(), pkg.main))).toBe(true);
    expect(existsSync(join(process.cwd(), pkg.types))).toBe(true);
  });

  it('never names a Node builtin in a static import', () => {
    // `fs` and `path` are reached only behind a runtime environment check,
    // through `getNodeRequire()`. A STATIC import of one — `import fs from
    // 'fs'` or a top-level `require('fs')` — executes on load, before any check
    // can run, and every browser bundler would then either polyfill it or fail
    // the consumer's build.
    //
    // The output is bundled into one file per format, so this reads both rather
    // than walking a module tree.
    for (const file of ['index.js', 'index.mjs']) {
      const source = readFileSync(join(DIST, file), 'utf8');
      const statics = [
        ...source.matchAll(/^\s*import\s[^;]*from\s*["'](node:)?(fs|path|os|crypto)["']/gm),
        ...source.matchAll(/^(const|let|var)\s+\w+\s*=\s*require\(["'](node:)?(fs|path)["']\)/gm),
      ].map(m => m[0].trim());

      expect(statics, `dist/${file} loads a Node builtin at module scope`).toEqual([]);
    }
  });

  it('reaches Node builtins through the runtime-guarded helper', () => {
    // Non-vacuity for the test above: the Node paths DO use fs and path, just
    // lazily. If the helper vanished, the assertion above would pass for the
    // wrong reason — nothing left to find.
    const source = readFileSync(join(DIST, 'index.mjs'), 'utf8');
    expect(source).toMatch(/getNodeRequire|nodeRequire/);
  });

  it('emits both module formats with matching declarations', () => {
    // CommonJS alone is what made this package impossible to tree-shake: a
    // consumer naming one enum from it pulled snarkjs entire. ESM is what lets
    // a bundler drop what a host does not call.
    for (const file of ['index.js', 'index.mjs', 'index.d.ts', 'index.d.mts']) {
      expect(existsSync(join(DIST, file)), `dist/${file} missing`).toBe(true);
    }
  });

  it('exports the surface downstream packages import', () => {
    // @orbinum/sdk imports these by name. Dropping one is a breaking change
    // that a type-level test in this repo would not notice.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const api = require(join(DIST, 'index.js'));
    for (const name of [
      'generateProof',
      'shouldProveSingleThreaded',
      'CircuitType',
      'circuitTypeToId',
      'getCircuitConfig',
      'NodeArtifactProvider',
      'WebArtifactProvider',
      'initWasm',
      'generateProofWasm',
      'compressSnarkjsProofWasm',
      'validateProofSize',
    ]) {
      expect(api[name], `${name} is not exported from the built package`).toBeDefined();
    }
  });

  it('loads snarkjs lazily, so naming one export does not cost 480 KB', () => {
    // A static `import * as snarkjs` is a hard graph edge. Under 6.0.0 a
    // consumer importing only `CircuitType` bundled to 1,539,822 bytes; with
    // the import behind `await import('snarkjs')` and code splitting, 11,411 —
    // and the 452 KB chunk is fetched only when a proof is actually generated.
    //
    // Both call sites were already async, so the load costs nothing a caller
    // was not already awaiting.
    for (const file of ['index.js', 'index.mjs']) {
      const source = readFileSync(join(DIST, file), 'utf8');
      const statics = source.match(/^import\s+\*\s+as\s+\w+\s+from\s*["']snarkjs["']/gm) ?? [];
      expect(statics, `dist/${file} imports snarkjs at module scope`).toEqual([]);
    }
  });

  it('still reaches snarkjs — lazily', () => {
    // Non-vacuity for the test above: proving genuinely needs snarkjs, so the
    // reference must survive as a dynamic import. If it vanished entirely, the
    // assertion above would pass while the prover was broken.
    expect(readFileSync(join(DIST, 'index.mjs'), 'utf8')).toMatch(
      /import\(\s*["']snarkjs["']\s*\)/
    );
  });

  it('inlines the wasm version rather than importing package.json', () => {
    // It used to be `import groth16pkg from '@orbinum/groth16-proofs/package.json'`.
    // That works in CommonJS and fails in ESM: Node demands an import attribute
    // (`with { type: 'json' }`) for a JSON module and throws
    // `ERR_IMPORT_ATTRIBUTE_MISSING` on load, before any function runs.
    //
    // Inlining also drops the assumption that the dependency exposes its
    // manifest at all — an `exports` map without a `"./package.json"` entry
    // would break the import under every bundler that honours it.
    const { version } = require('@orbinum/groth16-proofs/package.json');

    for (const file of ['index.js', 'index.mjs']) {
      const source = readFileSync(join(DIST, file), 'utf8');
      expect(source, `dist/${file} still imports the dependency's package.json`).not.toMatch(
        /@orbinum\/groth16-proofs\/package\.json/
      );
      // The literal version must survive, or the CDN URL points nowhere.
      expect(source, `dist/${file} lost the inlined version`).toContain(version);
    }
  });
});
