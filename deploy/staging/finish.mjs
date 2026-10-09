// Records an accepted release only from the gate ledger: every required gate has
// a passing record from this run, the slot binding and public health still name
// the candidate, and the receipt lists each gate with its duration, the digests
// of its retained evidence, and every scope that was omitted and why. A green
// job never implies that an optional or out-of-scope check ran.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {config, rest, read, write, json, evidence} from './common.mjs';
const state = read('state.json'), scope = read('scope.json');
const required = ['deploy', 'smoke', 'browser', 'evidence', 'restart', 'durable', 'external', ...(scope.clientGateRequired ? ['cli'] : [])];
const gatesDirectory = path.join(evidence, 'gates');
const ledger = Object.fromEntries((fs.existsSync(gatesDirectory) ? fs.readdirSync(gatesDirectory) : [])
  .filter(name => name.endsWith('.json')).map(name => JSON.parse(fs.readFileSync(path.join(gatesDirectory, name)))).map(record => [record.id, record]));
for (const id of required) assert.equal(ledger[id]?.result, 'passed', `Required gate ${id} has no passing record in this run`);
assert.equal((await rest('get','/config/web')).properties.linuxFxVersion, 'DOCKER|'+state.candidateImage);
assert.equal((await json(config.origin+'/healthz')).release,state.candidateRelease);
const durable = read('durable-restart.json');
assert.equal(durable.persistence, 'complete'); assert(durable.events > 0);
assert.notEqual(durable.previousBoot, durable.bootId); assert.equal(durable.admissions, 0);
const browser = read('browser/browser-receipt.json');
const omitted = [
  ...(scope.clientGateRequired ? [] : [{ gate: 'cli', reason: `No CLI, login-input or identity-contract change since ${scope.previousSource.slice(0, 12)}` }]),
  ...(browser.serverLogCheck?.omitted ? [{ gate: 'live-log-disclosure-scan', reason: browser.serverLogCheck.omitted }] : []),
];
const digest = file => {
  const full = path.join(evidence, file);
  assert(fs.existsSync(full), `Required acceptance evidence is missing: ${file}`);
  return 'sha256:' + createHash('sha256').update(fs.readFileSync(full)).digest('hex');
};
const retained = ['release.json', 'deployed.json', 'scope.json', 'smoke.json', 'browser/browser-receipt.json', 'browser/run.json', 'browser/durable-before.json',
  'replay-timing.json', 'restart.json', 'durable-restart.json', 'external/receipt.json', 'api-command.json', ...(scope.clientGateRequired ? ['cli.json'] : [])];
const receipt = {acceptedAt:new Date().toISOString(),release:state.candidateRelease,image:state.candidateImage,sourceCommit:state.sourceCommit,
  checksRun: process.env.SFX_CHECKS_RUN ?? null,
  gates: required.map(id => ({ id, result: ledger[id].result, durationMilliseconds: ledger[id].durationMilliseconds })), omitted,
  execution: { subject: config.observe.subject, expectedOutcome: config.expectedOutcome, deterministic: config.executionFixture?.deterministic === true,
    dependencies: config.executionFixture?.dependencies ?? [] },
  evidence: Object.fromEntries(retained.map(file => [file, digest(file)])),
  durableRun: durable,
  rollbackImage:state.previousImage,workflow:`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`};
const seconds = ms => (ms / 1000).toFixed(1);
fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, [`Accepted **${receipt.release}**`, '', `Image: \`${receipt.image}\``, '', `Rollback: \`${receipt.rollbackImage}\``, '',
  '| Required gate | Result | Seconds |', '| --- | --- | ---: |', ...receipt.gates.map(g => `| ${g.id} | ${g.result} | ${seconds(g.durationMilliseconds)} |`), '',
  ...(omitted.length ? ['Omitted scope:', ...omitted.map(o => `- **${o.gate}**: ${o.reason}`), ''] : []),
  `Execution path: \`${receipt.execution.subject}\` → \`${receipt.execution.expectedOutcome}\`` +
    (receipt.execution.deterministic ? ' (deterministic fixture).' : ` — not a deterministic fixture; depends on ${receipt.execution.dependencies.join(', ') || 'undeclared live inputs'}.`), ''].join('\n'));
write('accepted.json',receipt);
console.log(JSON.stringify(receipt));
