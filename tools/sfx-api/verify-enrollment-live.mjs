// Watch a fresh real enrollment acceptance command in the hosted live circuit.
// Browser tooling is supplied by the operator; it is not a runtime dependency.
// node verify-enrollment-live.mjs <HTTPS-origin> <evidence-dir> <command> [...args]
// SFX_BROWSER_TEST_MODULE: installed Playwright module path
// SFX_BROWSER_EXECUTABLE: installed Chromium executable path
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const [endpoint, evidence, command, ...args] = process.argv.slice(2);
if (!endpoint || !evidence || !command || new URL(endpoint).protocol !== 'https:')
  throw new Error('Expected HTTPS origin, evidence directory and acceptance command');
const { chromium } = await import(pathToFileURL(process.env.SFX_BROWSER_TEST_MODULE).href);
const browser = await chromium.launch({ executablePath: process.env.SFX_BROWSER_EXECUTABLE, headless: true });
fs.mkdirSync(evidence, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(endpoint + '/circuit?capability=enroll-ide-user&namespace=sidefx%3Acapabilities&scenario=enroll-ide-user&page=scenario-1');
  await page.waitForSelector('.component-hit', { timeout: 90000 });
  await page.locator('#follow').check();
  await page.evaluate(async () => {
    window.proofSamples = []; window.proofRun = 0; window.proofOpen = false; window.proofGraph = null;
    const source = window.proofEvents = new EventSource('/events');
    source.onmessage = event => {
      const record = JSON.parse(event.data);
      if (record.kind === 'run-start') { window.proofRun++; window.proofOpen = true; window.proofGraph = null; }
      if (record.kind === 'run-end') window.proofOpen = false;
      if (record.payload?.graphId) window.proofGraph = record.payload.graphId;
    };
    // Frame samples establish painted locations, not states synthesized later
    // from a completed capture. No reduced-motion or replay override is used.
    const sample = () => {
      window.proofSamples.push({ at: Date.now(), open: window.proofOpen, graph: window.proofGraph,
        run: window.proofRun, mode: document.querySelector('#mode').textContent,
        page: document.querySelector('#slide').value,
        current: [...document.querySelectorAll('.component-hit[data-current=true]')]
          .map(node => ({ id: node.dataset.nodeId, kind: node.dataset.kind, label: node.dataset.label })),
        dots: [...document.querySelectorAll('.flow-signal')].map(node => ({ ...node.dataset })) });
      window.proofFrame = requestAnimationFrame(sample);
    };
    window.proofFrame = requestAnimationFrame(sample);
    await new Promise((resolve, reject) => { source.onopen = resolve; source.onerror = () => reject(new Error('Live observer connection failed')); });
  });
  const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.pipe(process.stdout); child.stderr.pipe(process.stderr);
  const cliCode = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
  const samples = await page.evaluate(() => {
    cancelAnimationFrame(window.proofFrame); window.proofEvents.close(); return window.proofSamples;
  });
  const live = samples.filter(sample => sample.open && sample.graph === 'graph:enroll-ide-user');
  const providers = live.flatMap(sample => sample.current.filter(node => node.kind === 'provider').map(node => node.label));
  const receipt = { checkedAt: new Date().toISOString(), cliCode, errors,
    sampleCount: samples.length, liveProviderSamples: providers.length,
    providers: [...new Set(providers)], pages: [...new Set(live.map(sample => sample.page))],
    liveThroughout: samples.every(sample => sample.mode === 'LIVE RECEIPTS · real-time'),
    outcome: samples.at(-1)?.current };
  fs.writeFileSync(path.join(evidence, 'browser-samples.json'), JSON.stringify(samples));
  fs.writeFileSync(path.join(evidence, 'browser-receipt.json'), JSON.stringify(receipt, null, 2));
  await page.screenshot({ path: path.join(evidence, 'live-enrolled.png'), fullPage: true });
  console.log(JSON.stringify(receipt));
  if (cliCode !== 0 || errors.length || receipt.providers.length !== 2 || !receipt.liveThroughout) process.exitCode = 1;
} finally { await browser.close(); }
