#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pemPath = path.join(here, 'certs', 'localhost.pem');

// Node 20 does not read the OS root store, so hand it the exported public
// certificate through NODE_EXTRA_CA_CERTS and re-exec once when needed.
function ensureNodeTrustsFixtureCa() {
  if (process.env.SFX_FIXTURE_CA_REEXEC === '1') return;
  if (!fs.existsSync(pemPath)) {
    console.error(`[check-fixture] missing ${pemPath}; run setup-cert.ps1 first`);
    process.exit(1);
  }
  const wanted = path.resolve(pemPath);
  const current = (process.env.NODE_EXTRA_CA_CERTS ?? '')
    .split(path.delimiter)
    .filter(Boolean)
    .map((entry) => path.resolve(entry));
  if (current.includes(wanted)) return;
  const combined = [...current, wanted].join(path.delimiter);
  console.log(`[check-fixture] re-exec with NODE_EXTRA_CA_CERTS=${combined}`);
  const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, NODE_EXTRA_CA_CERTS: combined, SFX_FIXTURE_CA_REEXEC: '1' },
  });
  process.exit(child.status ?? 1);
}

ensureNodeTrustsFixtureCa();

const port = Number.parseInt(process.env.FIXTURE_PORT ?? '8788', 10);
const url = `https://localhost:${port}/delay?ms=200`;

try {
  const started = performance.now();
  const response = await fetch(url);
  const body = await response.text();
  const elapsedMs = performance.now() - started;
  console.log(`GET ${url}`);
  console.log(`status ${response.status}`);
  console.log(`elapsedMs ${elapsedMs.toFixed(1)}`);
  console.log(`body ${body}`);
  if (!response.ok) throw new Error(`unexpected status ${response.status}`);
  console.log('CHECK_FIXTURE_OK');
} catch (error) {
  console.error(`CHECK_FIXTURE_FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
