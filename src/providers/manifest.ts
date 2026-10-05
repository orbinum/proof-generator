/**
 * The `@orbinum/circuits` manifest: its shape, and the rules both providers
 * resolve a circuit version and its artifact files by.
 */
import { CircuitType } from '../circuits/types';
import type { ResolvedCircuitVersion } from './interface';

/**
 * The `@orbinum/circuits` release this package proves with. The Node provider
 * reads it from the installed dependency; the web provider fetches it from the
 * CDN. Kept equal to the dependency in package.json by a test.
 */
export const CIRCUITS_PACKAGE_VERSION = '0.16.0';

export type ArtifactKind = 'wasm' | 'zkey' | 'ark' | 'vk_json' | 'r1cs';

export interface ManifestArtifactEntry {
  file: string;
  bytes: number;
  sha256: string;
}

export interface ManifestCircuitVersion {
  version: number;
  vk_hash: string;
  artifacts: Partial<Record<ArtifactKind, ManifestArtifactEntry>>;
}

export interface ManifestCircuit {
  active_version: number;
  supported_versions: number[];
  versions: Record<string, ManifestCircuitVersion>;
}

export interface CircuitsManifest {
  schema_version: string;
  package_name: string;
  package_version: string;
  generated_at: string;
  circuits: Record<string, ManifestCircuit>;
}

/** Per-circuit version overrides, e.g. `{ unshield: 1 }`. */
export type CircuitVersions = Partial<Record<string, number>>;

/** One circuit version as the manifest describes it. */
export interface ResolvedVersionData {
  version: number;
  versionData: ManifestCircuitVersion;
  packageVersion: string;
}

/**
 * The version a circuit resolves to — the override, else the manifest's
 * `active_version` — with its manifest entry. Fail-closed: an unknown circuit,
 * a malformed override, or a version the manifest does not support throws.
 */
export function resolveVersionData(
  manifest: CircuitsManifest,
  circuitType: CircuitType,
  overrides: CircuitVersions
): ResolvedVersionData {
  const circuitName = circuitType as string;
  const circuit = manifest.circuits?.[circuitName];
  if (!circuit) {
    throw new Error(`Circuit "${circuitName}" not found in manifest`);
  }

  const version = overrides[circuitName] ?? circuit.active_version;
  if (!Number.isInteger(version) || version < 1) {
    throw new Error(`Circuit "${circuitName}": invalid version ${String(version)}`);
  }
  if (!circuit.supported_versions.includes(version)) {
    throw new Error(
      `Circuit "${circuitName}" v${version} is no longer supported. ` +
        `Supported versions: [${circuit.supported_versions.join(', ')}]`
    );
  }

  const versionData = circuit.versions[String(version)];
  if (!versionData) {
    throw new Error(`Circuit "${circuitName}" v${version} not found in manifest`);
  }
  return { version, versionData, packageVersion: manifest.package_version };
}

/** What a provider reports about the version it serves. */
export function toResolvedCircuitVersion({
  version,
  versionData,
  packageVersion,
}: ResolvedVersionData): ResolvedCircuitVersion {
  return { version, packageVersion, vkHash: versionData.vk_hash };
}

/**
 * The manifest entry for one artifact. Its file name must be a bare name: it is
 * joined onto a directory or a base URL, and a manifest from a mirror must not
 * be able to point outside it.
 */
export function artifactEntry(
  circuitType: CircuitType,
  { version, versionData }: ResolvedVersionData,
  kind: ArtifactKind
): ManifestArtifactEntry {
  const entry = versionData.artifacts[kind];
  if (!entry) {
    throw new Error(
      `Circuit "${circuitType}" v${version} has no "${kind}" artifact in the manifest`
    );
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(entry.file) || entry.file.includes('..')) {
    throw new Error(
      `Circuit "${circuitType}" v${version}: unsafe artifact file name "${entry.file}"`
    );
  }
  return entry;
}
