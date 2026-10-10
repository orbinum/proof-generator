import { defineConfig } from 'vitest/config';
import { buildDefines } from './build/pins';

// The build-time globals (`__GROTH16_VERSION__` and the integrity pins) are
// injected by tsup (see tsup.config.ts). Tests import from `src/`, which never
// goes through that build, so they have to be defined here too — otherwise
// every test touching the loader dies with `ReferenceError: __GROTH16_VERSION__
// is not defined`, which says nothing about the real cause.

/**
 * The end-to-end suite, kept out of the default run.
 *
 * These tests mock nothing: they resolve the published `@orbinum/circuits` and
 * `@orbinum/groth16-proofs`, generate real proofs with both backends, and verify
 * them. That costs about 30 seconds and 27 MB of proving keys, where the unit
 * suite runs in 300 ms against mocks.
 *
 * A separate config rather than a filter, because vitest applies `exclude`
 * before any path filter — a `--exclude`-based split silently matches nothing.
 */
export default defineConfig({
  define: buildDefines(),
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/e2e/**/*.test.ts'],
    // Proving transfer through the arkworks wasm takes about 7 seconds; the
    // per-test timeouts in the file itself are what actually bound this.
    testTimeout: 180000,
  },
});
