// The provider involvement profile and the staged change document.
//
// Renders the sets analysis.read_provider_details returns as a structured
// profile: identity, configuration, mechanics/ports, bindings, engagements,
// instructions, invocations and summary, with the raw sets kept unchanged in a
// fold. Reads are current database reads, never execution receipts.
//
// The panel is read-only by design. Edits stage the exact change document for
// model.install_provider_details_change (providerId, expectedDigest and the
// layer-writer sections) and copy or download it; nothing here calls a writer.
import { el } from './circuit-viewer.js';

const show = value => value == null ? '\u2014' : typeof value === 'object' ? JSON.stringify(value) : String(value);
const first = (row, keys) => { for (const key of keys) if (row?.[key] != null && row[key] !== '') return row[key]; return null; };
const setOf = (data, name) => data.resultSets.find(set => set.name === name) ?? { name, columns: [], rows: [] };

export function providerProfileModel(data) {
  return {
    identity: setOf(data, 'provider_identity').rows[0] ?? {},
    configuration: setOf(data, 'provider_configuration').rows[0] ?? {},
    mechanics: setOf(data, 'provider_mechanics'),
    bindings: setOf(data, 'provider_bindings'),
    engagements: setOf(data, 'provider_engagements'),
    instructions: setOf(data, 'provider_instructions'),
    invocations: setOf(data, 'provider_invocations'),
    summary: setOf(data, 'provider_summary'),
  };
}

// The change document is the reading's own fields, shaped for the writer.
// valueJson is a string: raw text for a template, JSON text for other values.
export function instructionChange(data, instruction, valueJson) {
  const namespace = first(instruction, ['namespace', 'owner_namespace']);
  const declaredId = first(instruction, ['declared_id', 'declaredId', 'owner_id', 'definition_id']);
  const path = first(instruction, ['json_path', 'path', 'member_path']);
  const expectedDigest = first(instruction, ['definition_digest', 'digest']);
  return { providerId: data.providerId, expectedDigest: data.definitionDigest,
    instructions: [{ namespace, declaredId, path, valueJson, ...(expectedDigest ? { expectedDigest } : {}) }] };
}

export function engagementChange(data, engagement, path, valueJson) {
  const capabilityId = first(engagement, ['capability_id', 'capabilityId', 'capability']);
  const portId = first(engagement, ['port_id', 'portId', 'port']);
  const expectedDigest = first(engagement, ['generation_digest', 'digest']);
  return { providerId: data.providerId, expectedDigest: data.definitionDigest,
    engagements: [{ capabilityId, portId, path, valueJson, ...(expectedDigest ? { expectedDigest } : {}) }] };
}

function heading(host, text_, note) {
  host.append(el('h3', { text: text_ }), note ? el('p', { class: 'note', text: note }) : null);
}
function table(host, set) {
  if (!set.rows.length) { host.append(el('p', { class: 'note', text: `No ${set.name} rows.` })); return; }
  const head = el('tr', {}, set.columns.map(c => el('th', { text: c })));
  const body = el('tbody', {}, set.rows.map(r => el('tr', {}, set.columns.map(c => el('td', { text: show(r[c]), title: show(r[c]) })))));
  host.append(el('div', { class: 'table-wrap' }, el('table', {}, [el('thead', {}, head), body])));
}
function fields(host, row, skip = []) {
  const entries = Object.entries(row).filter(([key]) => !skip.includes(key));
  const dl = el('dl', { class: 'answer-fields' }, entries.flatMap(([key, value]) => [el('dt', { text: key }), el('dd', { text: show(value) })]));
  host.append(dl);
}
function chip(text_, cls) { return el('span', { class: `profile-chip ${cls ?? ''}`, text: text_ }); }

// Stage a document in the shared fold: copy, download and the exact JSON. The
// wording never implies the change is applied.
function stageDocument(host, title, document) {
  const json = JSON.stringify(document, null, 2);
  const pre = el('pre', { class: 'document-preview', text: json });
  const copy = el('button', { type: 'button', class: 'button secondary small', text: 'Copy document' });
  const download = el('a', { class: 'button secondary small', href: URL.createObjectURL(new Blob([json], { type: 'application/json' })), download: 'provider-details-change.json', text: 'Download' });
  const status = el('p', { class: 'note', text: 'Nothing is applied here. Apply the document with model.install_provider_details_change (estate migration or server-side DAL); a stale expectedDigest refuses the change.' });
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(json); copy.textContent = 'Copied'; }
    catch { copy.textContent = 'Copy unavailable \u2014 select the JSON'; }
  });
  const fold = el('details', { class: 'profile-change' }, [el('summary', { text: title }), copy, download, status, pre]);
  host.append(fold);
  fold.open = true;
}

function instructionEditor(container, data, instruction) {
  const kind = first(instruction, ['instruction_kind', 'kind']) ?? 'INSTRUCTION';
  const current = first(instruction, ['value', 'instruction_value', 'template', 'member_value']);
  const editor = el('textarea', { rows: 4, spellcheck: 'false', class: 'instruction-editor', text: typeof current === 'string' ? current : JSON.stringify(current ?? '', null, 2) });
  const share = el('button', { type: 'button', class: 'button secondary small', text: 'Stage change document' });
  share.addEventListener('click', () => stageDocument(container, `Change document \u00b7 ${kind}`, instructionChange(data, instruction, editor.value)));
  container.append(editor, el('div', { class: 'observe-actions' }, share));
}

