import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { presentRun } from '../lib/workbench/presentation';

test('bare provider outcomes use published identity and preserve relative collection fields', () => {
  const publication = JSON.parse(fs.readFileSync('generated/lab-publication.json', 'utf8'));
  const run = { selection: { subject:'resolve-sidefx-eligible-providers', publicationId:publication.publicationId },
    result: { status:'EXECUTED', disposition:'terminated', outcome:{ disposition:'NOT_OBSERVABLE', consideredCount:2,
      eligibleCount:0, providers:[{providerAuthorityId:'provider',eligibilityDisposition:'NOT_OBSERVABLE',reasonCode:'NO_TARGET',lifecycle:'ADMITTED'}], findings:[] } } };
  const presented = presentRun(run) as typeof run & {presentation:{elements:{op:string;rowFields?:string[];rows?:{value:unknown};values:Record<string,{value:unknown}>}[]}};
  assert.ok(presented.presentation);
  const rows = presented.presentation.elements.find(e=>e.op==='rows' && e.rowFields?.includes('providerAuthorityId'));
  assert.deepEqual(rows?.rows?.value,run.result.outcome.providers);
  assert.ok(presented.presentation.elements.some(e=>e.values.amount?.value===0));
  assert.equal('presentation' in presentRun({...run,result:{...run.result,outcome:{...run.result.outcome,contractId:'foreign.v1'}}}),false);
});
