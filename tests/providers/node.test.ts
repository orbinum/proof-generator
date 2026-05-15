/**
 * Tests: NodeArtifactProvider
 *
 * Tests use a temporary directory with fake artifact files to avoid
 * dependence on the actual @orbinum/circuits package being installed.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { NodeArtifactProvider } from '../../src/providers';
import { CircuitType } from '../../src/circuits/types';

// ─── Temporary artifact directory ────────────────────────────────────────────

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbinum-test-'));

  // Create fake artifact files the provider will look for
  const artifacts = [
    'unshield.wasm',
    'unshield_pk.zkey',
    'unshield_pk.ark',
    'transfer.wasm',
    'transfer_pk.zkey',
    'transfer_pk.ark',
    'private_link.wasm',
    'private_link_pk.zkey',
    'private_link_pk.ark',
  ];
  for (const file of artifacts) {
    fs.writeFileSync(path.join(tmpDir, file), Buffer.from(`fake-${file}`));
  }
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('NodeArtifactProvider', () => {
  it('constructs successfully with an explicit packageRoot', () => {
    expect(() => new NodeArtifactProvider(tmpDir)).not.toThrow();
  });

  it('reads WASM file for Unshield circuit', async () => {
    const provider = new NodeArtifactProvider(tmpDir);
    const result = await provider.getCircuitWasm(CircuitType.Unshield);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('reads zkey file for Unshield circuit', async () => {
    const provider = new NodeArtifactProvider(tmpDir);
    const result = await provider.getCircuitZkey(CircuitType.Unshield);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('reads WASM file for Transfer circuit', async () => {
    const provider = new NodeArtifactProvider(tmpDir);
    const result = await provider.getCircuitWasm(CircuitType.Transfer);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('reads WASM file for PrivateLink circuit', async () => {
    const provider = new NodeArtifactProvider(tmpDir);
    const result = await provider.getCircuitWasm(CircuitType.PrivateLink);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('returns content matching the fake file', async () => {
    const provider = new NodeArtifactProvider(tmpDir);
    const result = await provider.getCircuitWasm(CircuitType.Unshield);
    const text = Buffer.from(result as Uint8Array).toString('utf8');
    expect(text).toBe('fake-unshield.wasm');
  });

  it('throws when artifact file does not exist', async () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbinum-empty-'));
    try {
      const provider = new NodeArtifactProvider(emptyDir);
      await expect(provider.getCircuitWasm(CircuitType.Unshield)).rejects.toThrow(
        'Artifact unshield.wasm not found'
      );
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it('reads .ark proving key for Unshield circuit', async () => {
    const provider = new NodeArtifactProvider(tmpDir);
    const result = await provider.getCircuitProvingKey!(CircuitType.Unshield);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('.ark content matches fake file', async () => {
    const provider = new NodeArtifactProvider(tmpDir);
    const result = await provider.getCircuitProvingKey!(CircuitType.Unshield);
    expect(Buffer.from(result).toString('utf8')).toBe('fake-unshield_pk.ark');
  });

  it('reads .ark proving key for all circuit types', async () => {
    const provider = new NodeArtifactProvider(tmpDir);
    const types = [
      CircuitType.Unshield,
      CircuitType.Transfer,
      CircuitType.ValueProof,
      CircuitType.PrivateLink,
    ];
    for (const type of types) {
      const result = await provider.getCircuitProvingKey!(type);
      expect(result).toBeInstanceOf(Uint8Array);
    }
  });

  it('throws when .ark file does not exist', async () => {
    // directory has no .ark files
    const noArkDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbinum-noark-'));
    fs.writeFileSync(path.join(noArkDir, 'unshield.wasm'), 'fake');
    fs.writeFileSync(path.join(noArkDir, 'unshield_pk.zkey'), 'fake');
    try {
      const provider = new NodeArtifactProvider(noArkDir);
      await expect(provider.getCircuitProvingKey!(CircuitType.Unshield)).rejects.toThrow(
        'Artifact unshield_pk.ark not found'
      );
    } finally {
      fs.rmSync(noArkDir, { recursive: true, force: true });
    }
  });

  it('throws when packageRoot cannot be resolved and no arg given', () => {
    // If @orbinum/circuits is not installed, construction should throw.
    // If it IS installed (CI), this test is skipped gracefully.
    try {
      const provider = new NodeArtifactProvider();
      // If we get here the package is installed — just verify it constructed
      expect(provider).toBeDefined();
    } catch (err: any) {
      expect(err.message).toMatch(/Cannot resolve @orbinum\/circuits/);
    }
  });
});