// Named pillars use the documented columns when present and fall back to the
// raw fields, so a reader column rename never blanks the profile.
export function renderProviderProfile(data) {
  const nodes = [];
  const host = el('div', { class: 'provider-profile' });
  const model = providerProfileModel(data);
  const identity = model.identity;
  const header = el('div', { class: 'profile-head' }, [
    el('strong', { text: show(first(identity, ['provider_id', 'id']) ?? data.providerId) }),
    chip(show(first(identity, ['provider_state', 'state']) ?? 'DECLARED'), first(identity, ['provider_state', 'state']) === 'ENGAGED_UNDECLARED' ? 'warn' : 'ok'),
    chip(show(first(identity, ['namespace', 'namespace_id']) ?? 'namespace not returned')),
    chip(`reader ${data.reader ?? 'declared'}`),
  ]);
  nodes.push(el('h3', { text: 'Provider involvement' }), header,
    el('p', { class: 'note', text: `${data.resultSets.length} result sets \u00b7 read ${data.readAt}. Current database read, not an execution receipt.` }));

  host.append(el('h4', { text: 'Identity' }), el('p', { class: 'notice', text: Object.entries(identity).map(([k, v]) => `${k}: ${show(v)}`).join('  \u00b7  ') || 'identity set empty' }));
  host.append(el('h4', { text: 'Configuration' }));
  fields(host, model.configuration, ['raw_configuration', 'configuration_json']);
  const raw = first(model.configuration, ['raw_configuration', 'configuration_json']);
  if (raw != null) host.append(el('details', {}, [el('summary', { text: 'Raw configuration JSON' }), el('pre', { text: show(raw) })]));

  host.append(el('h4', { text: 'Mechanics \u00b7 ports' })); table(host, model.mechanics);
  host.append(el('h4', { text: 'Bindings' })); table(host, model.bindings);

  host.append(el('h4', { text: 'Engagements \u00b7 ports that name this provider' }));
  if (!model.engagements.rows.length) host.append(el('p', { class: 'note', text: 'No engagement rows.' }));
  for (const engagement of model.engagements.rows) {
    const engagementKind = show(first(engagement, ['engagement_kind', 'kind', 'generation_kind']));
    const label = `${show(first(engagement, ['capability_id', 'capabilityId', 'capability']))} \u00b7 ${show(first(engagement, ['port_id', 'portId', 'port']))}`;
    const path = el('input', { type: 'text', class: 'document-path', value: '$.configuration.resultMode', 'aria-label': 'Configuration path' });
    const value = el('input', { type: 'text', class: 'document-value', placeholder: 'valueJson \u2014 e.g. "replace-carrier"', 'aria-label': 'valueJson' });
    const stage = el('button', { type: 'button', class: 'button secondary small', text: 'Stage request change' });
    stage.addEventListener('click', () => {
      if (!value.value) return;
      stageDocument(host, `Change document \u00b7 ${label}`, engagementChange(data, engagement, path.value, value.value));
    });
    host.append(el('details', { class: 'record' }, [el('summary', { text: `${engagementKind} \u00b7 ${label}` }),
      el('div', { class: 'answer-fields' }, Object.entries(engagement).flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: show(v) })])),
      el('p', { class: 'note', text: 'Patch one configuration member (model.patch_port_configuration), digest-guarded. Credentials are references and injection rules; values are never shown.' }),
      el('div', { class: 'document-row' }, [path, value, stage])]));
  }

  host.append(el('h4', { text: 'Instructions \u00b7 SYSTEM / USER declarations, projections, fixtures' }));
  const instructionHost = el('div', {});
  host.append(instructionHost);
  const renderInstructions = limit => {
    instructionHost.replaceChildren();
    const rows = model.instructions.rows;
    if (!rows.length) { instructionHost.append(el('p', { class: 'note', text: 'No instruction rows.' })); return; }
    if (rows.length > limit) instructionHost.append(el('p', { class: 'note', text: `${rows.length} instruction rows; showing the first ${limit}. A fixture-heavy provider lists every instruction-bearing transformation.` }));
    for (const instruction of rows.slice(0, limit)) {
      const kind = show(first(instruction, ['instruction_kind', 'kind']));
      const path = show(first(instruction, ['json_path', 'path', 'member_path']));
      const editable = /^DECLARED_/.test(kind) && first(instruction, ['definition_digest', 'digest']) != null;
      const fold = el('details', { class: 'record' });
      fold.append(el('summary', { text: `${kind} \u00b7 ${path}` }),
        el('div', { class: 'answer-fields' }, Object.entries(instruction).flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: show(v) })])),
        ...(editable ? [] : [el('p', { class: 'note', text: 'Fixture, projected or mapped copy \u2014 not the declared template; view only.' })]));
      if (editable) instructionEditor(fold, data, instruction);
      instructionHost.append(fold);
    }
    if (rows.length > limit) {
      const more = el('button', { type: 'button', class: 'button secondary small', text: `Show all ${rows.length} instructions` });
      more.addEventListener('click', () => renderInstructions(rows.length));
      instructionHost.append(more);
    }
  };
  renderInstructions(200);

  host.append(el('h4', { text: 'Invocations \u00b7 fixtures' })); table(host, model.invocations);
  host.append(el('h4', { text: 'Summary' })); table(host, model.summary);
  host.append(el('details', {}, [el('summary', { text: 'Raw result sets (unchanged)' }), ...data.resultSets.map(set => {
    const fold = el('details', {}, [el('summary', { text: `${set.name} \u00b7 ${set.rows.length} rows` })]); table(fold, set); return fold;
  })]));
  nodes.push(host);
  return nodes;
}
