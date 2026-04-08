import type { ArtifactProvider } from '../providers/interface';

export interface GenerateOptions {
  verbose?: boolean;
  provider?: ArtifactProvider;
  /** Proof generation backend. Defaults to `'snarkjs'`. */
  backend?: 'snarkjs' | 'arkworks';
}
