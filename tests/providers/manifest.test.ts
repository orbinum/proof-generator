/**
 * Tests: the circuits manifest rules both providers share — which version a
 * circuit resolves to, and which artifact file names are acceptable.
 */
import { describe, it, expect } from 'vitest';
import { CircuitType } from '../../src/circuits/types';
import {
  artifactEntry,
  resolveVersionData,
  toResolvedCircuitVersion,
  type CircuitsManifest,
} from '../../src/providers/manifest';

const entry = (file: string) => ({ file, bytes: 1, sha256: '00' });

function manifest(): CircuitsManifest {
  const version = (v: number, suffix: string) => ({
    version: v,
    vk_hash: `0x${v}`,
    artifacts: {
      wasm: entry(`unshield${suffix}.wasm`),
      zkey: entry(`unshield${suffix}_pk.zkey`),
    },
  });
  return {
    schema_version: '1.0.0',
    package_name: 'orbinum-circuits',
    package_version: '0.15.0',
    generated_at: '',
    circuits: {
      unshield: {
        active_version: 2,
        supported_versions: [1, 2],
        versions: { '1': version(1, ''), '2': version(2, '_v2') },
      },
    },
  };
}

describe('resolveVersionData', () => {
  it('defaults to the active version', () => {
    const data = resolveVersionData(manifest(), CircuitType.Unshield, {});
    expect(data.version).toBe(2);
    expect(data.versionData.artifacts.wasm?.file).toBe('unshield_v2.wasm');
    expect(data.packageVersion).toBe('0.15.0');
  });

  it('honours a pin, and only for the pinned circuit', () => {
    expect(resolveVersionData(manifest(), CircuitType.Unshield, { unshield: 1 }).version).toBe(1);
    expect(resolveVersionData(manifest(), CircuitType.Unshield, { transfer: 1 }).version).toBe(2);
  });

  it('refuses a circuit the manifest does not list', () => {
    expect(() => resolveVersionData(manifest(), CircuitType.Transfer, {})).toThrow(
      'Circuit "transfer" not found in manifest'
    );
  });

  it('refuses a version outside supported_versions', () => {
    // Retired versions keep their entry but leave supported_versions.
    const m = manifest();
    m.circuits.unshield.supported_versions = [2];
    expect(() => resolveVersionData(m, CircuitType.Unshield, { unshield: 1 })).toThrow(
      'v1 is no longer supported'
    );
  });

  it('refuses a supported version with no entry', () => {
    const m = manifest();
    delete m.circuits.unshield.versions['2'];
    expect(() => resolveVersionData(m, CircuitType.Unshield, {})).toThrow('v2 not found');
  });

  it('refuses a malformed version, from a pin or from the manifest', () => {
    for (const bad of [0, -1, 1.5, Number.NaN]) {
      expect(() => resolveVersionData(manifest(), CircuitType.Unshield, { unshield: bad })).toThrow(
        'invalid version'
      );
    }
    const m = manifest();
    m.circuits.unshield.active_version = 2.5;
    expect(() => resolveVersionData(m, CircuitType.Unshield, {})).toThrow('invalid version');
  });
});

describe('toResolvedCircuitVersion', () => {
  it('reports version, package version and vk_hash', () => {
    const data = resolveVersionData(manifest(), CircuitType.Unshield, { unshield: 1 });
    expect(toResolvedCircuitVersion(data)).toEqual({
      version: 1,
      packageVersion: '0.15.0',
      vkHash: '0x1',
    });
  });
});

describe('artifactEntry', () => {
  const data = () => resolveVersionData(manifest(), CircuitType.Unshield, {});

  it('returns the entry for a listed kind', () => {
    expect(artifactEntry(CircuitType.Unshield, data(), 'zkey').file).toBe('unshield_v2_pk.zkey');
  });

  it('refuses a kind the version does not ship', () => {
    expect(() => artifactEntry(CircuitType.Unshield, data(), 'ark')).toThrow(
      'v2 has no "ark" artifact'
    );
  });

  it.each([
    '../x.wasm',
    '/etc/passwd',
    'a/b.wasm',
    'a\\b.wasm',
    '.hidden',
    'x..wasm',
    '',
    'https://e.io/x',
  ])('refuses the file name %j', file => {
    const d = data();
    d.versionData.artifacts.wasm = entry(file);
    expect(() => artifactEntry(CircuitType.Unshield, d, 'wasm')).toThrow(
      'unsafe artifact file name'
    );
  });
});
