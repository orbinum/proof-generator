import type { ArtifactProvider } from '../providers/interface';

export interface GenerateOptions {
  verbose?: boolean;
  /**
   * Circuit version the proof is for; decides how many public signals it must
   * carry (v2 transfer/unshield add `memo_hash`). When the provider reports its
   * version (`getResolvedVersion`), that version is used and this, if given,
   * must match it. Otherwise it defaults to 1.
   */
  circuitVersion?: number;
  provider?: ArtifactProvider;
  /** Proof generation backend. Defaults to `'snarkjs'`. */
  backend?: 'snarkjs' | 'arkworks';
  /**
   * Prove on ONE thread instead of spawning a worker per logical core.
   *
   * snarkjs parallelises curve arithmetic through `ffjavascript`, which creates
   * `navigator.hardwareConcurrency` Web Workers — each with its own
   * `WebAssembly.Memory`. On a phone that is typically 8 workers against a
   * per-tab memory budget far smaller than a desktop's, and the transfer of the
   * WASM buffer fails outright:
   *
   *     Failed to execute 'postMessage' on 'Worker':
   *     Data cannot be cloned, out of memory.
   *
   * The proof is identical either way — only slower, since the multi-scalar
   * multiplication no longer spreads across cores. Slower beats impossible.
   *
   * Ignored by the `arkworks` backend, which is single-threaded already.
   *
   * Defaults to `false`. Callers that know they are on a memory-constrained
   * device should set it; see `shouldProveSingleThreaded` for a heuristic.
   */
  singleThread?: boolean;
}
