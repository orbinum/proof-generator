import { CircuitType } from '../circuits/types';
import { ArtifactProvider } from './interface';

// ============================================================================
// Constants
// ============================================================================

const UNPKG_BASE = 'https://unpkg.com/@orbinum/circuits';
const MANIFEST_URL = `${UNPKG_BASE}/manifest.json`;

// ============================================================================
// Integrity
// ============================================================================

/** Lowercase hex sha256 of the given bytes, via WebCrypto (browser + Node ≥ 20). */
async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copy);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

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

/**
 * The circuit version the provider resolved to, plus the identifiers a consumer
 * needs to cross-check integrity against the chain before proving.
 */
export type ResolvedCircuitVersion = {
  /** The resolved circuit version (the override, else the manifest active version). */
  version: number;
  /** The `@orbinum/circuits` package version the artifacts are pinned to. */
  packageVersion: string;
  /** The on-chain VK hash the manifest declares for this version. */
  vkHash: string;
};

// ============================================================================
// WebArtifactProvider
// ============================================================================

/**
 * Artifact provider for browser and mobile environments.
 *
 * Manifest-only: fetches `manifest.json` from the npm CDN (unpkg) or a
 * `baseUrl` mirror, resolves the exact artifact filename per circuit version,
 * pins artifact URLs to the manifest's `package_version`, and VERIFIES every
 * downloaded artifact against the manifest's sha256 (fail-closed — a mismatch
 * throws). Supports per-circuit version overrides for backwards-compatible proof
 * generation. There is no unverified/manifest-less mode: every artifact is
 * integrity-checked.
 */
export class WebArtifactProvider implements ArtifactProvider {
  private manifestUrl: string;
  private circuitVersions: Partial<Record<string, number>>;
  private manifest: CircuitsManifest | null = null;
  private manifestPromise: Promise<CircuitsManifest> | null = null;

  constructor(options?: WebProviderOptions) {
    const base = options?.baseUrl?.replace(/\/$/, '').replace(/\/manifest\.json$/, '');
    this.manifestUrl = base ? `${base}/manifest.json` : MANIFEST_URL;
    this.circuitVersions = options?.circuitVersions ?? {};
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
  // Version resolution via manifest
  // ---------------------------------------------------------------------------

  /**
   * Resolves the version + manifest data the provider will use for a circuit —
   * the requested override, else the manifest's `active_version`. Throws if the
   * circuit is missing or the version is unsupported (fail-closed).
   */
  private async resolveVersionData(circuitType: CircuitType): Promise<{
    version: number;
    versionData: ManifestCircuitVersion;
    packageVersion: string;
  }> {
    const manifest = await this.getManifest();
    const circuitName = circuitType as string;
    const circuitManifest = manifest.circuits[circuitName];

    if (!circuitManifest) {
      throw new Error(`Circuit "${circuitName}" not found in manifest`);
    }

    const version = this.circuitVersions[circuitName] ?? circuitManifest.active_version;

    if (!circuitManifest.supported_versions.includes(version)) {
      throw new Error(
        `Circuit "${circuitName}" v${version} is no longer supported. ` +
          `Supported versions: [${circuitManifest.supported_versions.join(', ')}]`
      );
    }

    const versionData = circuitManifest.versions[String(version)];
    if (!versionData) {
      throw new Error(`Circuit "${circuitName}" v${version} not found in manifest`);
    }

    return { version, versionData, packageVersion: manifest.package_version };
  }

  /**
   * The version + package_version + vk_hash the provider will use for a circuit.
   * Public so a consumer (SDK) can cross-check the vk_hash against the chain's
   * active VK before generating a proof.
   */
  async getResolvedVersion(circuitType: CircuitType): Promise<ResolvedCircuitVersion> {
    const { version, versionData, packageVersion } = await this.resolveVersionData(circuitType);
    return { version, packageVersion, vkHash: versionData.vk_hash };
  }

  // ---------------------------------------------------------------------------
  // Artifact URL resolution via manifest
  // ---------------------------------------------------------------------------

  /**
   * The base URL artifacts are served from. A custom `baseUrl` mirror serves
   * them next to its manifest; the default (unpkg) pins them to the manifest's
   * `package_version` for an immutable, cacheable URL.
   */
  private artifactBase(packageVersion: string): string {
    if (this.manifestUrl !== MANIFEST_URL) {
      return this.manifestUrl.replace(/\/manifest\.json$/, '');
    }
    return `${UNPKG_BASE}@${packageVersion}`;
  }

  /** Resolves the URL + expected sha256 for one artifact of a circuit. */
  private async resolveArtifact(
    circuitType: CircuitType,
    artifactType: 'wasm' | 'zkey' | 'ark'
  ): Promise<{ url: string; sha256: string }> {
    const { versionData, packageVersion } = await this.resolveVersionData(circuitType);

    const entry = versionData.artifacts[artifactType];
    if (!entry) {
      throw new Error(`Circuit "${circuitType}" has no "${artifactType}" artifact in the manifest`);
    }
    return { url: `${this.artifactBase(packageVersion)}/${entry.file}`, sha256: entry.sha256 };
  }

  // ---------------------------------------------------------------------------
  // ArtifactProvider implementation
  // ---------------------------------------------------------------------------

  async getCircuitWasm(type: CircuitType): Promise<Uint8Array> {
    const { url, sha256 } = await this.resolveArtifact(type, 'wasm');
    return this.fetchArtifact(url, sha256);
  }

  async getCircuitZkey(type: CircuitType): Promise<Uint8Array> {
    const { url, sha256 } = await this.resolveArtifact(type, 'zkey');
    return this.fetchArtifact(url, sha256);
  }

  async getCircuitProvingKey(type: CircuitType): Promise<Uint8Array> {
    const { url, sha256 } = await this.resolveArtifact(type, 'ark');
    return this.fetchArtifact(url, sha256);
  }

  /**
   * Fetches an artifact and verifies the downloaded bytes against the manifest's
   * sha256 — fail-closed: a mismatch throws and no bytes are returned (guards
   * against a tampered/stale CDN). Every artifact is verified; there is no
   * unchecked path.
   */
  private async fetchArtifact(url: string, expectedSha256: string): Promise<Uint8Array> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch circuit artifact: ${url} (${response.status})`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());

    const actual = await sha256Hex(bytes);
    if (actual !== expectedSha256.toLowerCase()) {
      throw new Error(
        `Integrity check failed for ${url}: expected sha256 ${expectedSha256}, got ${actual}`
      );
    }
    return bytes;
  }
}
