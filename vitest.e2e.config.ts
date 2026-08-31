import { defineConfig } from 'vitest/config';

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
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/e2e/**/*.test.ts'],
    // Proving transfer through the arkworks wasm takes about 7 seconds; the
    // per-test timeouts in the file itself are what actually bound this.
    testTimeout: 180000,
  },
});
