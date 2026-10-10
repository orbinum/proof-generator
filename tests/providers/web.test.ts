/**
 * Tests: WebArtifactProvider
 *
 * Fetches manifest.json from the pinned CDN release (or a `baseUrl` mirror) and
 * resolves versioned artifact URLs, served next to the manifest, from it. The
 * vk_hash and every sha256 come from the build-time pins, never the manifest.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  WebArtifactProvider,
  CIRCUITS_PACKAGE_VERSION,
  type CircuitsPins,
  type WebProviderOptions,
} from '../../src/providers';
import { CircuitType } from '../../src/circuits/types';

// ─── Shared mock manifest ─────────────────────────────────────────────────────

const MOCK_PKG_VERSION = '0.4.4';
const PINNED = `https://unpkg.com/@orbinum/circuits@${CIRCUITS_PACKAGE_VERSION}`;

// The manifest-mode tests mock every artifact fetch as 8 zero bytes
// (`new ArrayBuffer(8)`); this is their real sha256, so the integrity check
// passes. A dedicated integrity test below uses a different value to prove a
// mismatch throws.
const ZERO8_SHA = 'af5570f5a1810b7af78caf4bc70a660f0df51e42baf91d4de5b2328de0e83dfc';

function buildMockManifest(overrides?: {
  unshieldActiveVersion?: number;
  supportedVersions?: number[];
}) {
  return {
    schema_version: '1.0.0',
    package_name: 'orbinum-circuits',
    package_version: MOCK_PKG_VERSION,
    generated_at: '2026-03-19T14:10:04.861Z',
    circuits: {
      unshield: {
        active_version: overrides?.unshieldActiveVersion ?? 1,
        supported_versions: overrides?.supportedVersions ?? [1],
        versions: {
          '1': {
            version: 1,
            vk_hash: '0x73401aa0',
            artifacts: {
              wasm: { file: 'unshield.wasm', bytes: 2396830, sha256: ZERO8_SHA },
              zkey: { file: 'unshield_pk.zkey', bytes: 5326768, sha256: ZERO8_SHA },
              vk_json: { file: 'verification_key_unshield.json', bytes: 3657, sha256: ZERO8_SHA },
              r1cs: { file: 'unshield.r1cs', bytes: 1584412, sha256: ZERO8_SHA },
              ark: { file: 'unshield_pk.ark', bytes: 192, sha256: ZERO8_SHA },
            },
          },
          '2': {
            version: 2,
            vk_hash: '0xdeadbeef',
            artifacts: {
              wasm: { file: 'unshield_v2.wasm', bytes: 2500000, sha256: ZERO8_SHA },
              zkey: { file: 'unshield_v2_pk.zkey', bytes: 6000000, sha256: ZERO8_SHA },
              vk_json: {
                file: 'verification_key_unshield_v2.json',
                bytes: 3700,
                sha256: ZERO8_SHA,
              },
              r1cs: { file: 'unshield_v2.r1cs', bytes: 1700000, sha256: ZERO8_SHA },
              ark: { file: 'unshield_v2_pk.ark', bytes: 192, sha256: ZERO8_SHA },
            },
          },
        },
      },
      transfer: {
        active_version: 1,
        supported_versions: [1],
        versions: {
          '1': {
            version: 1,
            vk_hash: '0x2ab60d15',
            artifacts: {
              wasm: { file: 'transfer.wasm', bytes: 3359868, sha256: ZERO8_SHA },
              zkey: { file: 'transfer_pk.zkey', bytes: 20484784, sha256: ZERO8_SHA },
              vk_json: { file: 'verification_key_transfer.json', bytes: 3658, sha256: ZERO8_SHA },
              r1cs: { file: 'transfer.r1cs', bytes: 6629624, sha256: ZERO8_SHA },
            },
          },
        },
      },
    },
  };
}

type MockManifest = ReturnType<typeof buildMockManifest>;

/** Pins that agree with a manifest: what a build against it would embed. */
function pinsFrom(manifest: MockManifest): CircuitsPins {
  const pins: CircuitsPins = {};
  for (const [circuit, { versions }] of Object.entries(manifest.circuits)) {
    pins[circuit] = {};
    for (const [version, { vk_hash, artifacts }] of Object.entries(versions)) {
      const sha256 = Object.fromEntries(
        Object.entries(artifacts).map(([kind, entry]) => [kind, entry.sha256])
      );
      pins[circuit][version] = { vk_hash, sha256 };
    }
  }
  return pins;
}

