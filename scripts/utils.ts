/**
 * Shared utilities for downloading artifacts from GitHub releases
 */

import * as https from 'https';
import { IncomingMessage } from 'http';

export interface Release {
  tag_name: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
  }>;
}

/**
 * Get the latest release tag from GitHub API
 */
export async function getLatestReleaseTag(repo: string): Promise<Release> {
  const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;

  return new Promise((resolve, reject) => {
    https
      .get(
        apiUrl,
        {
          headers: {
            'User-Agent': 'orbinum-proof-generator',
          },
        },
        (response: IncomingMessage) => {
          if (response.statusCode !== 200) {
            reject(new Error(`Failed to fetch latest release: ${response.statusCode}`));
            return;
          }

          let data = '';
          response.on('data', chunk => (data += chunk));
          response.on('end', () => {
            try {
              const release: Release = JSON.parse(data);
              resolve(release);
            } catch (error) {
              reject(
                new Error(
                  `Failed to parse release data: ${error instanceof Error ? error.message : String(error)}`
                )
              );
            }
          });
        }
      )
      .on('error', reject);
  });
}

/**
 * Download file from URL and extract to target directory
 */
export async function downloadAndExtract(
  releaseUrl: string,
  targetDir: string,
  filter?: (filePath: string) => boolean
): Promise<void> {
  const { createGunzip } = require('zlib');
  const tar = require('tar');
  const fs = require('fs');

  return new Promise((resolve, reject) => {
    https
      .get(releaseUrl, (response: IncomingMessage) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          const location = response.headers.location;
          if (location) {
            https.get(location, handleDownload);
          } else {
            reject(new Error('Redirect location not found'));
          }
        } else if (response.statusCode === 200) {
          handleDownload(response);
        } else {
          reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        }

        function handleDownload(res: IncomingMessage) {
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }

          const gunzip = createGunzip();
          const extract = tar.extract({
            cwd: targetDir,
            filter: filter || (() => true),
          });

          res.pipe(gunzip).pipe(extract);

          extract.on('finish', resolve);
          extract.on('error', reject);
          gunzip.on('error', reject);
        }
      })
      .on('error', reject);
  });
}
