/**
 * Shapes crossing the WASM boundary.
 */

/** A snarkjs Groth16 proof, as `snarkjs.groth16.fullProve` returns it. */
export interface SnarkjsProofLike {
  pi_a: Array<string | number>;
  pi_b: Array<Array<string | number>>;
  pi_c: Array<string | number>;
}

export type InitWasmOptions = {
  /**
   * Where to load `groth16_proofs_bg.wasm` from in a browser. Defaults to the
   * pinned CDN URL.
   *
   * A host that must not fetch executable code at runtime has to override this.
   * A browser extension is the case that forces it: MV3's content security
   * policy is `script-src 'self'`, so a CDN fetch is refused — and a wallet
   * pulling its prover from a third party at spend time is exactly what that
   * policy exists to prevent. Such a host bundles the `.wasm` itself and passes
   * the packaged URL.
   *
   * Ignored under Node, which reads the file from `node_modules` directly.
   */
  wasmUrl?: string;
};
