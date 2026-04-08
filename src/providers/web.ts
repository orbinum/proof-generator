import { CircuitType } from '../circuits/types';
import { ArtifactProvider } from './interface';

// ============================================================================
// Constants
// ============================================================================

const UNPKG_BASE = 'https://unpkg.com/@orbinum/circuits';
const MANIFEST_URL = `${UNPKG_BASE}/manifest.json`;

// ============================================================================
// Manifest types
// ============================================================================

interface ManifestArtifactEntry {
  file: string;
  bytes: number;
  sha256: string;
}

interface ManifestCircuitVersion {
  version: number;
  vk_hash: string;
  artifacts: {
    wasm: ManifestArtifactEntry;
    zkey: ManifestArtifactEntry;
    vk_json: ManifestArtifactEntry;
    r1cs: ManifestArtifactEntry;
    /** Optional arkworks compressed proving key. Present when the manifest includes .ark artifacts. */
    ark?: ManifestArtifactEntry;
  };
}

interface ManifestCircuit {
  active_version: number;
  supported_versions: number[];
  versions: Record<string, ManifestCircuitVersion>;
}

interface CircuitsManifest {
  schema_version: string;
  package_name: string;
  package_version: string;
  generated_at: string;
  circuits: Record<string, ManifestCircuit>;
}

// ============================================================================
// Options
// ============================================================================

export type WebProviderOptions = {
  /**
   * Override the base URL for artifacts and manifest (e.g. self-hosted mirror).
   * The provider fetches `{baseUrl}/manifest.json` and resolves artifact
   * filenames from it.
   */
  baseUrl?: string;
  /**
   * Pin specific circuits to a version number.
   * Use when spending notes created with an older circuit version that differs
   * from the current `active_version` in the manifest.
   *
   * @example { unshield: 1 }  // force v1 unshield artifacts
   */
  circuitVersions?: Partial<Record<string, number>>;
};

// ============================================================================
// WebArtifactProvider
// ============================================================================

/**
 * Artifact provider for browser and mobile environments.
 *
 * Two modes:
 *   - **Legacy** (`new WebArtifactProvider('https://...')`) — appends artifact
 *     filenames directly to the given URL, no manifest fetch.
 *   - **Manifest** (`new WebArtifactProvider()` or `new WebArtifactProvider({...})`) —
 *     fetches `manifest.json` from the npm CDN (unpkg), resolves the exact
 *     artifact filename per circuit version, and pins artifact URLs to the
 *     `package_version` declared in the manifest. Supports per-circuit version
 *     overrides for backwards-compatible proof generation.
 */
export class WebArtifactProvider implements ArtifactProvider {
  private legacyBaseUrl: string | null = null;
  private manifestUrl: string;
  private circuitVersions: Partial<Record<string, number>>;
  private manifest: CircuitsManifest | null = null;
  private manifestPromise: Promise<CircuitsManifest> | null = null;

  constructor(optionsOrUrl?: string | WebProviderOptions) {
    if (typeof optionsOrUrl === 'string') {
      // Legacy mode: direct URL, no manifest
      this.legacyBaseUrl = optionsOrUrl.replace(/\/$/, '');
      this.manifestUrl = '';
      this.circuitVersions = {};
    } else {
      const opts = optionsOrUrl ?? {};
      const base = opts.baseUrl?.replace(/\/$/, '');
      this.manifestUrl = base ? `${base}/manifest.json` : MANIFEST_URL;
      this.circuitVersions = opts.circuitVersions ?? {};
    }
  }

  // ---------------------------------------------------------------------------
  // Manifest loading (lazy, cached, single-flight)
  // ---------------------------------------------------------------------------

  private async getManifest(): Promise<CircuitsManifest> {
    if (this.manifest) return this.manifest;
    if (!this.manifestPromise) {
      this.manifestPromise = fetch(this.manifestUrl)
        .then(r => {
          if (!r.ok) {
            throw new Error(`Failed to fetch circuits manifest: ${this.manifestUrl} (${r.status})`);
          }
          return r.json() as Promise<CircuitsManifest>;
        })
        .then(m => {
          this.manifest = m;
          return m;
        });
    }
    return this.manifestPromise;
  }

  // ---------------------------------------------------------------------------
  // Artifact URL resolution via manifest
  // ---------------------------------------------------------------------------

  private async resolveArtifactUrl(
    circuitType: CircuitType,
    artifactType: 'wasm' | 'zkey' | 'ark'
  ): Promise<string> {
    const manifest = await this.getManifest();
    const circuitName = circuitType as string;
    const circuitManifest = manifest.circuits[circuitName];

    if (!circuitManifest) {
      throw new Error(`Circuit "${circuitName}" not found in manifest`);
    }

    const requestedVersion = this.circuitVersions[circuitName] ?? circuitManifest.active_version;

    if (!circuitManifest.supported_versions.includes(requestedVersion)) {
      throw new Error(
        `Circuit "${circuitName}" v${requestedVersion} is no longer supported. ` +
          `Supported versions: [${circuitManifest.supported_versions.join(', ')}]`
      );
    }

    const versionData = circuitManifest.versions[String(requestedVersion)];
    if (!versionData) {
      throw new Error(`Circuit "${circuitName}" v${requestedVersion} not found in manifest`);
    }

    const isCustomBase = this.manifestUrl !== MANIFEST_URL;
    const artifactBase = isCustomBase
      ? this.manifestUrl.replace(/\/manifest\.json$/, '')
      : `${UNPKG_BASE}@${manifest.package_version}`;

    if (artifactType === 'ark') {
      // Use the manifest entry if present; otherwise derive the filename by convention.
      const filename = versionData.artifacts.ark?.file ?? `${circuitName}_pk.ark`;
      return `${artifactBase}/${filename}`;
    }

    const filename = versionData.artifacts[artifactType].file;
    return `${artifactBase}/${filename}`;
  }

  // ---------------------------------------------------------------------------
  // ArtifactProvider implementation
  // ---------------------------------------------------------------------------

  async getCircuitWasm(type: CircuitType): Promise<Uint8Array> {
    if (this.legacyBaseUrl !== null) {
      return this.fetchArtifact(`${this.legacyBaseUrl}/${type.toLowerCase()}.wasm`);
    }
    return this.fetchArtifact(await this.resolveArtifactUrl(type, 'wasm'));
  }

  async getCircuitZkey(type: CircuitType): Promise<Uint8Array> {
    if (this.legacyBaseUrl !== null) {
      return this.fetchArtifact(`${this.legacyBaseUrl}/${type.toLowerCase()}_pk.zkey`);
    }
    return this.fetchArtifact(await this.resolveArtifactUrl(type, 'zkey'));
  }

  async getCircuitProvingKey(type: CircuitType): Promise<Uint8Array> {
    if (this.legacyBaseUrl !== null) {
      return this.fetchArtifact(`${this.legacyBaseUrl}/${type.toLowerCase()}_pk.ark`);
    }
    return this.fetchArtifact(await this.resolveArtifactUrl(type, 'ark'));
  }

  private async fetchArtifact(url: string): Promise<Uint8Array> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch circuit artifact: ${url} (${response.status})`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }
}
