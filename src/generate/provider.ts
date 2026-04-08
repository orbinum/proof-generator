import { ArtifactProvider } from '../providers/interface';
import { NodeArtifactProvider, WebArtifactProvider } from '../providers';

/**
 * Returns the caller-supplied provider, or auto-detects Node.js vs browser
 * and instantiates the appropriate default provider.
 */
export function resolveProvider(override?: ArtifactProvider): ArtifactProvider {
  if (override) return override;
  return typeof window !== 'undefined' || typeof self !== 'undefined'
    ? new WebArtifactProvider()
    : new NodeArtifactProvider();
}
