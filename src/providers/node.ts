import { CircuitType } from '../circuits/types';
import { getNodeRequire, type NodeRequire } from '../internal/nodeRequire';
import { verifySha256 } from '../utils/integrity';
import { ArtifactProvider, ResolvedCircuitVersion } from './interface';
import {
  artifactEntry,
  resolveVersionData,
  toResolvedCircuitVersion,
  type ArtifactKind,
  type CircuitVersions,
  type CircuitsManifest,
} from './manifest';

export type NodeProviderOptions = {
  /** Directory holding the circuits package. Defaults to the installed `@orbinum/circuits`. */
  packageRoot?: string;
  /** Pin specific circuits to a version number, e.g. `{ unshield: 1 }`. */
  circuitVersions?: CircuitVersions;
};

/**
 * Artifact provider for Node.js environments.
 *
 * Reads the installed `@orbinum/circuits` package through its `manifest.json`:
 * the manifest resolves each circuit's version and file names, and every file
 * is verified against the manifest's sha256 before it is returned — the same
 * rules as the web provider.
 */
export class NodeArtifactProvider implements ArtifactProvider {
  private readonly explicitRoot: string | undefined;
  private readonly circuitVersions: CircuitVersions;
  // Resolved on first use rather than in the constructor: obtaining `require`
  // is async under ESM (`createRequire` arrives through a dynamic import), and
  // a constructor cannot await.
  private ready: Promise<{ fs: any; path: any; root: string; manifest: CircuitsManifest }> | null =
    null;

  /** A string argument is the package root, as in earlier versions. */
  constructor(options?: NodeProviderOptions | string) {
    const opts = typeof options === 'string' ? { packageRoot: options } : (options ?? {});
    this.explicitRoot = opts.packageRoot;
    this.circuitVersions = opts.circuitVersions ?? {};
  }

  /** Loads `fs`/`path`, locates the package and reads its manifest. Single-flight. */
  private init() {
    this.ready ??= (async () => {
      let nodeRequire: NodeRequire;
      try {
        nodeRequire = await getNodeRequire();
      } catch {
        throw new Error('NodeArtifactProvider requires Node.js environment');
      }
      const fs: any = nodeRequire('fs');
      const path: any = nodeRequire('path');
      const root = this.explicitRoot ?? resolvePackageRoot(nodeRequire, path);
      const manifestPath = path.join(root, 'manifest.json');
      if (!fs.existsSync(manifestPath)) {
        throw new Error(`No circuits manifest at ${manifestPath}`);
      }
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as CircuitsManifest;
      return { fs, path, root, manifest };
    })().catch(error => {
      this.ready = null;
      throw error;
    });
    return this.ready;
  }

  async getResolvedVersion(circuitType: CircuitType): Promise<ResolvedCircuitVersion> {
    const { manifest } = await this.init();
    return toResolvedCircuitVersion(
      resolveVersionData(manifest, circuitType, this.circuitVersions)
    );
  }

  async getCircuitWasm(type: CircuitType): Promise<Uint8Array> {
    return this.readArtifact(type, 'wasm');
  }

  async getCircuitZkey(type: CircuitType): Promise<Uint8Array> {
    return this.readArtifact(type, 'zkey');
  }

  async getCircuitProvingKey(type: CircuitType): Promise<Uint8Array> {
    return this.readArtifact(type, 'ark');
  }

  /** Reads one artifact beside the manifest and verifies it. */
  private async readArtifact(type: CircuitType, kind: ArtifactKind): Promise<Uint8Array> {
    const { fs, path, root, manifest } = await this.init();
    const entry = artifactEntry(
      type,
      resolveVersionData(manifest, type, this.circuitVersions),
      kind
    );
    const file = path.join(root, entry.file);
    if (!fs.existsSync(file)) {
      throw new Error(`Artifact ${entry.file} not found in ${root}`);
    }
    return verifySha256(new Uint8Array(fs.readFileSync(file)), entry.sha256, file);
  }
}

function resolvePackageRoot(nodeRequire: NodeRequire, path: any): string {
  for (const candidate of ['@orbinum/circuits/package.json', 'orbinum-circuits/package.json']) {
    try {
      return path.dirname(nodeRequire.resolve(candidate));
    } catch {
      continue;
    }
  }
  throw new Error('Cannot resolve @orbinum/circuits package');
}
