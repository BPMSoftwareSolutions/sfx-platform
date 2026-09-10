import { z } from 'zod';
import type { LabPilot, LabPublication, LabResult } from '@/contracts/lab';
import { at, object, parts, validators } from './compiler';

const requestSchema = z.object({ publicationId: z.string(), subject: z.string(),
  values: z.record(z.string(), z.unknown()), exampleId: z.string().optional() }).strict();

export function bindInput(pilot: LabPilot, values: Record<string, unknown>, exampleId?: string) {
  const editable = pilot.profile.inputs.filter(b => b.ownership === 'editable');
  if (Object.keys(values).some(k => !editable.some(b => b.pointer === k))) throw new Error('INPUT_OWNERSHIP_REFUSED');
  if (pilot.profile.interaction === 'retained-example-selection') {
    const example = pilot.examples.find(e => e.id === exampleId);
    if (!example) throw new Error('EXAMPLE_NOT_PUBLISHED');
    return structuredClone(example.input);
  }
  if (exampleId !== undefined) throw new Error('EXAMPLE_NOT_OFFERED');
  const input: Record<string, unknown> = {};
  for (const b of [...pilot.profile.inputs].sort((a, b) => parts(a.pointer).length - parts(b.pointer).length)) {
    if (b.ownership === 'system-bound') throw new Error('INPUT_BINDING_UNAVAILABLE');
    if (b.ownership === 'editable' && !Object.hasOwn(values, b.pointer)) {
      if (b.required) throw new Error('REQUIRED_INPUT_MISSING');
      continue;
    }
    const keys = parts(b.pointer), leaf = keys.pop()!;
    let parent = input;
    for (const key of keys) { if (!object(parent[key])) throw new Error('INPUT_PARENT_UNBOUND'); parent = parent[key]; }
    parent[leaf] = structuredClone(b.ownership === 'fixed' ? b.value : b.ownership === 'derived' ? {} : values[b.pointer]);
  }
  if (!validators(pilot).input(input)) throw new Error('INPUT_CONTRACT_REFUSED');
  return input;
}

export async function runPublishedInput(publication: LabPublication, raw: unknown,
  invoke: (subject: string, input: unknown, namespace?: string) => Promise<LabResult>): Promise<LabResult> {
  const request = requestSchema.safeParse(raw);
  const refused = (code: string, subject = ''): LabResult => ({ status: 'REFUSED', capabilityId: subject, code,
    message: code === 'STALE_PUBLICATION' ? 'This experience has changed. Reload it before running.' : 'The submitted input is not offered by this experience. Check the fields or selected example.' });
  if (!request.success) return refused('INVALID_LAB_REQUEST');
  const r = request.data;
  if (r.publicationId !== publication.publicationId) return refused('STALE_PUBLICATION', r.subject);
  const pilot = publication.pilots.find(p => p.profile.subject === r.subject);
  if (!pilot) return refused('SUBJECT_NOT_PUBLISHED', r.subject);
  let input: unknown;
  try { input = bindInput(pilot, r.values, r.exampleId); }
  catch (error) { return refused(error instanceof Error ? error.message : 'INPUT_REFUSED', r.subject); }
  const result = await invoke(r.subject, input, pilot.profile.namespace);
  if (result.status === 'EXECUTED') {
    // The local delivery pins authority before loading. Check the response as well.
    const identity = result.evidence.authorityIdentity;
    if (!object(identity) || Object.entries(pilot.authority.identity).some(([k, v]) => identity[k] !== v)
      || result.evidence.snapshotId !== pilot.authority.snapshotId || result.evidence.projectionDigest !== pilot.authority.projectionDigest
      || result.scenarioId !== pilot.authority.scenarioId
      || JSON.stringify(at(result.execution, '/result/input')) !== JSON.stringify(input)) {
      return { status: 'UNKNOWN', capabilityId: r.subject, code: 'EXECUTION_BINDING_MISMATCH', message: 'The response does not match the published input and authority. Execution cannot be confirmed for this experience.' };
    }
    if (result.disposition === 'terminated' && !validators(pilot).outcome(result.outcome)) {
      return { status: 'UNKNOWN', capabilityId: r.subject, code: 'OUTCOME_CONTRACT_MISMATCH', message: 'The returned outcome does not satisfy this experience’s contract.' };
    }
  }
  return result;
}
