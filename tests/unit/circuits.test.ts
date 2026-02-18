/**
 * Unit Tests: circuits.ts
 *
 * Tests circuit configuration resolution and validation
 */

import { getCircuitConfig, NodeArtifactProvider } from '../../src/circuits';
import { CircuitType } from '../../src/types';
import * as fs from 'fs';

describe('circuits.ts - Unit Tests', () => {
  describe('getCircuitConfig', () => {
    it('should return config for Unshield circuit', () => {
      const config = getCircuitConfig(CircuitType.Unshield);

      expect(config).toBeDefined();
      expect(config.name).toBe('unshield');
      expect(config.wasmPath).toBe('unshield.wasm');
      expect(config.zkeyPath).toBe('unshield_pk.zkey');
      expect(config.provingKeyPath).toBe('unshield_pk.ark');
      expect(config.expectedPublicSignals).toBe(5);
    });

    it('should return config for Transfer circuit', () => {
      const config = getCircuitConfig(CircuitType.Transfer);

      expect(config).toBeDefined();
      expect(config.name).toBe('transfer');
      expect(config.wasmPath).toBe('transfer.wasm');
      expect(config.zkeyPath).toBe('transfer_pk.zkey');
      expect(config.provingKeyPath).toBe('transfer_pk.ark');
      expect(config.expectedPublicSignals).toBe(5);
    });

    it('should return config for Disclosure circuit', () => {
      const config = getCircuitConfig(CircuitType.Disclosure);

      expect(config).toBeDefined();
      expect(config.name).toBe('disclosure');
      expect(config.wasmPath).toBe('disclosure.wasm');
      expect(config.zkeyPath).toBe('disclosure_pk.zkey');
      expect(config.provingKeyPath).toBe('disclosure_pk.ark');
      expect(config.expectedPublicSignals).toBe(4);
    });
  });

  describe('NodeArtifactProvider', () => {
    it('should resolve artifacts via fs', async () => {
      const provider = new NodeArtifactProvider();

      const wasm = await provider.getCircuitWasm(CircuitType.Unshield);
      const zkey = await provider.getCircuitZkey(CircuitType.Unshield);

      expect(wasm).toBeDefined();
      expect(zkey).toBeDefined();
      expect(wasm.length).toBeGreaterThan(0);
      expect(zkey.length).toBeGreaterThan(0);
    });

    it('should fail if artifacts are missing', async () => {
      // We expect it to succeed if env is correct,
      // but let's test that it throws with invalid package root if forced
      try {
        const provider = new NodeArtifactProvider('/invalid/path');
        await provider.getCircuitWasm(CircuitType.Unshield);
        fail('Should have thrown');
      } catch (e) {
        expect((e as Error).message).toContain('not found');
      }
    });
  });
});
