/**
 * Download all required artifacts from GitHub releases
 *
 * Downloads in parallel:
 * - Circuit artifacts (from orbinum/circuits)
 * - WASM package (from groth16-proofs)
 */

import { downloadCircuits } from './download-circuits';
import { downloadWasmPackage } from './download-wasm';

async function main(): Promise<void> {
  try {
    console.log('[*] Downloading required artifacts...\n');

    // Download circuits and WASM in parallel
    const [circuitResult, wasmResult] = await Promise.allSettled([
      downloadCircuits(),
      downloadWasmPackage(),
    ]);

    // Check for errors
    if (circuitResult.status === 'rejected') {
      throw new Error(`Circuits download failed: ${circuitResult.reason}`);
    }
    if (wasmResult.status === 'rejected') {
      throw new Error(`WASM download failed: ${wasmResult.reason}`);
    }

    console.log('\n[✓] All artifacts downloaded successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[!] Download failed:', message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
