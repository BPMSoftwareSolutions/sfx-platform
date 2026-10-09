// Offline release gates: no Azure, no staging slot and no live model. Each entry
// names the defect it exists to catch. Gates run as separate processes (spare
// ports, isolated host environment, own temporary directories) with bounded
// concurrency, outside the staging lock. A required input that is missing fails
// as a configuration error; it never becomes skipped coverage.
//   node deploy/staging/offline-checks.mjs [--concurrency=<n>] [--only=<id,id>] [--list]
// Writes artifacts/checks/offline-checks.json (gate, result, duration) and one
// log per gate. SFX_UI_PROVIDER_DIR must name the release-pinned providers.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
export const OFFLINE_CHECKS = [
  { id: 'release-policy', prevents: 'Wrong image, unpinned sources, unauthorized binary change, wrong client-gate scope or unsafe rollback ownership',
    args: ['--test', 'deploy/staging/policy.test.mjs'] },
  { id: 'composite-package', prevents: 'Missing or misplaced release files and incorrect package inventory',
    args: ['deploy/sda-kernel/verify-composite-package.mjs'] },
  { id: 'identity-session', prevents: 'Broken cookie custody, origin checks, session forwarding, revocation or credential disclosure in host output',
    args: ['live-circuit/circuit/verify-identity-session.mjs'] },
  { id: 'replay-clock', prevents: 'Wrong receipt timing, rate scaling, pause/resume, sequencing or stalled-clock catch-up',
    args: ['live-circuit/circuit/verify-timing.mjs', 'docs/replay-timing-fidelity/scene.json', 'docs/replay-timing-fidelity/capture.sse'] },
  { id: 'scenario-return', prevents: 'Composed scenario calls staying dark despite admitted return receipts, or lighting without matching evidence',
    args: ['live-circuit/circuit/verify-scenario-return.mjs', 'docs/ui-landing-acceptance/scene.json', 'docs/ui-landing-acceptance/capture.sse'] },
  { id: 'run-api', prevents: 'Bad admission boundaries, credential forwarding, cursor routing or fragmented SSE handling',
    args: ['live-circuit/circuit/verify-run-api.mjs'] },
  { id: 'objective', prevents: 'Wrong objective admission or summary handling, or the module not being served',
    args: ['live-circuit/circuit/verify-objective.mjs'] },
  { id: 'provider-view', prevents: 'Wrong provider reader, unadmitted procedure, host selection not binding, or the retired renderer returning',
    args: ['live-circuit/circuit/verify-provider-profile.mjs'] },
  { id: 'declared-view', prevents: 'Wrong declared-view binding, host selection or refusal behavior',
    args: ['live-circuit/circuit/verify-view.mjs'] },
  { id: 'declared-regions', prevents: 'Missing or unsafe declared regions or incorrect provider responses', requires: ['SFX_UI_PROVIDER_DIR'],
    args: ['live-circuit/circuit/verify-region.mjs'] },
  { id: 'declared-pages', prevents: 'Invalid page declarations, unsafe values or incorrect digest/refusal handling',
    args: ['live-circuit/circuit/verify-pages.mjs', '--fixtures'] },
  { id: 'component-kinds', prevents: 'Declared component roles or properties silently ignored or rendered incorrectly',
    args: ['live-circuit/circuit/verify-components.mjs'] },
  { id: 'claims', prevents: 'Invalid claim vocabulary, provenance or freshness rules',
    args: ['live-circuit/circuit/verify-claims.mjs', '--fixtures'] },
  { id: 'kind-tooling', prevents: 'Broken component and reader scaffolding',
    args: ['tools/live-circuit/verify-kind-tooling.mjs'] },
  { id: 'run-scoped-sse', prevents: 'Cross-run leakage, wrong cursor replay or replay on live subscriptions',
    args: ['live-circuit/dispatch-pair/verify-run-scoped-sse.mjs'] },
  { id: 'observer-bridge', prevents: 'Overlapping runs mixed, or testimony altered by the bridge',
    args: ['deploy/sda-kernel/verify-observer-bridge.mjs'] },
];

function runCheck(check, logDirectory) {
  const startedAt = new Date(), missing = (check.requires ?? []).filter(name => !process.env[name]);
  const finish = (result, detail, output = '') => {
    fs.writeFileSync(path.join(logDirectory, `${check.id}.log`), output);
    return { id: check.id, prevents: check.prevents, command: ['node', ...check.args].join(' '), startedAt: startedAt.toISOString(),
      durationMilliseconds: Date.now() - startedAt.getTime(), result, detail };
  };
  if (missing.length) return Promise.resolve(finish('failed', `CONFIGURATION_REQUIRED: ${missing.join(', ')}`));
  return new Promise(resolve => {
    const child = spawn(process.execPath, check.args, { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
    child.on('error', error => resolve(finish('failed', `COMMAND_START_FAILED: ${error.message}`, output)));
    child.on('close', code => resolve(finish(code === 0 ? 'passed' : 'failed',
      code === 0 ? null : `exit ${code}: ${output.trim().split(/\r?\n/).filter(Boolean).at(-1)?.slice(0, 400) ?? ''}`, output)));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const flags = new Map(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')).map(([key, value]) => [key, value ?? true]));
  if (flags.has('list')) { for (const check of OFFLINE_CHECKS) console.log(`${check.id}\t${check.prevents}`); process.exit(0); }
  const only = typeof flags.get('only') === 'string' ? new Set(flags.get('only').split(',')) : null;
  const selected = OFFLINE_CHECKS.filter(check => !only || only.has(check.id));
  if (only && selected.length !== only.size) throw new Error('Unknown check id: ' + [...only].filter(id => !OFFLINE_CHECKS.some(c => c.id === id)).join(', '));
  const concurrency = Math.max(1, Number(flags.get('concurrency') ?? 4));
  const directory = path.join(root, 'artifacts/checks'), logs = path.join(directory, 'logs');
  fs.mkdirSync(logs, { recursive: true });
  const queue = [...selected], results = [], startedAt = Date.now();
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    for (let check = queue.shift(); check; check = queue.shift()) {
      const result = await runCheck(check, logs);
      results.push(result);
      console.log(`${result.result === 'passed' ? 'PASS' : 'FAIL'} ${result.id} (${(result.durationMilliseconds / 1000).toFixed(1)} s)${result.detail ? ' · ' + result.detail : ''}`);
    }
  }));
  results.sort((a, b) => selected.findIndex(c => c.id === a.id) - selected.findIndex(c => c.id === b.id));
  const ledger = { checkedAt: new Date().toISOString(), concurrency, durationMilliseconds: Date.now() - startedAt,
    passed: results.filter(r => r.result === 'passed').length, failed: results.filter(r => r.result !== 'passed').length, results };
  fs.writeFileSync(path.join(directory, 'offline-checks.json'), JSON.stringify(ledger, null, 2) + '\n');
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, ['| Gate | Result | Seconds |', '| --- | --- | ---: |',
    ...results.map(r => `| ${r.id} | ${r.result} | ${(r.durationMilliseconds / 1000).toFixed(1)} |`), ''].join('\n') + '\n');
  if (ledger.failed) { console.error(`${ledger.failed} offline gate(s) failed; logs in artifacts/checks/logs`); process.exitCode = 1; }
}