const MOCK_PINS = pinsFrom(buildMockManifest());

/** A provider pinned to the mock manifest. */
const web = (options: WebProviderOptions = {}) =>
  new WebArtifactProvider({ pins: MOCK_PINS, ...options });

function mockManifestThenArtifact() {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => buildMockManifest() })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })
  );
}

// ─── Manifest mode ────────────────────────────────────────────────────────────

describe('WebArtifactProvider — manifest resolution', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches the pinned release manifest, then the WASM next to it', async () => {
    mockManifestThenArtifact();

    const provider = web();
    await provider.getCircuitWasm(CircuitType.Unshield);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      `${PINNED}/manifest.json`
    );
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[1][0]).toBe(
      `${PINNED}/unshield.wasm`
    );
  });

  it('serves the zkey from the pinned release', async () => {
    mockManifestThenArtifact();

    const provider = web();
    await provider.getCircuitZkey(CircuitType.Transfer);

    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[1][0]).toBe(
      `${PINNED}/transfer_pk.zkey`
    );
  });

  it('caches manifest — two artifact fetches = 3 total fetch calls', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => buildMockManifest() })
        .mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })
    );

    const provider = web();
    await provider.getCircuitWasm(CircuitType.Unshield);
    await provider.getCircuitZkey(CircuitType.Unshield);

    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('manifest is fetched only once across concurrent requests', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => buildMockManifest() })
        .mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })
    );

    const provider = web();
    await Promise.all([
      provider.getCircuitWasm(CircuitType.Unshield),
      provider.getCircuitZkey(CircuitType.Unshield),
    ]);

    const manifestCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(args =>
      (args[0] as string).includes('manifest.json')
    );
    expect(manifestCalls).toHaveLength(1);
  });

  it('circuitVersions override uses the specified version filename', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () =>
            buildMockManifest({ unshieldActiveVersion: 2, supportedVersions: [1, 2] }),
        })
        .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })
    );

    const provider = web({ circuitVersions: { unshield: 1 } });
    await provider.getCircuitWasm(CircuitType.Unshield);

    const artifactUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[1][0];
    // v1 filename is 'unshield.wasm'
    expect(artifactUrl).toBe(`${PINNED}/unshield.wasm`);
  });

  it('throws when requested circuit version is not in supported_versions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => buildMockManifest({ unshieldActiveVersion: 2, supportedVersions: [2] }),
      })
    );

    const provider = web({ circuitVersions: { unshield: 1 } });
    await expect(provider.getCircuitWasm(CircuitType.Unshield)).rejects.toThrow(
      'no longer supported'
    );
  });

  it('throws when manifest fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 503 }));

    const provider = web();
    await expect(provider.getCircuitWasm(CircuitType.Unshield)).rejects.toThrow(
      'Failed to fetch circuits manifest'
    );
  });

  it('uses custom baseUrl for manifest and artifacts', async () => {
    const mirror = 'https://my-mirror.io/circuits';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => buildMockManifest() })
        .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })
    );

    const provider = web({ baseUrl: mirror });
    await provider.getCircuitWasm(CircuitType.Unshield);

    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      `${mirror}/manifest.json`
    );
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[1][0]).toBe(
      `${mirror}/unshield.wasm`
    );
  });

  it('throws when artifact fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => buildMockManifest() })
        .mockResolvedValueOnce({ ok: false, status: 404 })
    );

    const provider = web();
    await expect(provider.getCircuitWasm(CircuitType.Unshield)).rejects.toThrow(
      'Failed to fetch circuit artifact'
    );
  });

  it('fetches .ark URL from manifest ark entry', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => buildMockManifest() })
        .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })
    );

    const provider = web();
    await provider.getCircuitProvingKey!(CircuitType.Unshield);

    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[1][0]).toBe(
      `${PINNED}/unshield_pk.ark`
    );
  });

  it('throws for an artifact with no manifest entry (fail-closed, no unverified derive)', async () => {
    // transfer circuit in the mock manifest has no ark entry → cannot be
    // integrity-checked, so it must not be served.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => buildMockManifest() })
    );

    const provider = web();
    await expect(provider.getCircuitProvingKey!(CircuitType.Transfer)).rejects.toThrow(
      /no "ark" artifact/
    );
  });

  it('getCircuitProvingKey returns Uint8Array', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => buildMockManifest() })
        .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })
    );

    const provider = web();
    const result = await provider.getCircuitProvingKey!(CircuitType.Unshield);
    expect(result).toBeInstanceOf(Uint8Array);
  });
});

