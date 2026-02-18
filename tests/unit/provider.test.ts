/**
 * Unit Tests: provider.ts
 *
 * Tests the WebArtifactProvider implementation using mocked fetch.
 */

import { WebArtifactProvider, getCircuitConfig } from '../../src/circuits';
import { CircuitType } from '../../src/types';

// Mock global fetch
global.fetch = jest.fn();

describe('WebArtifactProvider', () => {
  let provider: WebArtifactProvider;
  const baseUrl = 'https://test.orbinum.com/circuits';

  beforeEach(() => {
    jest.resetAllMocks();
    provider = new WebArtifactProvider(baseUrl);
  });

  it('should construct correct URLs for WASM', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    });

    await provider.getCircuitWasm(CircuitType.Unshield);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const url = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(url).toBe('https://test.orbinum.com/circuits/unshield.wasm');
  });

  it('should construct correct URLs for zkey', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    });

    await provider.getCircuitZkey(CircuitType.Transfer);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const url = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(url).toBe('https://test.orbinum.com/circuits/transfer_pk.zkey');
  });

  it('should throw error on failed fetch', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
    });

    await expect(provider.getCircuitWasm(CircuitType.Unshield)).rejects.toThrow(
      'Failed to fetch circuit artifact'
    );
  });

  it('should handle trailing slash in base URL', async () => {
    const providerWithSlash = new WebArtifactProvider('https://slash.com/');

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    });

    await providerWithSlash.getCircuitWasm(CircuitType.Unshield);

    const url = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(url).toBe('https://slash.com/unshield.wasm');
  });
});
