#!/usr/bin/env node
/**
 * Restore `public/media` from SQL.
 *
 * The media publication is generated content that SQL retains in full — every one of its files is
 * listed in `generated/visual-publication.json` and reconstructible byte for byte. It is therefore
 * not committed: the repository carries the code, and the bytes are restored here before a build.
 *
 *   node scripts/restore-media.mjs [--verify-only]
 *
 * The restore itself lives in the database repository, which owns the media schema and the only
 * database client. This wrapper locates that checkout and runs it against this working tree.
 *
 * Set SIDEFX_DATABASE_ROOT to point at the checkout; the defaults cover a sibling clone locally
 * and the path CI checks it out to.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const CANDIDATES = [
  process.env.SIDEFX_DATABASE_ROOT,
  join(ROOT, '.sidefx-database'),
  resolve(ROOT, '..', '..', 'sidefx-database'),
  resolve(ROOT, '..', 'sidefx-database'),
].filter((path) => typeof path === 'string' && path.length > 0);

const databaseRoot = CANDIDATES.find(
  (path) => path && existsSync(join(path, 'src', 'media', 'restore-website.mjs')),
);

if (!databaseRoot) {
  console.error('Could not find the sidefx-database checkout. Looked in:');
  for (const path of CANDIDATES) console.error(`  ${path}`);
  console.error('Set SIDEFX_DATABASE_ROOT to its location.');
  process.exit(1);
}

// The restore reads its own connection string from the environment; this wrapper never handles it.
if (!process.env['sidefx-connection-string'] && !process.env.SIDEFX_CONNECTION_STRING) {
  console.error('No database connection string in the environment.');
  console.error('Set SIDEFX_CONNECTION_STRING (or sidefx-connection-string) and try again.');
  process.exit(1);
}

const verifyOnly = process.argv.includes('--verify-only');
const args = ['src/media/restore-website.mjs', ...(verifyOnly ? ['--verify-only'] : ['--output', ROOT])];

const result = spawnSync(process.execPath, args, {
  cwd: databaseRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    // Accept either spelling so CI secrets and local shells agree.
    'sidefx-connection-string':
      process.env['sidefx-connection-string'] ?? process.env.SIDEFX_CONNECTION_STRING ?? '',
  },
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
