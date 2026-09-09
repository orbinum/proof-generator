/**
 * WASM loader for universal (Node.js + Browser) environments.
 *
 * The pieces live one responsibility per file; this re-exports them:
 *
 *   source.ts   where the browser fetches the .wasm from
 *   init.ts     instantiating it, per environment
 *   compress.ts snarkjs proof → arkworks compressed
 *   prove.ts    artifact + witness → proof
 */

export { initWasm } from './init';
export { setWasmUrl } from './source';
export { compressSnarkjsProofWasm } from './compress';
export { generateProofWasm } from './prove';
export type { InitWasmOptions, SnarkjsProofLike } from './types';
