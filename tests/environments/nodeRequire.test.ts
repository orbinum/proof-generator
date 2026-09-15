/**
 * `getNodeRequire()` against the BUILT output, in both module formats.
 *
 * The other checks in this directory read the bundle as text. This one runs it,
 * because the property that matters is not "the source looks right" — it is
 * that a `require` comes back and resolves a sibling package from the installed
 * location.
 *
 * It exists because of a specific near-miss. The helper used to call `eval`
 * twice and every bundler warned about it; the fix those warnings suggest —
 * indirect eval — would have broken the CommonJS path INVISIBLY. Indirect eval
 * runs in global scope, where `require` is not in scope, so it returns
 * `undefined` and the CommonJS build falls through to the ESM branch. Every
 * static check still passes. Only running it tells them apart.
 *
 * Run from a temporary directory, outside this project: anchoring resolution on
 * `process.cwd()` instead of the module's own path is right whenever the
 * process happens to run inside the project and wrong when it does not — a CLI
 * invoked from elsewhere, a test runner with its own working directory.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DIST = join(process.cwd(), 'dist');
const built = existsSync(join(DIST, 'index.js'));

if (!built && process.env.PROOF_GENERATOR_REQUIRE_ARTIFACTS) {
  throw new Error(
    'dist/ is missing and PROOF_GENERATOR_REQUIRE_ARTIFACTS is set — run `pnpm build` first.'
  );
}

/**
 * Runs `source` in a fresh directory, outside the project, and returns stdout.
 *
 * The extension decides the module system Node applies, which is the whole
 * point: the same helper has to work under both.
 */
function runOutsideProject(extension: 'cjs' | 'mjs', source: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'pg-noderequire-'));
  try {
    const file = join(dir, `probe.${extension}`);
    writeFileSync(file, source);
    return execFileSync(process.execPath, [file], { cwd: dir, encoding: 'utf8' }).trim();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Loads the WASM from disk through the built bundle.
 *
 * `initWasm()` rather than the helper directly: `getNodeRequire` is internal
 * and not exported, and going through the public entry tests the chain that
 * actually matters — the helper resolves `@orbinum/groth16-proofs`, and
 * `initWasm` reads the binary next to it. A broken `require` fails here.
 */
const PROBE = (load: string) => `
${load}
(async () => {
  await initWasm();
  console.log('initialised');
})().catch(e => { console.log('THREW: ' + e.message); process.exitCode = 1; });
`;

describe.skipIf(!built)("the built package reaches Node's require", () => {
  // The emitted file by absolute path, which is what pins the FORMAT under
  // test: Node applies CommonJS or ESM by the probe's own extension.
  const cjs = `const { initWasm } = require(${JSON.stringify(join(DIST, 'index.js'))});`;
  const esm = `const { initWasm } = await import(${JSON.stringify(join(DIST, 'index.mjs'))});`;

  it('returns a working require from the CommonJS build', () => {
    // The case indirect eval would have broken: under CommonJS the old code
    // read `require` from scope, and the suggested "safer" form reads it from
    // global scope, where it is not defined.
    expect(runOutsideProject('cjs', PROBE(cjs))).toBe('initialised');
  });

  it('returns a working require from the ESM build', () => {
    expect(runOutsideProject('mjs', PROBE(esm))).toBe('initialised');
  });
});
