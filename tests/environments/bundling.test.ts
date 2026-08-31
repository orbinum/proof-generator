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

  it('keeps Node builtins out of everything a browser loads', () => {
    // `fs` and `path` are reachable only through the Node provider and the
    // Node half of the loader, both behind a runtime environment check. If a
    // static `require('fs')` appeared at the top of a shared module, every
    // bundler would either polyfill it or fail — and the failure would land on
    // a consumer's build, not here.
    const offenders = files.filter(f => {
      if (/providers\/node\.js$|wasm\/loader\.js$/.test(f)) return false;
      return /require\(["'](fs|path|node:fs|node:path|crypto|os|child_process)["']\)/.test(
        readFileSync(f, 'utf8')
      );
    });

    expect(offenders).toEqual([]);
  });

  it('reaches Node builtins only lazily, never at module scope', () => {
    // In the two files that may touch them, the access has to be inside a
    // function body. A top-level `require('fs')` executes on import, which is
    // before any environment check can run.
    for (const file of ['providers/node.js', 'wasm/loader.js']) {
      const source = readFileSync(join(DIST, file), 'utf8');
      const topLevel = source
        .split('\n')
        .filter(line => /^(const|let|var)\s+\w+\s*=\s*require\(["'](fs|path)/.test(line));

      expect(topLevel, `${file} loads a Node builtin at module scope`).toEqual([]);
    }
  });

  it('does not leave the removed modules in dist', () => {
    // `tsc` only writes; it never deletes. A source file removed from `src/`
    // keeps shipping out of `dist/` until something cleans — which is how two
    // deleted modules ended up in a 6.0.0 tarball.
    expect(existsSync(join(DIST, 'utils/index.js'))).toBe(false);
    expect(existsSync(join(DIST, 'wasm/types.js'))).toBe(false);
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

  it('can resolve the wasm version it builds the CDN URL from', () => {
    // tsc emits a runtime `require('@orbinum/groth16-proofs/package.json')`
    // rather than inlining the version. That resolves only while the
    // dependency declares no `exports` map — or declares one that includes
    // `"./package.json"`. If it ever adds a restrictive map, this import
    // breaks under every bundler that honours `exports`, and the symptom is a
    // resolution error in a consumer's build rather than here.
    const loader = readFileSync(join(DIST, 'wasm/loader.js'), 'utf8');
    expect(loader).toContain('@orbinum/groth16-proofs/package.json');

    const pkg = require('@orbinum/groth16-proofs/package.json');
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(
      pkg.exports === undefined || pkg.exports['./package.json'] !== undefined,
      'the wasm package added an exports map without "./package.json"; the ' +
        'version import in src/wasm/loader.ts will not resolve under bundlers'
    ).toBe(true);
  });
});
