#!/usr/bin/env node
// verify-kind-tooling.mjs — dry-run verifier for new-component.mjs and
// new-reader.mjs. Dependency-free; every generated artifact lands in a fresh
// temporary directory that is removed afterwards. No production path is
// edited and nothing is committed.
//
//   node tools/live-circuit/verify-kind-tooling.mjs
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const scratch = await mkdtemp(path.join(os.tmpdir(), 'sfx-kind-tooling-'));
const checks = [];
const record = (name, pass, detail) => {
  checks.push({ name, pass: Boolean(pass), detail: detail ?? '' });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` · ${detail}` : ''}`);
};
const exists = async file => { try { await stat(file); return true; } catch { return false; } };
function run(args) {
  return spawnSync(process.execPath, args, { cwd: repoRoot, encoding: 'utf8', windowsHide: true });
}

try {
  // --- new-component scaffold mode -----------------------------------------
  const badgeDir = path.join(scratch, 'badge');
  const scaffold = run(['tools/live-circuit/new-component.mjs', 'badge',
    '--roles', 'label,tone', '--props', 'status,id', '--out', badgeDir]);
  record('component-scaffold-exit', scaffold.status === 0, `exit=${scaffold.status} ${scaffold.stderr.trim() || scaffold.stdout.trim().split('\n')[0]}`);
  const badgeFiles = ['badge.contract.json', 'badge.adapter.mjs', 'badge.parity.json', 'badge.acceptance.md'];
  for (const file of badgeFiles) record(`component-scaffold-file ${file}`, await exists(path.join(badgeDir, file)), '');
  const contract = JSON.parse(await readFile(path.join(badgeDir, 'badge.contract.json'), 'utf8'));
  record('component-contract-shape', contract.document === 'ui-component.v1' && contract.kind === 'badge'
    && contract.version === 1 && contract.roles.join(',') === 'label,tone'
    && Object.keys(contract.props).join(',') === 'status,id', JSON.stringify(contract));
  const stub = await import(pathToFileURL(path.join(badgeDir, 'badge.adapter.mjs')).href);
  record('component-stub-supportedRoles', stub.UI_COMPONENT_ROLES?.badge?.version === 1
    && stub.supportedRoles?.join(',') === 'label,tone,status,id', `supportedRoles=[${stub.supportedRoles?.join(',')}]`);
  const parity = JSON.parse(await readFile(path.join(badgeDir, 'badge.parity.json'), 'utf8'));
  record('component-parity-sentinels', parity.kind === 'badge' && parity.sentinels.label === 'sentinel-label'
    && parity.section.props.tone === 'sentinel-tone' && parity.section.bindings.status.value === 'sentinel-status', '');

  // --- new-component --check mode (positive, negative, shipped ten) --------
  const positive = run(['tools/live-circuit/new-component.mjs', '--check', path.join(badgeDir, 'badge.contract.json'),
    '--ui-components', path.join(badgeDir, 'badge.adapter.mjs')]);
  record('component-check-positive', positive.status === 0 && /"failed": 0/.test(positive.stdout), `exit=${positive.status}`);
  const tampered = JSON.parse(await readFile(path.join(badgeDir, 'badge.contract.json'), 'utf8'));
  tampered.roles.push('ghost');
  const tamperedFile = path.join(badgeDir, 'badge.contract.tampered.json');
  await writeFile(tamperedFile, JSON.stringify(tampered, null, 2), 'utf8');
  const negative = run(['tools/live-circuit/new-component.mjs', '--check', tamperedFile,
    '--ui-components', path.join(badgeDir, 'badge.adapter.mjs')]);
  record('component-check-negative', negative.status === 1 && /contract-role-parity/.test(negative.stdout), `exit=${negative.status}`);
  const shipped = run(['tools/live-circuit/new-component.mjs', '--check']);
  record('component-check-shipped-ten', shipped.status === 0 && /shipped-ten-role-parity/.test(shipped.stdout)
    && /shipped-ten-allowlist/.test(shipped.stdout), `exit=${shipped.status}`);

  // --- new-reader scaffold, list and refusal modes -------------------------
  const readerDir = path.join(scratch, 'standards-crosswalk');
  const reader = run(['tools/live-circuit/new-reader.mjs', 'standards-crosswalk', '--fields', 'crosswalkId', '--out', readerDir]);
  record('reader-scaffold-exit', reader.status === 0, `exit=${reader.status} ${reader.stderr.trim()}`);
  const readerFiles = ['CHECKLIST.md', 'estate/standards-crosswalk.reading.preflight.sql', 'estate/standards-crosswalk.reading.commit.sql',
    'platform/circuit-host.readers.patch.json', 'platform/live-store.reader.patch.mjs',
    'platform/ui-registry.source.patch.json', 'platform/accept.pins.patch.txt'];
  for (const file of readerFiles) record(`reader-scaffold-file ${file}`, await exists(path.join(readerDir, file)), '');
  const checklist = await readFile(path.join(readerDir, 'CHECKLIST.md'), 'utf8');
  record('reader-cost-itemisation', checklist.includes('One-time (paid in Phase 0 / K1-K4)') && checklist.includes('| Per reader |')
    && checklist.includes('hand-owned in-transaction proof') && checklist.includes('~30-80'), '');
  const readersPatch = JSON.parse(await readFile(path.join(readerDir, 'platform/circuit-host.readers.patch.json'), 'utf8'));
  record('reader-host-patch', readersPatch.readers['standards-crosswalk']?.outputContractId === 'standards-crosswalk.v1', '');
  const pins = await readFile(path.join(readerDir, 'platform/accept.pins.patch.txt'), 'utf8');
  record('reader-accept-pins', pins.includes("['/api/circuit/v1/standards-crosswalk', 'GET', 200]"), '');
  const listing = run(['tools/live-circuit/new-reader.mjs', 'second-reader', '--list', '--out', path.join(scratch, 'second-reader')]);
  record('reader-list-dry-run', listing.status === 0 && !(await exists(path.join(scratch, 'second-reader'))), `exit=${listing.status}`);
  const refused = run(['tools/live-circuit/new-reader.mjs', 'third-reader', '--method', 'POST']);
  record('reader-refuses-method', refused.status === 1 && /GET-only/.test(refused.stderr), `exit=${refused.status}`);
  const collision = run(['tools/live-circuit/new-reader.mjs', 'catalog', '--out', path.join(scratch, 'catalog')]);
  record('reader-refuses-collision', collision.status === 1 && /already declares the reader/.test(collision.stderr), `exit=${collision.status}`);
} finally {
  await rm(scratch, { recursive: true, force: true });
}

const summary = {
  tool: 'verify-kind-tooling.mjs',
  scratch: '<temporary, removed>',
  checkedAt: new Date().toISOString(),
  passed: checks.filter(check => check.pass).length,
  failed: checks.filter(check => !check.pass).length,
  checks,
};
console.log(JSON.stringify(summary, null, 2));
process.exitCode = summary.failed > 0 ? 1 : 0;
