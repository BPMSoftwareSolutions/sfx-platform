// Browser acceptance using an unchanged, retained real SSE capture. This is
// labelled replay: no records are posted to the observer and no API is invoked.
// node verify-circuit-replay.mjs <HTTPS-origin> <scene.json> <capture.sse> <evidence-dir> [candidate-traversal.js]
// Set SFX_BROWSER_TEST_MODULE and SFX_BROWSER_EXECUTABLE to installed browser tools.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [endpoint, sceneFile, captureFile, output, candidate] = process.argv.slice(2);
assert(endpoint && sceneFile && captureFile && output, 'Supply endpoint, real scene/capture, and output directory');
const deck = JSON.parse(fs.readFileSync(sceneFile, 'utf8'));
const capture = fs.readFileSync(captureFile, 'utf8');
const records = capture.split(/\r?\n/).filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)));
const { chromium } = await import(pathToFileURL(process.env.SFX_BROWSER_TEST_MODULE).href);
const browser = await chromium.launch({ executablePath: process.env.SFX_BROWSER_EXECUTABLE, headless: true });
fs.mkdirSync(output, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/events*', route => new URL(route.request().url()).searchParams.get('run') === 'current'
    ? route.fulfill({ status: 200, contentType: 'text/event-stream', body: capture }) : route.continue());
  if (candidate) await page.route('**/circuit/traversal.js', route => route.fulfill({
    contentType: 'text/javascript', body: fs.readFileSync(candidate, 'utf8') }));
  if (candidate) await page.route('**/circuit/app.js', route => route.fulfill({
    contentType: 'text/javascript', body: fs.readFileSync(path.join(path.dirname(candidate), 'app.js'), 'utf8') }));
  await page.goto(endpoint + '/circuit?' + new URLSearchParams({ capability: deck.capabilityId,
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
      nodeId: segment.calleeNodeId, interval: segment.pieces.find(piece => piece.basis === 'captured provider execution') })) };
  }, { deck, records });
  assert(expected.providers.length && expected.providers.every(provider => provider.interval), 'Acceptance requires captured provider intervals');
  const measurements = [];
  for (const rate of [1, 0.1]) {
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
      const within = result.samples.filter(sample => sample.position >= provider.interval.t0 && sample.position < provider.interval.t1);
      assert(within.length, 'Browser must sample the recorded interval: ' + provider.nodeId);
      assert(within.every(sample => sample.current.includes(provider.nodeId)), 'Provider is current throughout its sampled recorded interval');
      return { provider: provider.nodeId, capturedMilliseconds: provider.interval.t1 - provider.interval.t0, frames: within.length };
    });
    const deviation = result.wall - expected.duration / rate;
    assert(Math.abs(deviation) < 50, 'Browser scheduling deviation must be under 50 ms in this uninterrupted acceptance run');
    measurements.push({ rate, capturedMilliseconds: result.duration, expectedMilliseconds: expected.duration / rate,
      measuredMilliseconds: result.wall, deviationMilliseconds: deviation, providers });
  }
  assert.equal(errors.length, 0);
  const receipt = { checkedAt: new Date().toISOString(), endpoint, capabilityId: deck.capabilityId,
    runId: expected.runId, capture: captureFile, candidateOverride: Boolean(candidate),
    basis: 'Browser replay of unchanged retained real capture; no execution or observer writes', measurements, errors };
  fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt));
} finally { await browser.close(); }
