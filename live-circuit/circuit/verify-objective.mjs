// Objective component checks. Needs no running host; starts a fixture observer.
//   node verify-objective.mjs
// The admission and summary behavior of objective-run.js, the circuit host
// serving it, and specification rule 7 (the client core names no result set).
// The composer's rendered controls, its Run action and the exact admission it
// sends are proven in a real browser by verify-run-evidence-browser.mjs; this
// script does not match source spelling, icon geometry or copy.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { admissionBody, objectiveInput, spokenSummary, OBJECTIVE_CAPABILITY, OBJECTIVE_CONTRACT } from './objective-run.js';
import { startFixtureObserver } from './fixture-observer.mjs';

const here = new URL('./', import.meta.url);

// The admission body is the universal capability with the declared objective
// contract; the objective is trimmed and submitted verbatim, never guessed.
const body = admissionBody("What is Broadcom's current market price?");
assert.equal(OBJECTIVE_CAPABILITY, 'request-capability-from-objective-v3');
assert.equal(OBJECTIVE_CONTRACT, 'agent-objective-request.v1');
assert.deepEqual(body, { object: 'capability', operation: 'observe', subject: OBJECTIVE_CAPABILITY, namespace: 'sidefx:capabilities',
  input: { contractId: OBJECTIVE_CONTRACT, payload: { objective: "What is Broadcom's current market price?" } } });
assert.equal(admissionBody('   ').input.payload.objective, '', 'A blank objective is trimmed, never invented');
assert.equal(objectiveInput('  price  ').payload.objective, 'price');

// The spoken summary drops machine payloads; the on-screen text stays verbatim.
const machine = 'Nike (symbol: NKE) has an observed market price of $34.61 USD according to the Nasdaq Real Time Price data. Tool result: {"contractId":"equity-market-price-evidence.v1","payload":{"symbol":"NKE"}}';
assert.equal(spokenSummary(machine), 'Nike (symbol: NKE) has an observed market price of $34.61 USD according to the Nasdaq Real Time Price data.');
assert.equal(spokenSummary('Price is $34.61. {"a":[1,2]} Done.'), 'Price is $34.61. Done.');
assert.equal(spokenSummary('```json\n{"a":1}\n```'), '');
assert.equal(spokenSummary('{"only":"machine"}'), '');

// The circuit host serves the module the Explorer imports, byte for byte.
const observer = await startFixtureObserver();
try {
  const response = await fetch(`${observer.base}/circuit/objective-run.js`);
  assert.equal(response.status, 200, 'The circuit host serves objective-run.js');
  assert.equal(await response.text(), await readFile(new URL('objective-run.js', here), 'utf8'), 'The served module is the checked-out module');
} finally { observer.stop(); }

// Rule 7: the client core names no result set.
const client = (await Promise.all(['explorer.html', 'explorer.js', 'explorer-shell.js', 'objective-run.js']
  .map(name => readFile(new URL(name, here), 'utf8')))).join('\n');
assert(!client.includes("'capability_navigation'") && !client.includes('"capability_navigation"'), 'The client names no result set');
console.log(JSON.stringify({ checked: 'objective component', capability: OBJECTIVE_CAPABILITY, contract: OBJECTIVE_CONTRACT, served: true }));