// ─── Integrity (sha256) + getResolvedVersion (Phase 1) ────────────────────────

describe('WebArtifactProvider — integrity + resolved version', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('verifies downloaded bytes against the pinned sha256 (passes on match)', async () => {
    mockManifestThenArtifact(); // artifact = 8 zero bytes, pinned sha256 = ZERO8_SHA
    const provider = web();
    await expect(provider.getCircuitWasm(CircuitType.Unshield)).resolves.toBeInstanceOf(Uint8Array);
  });

  it('throws on a sha256 mismatch (tampered/stale CDN) and returns no bytes', async () => {
    // Manifest and pin declare ZERO8_SHA, but the artifact fetch returns different bytes.
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => buildMockManifest() })
        .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new ArrayBuffer(16) })
    );
    const provider = web();
    await expect(provider.getCircuitWasm(CircuitType.Unshield)).rejects.toThrow(
      /Integrity check failed/
    );
  });

  it('getResolvedVersion returns version + package_version + vk_hash', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => buildMockManifest() })
    );
    const provider = web();
    const resolved = await provider.getResolvedVersion(CircuitType.Unshield);
    expect(resolved).toEqual({
      version: 1,
      packageVersion: MOCK_PKG_VERSION,
      vkHash: '0x73401aa0',
    });
  });

  it('getResolvedVersion honors a circuitVersions override', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => buildMockManifest({ supportedVersions: [1, 2] }),
      })
    );
    const provider = web({ circuitVersions: { unshield: 2 } });
    const resolved = await provider.getResolvedVersion(CircuitType.Unshield);
    expect(resolved.version).toBe(2);
    expect(resolved.vkHash).toBe('0xdeadbeef');
  });

  it('getResolvedVersion throws for an unsupported version (fail-closed)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => buildMockManifest() })
    );
    const provider = web({ circuitVersions: { unshield: 2 } }); // supported: [1]
    await expect(provider.getResolvedVersion(CircuitType.Unshield)).rejects.toThrow(
      /no longer supported/
    );
  });

  it('a failed manifest fetch is retried on the next call', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({ ok: true, json: async () => buildMockManifest() })
    );
    const provider = web();
    await expect(provider.getResolvedVersion(CircuitType.Unshield)).rejects.toThrow('503');
    await expect(provider.getResolvedVersion(CircuitType.Unshield)).resolves.toMatchObject({
      version: 1,
    });
  });

  it('refuses a manifest file name that points outside the release', async () => {
    const manifest = buildMockManifest();
    manifest.circuits.unshield.versions['1'].artifacts.wasm.file = '../evil.wasm';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => manifest }));
    const provider = web();
    await expect(provider.getCircuitWasm(CircuitType.Unshield)).rejects.toThrow(
      'unsafe artifact file name'
    );
    // Refused before any artifact request.
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

// ─── Build-time pins ──────────────────────────────────────────────────────────

const ZERO16_SHA = createHash('sha256').update(new Uint8Array(16)).digest('hex');

