/**
 * Download ZK circuit artifacts from GitHub releases
 *
 * Downloads circuit files needed for proof generation:
 * - *.wasm (witness calculators for snarkjs)
 * - *_pk.ark (proving keys for arkworks)
 */

import * as fs from 'fs';
import * as path from 'path';
import { getLatestReleaseTag, downloadAndExtract } from './utils';

const CIRCUITS_REPO = 'orbinum/circuits';
const CIRCUITS_DIR = path.join(process.cwd(), 'circuits');

const REQUIRED_FILES = [
  'unshield.wasm',
  'unshield_pk.ark',
  'transfer.wasm',
  'transfer_pk.ark',
  'disclosure.wasm',
  'disclosure_pk.ark',
];

/**
 * Check if all required circuit artifacts exist
 */
function circuitsExist(): boolean {
  if (!fs.existsSync(CIRCUITS_DIR)) {
    return false;
  }

  return REQUIRED_FILES.every(file => fs.existsSync(path.join(CIRCUITS_DIR, file)));
}

/**
 * Download circuits
 */
export async function downloadCircuits(): Promise<void> {
  if (circuitsExist()) {
    console.log('[✓] Circuits already exist, skipping download');
    return;
  }

  try {
    console.log(`[+] Fetching latest circuits version...`);
    const release = await getLatestReleaseTag(CIRCUITS_REPO);
    console.log(`[✓] Latest version: ${release.tag_name}`);

    console.log(`[+] Downloading circuits from GitHub releases...`);
    const releaseUrl = `https://github.com/${CIRCUITS_REPO}/releases/download/${release.tag_name}/orbinum-circuits-${release.tag_name}.tar.gz`;

    await downloadAndExtract(releaseUrl, CIRCUITS_DIR, (filePath: string) => {
      const filename = filePath.split('/').pop();
      return filename ? REQUIRED_FILES.includes(filename) : false;
    });

    console.log('[✓] Circuits downloaded successfully');

    const missing = REQUIRED_FILES.filter(file => !fs.existsSync(path.join(CIRCUITS_DIR, file)));
    if (missing.length > 0) {
      throw new Error(`Missing files: ${missing.join(', ')}`);
    }

    console.log('[✓] All required circuits are available');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[!] Error downloading circuits:', message);
    console.error('\nYou can download manually from:');
    console.error(`https://github.com/${CIRCUITS_REPO}/releases`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  downloadCircuits().catch(err => {
    console.error('[!] Unexpected error:', err);
    process.exit(1);
  });
}

export { circuitsExist };
