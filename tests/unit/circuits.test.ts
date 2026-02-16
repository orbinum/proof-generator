/**
 * Unit Tests: circuits.ts
 *
 * Tests circuit configuration resolution and validation
 */

import { getCircuitConfig, validateCircuitArtifacts } from '../../src/circuits';
import { CircuitType, CircuitConfig } from '../../src/types';
import * as fs from 'fs';

describe('circuits.ts - Unit Tests', () => {
  describe('getCircuitConfig', () => {
    it('should return config for Unshield circuit', () => {
      const config = getCircuitConfig(CircuitType.Unshield);

      expect(config).toBeDefined();
      expect(config.name).toBe('unshield');
      expect(config.wasmPath).toContain('unshield');
      expect(config.zkeyPath).toContain('unshield');
      expect(config.provingKeyPath).toContain('unshield');
      expect(config.expectedPublicSignals).toBe(5);
    });

    it('should return config for Transfer circuit', () => {
      const config = getCircuitConfig(CircuitType.Transfer);

      expect(config).toBeDefined();
      expect(config.name).toBe('transfer');
      expect(config.wasmPath).toContain('transfer');
      expect(config.zkeyPath).toContain('transfer');
      expect(config.provingKeyPath).toContain('transfer');
      expect(config.expectedPublicSignals).toBe(5);
    });

    it('should return config for Disclosure circuit', () => {
      const config = getCircuitConfig(CircuitType.Disclosure);

      expect(config).toBeDefined();
      expect(config.name).toBe('disclosure');
      expect(config.wasmPath).toContain('disclosure');
      expect(config.zkeyPath).toContain('disclosure');
      expect(config.provingKeyPath).toContain('disclosure');
      expect(config.expectedPublicSignals).toBe(4);
    });

    it('should resolve circuit paths from npm package', () => {
      const config = getCircuitConfig(CircuitType.Unshield);

      // Paths should be absolute
      expect(config.wasmPath).toMatch(/^\/|^[A-Z]:\\/);
      expect(config.zkeyPath).toMatch(/^\/|^[A-Z]:\\/);
      expect(config.provingKeyPath).toMatch(/^\/|^[A-Z]:\\/);

      // Paths should contain node_modules or package directory
      expect(config.wasmPath.includes('node_modules') || config.wasmPath.includes('circuits')).toBe(
        true
      );
    });

    it('should have correct file extensions', () => {
      const config = getCircuitConfig(CircuitType.Unshield);

      expect(config.wasmPath).toMatch(/\.wasm$/);
      expect(config.zkeyPath).toMatch(/\.zkey$/);
      expect(config.provingKeyPath).toMatch(/\.ark$/);
    });
  });

  describe('validateCircuitArtifacts', () => {
    it('should validate existing artifacts without throwing', () => {
      const config = getCircuitConfig(CircuitType.Unshield);

      // Should not throw if artifacts exist
      expect(() => validateCircuitArtifacts(config)).not.toThrow();
    });

    it('should throw if WASM file does not exist', () => {
      const invalidConfig: CircuitConfig = {
        name: 'test',
        wasmPath: '/nonexistent/path/test.wasm',
        zkeyPath: '/some/path/test.zkey',
        provingKeyPath: '/some/path/test.ark',
        expectedPublicSignals: 5,
      };

      expect(() => validateCircuitArtifacts(invalidConfig)).toThrow(/WASM not found/);
    });

    it('should throw if proving key does not exist', () => {
      const config = getCircuitConfig(CircuitType.Unshield);
      const invalidConfig: CircuitConfig = {
        ...config,
        provingKeyPath: '/nonexistent/path/test.ark',
      };

      expect(() => validateCircuitArtifacts(invalidConfig)).toThrow(/Proving key not found/);
    });

    it('should throw if zkey does not exist', () => {
      const config = getCircuitConfig(CircuitType.Unshield);
      const invalidConfig: CircuitConfig = {
        ...config,
        zkeyPath: '/nonexistent/path/test.zkey',
      };

      expect(() => validateCircuitArtifacts(invalidConfig)).toThrow(/zkey not found/);
    });

    it('should verify all three artifacts exist', () => {
      const config = getCircuitConfig(CircuitType.Transfer);

      // All files should exist
      expect(fs.existsSync(config.wasmPath)).toBe(true);
      expect(fs.existsSync(config.zkeyPath)).toBe(true);
      expect(fs.existsSync(config.provingKeyPath)).toBe(true);
    });
  });

  describe('expectedPublicSignals', () => {
    it('should return correct count for each circuit type', () => {
      expect(getCircuitConfig(CircuitType.Unshield).expectedPublicSignals).toBe(5);
      expect(getCircuitConfig(CircuitType.Transfer).expectedPublicSignals).toBe(5);
      expect(getCircuitConfig(CircuitType.Disclosure).expectedPublicSignals).toBe(4);
    });
  });
});
