#!/usr/bin/env node
// new-component.mjs — dependency-free scaffolder and contract checker for
// ui-component.v1 kinds, written to the frozen Lane A interface:
//
//   live-circuit/circuit/ui-components.js exports
//     UI_COMPONENT_ROLES = { kind: { version, roles, props } }
//   and UI_COMPONENTS[kind].supportedRoles === roles ∪ props.
//
// Scaffold (tests dry-run with --out into a scratch directory):
//   node tools/live-circuit/new-component.mjs <kind> [--version N]
//     [--roles a,b,c] [--props x,y] [--out <dir>] [--force]
//   writes <kind>.contract.json, <kind>.adapter.mjs, <kind>.parity.json and
//   <kind>.acceptance.md under <dir> (default tools/live-circuit/generated/<kind>).
//
// Check:
//   node tools/live-circuit/new-component.mjs --check [<contract.json>]
//     [--ui-components <module>]
//   validates a contract against its role table (both directions) and audits
//   the shipped ten against UI_COMPONENTS, the role table and circuit-host.json.
//   --ui-components points at a generated adapter stub before the kind is merged.
//
// Until Lane A lands UI_COMPONENT_ROLES, the loader falls back to
// UI_COMPONENTS[kind].supportedRoles as the role set (props empty) and the
// check receipt reports "legacy-supportedRoles"; the shipped-ten audit still
// runs. No production file outside tools/live-circuit is read for writing.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const canonicalModulePath = path.join(repoRoot, 'live-circuit', 'circuit', 'ui-components.js');
const hostPolicyPath = path.join(repoRoot, 'live-circuit', 'circuit', 'circuit-host.json');
const kindPattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const rolePattern = /^[A-Za-z][A-Za-z0-9._-]*$/;

function usage() {
  return [
    'usage: node tools/live-circuit/new-component.mjs <kind> [--version N] [--roles a,b] [--props x,y] [--out <dir>] [--force]',
    '       node tools/live-circuit/new-component.mjs --check [<contract.json>] [--ui-components <module>]',
  ].join('\n');
}
function parseArgs(argv, allowed) {
  const values = new Map(), positional = [];
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg.startsWith('--')) { positional.push(arg); continue; }
    const name = arg.slice(2);
    if (!allowed.has(name)) throw new Error(`unknown option --${name}`);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) values.set(name, true);
    else { values.set(name, next); index++; }
  }
  return { positional, value: name => values.get(name), has: name => values.has(name) };
}
function listOption(value, name) {
  if (value === undefined || value === true) return [];
  const names = String(value).split(',').map(item => item.trim()).filter(Boolean);
  for (const item of names) if (!rolePattern.test(item)) throw new Error(`--${name} entry "${item}" is not a valid role name`);
  return [...new Set(names)];
}
function kindFn(kind) {
  return kind.split(/[.-]/).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}
function contractNames(contract) {
  const roles = Array.isArray(contract?.roles) ? contract.roles : [];
  const props = contract?.props && typeof contract.props === 'object' ? Object.keys(contract.props) : [];
  return [...new Set([...roles, ...props])];
}
function validateContractShape(contract) {
  if (contract?.document !== 'ui-component.v1') return 'document must be "ui-component.v1"';
  if (typeof contract.kind !== 'string' || !kindPattern.test(contract.kind)) return 'kind must be a lower-case dotted/dashed name';
  if (!Number.isInteger(contract.version) || contract.version < 1) return 'version must be a positive integer';
  if (!Array.isArray(contract.roles) || contract.roles.some(role => typeof role !== 'string' || !role)) return 'roles must be a non-empty string array';
  if (new Set(contract.roles).size !== contract.roles.length) return 'roles must not repeat';
  if (!contract.props || typeof contract.props !== 'object' || Array.isArray(contract.props)) return 'props must be an object';
  if (Object.keys(contract.props).some(key => typeof key !== 'string' || !key)) return 'props keys must be non-empty strings';
  const overlap = contract.roles.filter(role => Object.prototype.hasOwnProperty.call(contract.props, role));
  if (overlap.length) return `roles and props overlap: ${overlap.join(',')}`;
  if (contract.states !== undefined && (!Array.isArray(contract.states) || contract.states.some(state => typeof state !== 'string' || !state))) return 'states must be a string array when present';
  return null;
}

