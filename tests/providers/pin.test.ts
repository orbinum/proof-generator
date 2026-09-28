import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CIRCUITS_PACKAGE_VERSION } from '../../src/providers';

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
