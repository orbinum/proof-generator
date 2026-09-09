/**
 * Instantiating the `@orbinum/groth16-proofs` WASM module.
 *
 * Two environments, two wasm-bindgen entry points taking differently-named
 * argument keys — `initSync({ module })` from a file buffer under Node,
 * `__wbg_init({ module_or_path })` from a URL in a browser.
 */

import { getNodeRequire } from '../internal/nodeRequire';
import { resolveWasmUrl, setWasmUrl } from './source';
import type { InitWasmOptions } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WasmModule = any;

let wasmModule: WasmModule = null;

/** No `window` and no `self` — Node, rather than a browser or a Web Worker. */
function isNode(): boolean {
  return typeof window === 'undefined' && typeof self === 'undefined';
}

/**
 * Node: load the WASM binary from disk and instantiate synchronously.
 *
 * `getNodeRequire()` rather than `eval('require')`: the latter works in the
 * CommonJS build and throws `ReferenceError: require is not defined` in the
 * ESM one, from the same source line.
 */
async function initFromDisk(wasm: WasmModule): Promise<void> {
  const requireFn = await getNodeRequire();
  const fs = requireFn('fs') as typeof import('fs');
  const path = requireFn('path') as typeof import('path');
  const wasmDir = path.dirname(requireFn.resolve('@orbinum/groth16-proofs'));
  const wasmBuffer = fs.readFileSync(path.join(wasmDir, 'groth16_proofs_bg.wasm'));

  // The two entry points take differently-named keys: `initSync` destructures
  // `{ module }`, the async default `{ module_or_path }`. Passing the wrong
  // one is not an error — wasm-bindgen reads `undefined` and silently falls
  // back to fetching `groth16_proofs_bg.wasm` relative to its own URL, which
  // in a bundle does not exist. The failure then surfaces as a fetch error
  // naming a file nobody asked for.
  if (typeof wasm.initSync === 'function') {
    wasm.initSync({ module: wasmBuffer });
  } else if (typeof wasm.default === 'function') {
    await wasm.default({ module_or_path: wasmBuffer });
  }
}

/**
 * The real `__wbg_init`, through either module shape.
 *
 * TypeScript (module: "CommonJS") compiles dynamic import() to
 * __importStar(require()), which causes Vite's CJS→ESM interop to wrap the
 * namespace and reassign `wasm.default` to the namespace object. Resolve the
 * actual __wbg_init function defensively (direct ESM or CJS-interop path).
 */
function resolveInitFn(
  wasm: WasmModule
): ((input: { module_or_path: string }) => Promise<unknown>) | undefined {
  const defaultExport = wasm.default;
  if (typeof defaultExport === 'function') return defaultExport;
  if (typeof defaultExport?.default === 'function') return defaultExport.default;
  return undefined;
}

/**
 * Browser: pass a URL directly to the init function — the host's when one was
 * configured, the pinned CDN otherwise.
 *
 * Relying on `new URL('groth16_proofs_bg.wasm', import.meta.url)` (the
 * wasm-pack default) breaks in Vite dev mode because the bundler moves the JS
 * out of its original node_modules path while the .wasm binary stays behind,
 * producing a 404. Loading from CDN is the same strategy already used for
 * @orbinum/circuits artifacts and avoids all import.meta.url / Vite
 * asset-serving issues entirely.
 */
async function initFromUrl(wasm: WasmModule): Promise<void> {
  const initFn = resolveInitFn(wasm);
  if (initFn) await initFn({ module_or_path: resolveWasmUrl() });
}

/**
 * Initialize the WASM module. Idempotent — safe to call multiple times.
 *
 * The first call wins: the module is already instantiated by the second, and
 * re-instantiating it would discard the prover's state. `options.wasmUrl` on a
 * later call is therefore ignored — use `setWasmUrl` to state the URL once,
 * before anything proves.
 */
export async function initWasm(options?: InitWasmOptions): Promise<void> {
  if (wasmModule) return;
  if (options?.wasmUrl !== undefined) setWasmUrl(options.wasmUrl);

  try {
    const wasm = await import('@orbinum/groth16-proofs');

    if (isNode()) {
      await initFromDisk(wasm);
    } else {
      await initFromUrl(wasm);
    }

    if (typeof wasm.init_panic_hook === 'function') {
      try {
        wasm.init_panic_hook();
      } catch {
        // init_panic_hook is a developer-aid only; safe to swallow.
      }
    }

    wasmModule = wasm;
  } catch (error) {
    throw new Error(`Failed to initialize WASM module: ${(error as Error).message}`);
  }
}

/** The instantiated module, initializing on first use. */
export async function getWasm(): Promise<WasmModule> {
  if (!wasmModule) await initWasm();
  return wasmModule;
}
