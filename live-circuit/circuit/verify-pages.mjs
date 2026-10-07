#!/usr/bin/env node
// Declarative-page acceptance checks against a running circuit host:
//   node live-circuit/circuit/verify-pages.mjs <base-url> [--refusals] [--digests] [--safety]
//   node live-circuit/circuit/verify-pages.mjs --fixtures
// --fixtures spawns the observer on port 8897 over the file-backed page source
// in fixtures/pages, runs every assertion group, then stops the child. Reads
// only; the fixture observer and this script never touch ports 8788/8799.
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const fixtureDirectory = path.join(here, 'fixtures', 'pages');
const observerModule = path.join(repoRoot, 'live-circuit', 'dispatch-pair', 'observe-server.mjs');
const fixturePort = 8897;
const fixtureBase = `http://localhost:${fixturePort}`;
const expectedComponents = ['hero', 'section', 'text', 'heading', 'stat', 'card', 'card-list', 'list', 'media.figure', 'notice'];
const expectedSources = ['catalog', 'scenario', 'details', 'provider-inspection', 'session', 'release'];

const args = process.argv.slice(2);
const flags = new Set(args.filter(arg => arg.startsWith('--')));
const positional = args.filter(arg => !arg.startsWith('--'));
const fixtures = flags.has('--fixtures');
const base = positional[0] ?? (fixtures ? fixtureBase : null);
if (!base) {
  console.error('usage: node verify-pages.mjs <base-url> [--refusals] [--digests] [--safety] | --fixtures');
  process.exit(2);
}
const groups = {
  refusals: fixtures,
  digests: fixtures || flags.has('--digests'),
  safety: fixtures,
};

const checks = [];
function record(name, pass, detail) {
  const entry = { name, pass: Boolean(pass), detail: detail ?? '' };
  checks.push(entry);
  console.log(`${entry.pass ? 'PASS' : 'FAIL'} ${name}${entry.detail ? ` · ${entry.detail}` : ''}`);
  return entry.pass;
}
async function guard(name, work) {
  try {
    const result = await work();
    return record(name, result?.pass, result?.detail);
  } catch (error) {
    return record(name, false, `unavailable · ${error?.message ?? error}`);
  }
}
async function request(pathname, headers = {}) {
  const response = await fetch(new URL(pathname, base), { headers, redirect: 'error' });
  const text = response.status === 304 ? '' : await response.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = null; }
  }
  return { response, body, text, etag: response.headers.get('etag') };
}
const pagePath = (slug, extra = '') => `/api/circuit/v1/page?path=${encodeURIComponent(`/circuit/${slug}`)}${extra}`;

