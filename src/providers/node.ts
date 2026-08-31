import { CircuitType } from '../circuits/types';
import { ArtifactProvider } from './interface';
import { getCircuitConfig } from '../circuits/config';
import { getNodeRequire, type NodeRequire } from '../internal/nodeRequire';

/**
 * Artifact provider for Node.js environments.
 * Reads circuit artifacts directly from the `@orbinum/circuits` package
 * installed in node_modules via the file system.
 */
export class NodeArtifactProvider implements ArtifactProvider {
  // Resolved on first use rather than in the constructor: obtaining `require`
  // is async under ESM (`createRequire` arrives through a dynamic import), and
  // a constructor cannot await. Every artifact read already went to disk, so
  // the one-time cost lands where it was going anyway.
  private fs: any;
  private pathLib: any;
  private packageRoot: string | undefined;
  private readonly explicitRoot: string | undefined;
  private ready: Promise<void> | undefined;

  constructor(packageRoot?: string) {
    this.explicitRoot = packageRoot;
  }

  /** Loads `fs`/`path` and locates the artifacts. Idempotent, single-flight. */
  private async init(): Promise<void> {
    this.ready ??= (async () => {
      let nodeRequire;
      try {
        nodeRequire = await getNodeRequire();
      } catch {
        throw new Error('NodeArtifactProvider requires Node.js environment');
      }
      this.fs = nodeRequire('fs');
      this.pathLib = nodeRequire('path');
      this.packageRoot = this.explicitRoot ?? this.resolvePackageRoot(nodeRequire);
    })();
    return this.ready;
  }

  private resolvePackageRoot(nodeRequire: NodeRequire): string {
    const candidates = ['@orbinum/circuits/package.json', 'orbinum-circuits/package.json'];
    for (const candidate of candidates) {
      try {
        return this.pathLib.dirname(nodeRequire.resolve(candidate));
      } catch {
        continue;
      }
    }
    throw new Error('Cannot resolve @orbinum/circuits package');
  }

  async getCircuitWasm(type: CircuitType): Promise<Uint8Array> {
    await this.init();
    const { wasmPath } = getCircuitConfig(type);
    return this.fs.readFileSync(this.findArtifactPath(wasmPath));
  }

  async getCircuitZkey(type: CircuitType): Promise<Uint8Array> {
    await this.init();
    const { zkeyPath } = getCircuitConfig(type);
    return this.fs.readFileSync(this.findArtifactPath(zkeyPath));
  }

  async getCircuitProvingKey(type: CircuitType): Promise<Uint8Array> {
    await this.init();
    const { provingKeyPath } = getCircuitConfig(type);
    return this.fs.readFileSync(this.findArtifactPath(provingKeyPath));
  }

  private findArtifactPath(filename: string): string {
    const searchDirs = [
      this.packageRoot as string,
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
