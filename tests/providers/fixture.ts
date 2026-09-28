/**
 * A throwaway `@orbinum/circuits`-shaped package: a manifest with v1 and v2 of
 * unshield and transfer, and files whose sha256 the manifest records.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const sha = (data: string) => createHash('sha256').update(data).digest('hex');

export function writeCircuitsPackage(): { root: string; manifest: any } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orbinum-circuits-'));
  const circuits: Record<string, unknown> = {};
  for (const circuit of ['unshield', 'transfer']) {
    const versions: Record<string, unknown> = {};
    for (const version of [1, 2]) {
      const name = version === 1 ? circuit : `${circuit}_v${version}`;
      const files = { wasm: `${name}.wasm`, zkey: `${name}_pk.zkey`, ark: `${name}_pk.ark` };
      const artifacts: Record<string, unknown> = {};
      for (const [kind, file] of Object.entries(files)) {
        const content = `fake-${file}`;
        fs.writeFileSync(path.join(root, file), content);
        artifacts[kind] = { file, bytes: content.length, sha256: sha(content) };
      }
      versions[String(version)] = {
        version,
        vk_hash: `0x${String(version).repeat(64)}`,
        artifacts,
      };
    }
    circuits[circuit] = { active_version: 2, supported_versions: [1, 2], versions };
  }
  const manifest = {
    schema_version: '1.0.0',
    package_name: 'orbinum-circuits',
    package_version: '0.15.0',
    generated_at: '2026-09-28T00:00:00.000Z',
    circuits,
  };
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest));
  return { root, manifest };
}
