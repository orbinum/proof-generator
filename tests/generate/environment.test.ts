/**
 * `shouldProveSingleThreaded` — the device heuristic behind the mobile fix.
 *
 * A phone reported `Failed to execute 'postMessage' on 'Worker': Data cannot be
 * cloned, out of memory` when proving an unshield. The cause is `ffjavascript`
 * spawning one Worker per logical core, each with its own `WebAssembly.Memory`,
 * against a per-tab budget far smaller than a desktop's.
 *
 * The heuristic errs toward single-threaded on purpose: a false positive costs
 * a slower proof, a false negative costs a proof that never completes. These
 * tests pin that asymmetry so nobody later "optimises" it in the wrong
 * direction.
 */
import { describe, it, expect } from 'vitest';
import { shouldProveSingleThreaded } from '../../src/generate/environment';

const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36';
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

describe('memory-based detection', () => {
  it('forces one thread on a device reporting 4 GiB or less', () => {
    // `deviceMemory` is capped at 8 and rounded DOWN, so a 6 GB phone reports 4.
    expect(shouldProveSingleThreaded({ deviceMemory: 4, userAgent: DESKTOP_UA })).toBe(true);
    expect(shouldProveSingleThreaded({ deviceMemory: 2, userAgent: DESKTOP_UA })).toBe(true);
  });

  it('allows threads on a device reporting more than 4 GiB', () => {
    expect(shouldProveSingleThreaded({ deviceMemory: 8, userAgent: DESKTOP_UA })).toBe(false);
  });

  it('ignores core count — cores are the problem, not the budget', () => {
    // A 16-core desktop with plenty of RAM should still parallelise; the
    // failure is memory per worker, not the number of workers as such.
    expect(
      shouldProveSingleThreaded({ hardwareConcurrency: 16, deviceMemory: 8, userAgent: DESKTOP_UA })
    ).toBe(false);
  });
});

describe('user-agent fallback', () => {
  it.each([
    ['Android', ANDROID_UA],
    ['iPhone', IPHONE_UA],
  ])('forces one thread on %s even without deviceMemory', (_label, userAgent) => {
    // Firefox and Safari do not implement `deviceMemory`, so the UA is the only
    // remaining signal on exactly the platforms that need it most.
    expect(shouldProveSingleThreaded({ userAgent })).toBe(true);
  });

  it('leaves a desktop UA on the threaded path', () => {
    expect(shouldProveSingleThreaded({ userAgent: DESKTOP_UA })).toBe(false);
  });
});

describe('non-browser and unknown environments', () => {
  it('returns false when the navigator exposes nothing useful', () => {
    // Node has no per-tab budget and the pool is bounded by real cores, so the
    // absence of any signal must not downgrade a server-side prover.
    expect(shouldProveSingleThreaded({})).toBe(false);
  });

  it('does not crash on a partial navigator', () => {
    expect(shouldProveSingleThreaded({ hardwareConcurrency: 8 })).toBe(false);
  });
});
