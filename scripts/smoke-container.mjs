import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const origin = process.argv[2] ?? 'http://127.0.0.1:3000';
const noindex = process.argv.includes('--noindex');
const publication = JSON.parse(readFileSync(new URL('../generated/estate-publication.json', import.meta.url), 'utf8'));
const paths = ['/', '/platform', '/capabilities', '/mechanics', '/providers', '/build', '/contact', '/docs/ownership', '/sitemap.xml', '/robots.txt', '/healthz', '/readyz'];
for (const kind of ['capabilities', 'mechanics', 'providers']) paths.push(`/${kind}/${publication[kind][0].urlKey}`);

for (let attempt = 0; ; attempt++) {
  try {
    const response = await fetch(new URL('/readyz', origin), { signal: AbortSignal.timeout(5000) });
    if (response.ok) break;
    if (attempt === 59) throw new Error(`Readiness returned ${response.status}`);
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
