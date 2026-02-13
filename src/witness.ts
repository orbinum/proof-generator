/**
 * Witness Generation Module
 *
 * Uses snarkjs to calculate witness from circuit inputs
 */

import * as snarkjs from 'snarkjs';
import * as fs from 'fs';
import { CircuitInputs, WitnessData } from './types';
import { witnessToHexLE } from './utils';

/**
 * Calculate witness using snarkjs
 *
 * @param inputs - Circuit inputs (key-value pairs)
 * @param wasmPath - Path to circuit WASM file
 * @returns Witness data as hex-encoded strings (little-endian)
 */
export async function calculateWitness(
  inputs: CircuitInputs,
  wasmPath: string
): Promise<WitnessData> {
  // Temporary path for witness file
  const wtnsPath = `/tmp/witness_${Date.now()}.wtns`;

  try {
    // Step 1: Calculate witness using snarkjs
    await snarkjs.wtns.calculate(inputs, wasmPath, wtnsPath);

    // Step 2: Export witness to JSON
    const witnessArray: any = await snarkjs.wtns.exportJson(wtnsPath);

    // Step 3: Convert to hex little-endian format
    const witnessHex = witnessToHexLE(witnessArray.map((w: any) => BigInt(w)));

    return {
      witness: witnessHex,
    };
  } finally {
    // Cleanup temporary file
    if (fs.existsSync(wtnsPath)) {
      fs.unlinkSync(wtnsPath);
    }
  }
}
