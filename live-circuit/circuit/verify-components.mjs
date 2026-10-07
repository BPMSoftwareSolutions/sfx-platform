#!/usr/bin/env node
// Component-kind conformance for the shipped ui-component.v1 adapters:
//   node live-circuit/circuit/verify-components.mjs
// For every shipped kind it proves two things: UI_COMPONENTS[kind].supportedRoles
// equals the kind's contract roles ∪ props, and every admitted role/name renders
// a consumption probe: a declaration carries a unique sentinel and the sentinel
// (or the role's observable effect) reaches the output. Dependency-free; Node has
// no DOM, so the harness carries an in-file DOM shim and the browser sign-in gate
// stays the DOM-execution backstop. Reads only; never starts a server.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// --- minimal DOM shim (createElement, append, attributes, querySelector) -----
class ShimNode {
  constructor(tagName) {
    this.tagName = String(tagName).toUpperCase();
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.className = '';
    this.id = '';
    this.text = '';
    this._text = '';
  }
  get textContent() {
    return this._text + this.children.map(child => (typeof child === 'string' ? child : child.textContent)).join('');
  }
  set textContent(value) {
    this.children = [];
    this._text = value === undefined || value === null ? '' : String(value);
  }
  append(...nodes) {
    for (const node of nodes.flat(3)) if (node !== undefined && node !== null && node !== false) this.children.push(node);
  }
  replaceChildren(...nodes) {
    this.children = []; this._text = '';
    this.append(...nodes);
  }
  hasChildNodes() {
    return this.children.length > 0 || this._text !== '';
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener() {}
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  querySelectorAll(selector) {
    const found = [];
    for (const node of this.descendants()) {
      if (selector.startsWith('.') && String(node.className).split(/\s+/).includes(selector.slice(1))) found.push(node);
      else if (selector === '[id]' && node.id) found.push(node);
      else if (selector === node.tagName.toLowerCase()) found.push(node);
    }
    return found;
  }
  *descendants() {
    for (const child of this.children) {
      if (typeof child === 'string') continue;
      yield child;
      yield* child.descendants();
    }
  }
}
globalThis.document = { createElement: tagName => new ShimNode(tagName) };

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const { UI_COMPONENT_ROLES, UI_COMPONENTS } = await import(pathToFileURL(path.join(here, 'ui-components.js')).href);

// The shipped ui-component.v1 contracts as seeded by
// sfx-embody/sql/migrations/declare-ui-page-reading.commit.sql:128-138 and the
// Phase-1 migration pair (five kinds, authored in parallel): the contract's own
// `roles` list and `props` keys. supportedRoles must equal their union; the role
// table keeps the names split by how the adapter consumes them.
const CONTRACTS = {
  hero: { roles: ['eyebrow', 'headline', 'lede', 'figure', 'primaryActionId'], props: ['eyebrow', 'headline', 'lede', 'figure', 'primaryActionId'] },
  section: { roles: ['heading', 'body', 'actions'], props: ['heading', 'body', 'actions'] },
  text: { roles: ['eyebrow', 'display', 'lede', 'micro', 'section-title', 'paragraph', 'note'], props: ['role', 'text'] },
  heading: { roles: ['level', 'chips', 'badges'], props: ['text', 'level', 'chips', 'badges'] },
  stat: { roles: ['value', 'label', 'sub'], props: ['label', 'value', 'sub'] },
  card: { roles: ['title', 'body', 'promise', 'meta', 'link', 'missing'], props: ['title', 'body', 'promise', 'meta', 'link', 'missing'] },
  'card-list': { roles: ['cards', 'catalog'], props: ['title', 'cards', 'catalogSourceId'] },
  list: { roles: ['items', 'current'], props: ['items', 'current', 'empty'] },
  'media.figure': { roles: ['svg', 'src', 'alt', 'caption', 'link', 'digest'], props: ['src', 'svg', 'alt', 'caption', 'link', 'digest'] },
  notice: { roles: ['title', 'body', 'action', 'state'], props: ['tone', 'title', 'body', 'actionId', 'state'] },
  table: { roles: ['columns', 'rows', 'caption', 'empty'], props: ['columns', 'rows', 'caption', 'empty'] },
  'field-list': { roles: ['fields', 'label'], props: ['fields', 'label'] },
  disclosure: { roles: ['summary', 'body'], props: ['summary', 'body'] },
  badge: { roles: ['label'], props: ['label', 'tone'] },
  'status-chip': { roles: ['label', 'state'], props: ['label', 'state'] },
};

const checks = [];
function record(name, pass, detail) {
  const entry = { name, pass: Boolean(pass), detail: detail ?? '' };
  checks.push(entry);
  console.log(`${entry.pass ? 'PASS' : 'FAIL'} ${name}${entry.detail ? ` · ${entry.detail}` : ''}`);
  return entry.pass;
}
function setEquals(left, right) {
  const a = new Set(left), b = new Set(right);
  return a.size === b.size && [...a].every(item => b.has(item));
}
function unionNames(roles, props) {
  const names = [];
  for (const name of [...(roles ?? []), ...(props ?? [])]) if (!names.includes(name)) names.push(name);
  return names;
}
const difference = (left, right) => left.filter(name => !right.includes(name));

// --- shim inspection helpers -------------------------------------------------
const nodeList = node => [...node.descendants()];
const textOf = node => node.textContent;
const attrsOf = node => nodeList(node)
  .flatMap(item => Object.entries(item.attributes).map(([name, value]) => `${name}=${value}`))
  .join(' ');
const tagsOf = node => nodeList(node).map(item => item.tagName);
const svgSentinel = sentinel => `<svg xmlns="http://www.w3.org/2000/svg" data-sentinel="${sentinel}"></svg>`;

// --- per-kind consumption probes --------------------------------------------
// Each probe declares one role with a unique sentinel and returns how that
// sentinel (or the role's observable effect) is observed in the rendered tree.
function probeSpec(kind, name) {
  const S = `sentinel-${kind}-${name}`;
  const textProbe = (props, extra = {}, detail = 'the declared value reaches the output') => ({
    entry: { sectionId: 'probe', props, ...extra },
    verify: root => textOf(root).includes(S),
    detail,
  });
  switch (`${kind}\u0000${name}`) {
    case 'hero\u0000figure':
      return {
        entry: { sectionId: 'probe', bindings: { figure: { kind: 'literal', value: { svg: svgSentinel(S) }, input: { capabilityId: S } } } },
        verify: root => tagsOf(root).includes('IMG') && textOf(root).includes(S),
        detail: 'the binding renders an image whose caption carries the sentinel',
      };
    case 'hero\u0000primaryActionId':
      return {
        entry: { sectionId: 'probe', props: { primaryActionId: S }, actions: [{ actionId: S, kind: 'navigate', to: `/${S}` }] },
        verify: root => attrsOf(root).includes(S),
        detail: 'the action renders a control whose link carries the sentinel',
      };
    case 'hero\u0000eyebrow': case 'hero\u0000headline': case 'hero\u0000lede':
      return textProbe({ [name]: S });
    case 'section\u0000actions':
      return {
        entry: { sectionId: 'probe', props: { actions: [{ actionId: S, label: S }] }, actions: [{ actionId: S, kind: 'navigate', to: '/probe' }] },
        verify: root => textOf(root).includes(S),
        detail: 'the action ref renders a control carrying the sentinel',
      };
    case 'section\u0000heading': case 'section\u0000body':
      return textProbe({ [name]: S });
    case 'text\u0000text':
      return textProbe({ role: 'paragraph', text: S });
    case 'text\u0000role':
      return {
        entry: { sectionId: 'probe', props: { role: 'display', text: S } },
        verify: root => {
          const first = nodeList(root)[0];
          return Boolean(first) && String(first.className).split(/\s+/).includes('display') && textOf(root).includes(S);
        },
        detail: 'a valid role value selects the rendered class',
      };
    case 'text\u0000eyebrow': case 'text\u0000display': case 'text\u0000lede': case 'text\u0000micro':
    case 'text\u0000section-title': case 'text\u0000paragraph': case 'text\u0000note':
      return {
        entry: { sectionId: 'probe', props: { role: name, text: S } },
        verify: root => {
          const first = nodeList(root)[0];
          return Boolean(first) && String(first.className).split(/\s+/).includes(name) && textOf(root).includes(S);
        },
        detail: 'the text-role value selects the rendered class',
      };
    case 'heading\u0000level':
      return {
        entry: { sectionId: 'probe', props: { text: S, level: 3 } },
        verify: root => tagsOf(root).includes('H3') && textOf(root).includes(S),
        detail: 'the declared level renders the matching heading element',
      };
    case 'heading\u0000chips':
      return textProbe({ chips: [S] });
    case 'heading\u0000badges':
      return textProbe({ badges: [{ text: S, kind: 'info' }] });
    case 'heading\u0000text':
      return textProbe({ text: S });
    case 'stat\u0000value': case 'stat\u0000label': case 'stat\u0000sub':
      return textProbe({ [name]: S });
    case 'card\u0000missing':
      return {
        entry: { sectionId: 'probe', props: { title: 'probe', meta: `probe/${S}`, missing: S, catalog: { capabilities: [{ capabilityId: 'not-the-card' }] } } },
        verify: root => textOf(root).includes(S),
        detail: 'an unmatched card renders the declared missing text',
      };
    case 'card\u0000link':
      return {
        entry: { sectionId: 'probe', props: { link: `/${S}` } },
        verify: root => attrsOf(root).includes(S),
        detail: 'the link renders an anchor carrying the sentinel',
      };
    case 'card\u0000title': case 'card\u0000body': case 'card\u0000promise': case 'card\u0000meta':
      return textProbe({ [name]: S });
    case 'card-list\u0000catalog':
      return {
        entry: { sectionId: 'probe', props: { catalog: { capabilities: [{ capabilityId: 'not-the-card' }] }, cards: [{ capabilityId: S, missing: `missing-${S}` }] } },
        verify: root => textOf(root).includes(`missing-${S}`),
        detail: 'the declared catalog decides the card match state',
      };
    case 'card-list\u0000catalogSourceId': {
      const sourceId = `source-${S}`;
      return {
        entry: { sectionId: 'probe', props: { catalogSourceId: sourceId, cards: [{ capabilityId: S, missing: `missing-${S}` }] } },
        context: { sources: { [sourceId]: { ok: true, status: 200, body: { capabilities: [{ capabilityId: 'not-the-card' }] }, error: null } } },
        verify: root => textOf(root).includes(`missing-${S}`),
        detail: 'the declared source id resolves the catalog for the card match state',
      };
    }
    case 'card-list\u0000title':
      return textProbe({ title: S });
    case 'card-list\u0000cards':
      return textProbe({ cards: [{ id: 'probe', title: S }] });
    case 'list\u0000items':
      return textProbe({ items: [{ runId: 'probe-run', meta: S }] });
    case 'list\u0000current':
      return textProbe({ current: S });
    case 'list\u0000empty':
      return textProbe({ items: [], empty: S });
    case 'media.figure\u0000svg':
      return {
        entry: { sectionId: 'probe', props: { svg: svgSentinel(S) } },
        verify: root => tagsOf(root).includes('IMG'),
        detail: 'the declared svg renders as an image',
      };
    case 'media.figure\u0000src':
      return {
        entry: { sectionId: 'probe', props: { src: `/${S}` } },
        verify: root => nodeList(root).some(node => node.src === `/${S}`),
        detail: 'the admitted source renders as the image src',
      };
    case 'media.figure\u0000alt':
      return {
        entry: { sectionId: 'probe', props: { svg: svgSentinel(S), alt: S } },
        verify: root => nodeList(root).some(node => node.tagName === 'IMG' && node.alt === S),
        detail: 'the alt text reaches the rendered image',
      };
    case 'media.figure\u0000caption':
      return textProbe({ caption: S });
    case 'media.figure\u0000link':
      return {
        entry: { sectionId: 'probe', props: { link: `/${S}` } },
        verify: root => attrsOf(root).includes(S),
        detail: 'the link renders an anchor carrying the sentinel',
      };
    case 'media.figure\u0000digest':
      return {
        entry: { sectionId: 'probe', props: { svg: svgSentinel(S), digest: '0'.repeat(64) } },
        verify: root => textOf(root).includes('digest check'),
        detail: 'a digest mismatch refuses visibly, proving the digest was consumed',
      };
    case 'notice\u0000tone':
      return {
        entry: { sectionId: 'probe', props: { tone: 'warning', title: S } },
        verify: root => {
          const first = nodeList(root)[0];
          return Boolean(first) && String(first.className).split(/\s+/).includes('warning') && textOf(root).includes(S);
        },
        detail: 'the declared tone selects the rendered class',
      };
    case 'notice\u0000state':
      return {
        entry: { sectionId: 'probe', props: { state: S } },
        verify: root => attrsOf(root).includes(`data-state=${S}`),
        detail: 'the declared state reaches data-state',
      };
    case 'notice\u0000action': case 'notice\u0000actionId':
      return textProbe({ [name]: S }, {}, 'an unmatched action id renders as text');
    case 'notice\u0000title': case 'notice\u0000body':
      return textProbe({ [name]: S });
    case 'table\u0000columns':
      return textProbe({ columns: [{ key: 'subject', label: S }], rows: [{ subject: 'value' }] }, {}, 'the declared column label reaches the header');
    case 'table\u0000rows': {
      const state = `state-${S}`;
      return {
        entry: { sectionId: 'probe', props: { columns: [{ key: 'subject', label: 'Subject' }, { key: 'state', label: 'State' }],
          rows: [{ subject: S, state: { label: `chip-${S}`, state } }] } },
        verify: root => textOf(root).includes(S) && attrsOf(root).includes(`data-state=${state}`),
        detail: 'the declared row cell reaches text and a {label,state} cell renders data-state',
      };
    }
    case 'table\u0000caption':
      return textProbe({ caption: S });
    case 'table\u0000empty':
      return textProbe({ rows: [], empty: S }, {}, 'an empty row set renders the declared empty text');
    case 'field-list\u0000fields':
      return {
        entry: { sectionId: 'probe', props: { fields: [{ label: `label-${S}`, value: `value-${S}` }] } },
        verify: root => textOf(root).includes(`label-${S}`) && textOf(root).includes(`value-${S}`),
        detail: 'the declared field label and value reach the list',
      };
    case 'field-list\u0000label':
      return textProbe({ label: S });
    case 'disclosure\u0000summary':
      return {
        entry: { sectionId: 'probe', props: { summary: S, body: `body-${S}` } },
        verify: root => tagsOf(root).includes('DETAILS') && tagsOf(root).includes('SUMMARY') && textOf(root).includes(S),
        detail: 'the declared summary renders inside a details element',
      };
    case 'disclosure\u0000body':
      return textProbe({ summary: 'probe summary', body: S });
    case 'badge\u0000label':
      return textProbe({ label: S });
    case 'badge\u0000tone': {
      const tone = `tone-${S}`;
      return {
        entry: { sectionId: 'probe', props: { label: S, tone } },
        verify: root => {
          const first = nodeList(root)[0];
          return Boolean(first) && String(first.className).split(/\s+/).includes(tone) && textOf(root).includes(S);
        },
        detail: 'the declared tone selects the rendered class and the label reaches text',
      };
    }
    case 'status-chip\u0000label':
      return textProbe({ label: S, state: 'mapped' });
    case 'status-chip\u0000state': {
      const state = `state-${S}`;
      return {
        entry: { sectionId: 'probe', props: { label: S, state } },
        verify: root => attrsOf(root).includes(`data-state=${state}`),
        detail: 'the declared state reaches data-state',
      };
    }
    default:
      return null;
  }
}
async function runProbe(kind, name) {
  const spec = probeSpec(kind, name);
  if (!spec) return { pass: false, detail: 'no consumption probe is defined for this role' };
  const root = document.createElement('div');
  const context = Object.assign({
    sources: {},
    resolve: binding => (binding && typeof binding === 'object' && 'value' in binding ? binding.value : binding),
    dispatch: () => {},
  }, spec.context ?? {});
  try {
    await UI_COMPONENTS[kind]?.render(root, spec.entry, context);
    await new Promise(resolve => setTimeout(resolve, 20));
  } catch (error) {
    return { pass: false, detail: `render threw ${error?.message ?? error}` };
  }
  try {
    return { pass: Boolean(spec.verify(root)), detail: spec.detail };
  } catch (error) {
    return { pass: false, detail: `assertion threw ${error?.message ?? error}` };
  }
}

// --- shipped-kind inventory, contract parity and probes ----------------------
const policy = JSON.parse(await readFile(path.join(here, 'circuit-host.json'), 'utf8'));
const allowlist = (policy.ui?.components ?? []).map(component => ({ kind: component?.kind, version: component?.version }));
const adapterKinds = Object.keys(UI_COMPONENTS);
const tableKinds = Object.keys(UI_COMPONENT_ROLES);

record('shipped-allowlist', setEquals(allowlist.map(component => component.kind), tableKinds) && setEquals(adapterKinds, tableKinds),
  `circuit-host=[${allowlist.map(component => component.kind).join(', ')}] adapters=[${adapterKinds.join(', ')}]`);
for (const component of allowlist) {
  const table = UI_COMPONENT_ROLES[component.kind];
  const versionsAgree = table?.version === component.version && UI_COMPONENTS[component.kind]?.version === component.version;
  record(`version-${component.kind}`, versionsAgree,
    `circuit-host=${component.version} table=${table?.version} adapter=${UI_COMPONENTS[component.kind]?.version}`);
}

let probeCount = 0;
for (const [kind, table] of Object.entries(UI_COMPONENT_ROLES)) {
  const adapter = UI_COMPONENTS[kind];
  const contract = CONTRACTS[kind];
  const tableNames = unionNames(table.roles, table.props);
  const contractNames = unionNames(contract?.roles, contract?.props);
  const supported = Array.isArray(adapter?.supportedRoles) ? adapter.supportedRoles : null;

  const derives = Boolean(supported) && setEquals(supported, tableNames);
  record(`supportedRoles-derived-${kind}`, derives,
    `supportedRoles=[${supported?.join(', ') ?? '(missing)'}] table=[${tableNames.join(', ')}]`);

  const parity = setEquals(tableNames, contractNames);
  record(`contract-parity-${kind}`, parity,
    parity ? `${contractNames.length} contract names agree both directions`
      : `table-only=[${difference(tableNames, contractNames).join(', ')}] contract-only=[${difference(contractNames, tableNames).join(', ')}]`);

  for (const name of tableNames) {
    const outcome = await runProbe(kind, name);
    probeCount += 1;
    record(`probe-${kind}-${name}`, outcome.pass, outcome.detail);
  }
}

const summary = {
  tool: 'verify-components.mjs',
  checkedAt: new Date().toISOString(),
  contractSource: 'sfx-embody/sql/migrations/declare-ui-page-reading.commit.sql:128-138 (shipped ui-component.v1 contracts)',
  kinds: tableKinds.length,
  probes: probeCount,
  passed: checks.filter(check => check.pass).length,
  failed: checks.filter(check => !check.pass).length,
  checks,
  limitations: [
    'Consumption probes run against an in-file DOM shim; the browser sign-in gate remains the DOM-execution backstop (WP0.7).',
    'The shipped contracts are embedded from the estate seed; estate reconciliation is re-proven by the declare-ui-page-reading migration pair.',
  ],
};
console.log(JSON.stringify(summary, null, 2));
process.exitCode = summary.failed > 0 ? 1 : 0;
