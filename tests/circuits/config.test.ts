import { describe, it, expect } from 'vitest';
import { getCircuitConfig } from '../../src/circuits/config';
import { CircuitType } from '../../src/circuits/types';

describe('getCircuitConfig', () => {
  it('returns correct config for Unshield', () => {
    const config = getCircuitConfig(CircuitType.Unshield);
    expect(config.name).toBe('unshield');
    expect(config.wasmPath).toBe('unshield.wasm');
    expect(config.zkeyPath).toBe('unshield_pk.zkey');
    expect(config.provingKeyPath).toBe('unshield_pk.ark');
    expect(config.expectedPublicSignals).toBe(5);
  });

  it('returns correct config for Transfer', () => {
    const config = getCircuitConfig(CircuitType.Transfer);
    expect(config.name).toBe('transfer');
    expect(config.wasmPath).toBe('transfer.wasm');
    expect(config.zkeyPath).toBe('transfer_pk.zkey');
    expect(config.provingKeyPath).toBe('transfer_pk.ark');
    expect(config.expectedPublicSignals).toBe(5);
  });

  it('returns correct config for Disclosure', () => {
    const config = getCircuitConfig(CircuitType.Disclosure);
    expect(config.name).toBe('disclosure');
    expect(config.wasmPath).toBe('disclosure.wasm');
    expect(config.zkeyPath).toBe('disclosure_pk.zkey');
    expect(config.provingKeyPath).toBe('disclosure_pk.ark');
    expect(config.expectedPublicSignals).toBe(4);
  });

  it('returns correct config for PrivateLink', () => {
    const config = getCircuitConfig(CircuitType.PrivateLink);
    expect(config.name).toBe('private_link');
    expect(config.wasmPath).toBe('private_link.wasm');
    expect(config.zkeyPath).toBe('private_link_pk.zkey');
    expect(config.provingKeyPath).toBe('private_link_pk.ark');
    expect(config.expectedPublicSignals).toBe(2);
  });

  it('all configs have name, wasmPath, zkeyPath, provingKeyPath, expectedPublicSignals', () => {
    const types = [
      CircuitType.Unshield,
      CircuitType.Transfer,
      CircuitType.Disclosure,
      CircuitType.PrivateLink,
    ];
    for (const type of types) {
      const config = getCircuitConfig(type);
      expect(config.name).toBeTruthy();
      expect(config.wasmPath).toMatch(/\.wasm$/);
      expect(config.zkeyPath).toMatch(/\.zkey$/);
      expect(config.provingKeyPath).toMatch(/\.ark$/);
      expect(config.expectedPublicSignals).toBeGreaterThan(0);
    }
  });

  it('wasmPath matches name.wasm pattern', () => {
    const config = getCircuitConfig(CircuitType.Unshield);
    expect(config.wasmPath).toBe(`${config.name}.wasm`);
  });

  it('zkeyPath matches name_pk.zkey pattern', () => {
    const config = getCircuitConfig(CircuitType.Unshield);
    expect(config.zkeyPath).toBe(`${config.name}_pk.zkey`);
  });

  it('provingKeyPath matches name_pk.ark pattern', () => {
    const config = getCircuitConfig(CircuitType.Unshield);
    expect(config.provingKeyPath).toBe(`${config.name}_pk.ark`);
  });
});
