import fs from 'node:fs';
import path from 'node:path';
import { at } from '@/lib/lab/compiler';
type Element = { elementId: string; op: string; pointers: Record<string, string>; fields?: string[];
  itemPath?: string; label?: string; emptyText?: string; dispositionLabels?: Record<string, string>; precision?: number };
type Variant = { outcomeId: string; title: string; anchor: unknown; layout: string; elements: Element[];
  match: { contractId: string; discriminatorPointer?: string; discriminatorValues?: unknown[] } };
type Manifest = { publicationId: string; capabilities: { subject: string; outcomeContract: string; variants: Variant[] }[] };
let manifest: Manifest | undefined;
const label = (s: string) => s.split('/').at(-1)!.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ');
const value = (v: unknown) => v === undefined ? { present: false, value: null } : { present: true, value: v };
export function presentRun(run: Record<string, unknown>) {
  const result = run.result as { status?: string; disposition?: string; outcome?: unknown; evidence?: Record<string, unknown> } | undefined;
  if (result?.status !== 'EXECUTED') return run;
  if (result.disposition !== 'terminated') return { ...run, presentationFinding: 'NO_TERMINAL_CAPABILITY_OUTCOME' };
  manifest ??= JSON.parse(fs.readFileSync(path.join(process.cwd(), 'generated/workbench-publication.json'), 'utf8')) as Manifest;
  const selection = run.selection as { subject: string; publicationId: string };
  if (manifest.publicationId !== selection.publicationId) return { ...run, presentationFinding: 'PRESENTATION_PUBLICATION_STALE' };
  const capability = manifest.capabilities.find(c => c.subject === selection.subject);
  // The pinned publication names the contract; a contract need not repeat its
  // own identity in its JSON instance. The service validated this terminal data
  // against that contract before retaining it as EXECUTED.
  const embeddedId = at(result.outcome, '/contractId');
  if (embeddedId !== undefined && embeddedId !== capability?.outcomeContract) return { ...run, presentationFinding: 'OUTCOME_CONTRACT_MISMATCH' };
  const matches = capability?.variants.filter(v => capability.outcomeContract === v.match.contractId &&
    (!v.match.discriminatorPointer || v.match.discriminatorValues?.includes(at(result.outcome, v.match.discriminatorPointer)))) ?? [];
  if (matches.length !== 1) return { ...run, presentationFinding: 'OUTCOME_VARIANT_UNRESOLVED' };
  const variant = matches[0]!;
  const elements = variant.elements.map(e => ({ componentId: 'outcome-' + variant.outcomeId + '-' + e.elementId, op: e.op, label: e.label,
    emptyText: e.emptyText, precision: e.precision, dispositionLabels: e.dispositionLabels,
    values: Object.fromEntries(Object.entries(e.pointers).map(([k, pointer]) => [k, value(at(result.outcome, pointer))])),
    fields: e.op === 'key-value' ? e.fields?.map(pointer => ({ label: label(pointer), ...value(at(result.outcome, pointer)) })) : undefined,
    rows: e.itemPath ? value(at(result.outcome, e.itemPath)) : undefined,
    rowFields: e.fields,
  }));
  return { ...run, presentation: { title: variant.title, anchor: variant.anchor, layout: variant.layout, elements } };
}
