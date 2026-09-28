import { CircuitType } from '../circuits/types';
import { verifySha256 } from '../utils/integrity';
import { ArtifactProvider, ResolvedCircuitVersion } from './interface';
import {
  CIRCUITS_PACKAGE_VERSION,
  artifactEntry,
  resolveVersionData,
  toResolvedCircuitVersion,
  type ArtifactKind,
  type CircuitVersions,
  type CircuitsManifest,
} from './manifest';

/** The pinned release on the npm CDN. */
const DEFAULT_BASE_URL = `https://unpkg.com/@orbinum/circuits@${CIRCUITS_PACKAGE_VERSION}`;

export type WebProviderOptions = {
  /**
   * Where `manifest.json` and the artifacts are served (e.g. a self-hosted
   * mirror). Defaults to the pinned `@orbinum/circuits` release on unpkg. An
   * unversioned URL follows `latest`, so a later publish changes what is
   * downloaded — pin it.
   */
  baseUrl?: string;
  /**
   * Pin specific circuits to a version number, e.g. to spend a note created
   * under an older circuit than the manifest's `active_version`.
   *
   * @example { unshield: 1 }  // force v1 unshield artifacts
   */
  circuitVersions?: CircuitVersions;
};

/**
 * Artifact provider for browser and mobile environments.
 *
 * Fetches `manifest.json`, resolves each circuit's version and artifact files
 * from it, and verifies every download against the manifest's sha256
 * (fail-closed — a mismatch throws). There is no unverified mode.
 */
export class WebArtifactProvider implements ArtifactProvider {
  private readonly baseUrl: string;
  private readonly circuitVersions: CircuitVersions;
  private manifestPromise: Promise<CircuitsManifest> | null = null;

  constructor(options?: WebProviderOptions) {
    const base = options?.baseUrl?.replace(/\/$/, '').replace(/\/manifest\.json$/, '');
    this.baseUrl = base || DEFAULT_BASE_URL;
    this.circuitVersions = options?.circuitVersions ?? {};
  }

  /** Lazy and single-flight; a failed fetch is retried on the next call. */
  private getManifest(): Promise<CircuitsManifest> {
    this.manifestPromise ??= (async () => {
      const url = `${this.baseUrl}/manifest.json`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch circuits manifest: ${url} (${response.status})`);
      }
      return (await response.json()) as CircuitsManifest;
    })().catch(error => {
      this.manifestPromise = null;
      throw error;
    });
    return this.manifestPromise;
  }

  private async resolve(circuitType: CircuitType) {
    return resolveVersionData(await this.getManifest(), circuitType, this.circuitVersions);
  }

  /**
   * The version, package version and vk_hash the provider serves for a circuit,
   * so a consumer can cross-check the vk_hash against the chain before proving.
   */
  async getResolvedVersion(circuitType: CircuitType): Promise<ResolvedCircuitVersion> {
    return toResolvedCircuitVersion(await this.resolve(circuitType));
  }

  async getCircuitWasm(type: CircuitType): Promise<Uint8Array> {
    return this.fetchArtifact(type, 'wasm');
  }

  async getCircuitZkey(type: CircuitType): Promise<Uint8Array> {
    return this.fetchArtifact(type, 'zkey');
  }

  async getCircuitProvingKey(type: CircuitType): Promise<Uint8Array> {
    return this.fetchArtifact(type, 'ark');
  }

  /** Downloads one artifact, served next to the manifest, and verifies it. */
  private async fetchArtifact(type: CircuitType, kind: ArtifactKind): Promise<Uint8Array> {
    const entry = artifactEntry(type, await this.resolve(type), kind);
    const url = `${this.baseUrl}/${entry.file}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch circuit artifact: ${url} (${response.status})`);
    }
    return verifySha256(new Uint8Array(await response.arrayBuffer()), entry.sha256, url);
  }
}
