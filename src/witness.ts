/**
 * Witness Generation Module
 *
 * Uses snarkjs to calculate witness from circuit inputs
 */

import * as snarkjs from 'snarkjs';
import * as fs from 'fs';
import { CircuitInputs, WitnessData } from './types';

/**
 * Calculate witness using snarkjs
 *
 * @param inputs - Circuit inputs (key-value pairs)
 * @param wasmPath - Path to circuit WASM file
 * @returns Witness data as decimal strings (native snarkjs format)
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

    // Step 2: Export witness to JSON (decimal format - native!)
    const witnessArray: any = await snarkjs.wtns.exportJson(wtnsPath);

    // Step 3: Convert to string array (snarkjs returns string[] already)
    const witnessDecimal = witnessArray.map((w: any) => String(w));

    return {
      witness: witnessDecimal,
    };
  } finally {
    // Cleanup temporary file
    if (fs.existsSync(wtnsPath)) {
      fs.unlinkSync(wtnsPath);
    }
  }
}
