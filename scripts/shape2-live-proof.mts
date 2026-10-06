import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { layoutCircuit } from '@/components/circuit/layout';
import type { SdaRunEvent, SdaRunGraph } from '@/contracts/sda-api';
import { applyEvents, emptyTrace, testimonyTrail } from '@/lib/live-trace';
import { buildRunGraphView, normalizeRunGraph, runGraphViewProjection } from '@/lib/run-graph';

const PLAYWRIGHT = process.env.SFX_PLAYWRIGHT ?? 'C:/lab/repos/source-facts-semantic-search-engine/node_modules/playwright';
const CHROMIUM = process.env.SFX_CHROMIUM ?? 'C:/Users/Sidney Jones/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const out = 'C:/Users/SIDNEY~1/AppData/Local/Temp/opencode/shape2';
const capturePath = 'C:/Users/SIDNEY~1/AppData/Local/Temp/opencode/baseline/run-say-hello-world.json';

const capture = JSON.parse(readFileSync(capturePath, 'utf8')) as {
  graph: { json: SdaRunGraph };
  pages: Array<{ body?: { events?: SdaRunEvent[] } }>;
};
const events = capture.pages.flatMap((page) => page.body?.events ?? []);
const view = buildRunGraphView(normalizeRunGraph(capture.graph.json));
const projection = runGraphViewProjection(view, { capabilityId: 'say-hello-world', scenarioId: null, fidelity: 'COMPILED_GRAPH' });
const layout = layoutCircuit(projection);
const trace = applyEvents(emptyTrace(view), events, view);
const trail = testimonyTrail(trace.transitions);
const expectedNodeOrder = trail
  .filter((step) => layout.nodeById[step.id])
  .map((step) => step.id);

const { chromium } = await import(pathToFileURL(path.join(PLAYWRIGHT, 'index.mjs')).href);
const browser = await chromium.launch({ executablePath: CHROMIUM });
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
const page = await context.newPage();

await page.goto('http://127.0.0.1:3100/capabilities/estate/say-hello-world', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.evaluate(() => {
  const samples: Array<{ t: number; transform: string }> = [];
  (window as unknown as { __tokenSamples: typeof samples }).__tokenSamples = samples;
  setInterval(() => {
    const token = document.querySelector('.circuit-token');
    if (!token) return;
    samples.push({ t: Date.now(), transform: token.getAttribute('transform') ?? '' });
  }, 30);
});

const run = page.locator('button', { hasText: 'Run this capability' });
if ((await run.count()) === 0) throw new Error('no run button found on the say-hello-world page');
await run.first().scrollIntoViewIfNeeded();
await run.first().click();

const deadline = Date.now() + 300000;
let status = '';
while (Date.now() < deadline) {
  status = await page.locator('.invocation-status').first().innerText().catch(() => '');
  if (status.includes('Run complete') || status.includes('Not executed') || status.includes('unconfirmed')) break;
  await page.waitForTimeout(400);
}

const surface = page.locator('.circuit-surface').first();
await surface.scrollIntoViewIfNeeded();
await page.waitForTimeout(600);
await surface.screenshot({ path: `${out}/hello-live-early.png` });
await page.waitForTimeout(1600);
await surface.screenshot({ path: `${out}/hello-live-mid.png` });
await page.waitForTimeout(3000);

const samples = (await page.evaluate(() => (window as unknown as { __tokenSamples: Array<{ t: number; transform: string }> }).__tokenSamples)) as Array<{ t: number; transform: string }>;
const doneNodes = await page.locator('.circuit-node--done').count();
const heldNodes = await page.locator('.circuit-node--held').count();
const failedNodes = await page.locator('.circuit-node--failed').count();
const plannedNodes = await page.locator('.circuit-node--planned').count();
const doneEdges = await page.locator('.circuit-edge--done').count();
const viewBox = await surface.locator('svg').first().getAttribute('viewBox');
await surface.screenshot({ path: `${out}/hello-live-final.png` });
await page.screenshot({ path: `${out}/hello-live-full.png`, fullPage: true });

const centre = (id: string) => {
  const box = layout.nodeById[id]!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
// Monotonic traversal: the token is accepted for the next expected node only while it is within
// the node's own box (half-width 106 plus margin), so the recorded order is the observed order.
const visited: string[] = [];
let nextExpected = 0;
for (const sample of samples) {
  const match = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(sample.transform);
  if (!match || nextExpected >= expectedNodeOrder.length) continue;
  const x = Number(match[1]);
  const y = Number(match[2]);
  const target = centre(expectedNodeOrder[nextExpected]);
  if (Math.hypot(target.x - x, target.y - y) <= 120) {
    visited.push(expectedNodeOrder[nextExpected]);
    nextExpected += 1;
  }
}

const proof = {
  status,
  expectedNodeOrder,
  visitedNodeOrder: visited,
  traversalMatches: JSON.stringify(visited) === JSON.stringify(expectedNodeOrder),
  doneNodes,
  doneEdges,
  heldNodes,
  failedNodes,
  plannedNodes,
  trailLength: trail.length,
  samples: samples.length,
  viewBox,
  expectedViewBox: `0 0 ${layout.width} ${layout.height}`,
  layoutMatches: viewBox === `0 0 ${layout.width} ${layout.height}`,
  output: await page.locator('.live-output-message').innerText().catch(() => ''),
};
writeFileSync(`${out}/hello-live-proof.json`, JSON.stringify(proof, null, 2));
console.log(JSON.stringify(proof, null, 2));
await browser.close();
