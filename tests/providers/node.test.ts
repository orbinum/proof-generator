/**
 * Tests: NodeArtifactProvider
 *
 * Runs against a throwaway package directory (see ./fixture), so the tests do
 * not depend on the installed @orbinum/circuits.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { NodeArtifactProvider } from '../../src/providers';
import { CircuitType } from '../../src/circuits/types';
import { writeCircuitsPackage } from './fixture';

let root: string;

beforeAll(() => {
  root = writeCircuitsPackage().root;
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const text = (bytes: Uint8Array) => Buffer.from(bytes).toString('utf8');

/** A copy of the fixture package with its manifest edited. */
function withManifest(edit: (manifest: any) => void): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbinum-edited-'));
  fs.cpSync(root, dir, { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  edit(manifest);
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
  return dir;
}

describe('NodeArtifactProvider', () => {
  it('serves the manifest active version by default', async () => {
    const provider = new NodeArtifactProvider({ packageRoot: root });
    expect(text(await provider.getCircuitWasm(CircuitType.Unshield))).toBe('fake-unshield_v2.wasm');
    expect(text(await provider.getCircuitZkey(CircuitType.Transfer))).toBe(
      'fake-transfer_v2_pk.zkey'
    );
    expect(text(await provider.getCircuitProvingKey(CircuitType.Transfer))).toBe(
      'fake-transfer_v2_pk.ark'
    );
  });

  it('serves a pinned version', async () => {
    const provider = new NodeArtifactProvider({
      packageRoot: root,
      circuitVersions: { unshield: 1 },
    });
    expect(text(await provider.getCircuitWasm(CircuitType.Unshield))).toBe('fake-unshield.wasm');
    // Only the pinned circuit moves.
    expect(text(await provider.getCircuitWasm(CircuitType.Transfer))).toBe('fake-transfer_v2.wasm');
  });

  it('reports the version it serves', async () => {
    const provider = new NodeArtifactProvider({
      packageRoot: root,
      circuitVersions: { transfer: 1 },
    });
    expect(await provider.getResolvedVersion(CircuitType.Transfer)).toEqual({
      version: 1,
      packageVersion: '0.15.0',
      vkHash: `0x${'1'.repeat(64)}`,
    });
  });

  it('still accepts the package root as a bare string', async () => {
    const provider = new NodeArtifactProvider(root);
    expect(text(await provider.getCircuitWasm(CircuitType.Unshield))).toBe('fake-unshield_v2.wasm');
  });

  it('refuses a file whose sha256 differs from the manifest', async () => {
    const dir = withManifest(() => {});
    fs.writeFileSync(path.join(dir, 'unshield_v2.wasm'), 'tampered');
    try {
      await expect(
        new NodeArtifactProvider(dir).getCircuitWasm(CircuitType.Unshield)
      ).rejects.toThrow('Integrity check failed');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refuses a version the manifest does not support', async () => {
    const provider = new NodeArtifactProvider({
      packageRoot: root,
      circuitVersions: { unshield: 3 },
    });
    await expect(provider.getCircuitWasm(CircuitType.Unshield)).rejects.toThrow(
      'v3 is no longer supported'
    );
  });

  it('refuses a malformed version pin', async () => {
    for (const bad of [0, 1.5, -1]) {
      const provider = new NodeArtifactProvider({
        packageRoot: root,
        circuitVersions: { unshield: bad },
      });
      await expect(provider.getResolvedVersion(CircuitType.Unshield)).rejects.toThrow(
        'invalid version'
      );
    }
  });

  it('refuses a manifest file name that escapes the package', async () => {
    const dir = withManifest(m => {
      m.circuits.unshield.versions['2'].artifacts.wasm.file = '../outside.wasm';
    });
    try {
      await expect(
        new NodeArtifactProvider(dir).getCircuitWasm(CircuitType.Unshield)
      ).rejects.toThrow('unsafe artifact file name');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('throws when a listed file is missing', async () => {
    const dir = withManifest(() => {});
    fs.rmSync(path.join(dir, 'unshield_v2_pk.ark'));
    try {
      await expect(
        new NodeArtifactProvider(dir).getCircuitProvingKey(CircuitType.Unshield)
      ).rejects.toThrow('Artifact unshield_v2_pk.ark not found');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('throws when the directory has no manifest', async () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'orbinum-empty-'));
    try {
      await expect(
        new NodeArtifactProvider(empty).getCircuitWasm(CircuitType.Unshield)
      ).rejects.toThrow('No circuits manifest');
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });

  it('reads the installed package when no root is given', async () => {
    // @orbinum/circuits is a dependency, so the default resolves and its manifest
    // names both circuits.
    const provider = new NodeArtifactProvider();
    const { version } = await provider.getResolvedVersion(CircuitType.Transfer);
    expect(version).toBeGreaterThanOrEqual(1);
  });
});
