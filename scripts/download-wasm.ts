/**
 * Download precompiled WASM package from GitHub releases
 *
 * Downloads groth16-proofs WASM package containing:
 * - groth16_proofs_bg.wasm (compiled Rust code)
 * - groth16_proofs.js (JavaScript bindings)
 * - TypeScript definitions
 */

import * as fs from 'fs';
import * as path from 'path';
import { getLatestReleaseTag, downloadAndExtract } from './utils';

const PROOF_GEN_REPO = 'orbinum/groth16-proofs';
const WASM_PKG_DIR = path.join(process.cwd(), 'groth16-proof');

const REQUIRED_FILES = ['groth16_proofs_bg.wasm', 'groth16_proofs.js', 'groth16_proofs.d.ts'];

/**
 * Check if WASM package exists
 */
function wasmPackExists(): boolean {
  if (!fs.existsSync(WASM_PKG_DIR)) {
    return false;
  }

  return REQUIRED_FILES.every(file => fs.existsSync(path.join(WASM_PKG_DIR, file)));
}

/**
 * Download WASM package
 */
export async function downloadWasmPackage(): Promise<void> {
  if (wasmPackExists()) {
    console.log('[✓] WASM package already exists, skipping download');
    return;
  }

  try {
    console.log(`[+] Fetching latest proof-generator version...`);
    const release = await getLatestReleaseTag(PROOF_GEN_REPO);
    console.log(`[✓] Latest version: ${release.tag_name}`);

    // Look for orb-groth16-proof.tar.gz asset
    const wasmAsset = release.assets.find(asset => asset.name === 'orb-groth16-proof.tar.gz');

    if (!wasmAsset) {
      throw new Error('orb-groth16-proof.tar.gz not found in release assets');
    }

    console.log(`[+] Downloading WASM package from GitHub releases...`);
    await downloadAndExtract(wasmAsset.browser_download_url, WASM_PKG_DIR);

    // Remove .gitignore from extracted tarball to allow npm to include files
    const gitignorePath = path.join(WASM_PKG_DIR, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      fs.unlinkSync(gitignorePath);
      console.log('[✓] Removed .gitignore from WASM package');
    }

    console.log('[✓] WASM package downloaded successfully');

    const missing = REQUIRED_FILES.filter(file => !fs.existsSync(path.join(WASM_PKG_DIR, file)));
    if (missing.length > 0) {
      throw new Error(`Missing files: ${missing.join(', ')}`);
    }

    console.log('[✓] WASM package is ready');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[!] Error downloading WASM package:', message);
    console.error('\nYou can download manually from:');
    console.error(`https://github.com/${PROOF_GEN_REPO}/releases`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  downloadWasmPackage().catch(err => {
    console.error('[!] Unexpected error:', err);
    process.exit(1);
  });
}

export { wasmPackExists };
