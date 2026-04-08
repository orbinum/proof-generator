/**
 * Tests: generate/provider.ts — resolveProvider()
 *
 * Verifies that the correct default provider is auto-selected based on
 * the environment, and that explicit overrides are passed through as-is.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveProvider } from '../../src/generate/provider';
import { NodeArtifactProvider } from '../../src/providers/node';
import { WebArtifactProvider } from '../../src/providers/web';
import type { ArtifactProvider } from '../../src/providers/interface';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveProvider', () => {
  it('returns the override provider unchanged when provided', () => {
    const custom: ArtifactProvider = {
      getCircuitWasm: vi.fn(),
      getCircuitZkey: vi.fn(),
    };
    expect(resolveProvider(custom)).toBe(custom);
  });

  it('returns NodeArtifactProvider when window and self are undefined (Node.js)', () => {
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('self', undefined);
    const provider = resolveProvider();
    expect(provider).toBeInstanceOf(NodeArtifactProvider);
  });

  it('returns WebArtifactProvider when window is defined (browser)', () => {
    vi.stubGlobal('window', {});
    const provider = resolveProvider();
    expect(provider).toBeInstanceOf(WebArtifactProvider);
  });

  it('returns WebArtifactProvider when self is defined (web worker)', () => {
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('self', {});
    const provider = resolveProvider();
    expect(provider).toBeInstanceOf(WebArtifactProvider);
  });
});