// Normalize either the frozen UI_COMPONENT_ROLES table or the pre-K1
// UI_COMPONENTS supportedRoles arrays into { kind: { version, roles, props } }.
function normalizeTable(module, label) {
  const table = {};
  if (module?.UI_COMPONENT_ROLES && typeof module.UI_COMPONENT_ROLES === 'object') {
    for (const [kind, entry] of Object.entries(module.UI_COMPONENT_ROLES)) {
      table[kind] = {
        version: entry?.version ?? null,
        roles: Array.isArray(entry?.roles) ? [...entry.roles] : Object.keys(entry?.roles ?? {}),
        props: Array.isArray(entry?.props) ? [...entry.props] : Object.keys(entry?.props ?? {}),
      };
    }
    return { table, mode: 'role-table' };
  }
  if (module?.UI_COMPONENTS && typeof module.UI_COMPONENTS === 'object') {
    for (const [kind, adapter] of Object.entries(module.UI_COMPONENTS)) {
      table[kind] = {
        version: adapter?.version ?? null,
        roles: Array.isArray(adapter?.supportedRoles) ? [...adapter.supportedRoles] : [],
        props: [],
      };
    }
    return { table, mode: 'legacy-supportedRoles' };
  }
  throw new Error(`${label} exports neither UI_COMPONENT_ROLES nor UI_COMPONENTS`);
}

async function auditShippedTen(adapters, table, record) {
  const adaptersPresent = adapters && typeof adapters === 'object';
  record('shipped-ten-adapters', adaptersPresent, adaptersPresent ? Object.keys(adapters).join(', ') : 'ui-components.js does not export UI_COMPONENTS');
  if (!adaptersPresent) return;
  const shipped = Object.keys(adapters);
  const policy = JSON.parse(await readFile(hostPolicyPath, 'utf8'));
  const allowlist = policy?.ui?.components ?? [];
  const allowKinds = allowlist.map(component => component?.kind);
  const sameSet = shipped.length === allowKinds.length && shipped.every(kind => allowKinds.includes(kind));
  record('shipped-ten-allowlist', sameSet, `adapters=[${shipped.join(', ')}] circuit-host=[${allowKinds.join(', ')}]`);
  const versionProblems = allowlist.filter(component => adapters[component?.kind]?.version !== component?.version)
    .map(component => `${component?.kind}: allowlist ${component?.version} vs adapter ${adapters[component?.kind]?.version}`);
  record('shipped-ten-versions', versionProblems.length === 0, versionProblems.join('; ') || 'all ten versions agree');
  const problems = [];
  for (const kind of shipped) {
    const entry = table[kind];
    if (!entry) { problems.push(`${kind}: missing from the role table`); continue; }
    const union = new Set([...entry.roles, ...entry.props]);
    const supported = adapters[kind]?.supportedRoles;
    if (!Array.isArray(supported)) { problems.push(`${kind}: adapter has no supportedRoles`); continue; }
    if (supported.length !== union.size || !supported.every(role => union.has(role)))
      problems.push(`${kind}: supportedRoles [${supported.join(', ')}] != table union [${[...union].join(', ')}]`);
  }
  record('shipped-ten-role-parity', problems.length === 0, problems.join('; ') || `${shipped.length} kinds agree with the role table`);
}

