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
  type ResolvedVersionData,
} from './manifest';
import { CIRCUITS_PINS, type CircuitVersionPin, type CircuitsPins } from './pins';

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
  /**
   * The vk_hash and sha256 each circuit version must have. Defaults to the
   * pins embedded at build time from the `@orbinum/circuits` dependency;
   * override only for tests.
   */
  pins?: CircuitsPins;
};

/**
 * Artifact provider for browser and mobile environments.
 *
 * Fetches `manifest.json` and resolves each circuit's version and artifact
 * files from it, but trusts it for nothing else: the manifest comes from the
 * same CDN or mirror as the artifacts, so a hostile one could make both agree.
 * Every download is verified against the sha256 pinned at build time, and the
 * reported vk_hash is the pinned one. A version without a pin, or a manifest
 * that disagrees with its pin, throws. There is no unverified mode.
 */
export class WebArtifactProvider implements ArtifactProvider {
  private readonly baseUrl: string;
  private readonly circuitVersions: CircuitVersions;
  private readonly pins: CircuitsPins;
  private manifestPromise: Promise<CircuitsManifest> | null = null;

  constructor(options?: WebProviderOptions) {
    const base = options?.baseUrl?.replace(/\/$/, '').replace(/\/manifest\.json$/, '');
    this.baseUrl = base || DEFAULT_BASE_URL;
    this.circuitVersions = options?.circuitVersions ?? {};
    this.pins = options?.pins ?? CIRCUITS_PINS;
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

  /** The version the manifest resolves to, with its pin; fail-closed on any disagreement. */
  private async resolve(
    circuitType: CircuitType
  ): Promise<{ resolved: ResolvedVersionData; pin: CircuitVersionPin }> {
    const resolved = resolveVersionData(
      await this.getManifest(),
      circuitType,
      this.circuitVersions
    );
    return { resolved, pin: checkPin(this.pins, circuitType, resolved) };
  }

  /**
   * The version, package version and vk_hash the provider serves for a circuit,
   * so a consumer can cross-check the vk_hash against the chain before proving.
   * The vk_hash is the pinned one.
   */
  async getResolvedVersion(circuitType: CircuitType): Promise<ResolvedCircuitVersion> {
    const { resolved, pin } = await this.resolve(circuitType);
    return { ...toResolvedCircuitVersion(resolved), vkHash: pin.vk_hash };
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

  /** Downloads one artifact, served next to the manifest, and verifies it against its pin. */
  private async fetchArtifact(type: CircuitType, kind: ArtifactKind): Promise<Uint8Array> {
    const { resolved, pin } = await this.resolve(type);
    const entry = artifactEntry(type, resolved, kind);
    const expected = pin.sha256[kind];
    if (!expected) {
      throw new Error(
        `Circuit "${type}" v${resolved.version}: no pinned sha256 for the "${kind}" artifact`
      );
    }
    const url = `${this.baseUrl}/${entry.file}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch circuit artifact: ${url} (${response.status})`);
    }
    return verifySha256(new Uint8Array(await response.arrayBuffer()), expected, url);
  }
}

/**
 * The pin for a resolved version. Throws if there is none, or if the manifest's
 * vk_hash or any artifact sha256 differs from it — a manifest that disagrees
 * with this build is not one it can prove with.
 */
function checkPin(
  pins: CircuitsPins,
  circuitType: CircuitType,
  { version, versionData }: ResolvedVersionData
): CircuitVersionPin {
  const label = `Circuit "${circuitType}" v${version}`;
  const pin = pins[circuitType]?.[String(version)];
  if (!pin) {
    throw new Error(
      `${label} is not pinned in this build of @orbinum/proof-generator; ` +
        `update the package or pin a known version with circuitVersions`
    );
  }
  if (versionData.vk_hash?.toLowerCase() !== pin.vk_hash.toLowerCase()) {
    throw new Error(
      `${label}: manifest vk_hash ${versionData.vk_hash} does not match the pinned ${pin.vk_hash}`
    );
  }
  for (const [kind, entry] of Object.entries(versionData.artifacts)) {
    const expected = pin.sha256[kind as ArtifactKind];
    if (expected && entry?.sha256?.toLowerCase() !== expected.toLowerCase()) {
      throw new Error(
        `${label}: manifest sha256 for "${kind}" does not match the pinned ${expected}`
      );
    }
  }
  return pin;
}
