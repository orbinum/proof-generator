/**
 * Deciding how much parallelism the current device can actually afford.
 *
 * Proving is the most memory-hungry thing this package does, and the failure
 * mode is not a slow proof — it is no proof at all. `ffjavascript` spawns one
 * Web Worker per logical core, each carrying its own `WebAssembly.Memory`, and
 * a mobile browser's per-tab budget is a fraction of a desktop's. The transfer
 * of the WASM buffer then fails with:
 *
 *     Failed to execute 'postMessage' on 'Worker':
 *     Data cannot be cloned, out of memory.
 *
 * Reported from a phone on the Orbinum testnet; the same build proves fine on
 * desktop, which is what makes this a platform limit rather than a logic bug.
 */

/** Browser globals this module reads. Absent outside a browser. */
interface DeviceHints {
  /** Logical cores. Each one becomes a prover Worker. */
  hardwareConcurrency?: number;
  /** Approximate device RAM in GiB, rounded down to a power of two. */
  deviceMemory?: number;
  userAgent?: string;
}

/**
 * RAM below which multi-threaded proving is not attempted, in GiB.
 *
 * `navigator.deviceMemory` is capped at 8 by every implementation and rounded
 * down, so a 6 GB phone reports 4. Four workers against 4 GiB shared with the
 * rest of the browser is where reports start; anything at or below that proves
 * on one thread.
 */
const LOW_MEMORY_GIB = 4;

/**
 * Whether proving should be forced onto a single thread.
 *
 * Errs toward single-threaded: a proof that takes longer is a worse experience,
 * a proof that cannot be produced is a broken wallet. The check is deliberately
 * coarse — there is no API that reports the per-tab memory budget, so the only
 * honest options are a heuristic or a failure the user cannot act on.
 *
 * Returns false outside a browser: Node has no per-tab budget, and the pool
 * there is bounded by real cores.
 *
 * @param navigatorLike Injected for tests. Defaults to the global `navigator`.
 */
export function shouldProveSingleThreaded(navigatorLike?: DeviceHints | undefined): boolean {
  const nav = navigatorLike ?? (globalThis as { navigator?: DeviceHints }).navigator ?? undefined;
  if (!nav) return false;

  // A device that reports little RAM cannot afford one WASM heap per core,
  // however many cores it claims.
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= LOW_MEMORY_GIB) {
    return true;
  }

  // Firefox and Safari do not implement `deviceMemory`, so mobile has to be
  // recognised some other way. The UA is unreliable in general but adequate
  // here: the cost of a false positive is a slower proof, and of a false
  // negative a proof that never completes.
  if (typeof nav.userAgent === 'string' && isMobileUserAgent(nav.userAgent)) {
    return true;
  }

  return false;
}

/** Mobile and tablet UAs, which is where the per-tab budget is tightest. */
function isMobileUserAgent(userAgent: string): boolean {
  return /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|Opera Mini/i.test(userAgent);
}
