// Browser acceptance using an unchanged, retained real SSE capture. This is
// labelled replay: no records are posted to the observer and no API is invoked.
// It checks browser rendering at 1x. Exact rate scaling is checked by
// verify-timing.mjs with a deterministic scheduler and the same real capture.
// node verify-circuit-replay.mjs <origin> <scene.json> <capture.sse> <evidence-dir> [candidate-traversal.js]
//   [--full-wall-clock] [--served-events] [--cpu-throttle=<rate>]
// --full-wall-clock  slower 1x/0.1x browser timing qualification (50 ms tolerance).
// --served-events    use the origin's own /events (a candidate fixture host that
//                    controls delivery) instead of fulfilling it from the capture.
// --cpu-throttle     Chromium CPU throttling rate for delayed-scheduler qualification.
// Set SFX_BROWSER_TEST_MODULE and SFX_BROWSER_EXECUTABLE to installed browser tools.
// A failure retains failed.json (stage, classification, page and stream state)
// and failed.png in the evidence directory and prints one REPLAY_FAILED line.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { newRun, applyRecord } from '../../live-circuit/circuit/deck-trace.js';

const flags = process.argv.slice(2).filter(arg => arg.startsWith('--'));
const fullWallClock = flags.includes('--full-wall-clock');
const servedEvents = flags.includes('--served-events');
const throttle = Number(flags.find(flag => flag.startsWith('--cpu-throttle='))?.split('=')[1] ?? 1);
assert(Number.isFinite(throttle) && throttle >= 1, 'CPU throttle rate must be at least 1');
const [endpoint, sceneFile, captureFile, output, candidate] = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
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
const frameMilliseconds = deck.observationMap?.flowPolicy?.continuousPath?.frameMilliseconds ?? 100;
const { chromium } = await import(pathToFileURL(process.env.SFX_BROWSER_TEST_MODULE).href);
const browser = await chromium.launch({ executablePath: process.env.SFX_BROWSER_EXECUTABLE, headless: true });
fs.mkdirSync(output, { recursive: true });
let page, stage = 'opening browser', classification = null;
const errors = [], consoleMessages = [];
const fail = (code, message) => { classification = code; throw new assert.AssertionError({ message: `${code}: ${message}` }); };
try {
  page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { consoleMessages.push(message.text()); if (consoleMessages.length > 50) consoleMessages.shift(); });
  if (throttle > 1) await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: throttle });
  // Stream lifecycle diagnostics only: which observer streams opened, how many
  // records each delivered, and when each was closed by the page.
  await page.addInitScript(() => {
    const Native = window.EventSource; window.replayStreams = [];
    window.EventSource = class extends Native {
      constructor(url, options) {
        super(url, options);
        const entry = { url: new URL(String(url), location.href).pathname + new URL(String(url), location.href).search,
          openedAt: performance.now(), records: 0, lastKind: null, errors: 0, closedAt: null };
        window.replayStreams.push(entry); if (window.replayStreams.length > 40) window.replayStreams.shift();
        this.addEventListener('message', event => { entry.records++; try { entry.lastKind = JSON.parse(event.data).kind; } catch {} });
        this.addEventListener('error', () => { entry.errors++; });
        const close = this.close.bind(this);
        this.close = () => { entry.closedAt ??= performance.now(); close(); };
      }
    };
  });
  if (!servedEvents) await page.route('**/events*', route => new URL(route.request().url()).searchParams.get('run') === 'current'
    ? route.fulfill({ status: 200, contentType: 'text/event-stream', body: selectedCapture })
    : route.fulfill({status:200,contentType:'text/event-stream',body:': retained replay acceptance; no new live records\n\n'}));
  if (candidate) await page.route('**/circuit/traversal.js', route => route.fulfill({
    contentType: 'text/javascript', body: fs.readFileSync(candidate, 'utf8') }));
  if (candidate) await page.route('**/circuit/circuit-runtime.js', route => route.fulfill({
    contentType: 'text/javascript', body: fs.readFileSync(path.join(path.dirname(candidate), 'circuit-runtime.js'), 'utf8') }));
  stage = 'loading the Explorer and its declared shell regions';
  await page.goto(endpoint + '/circuit/explorer?' + new URLSearchParams({ capability: deck.capabilityId,
    namespace: deck.namespaceId, scenario: deck.scenarioId, page: 'scenario-1' }));
  // Region mounts are asynchronous; the run controls live in the middle region.
  await page.waitForFunction(ids => ids.every(id => {
    const node = document.getElementById(id);
    return node?.dataset.regionSource === 'declared' || node?.dataset.regionFailure !== undefined;
  }), ['region-header', 'tree', 'region-middle', 'context', 'region-footer'], { timeout: 90000 });
  const regionFailures = await page.locator('[data-region-failure]').evaluateAll(nodes => nodes.map(node => `${node.dataset.region}:${node.dataset.regionFailure}`));
  if (regionFailures.length) fail('SHELL_REGION_FAILED', regionFailures.join(', '));
  await page.waitForSelector('.component-hit', { timeout: 90000 });
  await page.locator('#follow').check();
  stage = 'computing the expected replay model from the served modules';
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
    stage = `starting replay at ${rate}x`;
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
    stage = `waiting for the selected run to replay to completion at ${rate}x`;
    try {
      await page.waitForFunction(rate => {
        const mode = document.querySelector('#mode').textContent;
        return mode.includes(`SCENARIO REPLAY · ${rate}× · finished`);
      }, rate, { timeout: expected.duration / rate + 15000 });
    } catch (error) {
      if (error.name !== 'TimeoutError') throw error;
      const { mode, streams } = await page.evaluate(() => ({ mode: document.querySelector('#mode').textContent, streams: window.replayStreams }));
      const replayStream = streams.findLast(entry => entry.url.includes('run=current'));
      if (!mode.includes('SCENARIO REPLAY')) fail('REPLAY_RUN_NOT_RECEIVED', replayStream
        ? `the replay stream delivered ${replayStream.records} records ending at ${replayStream.lastKind ?? 'none'} and was ${replayStream.closedAt === null ? 'still open' : 'closed by the page'}; replay never started`
        : 'no replay stream was opened');
      fail('REPLAY_NOT_FINISHED', `replay started but did not finish within ${Math.round(expected.duration / rate + 15000)} ms: ${mode}`);
    }
    stage = `checking provider painting at ${rate}x`;
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
      // A painting miss is only a product failure when sampling was dense
      // enough to have seen the paint; a starved renderer is classified apart.
      const positions = [from, ...within.map(sample => sample.position), to];
      const largestGap = Math.max(...positions.slice(1).map((value, index) => value - positions[index]));
      const missed = code => fail(largestGap > frameMilliseconds ? 'RENDER_SAMPLING_SPARSE' : 'PROVIDER_NOT_PAINTED',
        `${code} ${provider.nodeId} in ${Math.round(from)}-${Math.round(to)} ms; ${within.length} samples, largest gap ${Math.round(largestGap)} ms`);
      if (!within.length) missed('Browser must sample the recorded interval:');
      if (provider.interval && !within.every(sample => sample.current.includes(provider.nodeId))) missed('Provider is not current throughout its separately captured provider interval:');
      if (!provider.interval && !within.some(sample => sample.current.includes(provider.nodeId))) missed('Schematic path must visit the provider within the captured owning-operation window:');
      return { provider: provider.nodeId, capturedMilliseconds: to - from, frames: within.length,
        providerFrames: within.filter(sample => sample.current.includes(provider.nodeId)).length, largestGapMilliseconds: largestGap,
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
  assert.equal(errors.length, 0, 'Browser JavaScript errors');
  const receipt = { checkedAt: new Date().toISOString(), endpoint, capabilityId: deck.capabilityId,
    runId: expected.runId, capture: captureFile, candidateOverride: Boolean(candidate),
    mode: fullWallClock ? 'full-wall-clock-qualification' : 'browser-rendering',
    events: servedEvents ? 'served by the origin' : 'fulfilled from the capture', cpuThrottle: throttle,
    wallClockToleranceMs: fullWallClock ? 50 : null,
    basis: 'Browser replay of unchanged retained real capture; no execution or observer writes', measurements, errors };
  fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt));
} catch (error) {
  classification ??= error.name === 'TimeoutError' ? 'BROWSER_WAIT_TIMEOUT' : 'UNCLASSIFIED';
  const state = page ? await page.evaluate(() => ({
    mode: document.querySelector('#mode')?.textContent ?? null, run: document.querySelector('#run')?.textContent ?? null,
    observer: document.querySelector('#observer-status')?.textContent ?? null,
    viewer: { ...(document.querySelector('#viewer')?.dataset ?? {}) }, streams: window.replayStreams ?? [],
    samples: (window.replaySamples ?? []).slice(-20)
  })).catch(reason => ({ unavailable: reason.message })) : null;
  if (page) await page.screenshot({ path: path.join(output, 'failed.png'), fullPage: true }).catch(() => {});
  fs.writeFileSync(path.join(output, 'failed.json'), JSON.stringify({ failedAt: new Date().toISOString(), stage, classification,
    error: error.message, cpuThrottle: throttle, events: servedEvents ? 'served' : 'fulfilled', page: state, pageErrors: errors,
    console: consoleMessages }, null, 2));
  console.error(`REPLAY_FAILED ${classification} stage="${stage}": ${error.message}`);
  process.exitCode = 1;
} finally { await browser.close(); }
