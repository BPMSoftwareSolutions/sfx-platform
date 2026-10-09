// Browser acceptance using an unchanged, retained real SSE capture. This is
// labelled replay: no records are posted to the observer and no API is invoked.
// Deployment checks browser rendering at 1x. Exact rate scaling is checked by
// verify-timing.mjs with a deterministic scheduler and the same real capture.
// Add --full-wall-clock for the slower 1x/0.1x browser timing qualification.
// node verify-circuit-replay.mjs <HTTPS-origin> <scene.json> <capture.sse> <evidence-dir> [candidate-traversal.js] [--full-wall-clock]
// Set SFX_BROWSER_TEST_MODULE and SFX_BROWSER_EXECUTABLE to installed browser tools.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { newRun, applyRecord } from '../../live-circuit/circuit/deck-trace.js';

const fullWallClock = process.argv.includes('--full-wall-clock');
const [endpoint, sceneFile, captureFile, output, candidate] = process.argv.slice(2).filter(arg => arg !== '--full-wall-clock');
assert(endpoint && sceneFile && captureFile && output, 'Supply endpoint, real scene/capture, and output directory');
const deck = JSON.parse(fs.readFileSync(sceneFile, 'utf8'));
const capture = fs.readFileSync(captureFile, 'utf8');
const allRecords = capture.split(/\r?\n/).filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)));
// A browser sign-in/Observe/sign-out capture contains several executions. Feed
// exactly the selected complete run to "replay latest"; preserve all its values,
// receipt IDs and timestamps. Never let a login run-end select the wrong replay.
const groups = []; let group;
for (const record of allRecords) {
  if (record.kind === 'run-start') { group = {run:newRun(record),records:[]}; groups.push(group); }
  else if (group) applyRecord(group.run,record);
  group?.records.push(record);
}
const selected = groups.findLast(g=>g.run.ended && g.run.graph?.graphId==='graph:'+deck.capabilityId);
assert(selected, 'Capture must contain a completed execution of the selected capability');
const records = selected.records;
const selectedCapture = records.map(record=>'data: '+JSON.stringify(record)+'\n\n').join('');
const { chromium } = await import(pathToFileURL(process.env.SFX_BROWSER_TEST_MODULE).href);
const browser = await chromium.launch({ executablePath: process.env.SFX_BROWSER_EXECUTABLE, headless: true });
fs.mkdirSync(output, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/events*', route => new URL(route.request().url()).searchParams.get('run') === 'current'
    ? route.fulfill({ status: 200, contentType: 'text/event-stream', body: selectedCapture })
    : route.fulfill({status:200,contentType:'text/event-stream',body:': retained replay acceptance; no new live records\n\n'}));
  if (candidate) await page.route('**/circuit/traversal.js', route => route.fulfill({
    contentType: 'text/javascript', body: fs.readFileSync(candidate, 'utf8') }));
  if (candidate) await page.route('**/circuit/circuit-runtime.js', route => route.fulfill({
    contentType: 'text/javascript', body: fs.readFileSync(path.join(path.dirname(candidate), 'circuit-runtime.js'), 'utf8') }));
  await page.goto(endpoint + '/circuit/explorer?' + new URLSearchParams({ capability: deck.capabilityId,
    namespace: deck.namespaceId, scenario: deck.scenarioId, page: 'scenario-1' }));
  await page.waitForSelector('.component-hit', { timeout: 90000 });
  await page.locator('#follow').check();
  const expected = await page.evaluate(async ({ deck, records }) => {
    const { newRun, applyRecord, replayTimeline } = await import('/circuit/deck-trace.js');
    const { buildTraversal } = await import('/circuit/traversal.js');
    const runs = []; let run;
    for (const record of records) {
      if (record.kind === 'run-start') { run = newRun(record); runs.push(run); }
      else if (run) applyRecord(run, record);
    }
    run = runs.findLast(value => value.graph?.graphId === 'graph:' + deck.capabilityId);
    const timeline = replayTimeline(deck, run), model = buildTraversal(deck, run, timeline);
    return { runId: run.id, duration: timeline.duration, providers: model.segments.filter(segment => segment.call === 'provider').map(segment => ({
      nodeId: segment.calleeNodeId, from: segment.from, to: segment.to,
      interval: segment.pieces.find(piece => piece.basis === 'captured provider execution') })) };
  }, { deck, records });
  assert(expected.providers.length, 'Acceptance requires provider calls matched to captured executor authority');
  const measurements = [];
  for (const rate of fullWallClock ? [1, 0.1] : [1]) {
    await page.locator('#speed').selectOption(String(rate));
    await page.evaluate(() => {
      window.replaySamples = [];
      const sample = () => {
        const data = document.querySelector('#viewer').dataset;
        window.replaySamples.push({ at: performance.now(), position: Number(data.replayPosition),
          current: [...document.querySelectorAll('.component-hit[data-current=true]')].map(node => node.dataset.nodeId) });
        window.replaySampleFrame = requestAnimationFrame(sample);
      };
      window.replaySampleFrame = requestAnimationFrame(sample);
    });
    await page.locator('#replay').click();
    await page.waitForFunction(rate => {
      const mode = document.querySelector('#mode').textContent;
      return mode.includes(`SCENARIO REPLAY · ${rate}× · finished`);
    }, rate, { timeout: expected.duration / rate + 15000 });
    const result = await page.evaluate(() => {
      cancelAnimationFrame(window.replaySampleFrame);
      return { duration: Number(document.querySelector('#viewer').dataset.replayDuration),
        wall: Number(document.querySelector('#viewer').dataset.replayWall), samples: window.replaySamples };
    });
    fs.writeFileSync(path.join(output, `samples-${rate}.json`), JSON.stringify(result.samples));
    fs.writeFileSync(path.join(output, `clock-${rate}.json`), JSON.stringify({ duration: result.duration, wall: result.wall, expected }, null, 2));
    assert.equal(result.duration, expected.duration);
    const providers = expected.providers.map(provider => {
      const from = provider.interval?.t0 ?? provider.from, to = provider.interval?.t1 ?? provider.to;
      const within = result.samples.filter(sample => sample.position >= from && sample.position < to);
      assert(within.length, 'Browser must sample the recorded interval: ' + provider.nodeId);
      if (provider.interval) assert(within.every(sample => sample.current.includes(provider.nodeId)), 'Provider is current throughout its separately captured provider interval');
      else assert(within.some(sample => sample.current.includes(provider.nodeId)), 'Schematic path must visit the provider within the captured owning-operation window');
      return { provider: provider.nodeId, capturedMilliseconds: to - from, frames: within.length,
        providerFrames: within.filter(sample => sample.current.includes(provider.nodeId)).length,
        timingBasis: provider.interval ? 'separately captured provider execution' : 'captured owning operation; transport location is schematic' };
    });
    const deviation = result.wall - expected.duration / rate;
    // Shared CI scheduler latency is measured, not treated as replay-clock
    // arithmetic. Completion remains bounded and all provider painting checks
    // above remain mandatory. The explicit wall-clock qualification retains
    // its original tighter requirement.
    if (fullWallClock) assert(Math.abs(deviation) < 50, 'Browser scheduling deviation must be under 50 ms in this uninterrupted qualification run');
    measurements.push({ rate, capturedMilliseconds: result.duration, expectedMilliseconds: expected.duration / rate,
      measuredMilliseconds: result.wall, deviationMilliseconds: deviation, providers });
  }
  assert.equal(errors.length, 0);
  const receipt = { checkedAt: new Date().toISOString(), endpoint, capabilityId: deck.capabilityId,
    runId: expected.runId, capture: captureFile, candidateOverride: Boolean(candidate),
    mode: fullWallClock ? 'full-wall-clock-qualification' : 'deployment-browser-rendering',
    wallClockToleranceMs: fullWallClock ? 50 : null,
    basis: 'Browser replay of unchanged retained real capture; no execution or observer writes', measurements, errors };
  fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt));
} finally { await browser.close(); }
