/**
 * Circuit Configuration and Artifact Providers
 *
 * Defines paths and metadata for all supported circuits.
 * Implements ArtifactProvider for Node.js (fs) and Browser (fetch).
 */

import { CircuitType, CircuitConfig } from './types';
import { ArtifactProvider } from './provider';
import * as path from 'path';

// ============================================================================
// Defaults & Configuration
// ============================================================================

const DEFAULT_CIRCUIT_URL = 'https://circuits.orbinum.io/v1';

export function getCircuitConfig(circuitType: CircuitType): CircuitConfig {
  const circuitName = circuitType.toLowerCase();
  return {
    name: circuitName,
    wasmPath: `${circuitName}.wasm`,
    zkeyPath: `${circuitName}_pk.zkey`,
    provingKeyPath: `${circuitName}_pk.ark`,
    expectedPublicSignals: getExpectedPublicSignals(circuitType),
  };
}

function getExpectedPublicSignals(circuitType: CircuitType): number {
  switch (circuitType) {
    case CircuitType.Unshield:
      return 5;
    case CircuitType.Transfer:
      return 5;
    case CircuitType.Disclosure:
      return 4;
    default:
      throw new Error(`Unknown circuit type: ${circuitType}`);
  }
}

// ============================================================================
// Node.js Provider (FS)
// ============================================================================

export class NodeArtifactProvider implements ArtifactProvider {
  private fs: any;
  private packageRoot: string;

  constructor(packageRoot?: string) {
    // Dynamic require to avoid bundling fs in browser
    try {
      this.fs = eval('require')('fs');
    } catch (e) {
      throw new Error('NodeArtifactProvider requires Node.js environment');
    }
    this.packageRoot = packageRoot || this.resolvePackageRoot();
  }

  private resolvePackageRoot(): string {
    const packageCandidates = ['@orbinum/circuits/package.json', 'orbinum-circuits/package.json'];
    for (const candidate of packageCandidates) {
      try {
        return path.dirname(eval('require').resolve(candidate));
      } catch {
        continue;
      }
    }
    throw new Error('Cannot resolve @orbinum/circuits package');
  }

  async getCircuitWasm(type: CircuitType): Promise<Uint8Array> {
    const config = getCircuitConfig(type);
    const filePath = this.findArtifactPath(config.wasmPath);
    return this.fs.readFileSync(filePath);
  }

  async getCircuitZkey(type: CircuitType): Promise<Uint8Array> {
    const config = getCircuitConfig(type);
    const filePath = this.findArtifactPath(config.zkeyPath);
    return this.fs.readFileSync(filePath);
  }

  private findArtifactPath(filename: string): string {
    const searchDirs = [
      this.packageRoot,
      path.join(this.packageRoot, 'artifacts'),
      path.join(this.packageRoot, 'pkg'),
    ];
    for (const dir of searchDirs) {
      const p = path.join(dir, filename);
      if (this.fs.existsSync(p)) return p;
    }
    throw new Error(`Artifact ${filename} not found in ${this.packageRoot}`);
  }
}

// ============================================================================
// Web Provider (Fetch)
// ============================================================================

export class WebArtifactProvider implements ArtifactProvider {
  private baseUrl: string;

  constructor(baseUrl: string = DEFAULT_CIRCUIT_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async getCircuitWasm(type: CircuitType): Promise<Uint8Array> {
    const config = getCircuitConfig(type);
    return this.fetchArtifact(config.wasmPath);
  }

  async getCircuitZkey(type: CircuitType): Promise<Uint8Array> {
    const config = getCircuitConfig(type);
    return this.fetchArtifact(config.zkeyPath);
  }

  private async fetchArtifact(filename: string): Promise<Uint8Array> {
    const url = `${this.baseUrl}/${filename}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch circuit artifact: ${url} (${response.status})`);
    }
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }
}
