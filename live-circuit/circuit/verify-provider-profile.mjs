// Declared provider view checks (repointed from the retired bespoke renderer).
//   node verify-provider-profile.mjs
// The provider drill-down is declared-only: the estate-published view is read
// through the page reader, the host binds its own selection, and a view that
// cannot be read is a named visible state. The bespoke provider-profile.js
// renderer and every reader fallback are gone; a read-only check, no host
// required.
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const here = new URL('./', import.meta.url);
const host = JSON.parse(await readFile(new URL('circuit-host.json', here), 'utf8'));
const policy = await readFile(new URL('../../deploy/sda-kernel/retrieval-policy.json', here), 'utf8');
const store = await readFile(new URL('live-store.mjs', here), 'utf8');
const runtime = await readFile(new URL('circuit-runtime.js', here), 'utf8');
const viewRuntime = await readFile(new URL('view-runtime.js', here), 'utf8');
const server = await readFile(new URL('../dispatch-pair/observe-server.mjs', here), 'utf8');

const provider = host.retrieval.provider;
assert.equal(provider.procedure, 'analysis.read_provider_details', 'The details reader is the default');
assert.equal(provider.identityResultSet, 'provider_identity', 'The identity set pairs with the details reader');
assert.ok((provider.canonicalProviders ?? []).includes('sda-authority-transformation-port.v1'), 'Canonical platform catalogs select the canonical reader');
assert.ok(policy.includes('"analysis.read_provider_details"') && policy.includes('"analysis.read_provider_canonical_body"'), 'Both readers are admitted by the retrieval policy');
assert.match(store, /canonicalProviders/, 'The host selects the canonical reader for canonical platform catalogs');
assert.ok(!store.includes('readerFallback'), 'No reader fallback is retained: a failed details read is a named refusal');
assert.match(runtime, /readView\(/, 'The drill-down reads the declared view');
assert.match(runtime, /createViewRuntime\(/, 'The drill-down projects the declared view');
assert.ok(!runtime.includes('renderProviderProfile') && !runtime.includes('provider-profile.js'), 'The bespoke profile renderer is not wired anywhere');
assert.ok(!server.includes("['/circuit/provider-profile.js'"), 'The circuit host does not serve provider-profile.js');
assert.match(viewRuntime, /input: \{ \.\.\.\(isRecord\(source\.input\)/, 'The host selection wins over the declaration defaults');
await assert.rejects(access(new URL('provider-profile.js', here)), 'provider-profile.js is deleted');

console.log(JSON.stringify({ checked: 'declared provider view', reader: provider.procedure,
  canonical: provider.canonicalProviders, bespokeRenderer: 'absent', readerFallback: 'absent', appliedByClient: false }));