async function runCheck(contractPath, overridePath) {
  const checks = [];
  const record = (name, pass, detail) => checks.push({ name, pass: Boolean(pass), detail: detail ?? '' });
  const canonical = await import(pathToFileURL(canonicalModulePath).href);
  const canonicalTable = normalizeTable(canonical, 'live-circuit/circuit/ui-components.js');
  let tableSource = canonicalTable;
  let tableLabel = 'live-circuit/circuit/ui-components.js';
  if (overridePath) {
    const resolved = path.resolve(process.cwd(), overridePath);
    const override = await import(pathToFileURL(resolved).href);
    tableSource = normalizeTable(override, overridePath);
    tableLabel = resolved;
  }
  const { table, mode } = tableSource;

  if (contractPath) {
    const contract = JSON.parse(await readFile(path.resolve(process.cwd(), contractPath), 'utf8'));
    const shapeProblem = validateContractShape(contract);
    record('contract-shape', shapeProblem === null, shapeProblem ?? `${contract.document} ${contract.kind}@${contract.version}`);
    const entry = table[contract.kind];
    record('contract-kind-in-table', Boolean(entry), entry ? contract.kind : `${contract.kind} is not in ${tableLabel}`);
    if (entry) {
      const union = new Set([...entry.roles, ...entry.props]);
      const names = contractNames(contract);
      const namesSet = new Set(names);
      const forward = names.filter(name => !union.has(name));
      const reverse = [...union].filter(name => !namesSet.has(name));
      record('contract-role-parity', forward.length === 0 && reverse.length === 0,
        forward.length === 0 && reverse.length === 0
          ? `${names.length} role names agree both directions`
          : `contract-only=[${forward.join(', ')}] table-only=[${reverse.join(', ')}]`);
      record('contract-version', entry.version == null || contract.version === entry.version,
        `contract ${contract.version} table ${entry.version}`);
    }
    const adapter = canonical?.UI_COMPONENTS?.[contract.kind];
    if (adapter?.supportedRoles) {
      const union = new Set([...(entry?.roles ?? []), ...(entry?.props ?? [])]);
      const supported = new Set(adapter.supportedRoles);
      const names = contractNames(contract);
      record('contract-supportedRoles', supported.size === union.size && [...supported].every(role => union.has(role)) && names.every(role => supported.has(role)),
        `adapter supportedRoles=${adapter.supportedRoles.length} contract names=${names.length} table union=${union.size}`);
    } else {
      record('contract-supportedRoles', !canonical?.UI_COMPONENTS?.[contract.kind],
        canonical?.UI_COMPONENTS?.[contract.kind] ? `${contract.kind} adapter exports no supportedRoles` : `${contract.kind} is not merged into UI_COMPONENTS yet`);
    }
  } else {
    record('contract-path', true, 'no contract given; auditing the shipped ten only');
  }

  await auditShippedTen(canonical?.UI_COMPONENTS, canonicalTable.table, record);
  return { checks, tableLabel, mode, shippedKinds: Object.keys(canonical?.UI_COMPONENTS ?? {}) };
}

