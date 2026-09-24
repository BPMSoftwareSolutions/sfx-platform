#!/usr/bin/env node
/**
 * Circuit presentation publication — D3 / implementation plan phases 2-3.
 *
 * The estate declares the presentation policy through the `read-circuit-presentation` declared
 * read. This publishes the observed value into `generated/circuit-presentation.json`, so the
 * website reads one approved artifact and never invokes a kernel at request time.
 *
 *   node scripts/publish-circuit-presentation.mjs [--source <observed.json>] [--cwd <estate root>] [--allow-missing]
 *
 * Without `--source` the value is read through the kernel CLI, in the estate project that owns
 * `sfx.config.json` (default: a sibling `sfx-embody` checkout, or `SIDEFX_EMBODY_ROOT`). The
 * artifact is content only: identity, materials, grain. No configuration or credential value is
 * carried by the policy or written here.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT_DIR = join(ROOT, 'generated');
const OUT_FILE = join(OUT_DIR, 'circuit-presentation.json');

const args = process.argv.slice(2);
const argValue = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const allowMissing = args.includes('--allow-missing');
const sourceFile = argValue('--source');

function estateRoot() {
  const candidates = [
    argValue('--cwd'),
    process.env.SIDEFX_EMBODY_ROOT,
    resolve(ROOT, '..', 'sfx-embody'),
    resolve(ROOT, '..', '..', 'sfx-embody'),
  ].filter((path) => typeof path === 'string' && path.length > 0);
  return candidates.find((path) => existsSync(join(path, 'sfx.config.json'))) ?? null;
}

function readDeclaredPolicy() {
  if (sourceFile) return readFileSync(sourceFile, 'utf8');
  const cwd = estateRoot();
  if (!cwd) {
    throw new Error('Could not find the estate project (sfx-embody). Pass --cwd or set SIDEFX_EMBODY_ROOT.');
  }
  const result = spawnSync(
    'sfx',
    ['capability', 'invoke', 'read-circuit-presentation', '--json', '--input', '{}'],
    { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: true, windowsHide: true },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`The declared read failed with status ${result.status}: ${(result.stderr || result.stdout || '').trim()}`);
  }
  const text = (result.stdout ?? '').trim();
  if (!text.startsWith('{')) throw new Error('The declared read returned no policy document.');
  return text;
}

function assertPolicy(value) {
  const fail = (message) => {
    throw new Error(`The observed circuit presentation policy is not usable: ${message}`);
  };
  if (value?.policyType !== 'circuit-presentation.v1') fail('policyType is not circuit-presentation.v1');
  const materials = value?.materials;
  if (!materials || typeof materials !== 'object') fail('materials is absent');
  for (const map of ['boundary', 'byAuthority', 'byEdgeKind']) {
    const entries = materials[map];
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) fail(`materials.${map} is absent`);
    if (map !== 'boundary' && Object.keys(entries).length === 0) fail(`materials.${map} is empty`);
  }
  if (typeof value?.granularity?.node !== 'string' || value.granularity.node.length === 0) {
    fail('granularity.node is not declared');
  }
  return value;
}

mkdirSync(OUT_DIR, { recursive: true });

let observed;
try {
  observed = readDeclaredPolicy();
} catch (error) {
  if (!allowMissing) {
    console.error(String(error.message ?? error));
    process.exit(1);
  }
  console.warn(`${error.message ?? error}; keeping the existing publication.`);
  process.exit(0);
}

const policy = assertPolicy(JSON.parse(observed));
const tmp = `${OUT_FILE}.tmp`;
writeFileSync(tmp, `${JSON.stringify(policy, null, 2)}\n`);
renameSync(tmp, OUT_FILE);

console.log(`Published ${OUT_FILE}`);
console.log(
  `  ${Object.keys(policy.materials.byAuthority).length} authorities · ` +
    `${Object.keys(policy.materials.byEdgeKind).length} edge kinds · ` +
    `grain ${policy.granularity.node}`,
);
