/**
 * Jest configuration for @orbinum/proof-generator tests
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 30000, // 30 seconds (proof generation can be slow)

  // Support ES modules from wasm-pack
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          target: 'ES2020',
          module: 'esnext',
        },
      },
    ],
  },
  // Don't transform WASM packages - use them as-is
  transformIgnorePatterns: [
    'node_modules/(?!@orbinum/groth16-proofs)',
  ],
};