let child = null;
async function startFixtureObserver() {
  const env = {
    ...process.env,
    OBSERVER_PORT: String(fixturePort),
    SFX_PAGE_FIXTURE_DIR: fixtureDirectory,
    ...(process.env.SDA_ESTATE_DIR ? { SDA_ESTATE_DIR: process.env.SDA_ESTATE_DIR } : {}),
  };
  child = spawn(process.execPath, [observerModule], { env, cwd: repoRoot, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.resume();
  child.stderr.resume();
  child.on('error', () => {});
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`observe-server exited early with code ${child.exitCode}`);
    try {
      const response = await fetch(`${base}/health`, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return;
    } catch {
      /* the observer is not ready yet */
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('observe-server did not report /health within 20s');
}
function stopFixtureObserver() {
  const running = child;
  child = null;
  if (running && running.exitCode === null) running.kill();
}

if (fixtures) {
  try {
    await startFixtureObserver();
  } catch (error) {
    record('fixture-observer', false, `could not start · ${error?.message ?? error}`);
  }
}

let homeBody = null;
let homeEtag = null;

await guard('home-read', async () => {
  const { response, body, etag } = await request(pagePath('home'));
  homeBody = body;
  homeEtag = etag;
  const pass = response.status === 200 && body?.contractId === 'ui-page.v1' && body?.status === 'READ'
    && /^[a-f0-9]{64}$/.test(body?.pageDigest ?? '') && !body?.error
    && Array.isArray(body?.sections) && body.sections.length >= 10
    && body?.layout?.layoutId === 'ui-layout-marketing.v1';
  return { pass, detail: `status=${response.status} contractId=${body?.contractId} status=${body?.status} pageDigest=${String(body?.pageDigest ?? '').slice(0, 12)}… sections=${body?.sections?.length ?? 0} layout=${body?.layout?.layoutId}` };
});

await guard('home-etag-304', async () => {
  if (!homeEtag) return { pass: false, detail: 'the first read returned no ETag' };
  const { response } = await request(pagePath('home'), { 'if-none-match': homeEtag });
  return { pass: response.status === 304, detail: `status=${response.status} etag=${homeEtag}` };
});

await guard('unknown-page-404', async () => {
  const { response, body } = await request(pagePath('does-not-exist'));
  return { pass: response.status === 404 && body?.error === 'PAGE_NOT_FOUND', detail: `status=${response.status} error=${body?.error}` };
});

await guard('ui-registry', async () => {
  const { response, body } = await request('/api/circuit/v1/ui-registry');
  const kinds = new Set((body?.components ?? []).map(component => component?.kind));
  const sources = new Set((body?.sources ?? []).map(source => source?.sourceId));
  const missingKinds = expectedComponents.filter(kind => !kinds.has(kind));
  const missingSources = expectedSources.filter(source => !sources.has(source));
  const pass = response.status === 200 && body?.contractId === 'ui-registry.v1'
    && missingKinds.length === 0 && missingSources.length === 0;
  return { pass, detail: `status=${response.status} contractId=${body?.contractId} components=${kinds.size}/10 sources=${sources.size}/6${missingKinds.length ? ` missingKinds=${missingKinds.join(',')}` : ''}${missingSources.length ? ` missingSources=${missingSources.join(',')}` : ''}` };
});

if (fixtures) {
  await guard('degraded-read', async () => {
    const { response, body } = await request(pagePath('degraded'));
    const degraded = body?.degraded;
    const pass = response.status === 200 && body?.status === 'DEGRADED' && typeof degraded?.reason === 'string'
      && degraded.reason.length > 0 && Number.isInteger(degraded?.requestedRevision) && Number.isInteger(degraded?.servedRevision);
    return { pass, detail: `status=${response.status} page=${body?.status} requested=${degraded?.requestedRevision} served=${degraded?.servedRevision} reason="${String(degraded?.reason ?? '').slice(0, 64)}…"` };
  });
}

if (groups.refusals) {
  for (const [slug, declared] of [['unknown-component', 'galaxy'], ['unknown-action', 'launch-missiles']]) {
    await guard(`${slug}-refused`, async () => {
      const { response, body } = await request(pagePath(slug));
      const fixture = JSON.parse(await readFile(path.join(fixtureDirectory, `${slug}.json`), 'utf8'));
      const declares = JSON.stringify(fixture.sections ?? []).includes(declared);
      const pass = response.status === 422 && body?.error === 'UI_DECLARATION_INVALID'
        && !Object.prototype.hasOwnProperty.call(body ?? {}, 'sections') && declares;
      return { pass, detail: `status=${response.status} error=${body?.error} sectionsInError=${Object.prototype.hasOwnProperty.call(body ?? {}, 'sections')} fixtureDeclares=${declared}` };
    });
  }
}

if (groups.digests) {
  await guard('digest-pin-200', async () => {
    if (!homeBody?.pageDigest) return { pass: false, detail: 'no home pageDigest to pin' };
    const { response, body } = await request(pagePath('home', `&expectedPageDigest=${homeBody.pageDigest}`));
    return { pass: response.status === 200 && body?.contractId === 'ui-page.v1', detail: `status=${response.status} pinnedPageDigest=${String(homeBody.pageDigest).slice(0, 12)}…` };
  });
  await guard('digest-mismatch-409', async () => {
    const zero = '0'.repeat(64);
    const slug = fixtures ? 'stale' : 'home';
    const { response, body } = await request(pagePath(slug, `&expectedPageDigest=${zero}`));
    return { pass: response.status === 409 && body?.error === 'PAGE_SNAPSHOT_CHANGED', detail: `path=/circuit/${slug} expectedPageDigest=${zero.slice(0, 12)}… status=${response.status} error=${body?.error}` };
  });
  await guard('digest-malformed-400', async () => {
    const { response, body } = await request(pagePath('home', '&expectedPageDigest=xyz'));
    return { pass: response.status === 400, detail: `expectedPageDigest=xyz status=${response.status} error=${body?.error}` };
  });
}

if (groups.safety) {
  await guard('unsafe-served-as-data', async () => {
    const { response, text, body } = await request(pagePath('unsafe'));
    const literalScript = text.includes('<script>alert(1)</script>');
    const refusedScheme = text.includes('javascript:alert(1)');
    return { pass: response.status === 200 && body?.status === 'READ' && literalScript && refusedScheme,
      detail: `status=${response.status} page=${body?.status} scriptText=${literalScript} refusedScheme=${refusedScheme}` };
  });
  await guard('adapter-source-safety', async () => {
    const source = await readFile(path.join(here, 'ui-components.js'), 'utf8');
    const pass = source.includes('textContent') && !source.includes('innerHTML')
      && !source.includes('javascript:') && source.includes('safeUrl');
    return { pass, detail: `textContent=${source.includes('textContent')} htmlAssignment=${source.includes('innerHTML')} refusedScheme=${source.includes('javascript:')} safeUrl=${source.includes('safeUrl')}` };
  });
}

const summary = {
  tool: 'verify-pages.mjs',
  base,
  mode: fixtures ? 'fixtures' : 'base',
  groups,
  checkedAt: new Date().toISOString(),
  passed: checks.filter(check => check.pass).length,
  failed: checks.filter(check => !check.pass).length,
  checks,
  limitations: [
    ...(groups.safety ? ['Rendering safety is source-checked here; DOM execution proof (markup renders as text, no refused URL navigates) needs the browser gate (WP0.7).'] : []),
    ...(fixtures ? ['The file-backed fixture source returns declared refusal documents for /circuit/stale; digest recomputation against a published declaration is exercised by the staged reader.'] : []),
  ],
};
stopFixtureObserver();
console.log(JSON.stringify(summary, null, 2));
process.exitCode = summary.failed > 0 ? 1 : 0;
