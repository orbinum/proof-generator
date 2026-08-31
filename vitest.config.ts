import { defineConfig } from 'vitest/config';
import { createRequire } from 'node:module';

// `__GROTH16_VERSION__` is injected by tsup at build time (see tsup.config.ts).
// Tests import from `src/`, which never goes through that build, so it has to
// be defined here too — otherwise every test touching the loader dies with
// `ReferenceError: __GROTH16_VERSION__ is not defined`, which says nothing
// about the real cause.
const { version: groth16Version } = createRequire(import.meta.url)(
  '@orbinum/groth16-proofs/package.json'
) as { version: string };

export default defineConfig({
  define: { __GROTH16_VERSION__: JSON.stringify(groth16Version) },
  test: {
    globals: true,
    environment: 'node',
    // The e2e suite is excluded here and run by `pnpm test:e2e`. It needs
    // @orbinum/circuits — 27 MB of proving keys — and takes about 30 seconds
    // where the unit suite takes 300 ms. Mixing them would mean either a slow
    // default or a default that skips silently when the package is absent.
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/index.ts'],
    },
    testTimeout: 30000,
  },
});
