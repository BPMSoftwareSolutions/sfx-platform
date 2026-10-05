// Watch a selected circuit while an external acceptance command executes.
// No events, API responses, renderer, or timing are substituted. The command
// owns invocation and cleanup; this observer is an anonymous browser.
// node verify-external-live.mjs <origin> <capability> <expected-variant> <evidence> <command> [...args]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const [origin, capability, variant, evidence, command, ...args] = process.argv.slice(2);
assert(origin && capability && variant && evidence && command, 'Supply origin, capability, variant, evidence and command');
const { chromium } = await import(pathToFileURL(process.env.SFX_BROWSER_TEST_MODULE).href);
fs.mkdirSync(evidence, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.SFX_BROWSER_EXECUTABLE, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const selection = new URLSearchParams({ capabilityId: capability, namespaceId: 'sidefx:capabilities', scenarioId: capability });
  const response = await fetch(origin + '/api/circuit/v1/scenario?' + selection);
  assert.equal(response.status, 200); const scene = await response.json();
  fs.writeFileSync(path.join(evidence, 'scene.json'), JSON.stringify(scene));
  await page.goto(origin + '/circuit?' + new URLSearchParams({ capability, namespace: scene.namespaceId, scenario: capability, page: 'scenario-1' }));
  await page.waitForSelector('.component-hit', { timeout: 90000 });
  await page.locator('#follow').check();
  await page.evaluate(async () => {
    window.externalSamples = []; window.externalRecords = []; window.externalOpen = false; window.externalGraph = null;
    const source = window.externalSource = new EventSource('/events');
    source.onmessage = event => {
      const record = JSON.parse(event.data); window.externalRecords.push(record);
      if (record.kind === 'run-start') { window.externalOpen = true; window.externalGraph = null; }
      if (record.kind === 'run-end') window.externalOpen = false;
      if (record.payload?.graphId) window.externalGraph = record.payload.graphId;
    };
    const sample = () => {
      window.externalSamples.push({ at: Date.now(), open: window.externalOpen, graph: window.externalGraph,
        mode: document.querySelector('#mode').textContent, page: document.querySelector('#slide').value,
        current: [...document.querySelectorAll('.component-hit[data-current=true]')].map(n => ({ id: n.dataset.nodeId, kind: n.dataset.kind })) });
      window.externalFrame = requestAnimationFrame(sample);
    };
    window.externalFrame = requestAnimationFrame(sample);
    await new Promise((resolve, reject) => { source.onopen = resolve; source.onerror = () => reject(new Error('External SSE failed')); });
  });
  const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.pipe(process.stdout); child.stderr.pipe(process.stderr);
  const exitCode = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
  const { samples, records } = await page.evaluate(() => {
    cancelAnimationFrame(window.externalFrame); window.externalSource.close();
    return { samples: window.externalSamples, records: window.externalRecords };
  });
  fs.writeFileSync(path.join(evidence, 'frames.json'), JSON.stringify(samples));
  fs.writeFileSync(path.join(evidence, 'capture.sse'), records.map(r => 'data: ' + JSON.stringify(r) + '\n\n').join(''));
  await page.screenshot({ path: path.join(evidence, 'external.png'), fullPage: true });
  const live = samples.filter(s => s.open && s.graph === 'graph:' + capability);
  const providers = [...new Set(live.flatMap(s => s.current.filter(n => n.kind === 'provider').map(n => n.id)))];
  const declared = [...new Set(scene.observationMap.declaredNodes.filter(n => n.kind === 'provider').map(n => n.id))];
  const outcomes = [...new Set(samples.flatMap(s => s.current.filter(n => n.kind === 'variant').map(n => n.id)))];
  const receipt = { checkedAt: new Date().toISOString(), origin, capability, exitCode, errors,
    frames: samples.length, liveFrames: live.length, providers, declaredProviders: declared,
    pages: [...new Set(live.map(s => s.page))], outcomes, replayUsed: samples.some(s => s.mode.includes('REPLAY')) };
  fs.writeFileSync(path.join(evidence, 'receipt.json'), JSON.stringify(receipt, null, 2));
  assert.equal(exitCode, 0); assert.equal(errors.length, 0); assert(!receipt.replayUsed);
  assert(providers.length, 'Provider must be painted current while external run is open');
  assert(outcomes.some(id => id.endsWith(':' + variant)), 'Expected exact outcome must be painted');
  console.log(JSON.stringify(receipt));
} finally { await browser.close(); }
