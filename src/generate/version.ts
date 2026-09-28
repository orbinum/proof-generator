import { CircuitType } from '../circuits/types';
import { CircuitVersionMismatchError } from '../errors';
import type { ArtifactProvider } from '../providers/interface';

/**
 * The circuit version a proof is built for.
 *
 * The provider is the authority when it can say which version its artifacts
 * belong to; a caller-supplied `requested` version must then agree with it.
 * Otherwise the proof would be checked against one version's arity while being
 * built from another's artifacts. A provider that cannot say uses `requested`,
 * or version 1.
 */
export async function resolveCircuitVersion(
  provider: ArtifactProvider,
  circuitType: CircuitType,
  requested: number | undefined
): Promise<number> {
  if (!provider.getResolvedVersion) return requested ?? 1;
  const { version } = await provider.getResolvedVersion(circuitType);
  if (requested !== undefined && requested !== version) {
    throw new CircuitVersionMismatchError(circuitType, requested, version);
  }
  return version;
}
