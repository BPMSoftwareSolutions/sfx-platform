// Declared provider view checks (repointed from the retired bespoke renderer).
//   node verify-provider-profile.mjs
// The provider drill-down is declared-only: the estate-published view is read
// through the page reader, the host binds its own selection, and a view that
// cannot be read is a named visible state. Checks reader selection, retrieval
// admission and selection binding by behavior, and the served route table
// through a fixture observer. The click path (provider glyph -> declared view
// read -> named refusal) runs in a real browser in verify-run-evidence-browser.mjs.
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { providerReader } from './live-store.mjs';
import { bindViewSelection } from './view-runtime.js';
import { startFixtureObserver } from './fixture-observer.mjs';

const here = new URL('./', import.meta.url);
const host = JSON.parse(await readFile(new URL('circuit-host.json', here), 'utf8'));
const policy = JSON.parse(await readFile(new URL('../../deploy/sda-kernel/retrieval-policy.json', here), 'utf8'));

const provider = host.retrieval.provider;
assert.equal(provider.procedure, 'analysis.read_provider_details', 'The details reader is the default');
assert.equal(provider.identityResultSet, 'provider_identity', 'The identity set pairs with the details reader');
for (const canonical of provider.canonicalProviders ?? [])
  assert.equal(providerReader(provider, canonical).procedure, 'analysis.read_provider_canonical_body', `${canonical} selects the canonical reader`);
assert.ok((provider.canonicalProviders ?? []).includes('sda-authority-transformation-port.v1'), 'Canonical platform catalogs select the canonical reader');
assert.equal(providerReader(provider, 'google/gemini-select').procedure, 'analysis.read_provider_details', 'Other providers select the details reader');
assert.equal(providerReader({ ...provider, canonical: undefined }, 'sda-authority-transformation-port.v1').procedure,
  'analysis.read_provider_details', 'Without a declared canonical reader every provider reads details');
for (const reader of [provider, provider.canonical])
  assert.ok(policy.allowedProcedures.includes(reader.procedure), `${reader.procedure} is admitted by the retrieval policy`);

// The host selection wins over a declared default; an empty selection keeps it.
const declaredView = { sources: [{ sourceId: 'profile', reader: 'provider-inspection', input: { detailId: 'declared-default', extra: 'kept' } }] };
const bound = bindViewSelection(declaredView, { detailId: 'provider:selected' }).sources[0].input;
assert.equal(bound.detailId, 'provider:selected', 'The host selection wins over the declaration defaults');
assert.equal(bound.extra, 'kept', 'Declared inputs the selection does not name are preserved');
assert.equal(bindViewSelection(declaredView, { detailId: '' }).sources[0].input.detailId, 'declared-default', 'An empty selection keeps the declared default');

// The bespoke renderer is gone from the checkout and from the served routes.
await assert.rejects(access(new URL('provider-profile.js', here)), 'provider-profile.js is deleted');
const observer = await startFixtureObserver();
try {
  const [retired, runtime] = await Promise.all([fetch(`${observer.base}/circuit/provider-profile.js`), fetch(`${observer.base}/circuit/view-runtime.js`)]);
  await Promise.all([retired.body?.cancel(), runtime.body?.cancel()]);
  assert.equal(retired.status, 404, 'The circuit host does not serve provider-profile.js');
  assert.equal(runtime.status, 200, 'The circuit host serves view-runtime.js');
} finally { observer.stop(); }

console.log(JSON.stringify({ checked: 'declared provider view', reader: provider.procedure,
  canonical: provider.canonicalProviders, bespokeRenderer: 'absent', appliedByClient: false }));
