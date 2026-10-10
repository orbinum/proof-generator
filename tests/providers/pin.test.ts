import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { CIRCUITS_PACKAGE_VERSION } from '../../src/providers';
import { CIRCUITS_PINS } from '../../src/providers/pins';
import { GROTH16_WASM_SHA256 } from '../../src/wasm/source';

/**
 * The web provider downloads CIRCUITS_PACKAGE_VERSION; the Node provider reads
 * the installed dependency. Both must be the same release, or a proof built in
 * the browser and one built in Node would come from different keys.
 */
describe('circuits release pin', () => {
  it('equals the exact @orbinum/circuits dependency', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.dependencies['@orbinum/circuits']).toBe(CIRCUITS_PACKAGE_VERSION);
  });
});

/**
 * The integrity pins inlined at build time must describe the installed
 * dependencies exactly: a stale pin makes the browser refuse a genuine release.
 * Recomputed here from the files, independently of build/pins.ts.
 */
describe('embedded integrity pins', () => {
  it('match every circuit version in the installed manifest', () => {
    const manifest = JSON.parse(
      readFileSync(require.resolve('@orbinum/circuits/manifest.json'), 'utf8')
    );
    const expected: Record<string, Record<string, unknown>> = {};
    for (const [circuit, { versions }] of Object.entries<any>(manifest.circuits)) {
      expected[circuit] = {};
      for (const [version, data] of Object.entries<any>(versions)) {
        expected[circuit][version] = {
          vk_hash: data.vk_hash,
          sha256: Object.fromEntries(
            Object.entries<any>(data.artifacts).map(([kind, entry]) => [kind, entry.sha256])
          ),
        };
      }
    }
    expect(CIRCUITS_PINS).toEqual(expected);
  });

  it('pin the groth16 wasm binary that is installed', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.dependencies['@orbinum/groth16-proofs']).toMatch(/^\d+\.\d+\.\d+$/);
    const wasm = readFileSync(require.resolve('@orbinum/groth16-proofs/groth16_proofs_bg.wasm'));
    expect(GROTH16_WASM_SHA256).toBe(createHash('sha256').update(wasm).digest('hex'));
  });
});
