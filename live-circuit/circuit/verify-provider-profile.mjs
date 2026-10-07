// Provider involvement profile checks. Reads only; needs no running host.
//   node verify-provider-profile.mjs
// The drill-down must render the structured profile from the details reader,
// keep the canonical fallback for platform catalogs, and stage (never apply)
// change documents with their expectedDigest guards.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { providerProfileModel, instructionChange, engagementChange } from './provider-profile.js';

const here = new URL('./', import.meta.url);
const host = JSON.parse(await readFile(new URL('circuit-host.json', here), 'utf8'));
const policy = await readFile(new URL('../../deploy/sda-kernel/retrieval-policy.json', here), 'utf8');
const store = await readFile(new URL('live-store.mjs', here), 'utf8');
const runtime = await readFile(new URL('circuit-runtime.js', here), 'utf8');
const profile = await readFile(new URL('provider-profile.js', here), 'utf8');
const server = await readFile(new URL('../dispatch-pair/observe-server.mjs', here), 'utf8');

const provider = host.retrieval.provider;
assert.equal(provider.procedure, 'analysis.read_provider_details', 'The details reader is the default');
assert.equal(provider.identityResultSet, 'provider_identity', 'The identity set pairs with the details reader');
assert.equal(provider.canonical?.procedure, 'analysis.read_provider_canonical_body', 'The canonical reader is retained as fallback');
assert.ok((provider.canonicalProviders ?? []).includes('sda-authority-transformation-port.v1'), 'Platform catalogs use the canonical fallback');
assert.ok(policy.includes('"analysis.read_provider_details"') && policy.includes('"analysis.read_provider_canonical_body"'), 'Both readers are admitted by the retrieval policy');
assert.match(store, /canonicalProviders/, 'The host selects the reader per provider');
assert.match(store, /readerFallback/, 'A failed details read degrades to the canonical reader with the reason recorded');
assert.match(store, /reader: reader\.procedure/, 'The response reports which reader ran');
assert.match(runtime, /renderProviderProfile\(/, 'The drill-down renders the structured profile');
assert.match(profile, /expectedDigest/, 'Staged documents carry the optimistic guard');
assert.match(profile, /model\.install_provider_details_change/, 'The staged document names its writer');
assert.ok(!/fetch\(/.test(profile), 'The profile module never calls a network writer');
assert.ok(server.includes("['/circuit/provider-profile.js'"), 'The circuit host serves provider-profile.js');

// Pure helpers: sets resolve by name; change documents match the writer contract.
const data = { providerId: 'google/gemini-select', definitionDigest: '6cc29f2d',
  resultSets: [{ name: 'provider_identity', columns: ['provider_id'], rows: [{ provider_id: 'google/gemini-select' }] },
    { name: 'provider_engagements', columns: ['capability_id'], rows: [{ capability_id: 'request-capability-from-objective-v3' }] }] };
const model = providerProfileModel(data);
assert.equal(model.identity.provider_id, 'google/gemini-select');
assert.equal(model.engagements.rows.length, 1);
assert.deepEqual(model.bindings.rows, [], 'A missing set is empty, never invented');

const instruction = instructionChange(data, { namespace: 'sidefx:capability:request-capability-from-objective-v3', declared_id: 'build-agent-model-request',
  json_path: '$.expression.fields.modelRequest.fields.interaction.fields.messages.items[0].fields.content.template', definition_digest: '46ff5075' }, 'You map one user objective...');
assert.deepEqual(instruction, { providerId: 'google/gemini-select', expectedDigest: '6cc29f2d',
  instructions: [{ namespace: 'sidefx:capability:request-capability-from-objective-v3', declaredId: 'build-agent-model-request',
    path: '$.expression.fields.modelRequest.fields.interaction.fields.messages.items[0].fields.content.template', valueJson: 'You map one user objective...', expectedDigest: '46ff5075' }] });

const engagement = engagementChange(data, { capability_id: 'request-capability-from-objective-v3', port_id: 'select-capability-model-port', generation_digest: 'eb055ff2' },
  '$.configuration.resultMode', '"replace-carrier"');
assert.deepEqual(engagement, { providerId: 'google/gemini-select', expectedDigest: '6cc29f2d',
  engagements: [{ capabilityId: 'request-capability-from-objective-v3', portId: 'select-capability-model-port',
    path: '$.configuration.resultMode', valueJson: '"replace-carrier"', expectedDigest: 'eb055ff2' }] });

console.log(JSON.stringify({ checked: 'provider involvement profile', reader: provider.procedure, fallback: provider.canonicalProviders, appliedByClient: false }));
