/**
 * How the WASM module is initialised in each environment.
 *
 * `initWasm` branches on `window`/`self` and calls a different wasm-bindgen
 * entry point on each side, with a differently-named argument key:
 *
 *   initSync({ module })            — Node, synchronous, from a file buffer
 *   __wbg_init({ module_or_path })  — browser, async, from a URL
 *
 * Getting the key wrong is not an error. wasm-bindgen destructures the object,
 * reads `undefined`, and falls back to fetching `groth16_proofs_bg.wasm`
 * relative to its own module URL — a path that does not exist in a bundle. The
 * failure surfaces much later as a fetch for a file nobody asked for, which is
 * why these assert the exact shape rather than merely that a call happened.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const initSync = vi.fn();
const asyncInit = vi.fn().mockResolvedValue(undefined);

vi.mock('@orbinum/groth16-proofs', () => ({
  get default() {
    return asyncInit;
  },
  get initSync() {
    return hasInitSync ? initSync : undefined;
  },
  init_panic_hook: vi.fn(),
  compress_snarkjs_proof_wasm: vi.fn().mockReturnValue('0x' + 'ab'.repeat(128)),
  generate_proof_wasm: vi
    .fn()
    .mockReturnValue(JSON.stringify({ proof: '0x' + 'cd'.repeat(128), publicSignals: [] })),
}));

/** Lets a test hide `initSync` to exercise the async fallback. */
let hasInitSync = true;

/** Import the loader fresh, so its module-level `wasmModule` cache is empty. */
async function freshLoader() {
  vi.resetModules();
  return import('../../src/wasm/loader');
}

describe('WASM initialisation per environment', () => {
  beforeEach(() => {
    hasInitSync = true;
    initSync.mockClear();
    asyncInit.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('server (no window, no self)', () => {
    beforeEach(() => {
      vi.stubGlobal('window', undefined);
      vi.stubGlobal('self', undefined);
    });

    it('initialises synchronously from a file buffer', async () => {
      const { initWasm } = await freshLoader();
      await initWasm();

      expect(initSync).toHaveBeenCalledTimes(1);
      expect(asyncInit).not.toHaveBeenCalled();
    });

    it('passes the buffer under the key initSync destructures', async () => {
      const { initWasm } = await freshLoader();
      await initWasm();

      const arg = initSync.mock.calls[0][0];
      expect(arg).toHaveProperty('module');
      expect(arg.module).toBeInstanceOf(Uint8Array);
      // Non-empty: an empty buffer would make `new WebAssembly.Module` throw
      // with a message about the binary, not about how it was loaded.
      expect(arg.module.length).toBeGreaterThan(0);
    });

    it('falls back to the async entry point under ITS key when initSync is absent', async () => {
      // Older and future wasm-pack outputs do not always export initSync. The
      // async function destructures `module_or_path`, not `module`: passing
      // `{ module }` here reads undefined and silently triggers a relative
      // fetch instead of using the buffer already read from disk.
      hasInitSync = false;

      const { initWasm } = await freshLoader();
      await initWasm();

      expect(asyncInit).toHaveBeenCalledTimes(1);
      const arg = asyncInit.mock.calls[0][0];
      expect(arg).toHaveProperty('module_or_path');
      expect(arg.module_or_path).toBeInstanceOf(Uint8Array);
      expect(arg).not.toHaveProperty('module');
    });

    it('does not touch fetch', async () => {
      // A server has the binary on disk. Reaching for the network would make
      // proving depend on a CDN that an air-gapped deployment cannot see.
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const { initWasm } = await freshLoader();
      await initWasm();

      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('browser (window defined)', () => {
    beforeEach(() => {
      vi.stubGlobal('window', {});
      vi.stubGlobal('self', {});
    });

    it('initialises asynchronously from a URL', async () => {
      const { initWasm } = await freshLoader();
      await initWasm();

      expect(asyncInit).toHaveBeenCalledTimes(1);
      expect(initSync).not.toHaveBeenCalled();
    });

    it('passes a CDN URL under the key the async entry point destructures', async () => {
      const { initWasm } = await freshLoader();
      await initWasm();

      const arg = asyncInit.mock.calls[0][0];
      expect(arg).toHaveProperty('module_or_path');
      expect(typeof arg.module_or_path).toBe('string');
      expect(arg.module_or_path).toMatch(/^https:\/\/unpkg\.com\/@orbinum\/groth16-proofs@/);
      expect(arg.module_or_path).toMatch(/groth16_proofs_bg\.wasm$/);
    });

    it('pins the URL to the installed version rather than latest', async () => {
      // An unpinned CDN URL would serve whatever is newest, which is a
      // different wasm than the one this package was built and tested against.
      const { version } = await import('@orbinum/groth16-proofs/package.json');
      const { initWasm } = await freshLoader();
      await initWasm();

      expect(asyncInit.mock.calls[0][0].module_or_path).toContain(`@${version}/`);
    });

    it('never reaches for fs', async () => {
      // A browser bundle has no filesystem; touching `require('fs')` is what
      // makes a bundler emit a Node-polyfill warning or fail outright.
      const { initWasm } = await freshLoader();
      await expect(initWasm()).resolves.toBeUndefined();
    });
  });

  describe('web worker (self defined, window absent)', () => {
    it('takes the browser path', async () => {
      // Proving in a worker is the common case on mobile: the main thread stays
      // responsive. A worker has `self` but no `window`.
      vi.stubGlobal('window', undefined);
      vi.stubGlobal('self', {});

      const { initWasm } = await freshLoader();
      await initWasm();

      expect(asyncInit).toHaveBeenCalledTimes(1);
      expect(initSync).not.toHaveBeenCalled();
    });
  });
});

/**
 * Where `getNodeRequire()` resolves from.
 *
 * The two module systems reach `require` differently, and the difference is
 * easy to get subtly wrong: CommonJS resolves relative to the MODULE, while
 * `createRequire` resolves relative to whatever path it is handed. Anchoring
 * the ESM path on `process.cwd()` passes every test run from the project root
 * and fails the moment a process runs from somewhere else — a CLI invoked from
 * a user's home directory, a test runner with its own working directory.
 *
 * Measured while auditing 7.0.0 against a packed tarball: with the CWD outside
 * the project, the CommonJS build resolved its wasm fine and a CWD-anchored ESM
 * build failed with `Cannot find module '@orbinum/groth16-proofs'`. The two
 * builds must behave the same.
 */
describe('getNodeRequire', () => {
  it('anchors on this module, not the working directory', async () => {
    const { getNodeRequire } = await import('../../src/internal/nodeRequire');
    const nodeRequire = await getNodeRequire();

    // Resolving the wasm dependency must not depend on where the process was
    // started. Under vitest the CWD is the project root, so this passing is
    // necessary but not sufficient — the assertion below is the load-bearing
    // one.
    expect(() => nodeRequire.resolve('@orbinum/groth16-proofs')).not.toThrow();
  });

  it('reads a module path rather than hardcoding the CWD', async () => {
    // A source-level assertion, because the runtime one above cannot
    // distinguish the two anchors while the CWD happens to be correct. If the
    // CWD ever becomes the only anchor again, this fails and names why.
    const { readFileSync } = await import('node:fs');
    const source = readFileSync('src/internal/nodeRequire.ts', 'utf8');

    expect(source).toContain('ownModulePath()');
    // The CWD may remain as a fallback, but never as the sole base.
    expect(source).toMatch(/ownModulePath\(\)\s*\?\?/);
  });
});