async function scaffold(kind, options) {
  if (!kindPattern.test(kind)) throw new Error(`kind "${kind}" must match ${kindPattern}`);
  const canonical = await import(pathToFileURL(canonicalModulePath).href);
  if (canonical?.UI_COMPONENTS?.[kind]) throw new Error(`kind "${kind}" already ships; use --check to audit the shipped table`);
  if (canonical?.UI_COMPONENT_ROLES?.[kind]) throw new Error(`kind "${kind}" already has a role table entry; use --check to audit it`);
  const version = options.version === undefined ? 1 : Number(options.version);
  if (!Number.isInteger(version) || version < 1) throw new Error('--version must be a positive integer');
  const roles = listOption(options.roles, 'roles');
  const props = listOption(options.props, 'props');
  const overlap = roles.filter(role => props.includes(role));
  if (overlap.length) throw new Error(`roles and props overlap: ${overlap.join(', ')}`);
  if (roles.length === 0 && props.length === 0) throw new Error('declare at least one --roles or --props name; the role table is the source of truth');

  const outDir = path.resolve(process.cwd(), options.out ?? path.join(here, 'generated', kind));
  const fn = `render${kindFn(kind)}`;
  const contract = {
    document: 'ui-component.v1',
    kind,
    version,
    roles,
    props: Object.fromEntries(props.map(name => [name, { type: 'text', required: false }])),
    states: ['ready', 'empty', 'error', 'not-supported'],
  };
  const contractText = JSON.stringify(contract, null, 2) + '\n';
  const digest = createHash('sha256').update(contractText).digest('hex');
  const names = [...roles, ...props];
  const sentinels = Object.fromEntries(names.map(name => [name, `sentinel-${name}`]));

  const adapterText = `// Generated adapter stub for the ui-component.v1 kind "${kind}" (version ${version}).
// Merge into live-circuit/circuit/ui-components.js:
//   1. add the ${kind} entry below to UI_COMPONENT_ROLES;
//   2. attach UI_COMPONENTS["${kind}"] = { version: ${version}, supportedRoles, render: ${fn} };
// Every render read resolves through the role table; no literal role string
// may be read outside it (K1), so a contract role cannot silently drop.
// This module is importable for "new-component.mjs --check" before the merge.

export const UI_COMPONENT_ROLES = {
  "${kind}": {
    version: ${version},
    roles: ${JSON.stringify(roles)},
    props: ${JSON.stringify(props)},
  },
};

// Declared props and bindings the validator admits: roles ∪ props, derived.
export const supportedRoles = Object.freeze([
  ...UI_COMPONENT_ROLES["${kind}"].roles,
  ...UI_COMPONENT_ROLES["${kind}"].props,
]);

export function ${fn}(container, entry, context) {
  const section = h("section", { class: "page-section", id: entry?.sectionId });
  const wrap = h("div", { class: "wrap" });
${names.map(name => `  const ${name.replace(/[^A-Za-z0-9_$]/g, '_')}Value = declared(context, entry, ${JSON.stringify(name)});`).join('\n')}
${names.map(name => `  if (${name.replace(/[^A-Za-z0-9_$]/g, '_')}Value !== undefined && ${name.replace(/[^A-Za-z0-9_$]/g, '_')}Value !== null && ${name.replace(/[^A-Za-z0-9_$]/g, '_')}Value !== "") wrap.append(h("p", { class: "note", text: declaredText(context, entry, ${JSON.stringify(name)}) }));`).join('\n')}
  if (wrap.hasChildNodes()) section.append(wrap);
  container.append(section);
}
`;

  const section = {
    sectionId: `${kind.replace(/[^a-z0-9]+/g, '-')}-parity`,
    regionId: 'main',
    order: 1,
    component: { kind, version },
    props: Object.fromEntries(roles.map(role => [role, sentinels[role]])),
    ...(props.length ? { bindings: Object.fromEntries(props.map(name => [name, { kind: 'literal', value: sentinels[name] }])) } : {}),
  };
  const parity = {
    contractId: 'ui-component-parity.v1',
    kind,
    version,
    notes: [
      'Every role is declared with a unique sentinel; the K1 consumption probe must see each sentinel reach the output, so no declared role silently drops.',
      props.length
        ? 'roles are declared as props; props are declared as literal bindings, exercising both declaration paths.'
        : 'roles are declared as props; add binding-path coverage if the adapter reads any role from bindings.',
    ],
    section,
    sentinels,
  };
  const acceptance = `# Acceptance pins for component kind "${kind}"

Contract sha256: \`${digest}\` (tool-computed over \`${kind}.contract.json\`; do not copy this
digest into the estate — the migration pair computes the canonical contract digest).

This is a class (b) policy/registry/shell change: a composite-image deploy with the
full staging acceptance, not a data-only page publish.

- [ ] Merge \`${kind}.adapter.mjs\` into \`live-circuit/circuit/ui-components.js\`
      (\`UI_COMPONENT_ROLES\` entry + \`UI_COMPONENTS["${kind}"]\`).
- [ ] Add \`{ "kind": "${kind}", "version": ${version} }\` to \`circuit-host.json\`
      \`ui.components\` (allowlist; \`circuit-host.json:17\`).
- [ ] Regenerate the registry copies (K2): the served \`uiRegistry\`
      (\`live-store.mjs:357-382\`) and the client \`UI_REGISTRY\` (\`page-runtime.js:22-54\`).
- [ ] Reconcile the estate \`ui-component.v1\` contract seed in the
      \`declare-ui-page-reading\` pair (\`sfx-embody/sql/migrations/declare-ui-page-reading.commit.sql:128-138\`)
      so its \`roles\`/\`props\` agree with the table both directions.
- [ ] Add the \`<kind>.parity.json\` section to a \`fixtures/pages\` page and run
      \`node live-circuit/circuit/verify-pages.mjs --fixtures\`.
- [ ] Run the K1 conformance harness and the browser sign-in gate (WP0.7).
- [ ] Pins: \`deploy/staging/accept.mjs\` smoke static route list and
      \`live-circuit/circuit/verify-pages.mjs:127-136\` registry expectation.
- [ ] \`CIRCUIT_FILES\` entry only if the adapter ships as a new client module
      (\`observe-server.mjs:14-49\`); then add the module pin.
`;

  const outputs = [
    [`${kind}.contract.json`, contractText],
    [`${kind}.adapter.mjs`, adapterText],
    [`${kind}.parity.json`, JSON.stringify(parity, null, 2) + '\n'],
    [`${kind}.acceptance.md`, acceptance],
  ];
  if (!options.force) {
    const existing = [];
    for (const [name] of outputs) {
      try { await readFile(path.join(outDir, name)); existing.push(name); } catch { /* absent is fine */ }
    }
    if (existing.length) throw new Error(`${existing.join(', ')} already exist under ${outDir}; pass --force to overwrite`);
  }
  await mkdir(outDir, { recursive: true });
  for (const [name, text] of outputs) await writeFile(path.join(outDir, name), text, 'utf8');
  return { outDir, files: outputs.map(([name]) => name), digest, contract };
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) { console.log(usage()); process.exit(0); }
try {
  if (args[0] === '--check') {
    const parsed = parseArgs(args.slice(1), new Set(['ui-components']));
    if (parsed.positional.length > 1) throw new Error('--check takes at most one contract path');
    const result = await runCheck(parsed.positional[0], parsed.value('ui-components'));
    for (const check of result.checks) console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}${check.detail ? ` · ${check.detail}` : ''}`);
    const failed = result.checks.filter(check => !check.pass).length;
    console.log(JSON.stringify({
      tool: 'new-component.mjs',
      mode: 'check',
      contract: parsed.positional[0] ?? null,
      table: result.tableLabel,
      tableMode: result.mode,
      interface: result.mode === 'role-table' ? 'UI_COMPONENT_ROLES' : 'legacy fallback: supportedRoles (Lane A not landed)',
      shippedKinds: result.shippedKinds,
      checkedAt: new Date().toISOString(),
      passed: result.checks.length - failed,
      failed,
      checks: result.checks,
    }, null, 2));
    process.exitCode = failed > 0 ? 1 : 0;
  } else {
    const parsed = parseArgs(args, new Set(['version', 'roles', 'props', 'out', 'force']));
    if (parsed.positional.length !== 1) { console.error(usage()); process.exit(2); }
    const result = await scaffold(parsed.positional[0], {
      version: parsed.has('version') ? parsed.value('version') : undefined,
      roles: parsed.value('roles'),
      props: parsed.value('props'),
      out: parsed.value('out') === true ? undefined : parsed.value('out'),
      force: parsed.has('force'),
    });
    console.log(JSON.stringify({
      tool: 'new-component.mjs',
      mode: 'scaffold',
      kind: result.contract.kind,
      version: result.contract.version,
      contractSha256: result.digest,
      outDir: result.outDir,
      files: result.files,
    }, null, 2));
  }
} catch (error) {
  console.error(`new-component.mjs: ${error.message}`);
  process.exitCode = 1;
}
