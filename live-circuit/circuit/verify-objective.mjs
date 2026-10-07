// Objective component checks. Reads only; needs no running host.
//   node verify-objective.mjs
// The universal capability's composer must be the prompt shell's pattern:
// prompt-shell mic icon, voice status, Run, and the universal subject. The
// client core must stay free of result-set names (specification rule 7).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { admissionBody, objectiveInput, OBJECTIVE_CAPABILITY, OBJECTIVE_CONTRACT } from './objective-run.js';

const here = new URL('./', import.meta.url);
const html = await readFile(new URL('explorer.html', here), 'utf8');
const explorer = await readFile(new URL('explorer.js', here), 'utf8');
const module_ = await readFile(new URL('objective-run.js', here), 'utf8');
const server = await readFile(new URL('../dispatch-pair/observe-server.mjs', here), 'utf8');
const client = [html, explorer, module_].join('\n');

for (const id of ['objective-form', 'objective-input', 'objective-voice-status', 'objective-mic', 'objective-run', 'objective-run-status', 'summary-strip', 'requested-capabilities'])
  assert.match(html, new RegExp(`id="${id}"`), `Explorer declares ${id}`);
assert.match(html, /<svg class="button-icon objective-mic-icon"[^>]*>[\s\S]*?M18\.585 13\.412[\s\S]*?<\/svg>/, 'The objective mic is the prompt-shell icon');
assert.match(html, /id="objective-run"[^>]*>Run</, 'The objective action is Run');
assert.match(html, /Voice ready/, 'The idle voice status is the shell copy');
assert.match(explorer, /createObjectiveRun\(/, 'The objective component is mounted in the Explorer');
assert.match(module_, /Review or Run\./, 'The captured voice status is the shell copy');
assert.ok(server.includes("['/circuit/objective-run.js'"), 'The circuit host serves objective-run.js');

// The admission body is the universal capability with the declared objective
// contract; the objective is trimmed and submitted verbatim, never guessed.
const body = admissionBody("What is Broadcom's current market price?");
assert.equal(OBJECTIVE_CAPABILITY, 'request-capability-from-objective-v3');
assert.equal(OBJECTIVE_CONTRACT, 'agent-objective-request.v1');
assert.deepEqual(body, { object: 'capability', operation: 'observe', subject: OBJECTIVE_CAPABILITY, namespace: 'sidefx:capabilities',
  input: { contractId: OBJECTIVE_CONTRACT, payload: { objective: "What is Broadcom's current market price?" } } });
assert.equal(admissionBody('   ').input.payload.objective, '', 'A blank objective is trimmed, never invented');
assert.equal(objectiveInput('  price  ').payload.objective, 'price');

// Rule 7: the client names no result set; and the design's Ask wording never returns.
assert(!/Ask/.test(html), 'The Explorer never labels the objective action Ask');
assert(!client.includes("'capability_navigation'") && !client.includes('"capability_navigation"'), 'The client names no result set');
console.log(JSON.stringify({ checked: 'objective component', capability: OBJECTIVE_CAPABILITY, contract: OBJECTIVE_CONTRACT, served: true }));