describe('WebArtifactProvider — build-time pins', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('refuses a tampered artifact served with a self-consistent manifest', async () => {
    // A hostile mirror rewrites the manifest so its sha256 matches the bytes it
    // serves, and keeps the vk_hash the chain expects. Only the pin catches it.
    const manifest = buildMockManifest();
    manifest.circuits.unshield.versions['1'].artifacts.wasm.sha256 = ZERO16_SHA;
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => manifest })
        .mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(16) })
    );
    await expect(web().getCircuitWasm(CircuitType.Unshield)).rejects.toThrow(
      /manifest sha256 for "wasm" does not match the pinned/
    );
    // Refused before any artifact request.
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('checks the bytes against the pin even when the manifest agrees with it', async () => {
    // The manifest is untouched; only the served bytes differ. The expected
    // hash is the pin's, so the result is the same whatever the manifest says.
    const pins = pinsFrom(buildMockManifest());
    pins.unshield['1'].sha256.wasm = ZERO16_SHA;
    const manifest = buildMockManifest();
    manifest.circuits.unshield.versions['1'].artifacts.wasm.sha256 = ZERO16_SHA;
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => manifest })
        .mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })
    );
    await expect(web({ pins }).getCircuitWasm(CircuitType.Unshield)).rejects.toThrow(
      `expected sha256 ${ZERO16_SHA}`
    );
  });

  it('refuses a manifest whose vk_hash differs from the pin', async () => {
    const manifest = buildMockManifest();
    manifest.circuits.unshield.versions['1'].vk_hash = '0xfeedface';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => manifest }));
    const provider = web();
    await expect(provider.getResolvedVersion(CircuitType.Unshield)).rejects.toThrow(
      /manifest vk_hash 0xfeedface does not match the pinned 0x73401aa0/
    );
    await expect(provider.getCircuitZkey(CircuitType.Unshield)).rejects.toThrow(
      /does not match the pinned/
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('reports the pinned vk_hash', async () => {
    const pins = pinsFrom(buildMockManifest());
    pins.unshield['1'].vk_hash = '0x73401AA0';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => buildMockManifest() })
    );
    const resolved = await web({ pins }).getResolvedVersion(CircuitType.Unshield);
    expect(resolved.vkHash).toBe('0x73401AA0');
  });

  it('refuses a version the build has no pin for', async () => {
    // The manifest makes v2 active; this build only knows v1.
    const pins = pinsFrom(buildMockManifest());
    delete pins.unshield['2'];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () =>
          buildMockManifest({ unshieldActiveVersion: 2, supportedVersions: [1, 2] }),
      })
    );
    const provider = web({ pins });
    await expect(provider.getResolvedVersion(CircuitType.Unshield)).rejects.toThrow(
      /v2 is not pinned/
    );
    await expect(provider.getCircuitWasm(CircuitType.Unshield)).rejects.toThrow(/not pinned/);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    // A pinned version still resolves.
    await expect(
      web({ pins, circuitVersions: { unshield: 1 } }).getResolvedVersion(CircuitType.Unshield)
    ).resolves.toMatchObject({ version: 1, vkHash: '0x73401aa0' });
  });

  it('refuses a circuit the build has no pin for', async () => {
    const pins = pinsFrom(buildMockManifest());
    delete pins.transfer;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => buildMockManifest() })
    );
    await expect(web({ pins }).getResolvedVersion(CircuitType.Transfer)).rejects.toThrow(
      /not pinned/
    );
  });

  it('refuses an artifact kind with no pinned sha256', async () => {
    const pins = pinsFrom(buildMockManifest());
    delete pins.unshield['1'].sha256.ark;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => buildMockManifest() })
    );
    await expect(web({ pins }).getCircuitProvingKey(CircuitType.Unshield)).rejects.toThrow(
      /no pinned sha256 for the "ark" artifact/
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  describe('with the embedded pins', () => {
    const root = dirname(require.resolve('@orbinum/circuits/manifest.json'));
    const installed = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));

    it('serves the installed release', async () => {
      const circuit = installed.circuits.shield;
      const entry = circuit.versions[String(circuit.active_version)];
      const bytes = readFileSync(join(root, entry.artifacts.wasm.file));
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce({ ok: true, json: async () => installed })
          .mockResolvedValueOnce({
            ok: true,
            arrayBuffer: async () =>
              bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
          })
      );
      const provider = new WebArtifactProvider();
      await expect(provider.getResolvedVersion(CircuitType.Shield)).resolves.toMatchObject({
        version: circuit.active_version,
        vkHash: entry.vk_hash,
      });
      await expect(provider.getCircuitWasm(CircuitType.Shield)).resolves.toBeInstanceOf(Uint8Array);
    });

    it('refuses a manifest that disagrees with them', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, json: async () => buildMockManifest() })
      );
      await expect(
        new WebArtifactProvider().getResolvedVersion(CircuitType.Unshield)
      ).rejects.toThrow(/does not match the pinned|not pinned/);
    });
  });
});
