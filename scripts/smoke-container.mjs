import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const origin = process.argv[2] ?? 'http://127.0.0.1:3000';
const noindex = process.argv.includes('--noindex');
const revisionArgument = process.argv.indexOf('--revision');
const expectedRevision = revisionArgument < 0 ? undefined : process.argv[revisionArgument + 1];
if (revisionArgument >= 0) assert.ok(expectedRevision, '--revision requires the image source commit');
const publication = JSON.parse(readFileSync(new URL('../generated/estate-publication.json', import.meta.url), 'utf8'));
const visuals = JSON.parse(readFileSync(new URL('../generated/visual-publication.json', import.meta.url), 'utf8'));
const paths = ['/', '/platform', '/capabilities', '/mechanics', '/providers', '/build', '/contact', '/docs/ownership', '/sitemap.xml', '/robots.txt', '/healthz', '/readyz'];
for (const kind of ['capabilities', 'mechanics', 'providers']) paths.push(`/${kind}/${publication[kind][0].urlKey}`);

for (let attempt = 0; ; attempt++) {
  try {
    const response = await fetch(new URL('/readyz', origin), { signal: AbortSignal.timeout(5000) });
    const body = response.ok ? await response.json().catch(() => null) : null;
    if (body?.status === 'ready' && (!expectedRevision || response.headers.get('x-sidefx-release') === expectedRevision)) break;
    if (attempt === 59) throw new Error(`Expected release did not become ready (HTTP ${response.status})`);
  } catch (error) {
    if (attempt === 59) throw error;
  }
  await new Promise(resolve => setTimeout(resolve, 2000));
}

const assets = new Set();
for (const path of paths) {
  const response = await fetch(new URL(path, origin), { redirect: 'manual', signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200, `${path}: ${response.status}`);
  if (noindex) assert.match(response.headers.get('x-robots-tag') ?? '', /noindex/, `${path}: staging indexing`);
  const body = await response.text();
  if (['/healthz', '/readyz'].includes(path)) {
    assert.match(response.headers.get('cache-control') ?? '', /no-store/);
    assert.deepEqual(JSON.parse(body), { status: path === '/healthz' ? 'ok' : 'ready' });
    if (path === '/readyz' && expectedRevision) assert.equal(response.headers.get('x-sidefx-release'), expectedRevision);
  }
  if (path === '/robots.txt' && noindex) assert.match(body, /Disallow: \/\s*$/);
  if (path.startsWith('/capabilities/')) {
    assert.ok(body.includes(publication.capabilities[0].title), 'Wrong capability page');
    assert.match(body, /<svg/, 'Missing server-rendered circuit');
  }
  for (const match of body.matchAll(/(?:src|href)="(\/_next\/static\/[^"?]+)(?:\?[^" ]*)?"/g)) assets.add(match[1]);
  console.log(`PASS ${path}`);
}
assert.ok([...assets].some(path => path.endsWith('.css')), 'No CSS references found');
assert.ok([...assets].some(path => path.endsWith('.js')), 'No JS references found');
for (const path of assets) {
  const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200, `Missing static asset ${path}`);
}
const redirect = await fetch(new URL('/mcp', origin), { redirect: 'manual' });
assert.equal(redirect.status, 308);
assert.equal(new URL(redirect.headers.get('location'), origin).pathname, '/managed-capability-provider');
const missing = await fetch(new URL('/capabilities/estate/not-a-real-capability', origin));
assert.equal(missing.status, 404);
console.log(`PASS ${assets.size} static assets, canonical redirect and missing capability`);
const media=new Set(visuals.visuals.map(v=>v.url));
for(const edition of visuals.editions)for(const url of [edition.circuitUrl,edition.captions])if(url)media.add(url);
for(const circuit of [visuals.circuits[0],visuals.circuits.at(-1)])if(circuit)for(const url of circuit.artifacts)media.add(url);
for(const path of media){
 const response=await fetch(new URL(path,origin),{signal:AbortSignal.timeout(15000)});
 assert.equal(response.status,200,`Missing published media ${path}`);
 const bytes=Buffer.from(await response.arrayBuffer());
 assert.equal(createHash('sha256').update(bytes).digest('hex'),visuals.artifacts[path].sha256,`Changed published media ${path}`);
}
for(const edition of visuals.editions.filter(e=>e.film)){
 const response=await fetch(new URL(edition.film,origin),{headers:{Range:'bytes=0-1023'},signal:AbortSignal.timeout(15000)});
 assert.equal(response.status,206,'Film seeking requires HTTP range support');
 assert.match(response.headers.get('content-range')??'',/^bytes 0-1023\/[0-9]+$/);
 assert.equal((await response.arrayBuffer()).byteLength,1024);
}
console.log(`PASS ${media.size} media byte hashes, published circuit closure samples and film seeking`);

// §13.1 — every capability page carries the execution surface, and nothing executes on load.
// Whether a given capability can execute is the estate's answer at run time, so the image is
// checked for the control and its stated limits, not for a preparation outcome.
for (const kind of ['capabilities']) {
  for (const capability of [publication[kind][0], publication[kind].at(-1)]) {
    const response = await fetch(new URL(`/${kind}/${capability.urlKey}`, origin), { signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 200);
    const body = await response.text();
    assert.match(body, /invocation-panel/, `${capability.entityId}: no execution surface`);
    assert.match(body, /Run this capability/, `${capability.entityId}: no run control`);
    assert.doesNotMatch(body, /invocation-result/, `${capability.entityId}: a result rendered before any run`);
    // The page must keep stating what an execution does not establish.
    assert.match(body, /separately unevaluated/, `${capability.entityId}: execution limits dropped`);
  }
}
console.log('PASS capability execution surface present, inert on load, with its limits stated');
