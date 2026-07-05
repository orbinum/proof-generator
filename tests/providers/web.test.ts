/**
 * Tests: WebArtifactProvider
 *
 * Two modes:
 *   - Legacy (string arg): direct URL construction, no manifest fetch.
 *   - Manifest (no arg / options object): fetches manifest.json from npm CDN,
 *     resolves versioned artifact URLs from it.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebArtifactProvider } from '../../src/providers';
import { CircuitType } from '../../src/circuits/types';

// ─── Shared mock manifest ─────────────────────────────────────────────────────

const MOCK_PKG_VERSION = '0.4.4';

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

describe('WebArtifactProvider — manifest mode (npm CDN)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches manifest then pins WASM URL to package_version', async () => {
    mockManifestThenArtifact();

    const provider = new WebArtifactProvider();
    await provider.getCircuitWasm(CircuitType.Unshield);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      'https://unpkg.com/@orbinum/circuits/manifest.json'
    );
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[1][0]).toBe(
      `https://unpkg.com/@orbinum/circuits@${MOCK_PKG_VERSION}/unshield.wasm`
    );
  });

  it('pins zkey URL to package_version', async () => {
    mockManifestThenArtifact();

    const provider = new WebArtifactProvider();
    await provider.getCircuitZkey(CircuitType.Transfer);

    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[1][0]).toBe(
      `https://unpkg.com/@orbinum/circuits@${MOCK_PKG_VERSION}/transfer_pk.zkey`
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

    const provider = new WebArtifactProvider();
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

    const provider = new WebArtifactProvider();
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

    const provider = new WebArtifactProvider({ circuitVersions: { unshield: 1 } });
    await provider.getCircuitWasm(CircuitType.Unshield);

    const artifactUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[1][0];
    // v1 filename is 'unshield.wasm'
    expect(artifactUrl).toBe(
      `https://unpkg.com/@orbinum/circuits@${MOCK_PKG_VERSION}/unshield.wasm`
    );
  });

  it('throws when requested circuit version is not in supported_versions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => buildMockManifest({ unshieldActiveVersion: 2, supportedVersions: [2] }),
      })
    );

    const provider = new WebArtifactProvider({ circuitVersions: { unshield: 1 } });
    await expect(provider.getCircuitWasm(CircuitType.Unshield)).rejects.toThrow(
      'no longer supported'
    );
  });

  it('throws when manifest fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 503 }));

    const provider = new WebArtifactProvider();
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

    const provider = new WebArtifactProvider({ baseUrl: mirror });
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

    const provider = new WebArtifactProvider();
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

    const provider = new WebArtifactProvider();
    await provider.getCircuitProvingKey!(CircuitType.Unshield);

    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[1][0]).toBe(
      `https://unpkg.com/@orbinum/circuits@${MOCK_PKG_VERSION}/unshield_pk.ark`
    );
  });

  it('throws for an artifact with no manifest entry (fail-closed, no unverified derive)', async () => {
    // transfer circuit in the mock manifest has no ark entry → cannot be
    // integrity-checked, so it must not be served.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => buildMockManifest() })
    );

    const provider = new WebArtifactProvider();
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

    const provider = new WebArtifactProvider();
    const result = await provider.getCircuitProvingKey!(CircuitType.Unshield);
    expect(result).toBeInstanceOf(Uint8Array);
  });
});

// ─── Integrity (sha256) + getResolvedVersion (Phase 1) ────────────────────────

describe('WebArtifactProvider — integrity + resolved version', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('verifies downloaded bytes against the manifest sha256 (passes on match)', async () => {
    mockManifestThenArtifact(); // artifact = 8 zero bytes, manifest sha256 = ZERO8_SHA
    const provider = new WebArtifactProvider();
    await expect(provider.getCircuitWasm(CircuitType.Unshield)).resolves.toBeInstanceOf(Uint8Array);
  });

  it('throws on a sha256 mismatch (tampered/stale CDN) and returns no bytes', async () => {
    // Manifest declares ZERO8_SHA, but the artifact fetch returns different bytes.
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => buildMockManifest() })
        .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new ArrayBuffer(16) })
    );
    const provider = new WebArtifactProvider();
    await expect(provider.getCircuitWasm(CircuitType.Unshield)).rejects.toThrow(
      /Integrity check failed/
    );
  });

  it('getResolvedVersion returns version + package_version + vk_hash', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => buildMockManifest() })
    );
    const provider = new WebArtifactProvider();
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
    const provider = new WebArtifactProvider({ circuitVersions: { unshield: 2 } });
    const resolved = await provider.getResolvedVersion(CircuitType.Unshield);
    expect(resolved.version).toBe(2);
    expect(resolved.vkHash).toBe('0xdeadbeef');
  });

  it('getResolvedVersion throws for an unsupported version (fail-closed)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => buildMockManifest() })
    );
    const provider = new WebArtifactProvider({ circuitVersions: { unshield: 2 } }); // supported: [1]
    await expect(provider.getResolvedVersion(CircuitType.Unshield)).rejects.toThrow(
      /no longer supported/
    );
  });
});
