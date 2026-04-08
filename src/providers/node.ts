import { CircuitType } from '../circuits/types';
import { ArtifactProvider } from './interface';
import { getCircuitConfig } from '../circuits/config';

/**
 * Artifact provider for Node.js environments.
 * Reads circuit artifacts directly from the `@orbinum/circuits` package
 * installed in node_modules via the file system.
 */
export class NodeArtifactProvider implements ArtifactProvider {
  // Dynamic require so bundlers do not attempt to polyfill Node.js modules
  // when this class is tree-shaken in browser/mobile builds.
  private fs: any;
  private pathLib: any;
  private packageRoot: string;

  constructor(packageRoot?: string) {
    try {
      this.fs = eval('require')('fs');
      this.pathLib = eval('require')('path');
    } catch {
      throw new Error('NodeArtifactProvider requires Node.js environment');
    }
    this.packageRoot = packageRoot ?? this.resolvePackageRoot();
  }

  private resolvePackageRoot(): string {
    const candidates = ['@orbinum/circuits/package.json', 'orbinum-circuits/package.json'];
    for (const candidate of candidates) {
      try {
        return this.pathLib.dirname(eval('require').resolve(candidate));
      } catch {
        continue;
      }
    }
    throw new Error('Cannot resolve @orbinum/circuits package');
  }

  async getCircuitWasm(type: CircuitType): Promise<Uint8Array> {
    const { wasmPath } = getCircuitConfig(type);
    return this.fs.readFileSync(this.findArtifactPath(wasmPath));
  }

  async getCircuitZkey(type: CircuitType): Promise<Uint8Array> {
    const { zkeyPath } = getCircuitConfig(type);
    return this.fs.readFileSync(this.findArtifactPath(zkeyPath));
  }

  async getCircuitProvingKey(type: CircuitType): Promise<Uint8Array> {
    const { provingKeyPath } = getCircuitConfig(type);
    return this.fs.readFileSync(this.findArtifactPath(provingKeyPath));
  }

  private findArtifactPath(filename: string): string {
    const searchDirs = [
      this.packageRoot,
      this.pathLib.join(this.packageRoot, 'artifacts'),
      this.pathLib.join(this.packageRoot, 'pkg'),
    ];
    for (const dir of searchDirs) {
      const p = this.pathLib.join(dir, filename);
      if (this.fs.existsSync(p)) return p;
    }
    throw new Error(`Artifact ${filename} not found in ${this.packageRoot}`);
  }
}
