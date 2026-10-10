import { defineConfig } from 'tsup';
import { buildDefines } from './build/pins';

/**
 * Dual ESM + CommonJS, with the wasm version and integrity pins inlined.
 *
 * `main` stays CommonJS because Metro on React Native 0.73 does not enable
 * `exports` resolution by default, so a mobile host reads `main`. The ESM
 * output is what lets a browser or extension bundler tree-shake this package
 * at all — as CommonJS-only it could not, and a consumer naming one enum from
 * it pulled snarkjs entire.
 *
 * The constants are injected rather than imported: a JSON import needs an
 * import attribute under ESM and throws on load without one (see build/pins.ts).
 */
export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    define: buildDefines(),
});
