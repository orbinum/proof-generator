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
              wasm: { file: 'unshield.wasm', bytes: 2396830, sha256: 'aaa' },
              zkey: { file: 'unshield_pk.zkey', bytes: 5326768, sha256: 'bbb' },
              vk_json: { file: 'verification_key_unshield.json', bytes: 3657, sha256: 'ccc' },
              r1cs: { file: 'unshield.r1cs', bytes: 1584412, sha256: 'ddd' },
              ark: { file: 'unshield_pk.ark', bytes: 192, sha256: 'eee' },
            },
          },
          '2': {
            version: 2,
            vk_hash: '0xdeadbeef',
            artifacts: {
              wasm: { file: 'unshield_v2.wasm', bytes: 2500000, sha256: 'eee' },
              zkey: { file: 'unshield_v2_pk.zkey', bytes: 6000000, sha256: 'fff' },
              vk_json: { file: 'verification_key_unshield_v2.json', bytes: 3700, sha256: 'ggg' },
              r1cs: { file: 'unshield_v2.r1cs', bytes: 1700000, sha256: 'hhh' },
              ark: { file: 'unshield_v2_pk.ark', bytes: 192, sha256: 'iii' },
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
              wasm: { file: 'transfer.wasm', bytes: 3359868, sha256: 'iii' },
              zkey: { file: 'transfer_pk.zkey', bytes: 20484784, sha256: 'jjj' },
              vk_json: { file: 'verification_key_transfer.json', bytes: 3658, sha256: 'kkk' },
              r1cs: { file: 'transfer.r1cs', bytes: 6629624, sha256: 'lll' },
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

// ─── Legacy mode ─────────────────────────────────────────────────────────────

describe('WebArtifactProvider — legacy mode (string URL)', () => {
  const baseUrl = 'https://test.orbinum.com/circuits';

  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })
    );
  });

  it('constructs correct WASM URL', async () => {
    const provider = new WebArtifactProvider(baseUrl);
    await provider.getCircuitWasm(CircuitType.Unshield);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      'https://test.orbinum.com/circuits/unshield.wasm'
    );
  });

  it('constructs correct zkey URL', async () => {
    const provider = new WebArtifactProvider(baseUrl);
    await provider.getCircuitZkey(CircuitType.Transfer);

    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      'https://test.orbinum.com/circuits/transfer_pk.zkey'
    );
  });

  it('constructs correct .ark URL', async () => {
    const provider = new WebArtifactProvider(baseUrl);
    await provider.getCircuitProvingKey!(CircuitType.Unshield);

    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      'https://test.orbinum.com/circuits/unshield_pk.ark'
    );
  });

  it('throws on failed fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const provider = new WebArtifactProvider(baseUrl);

    await expect(provider.getCircuitWasm(CircuitType.Unshield)).rejects.toThrow(
      'Failed to fetch circuit artifact'
    );
  });

  it('strips trailing slash from base URL', async () => {
    const provider = new WebArtifactProvider('https://slash.com/');
    await provider.getCircuitWasm(CircuitType.Unshield);

    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(url).toBe('https://slash.com/unshield.wasm');
  });

  it('returns Uint8Array from ArrayBuffer', async () => {
    const provider = new WebArtifactProvider(baseUrl);
    const result = await provider.getCircuitWasm(CircuitType.Unshield);
    expect(result).toBeInstanceOf(Uint8Array);
  });
});

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

  it('derives .ark filename by convention when manifest has no ark entry', async () => {
    // transfer circuit in the mock manifest has no ark entry
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => buildMockManifest() })
        .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })
    );

    const provider = new WebArtifactProvider();
    await provider.getCircuitProvingKey!(CircuitType.Transfer);

    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[1][0];
    expect(url).toBe(`https://unpkg.com/@orbinum/circuits@${MOCK_PKG_VERSION}/transfer_pk.ark`);
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
