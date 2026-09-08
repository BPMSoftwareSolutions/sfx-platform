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
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
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
if (result.status !== 0) process.exit(result.status ?? 1);
if (verifyOnly) process.exit(0);

/**
 * Confirm the restore actually delivered the selected publication.
 *
 * A restore that silently produced the wrong generation — or nothing — would otherwise only
 * surface inside the Docker build. This check needs no dependencies, so it runs on a bare runner:
 * the publication manifest pins the visual publication's digest, and the restore just wrote it.
 */
const manifestPath = join(ROOT, 'generated', 'publication-manifest.json');
const visualPath = join(ROOT, 'generated', 'visual-publication.json');

if (!existsSync(visualPath)) {
  console.error('The restore did not write generated/visual-publication.json.');
  process.exit(1);
}

const pinned = JSON.parse(readFileSync(manifestPath, 'utf8')).artifacts['visual-publication.json'];
const actual = `sha256:${createHash('sha256').update(readFileSync(visualPath)).digest('hex')}`;

if (pinned !== actual) {
  console.error('The restored media publication is not the one this release selected.');
  console.error(`  selected: ${pinned}`);
  console.error(`  restored: ${actual}`);
  console.error('SQL is serving a different generation than generated/publication-manifest.json pins.');
  process.exit(1);
}

const files = Object.keys(JSON.parse(readFileSync(visualPath, 'utf8')).artifacts).length;
console.log(`Restored publication matches the selected release: ${files} files, ${actual.slice(0, 19)}…`);
