#!/usr/bin/env node
/**
 * Estate publication service — §11.1, §11.4.
 *
 * Reads one pinned generation of the selected model through the file-based inspection
 * projection, applies the publication allow-list, validates it, and writes an immutable
 * publication under generated/. The website never reads the source directly; public
 * browsers never reach SQL Server.
 *
 *   node scripts/publish-estate.mjs [--source <inventory.json>] [--allow-missing]
 *
 * --allow-missing lets a build proceed with no valid publication. The site then renders
 * its unavailable state (§11.4) rather than an empty catalog.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT_DIR = join(ROOT, 'generated');
const OUT_FILE = join(OUT_DIR, 'estate-publication.json');
const TOPOLOGY_SQL = join(HERE, 'sql', 'publish-estate-topology.sql');

const ADAPTER_VERSION = 'estate-publication-adapter/1.2.0';
const CONTRACT_VERSION = '1.0.0';
const SCL_VERSION = '0.2';
/** The authored bundle renderer is the capability's stored circuit; the absent renderer records
 * that the execution graph is compiled by the engine at request time — never a boundary lens. */
const AUTHORED_RENDERER_VERSION = 'stored-circuit/1.0.0';
const ABSENT_RENDERER_VERSION = 'absent-projection/1.0.0';
const AUTHORED_SOURCE_PROFILE = 'media-circuit-bundle.v1';
const ABSENT_SOURCE_PROFILE = 'capability-engine-compile.v1';

/** Default source: the executed read-only inventory query recorded by the database repo (§14.1). */
const DEFAULT_SOURCE = 'C:/lab/sidefx-database/data/media/website-inventory.json';
let selectedVisuals = [];

/**
 * §11.4 step 2 — the explicit public allow-list. Only these source fields may leave the
 * boundary. Anything not named here is dropped, including fields added upstream later.
 */
const ALLOW_LIST = {
  mechanic: [
    'mechanic_id',
    'namespace_id',
    'semantic_object_pk',
    'semantic_object_definition_pk',
    'definition_profile',
    'mechanic_kind',
    'name',
    'implementation_relationships',
    'provider_identities',
  ],
  provider: [
    'provider_id',
    'namespace_id',
    'semantic_object_pk',
    'semantic_object_definition_pk',
    'name',
    'declaration_profile',
    'mechanic_relationships',
    'capability_relationships',
  ],
  relationship: ['provider_id', 'mechanic_id', 'role'],
  scenario: [
    'capability_id',
    'scenario_id',
    'semantic_object_pk',
    'scenario_version_pk',
    'semantic_object_definition_pk',
    'input_id',
    'event_id',
    'responsibility',
    'outcome_id',
    'input_contract_state',
    'event_authority_state',
  ],
  blueprint: [
    'blueprint_id',
    'capability_id',
    'carrier_profile',
    'source_disposition',
    'node_count',
    'edge_count',
  ],
};

function pick(row, fields) {
  const out = {};
  for (const f of fields) out[f] = row[f] ?? null;
  return out;
}

function sha256(value) {
  return 'sha256:' + createHash('sha256').update(value).digest('hex');
}

/** Deterministic digest over a value: key order cannot change the hash. */
function stableDigest(value) {
  const canonical = (v) => {
    if (Array.isArray(v)) return v.map(canonical);
    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.keys(v)
          .sort()
          .map((k) => [k, canonical(v[k])]),
      );
    }
    return v;
  };
  return sha256(JSON.stringify(canonical(value)));
}

function slugifyNamespace(namespaceId) {
  return namespaceId.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

/** Presentation-only transform of an exact identity. Reversible; asserts no new meaning. */
function readableFromIdentity(id) {
  return id
    .split(/[-_]/)
    .filter(Boolean)
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/** Maps an exact source state to a readable line without discarding the source value (§11.3). */
function sourceState(value) {
  if (value === null || value === undefined || value === '') {
    return { value: null, readable: 'Not declared in this generation' };
  }
  const readable = {
    RESOLVED: 'Resolved in source',
    UNRESOLVED: 'Declared but unresolved',
    ADMITTED: 'Admitted',
    CANDIDATE: 'Candidate — not admitted',
  }[value];
  return { value, readable: readable ?? `Source state: ${value}` };
}

function intOf(value) {
  const n = Number.parseInt(String(value ?? '0'), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** §12.7 — every core entity carries a visual requirement, whether or not an image exists. */
function visualRequirements(subjectKind, semanticObjectPk, semanticObjectDefinitionPk, purposes) {
  return purposes.map((purpose) => {
    const selected = selectedVisuals.find(v => v.kind === subjectKind && v.objectPk === semanticObjectPk && v.definitionPk === semanticObjectDefinitionPk && v.purpose === purpose);
    return ({
    subjectKind,
    semanticObjectPk,
    semanticObjectDefinitionPk,
    purpose,
    state: selected ? 'READY' : 'REQUIRED',
    assetRevisionId: selected?.revision ?? null,
    originalDigest: selected ? `sha256:${selected.originalDigest}` : null,
    mediaType: selected?.mediaType ?? null,
    width: selected?.width ?? null,
    height: selected?.height ?? null,
    altText: selected?.altText ?? null,
    generatorModel: selected?.model ?? null,
    publishedUrl: selected?.url ?? null,
  }); });
}

/** Locate the SDA kernel runner the same way publish-circuits.mjs does. */
function locateRunner() {
  const roots = [
    process.env.SIDEFX_SDA_ROOT,
    resolve(ROOT, '..', 'scenario-driven-architecture'),
    resolve(ROOT, '..', '..', 'scenario-driven-architecture'),
  ].filter((path) => typeof path === 'string' && path.length > 0);
  for (const root of roots) {
    const runner = join(root, 'languages', 'typescript', 'src', 'kernel', 'bootstrap', 'run-migration.mjs');
    if (existsSync(runner)) return runner;
  }
  return null;
}

/** Parse the `RS <name> rows <n>` result sets the runner prints. */
function readResultSets(stdout) {
  const sets = new Map();
  let name = null;
  for (const raw of stdout.split(/\r?\n/)) {
    const header = /^RS (.+?) rows (\d+)$/.exec(raw);
    if (header) {
      name = header[1];
      continue;
    }
    const line = raw.trim();
    if (!name || !line.startsWith('{') || !line.endsWith('}')) continue;
    try {
      const row = JSON.parse(line);
      if (typeof row.json_value === 'string') sets.set(name, JSON.parse(row.json_value));
      else {
        const list = sets.get(name) ?? [];
        list.push(row);
        sets.set(name, list);
      }
    } catch {
      /* A partial line the runner never split is ignored. */
    }
  }
  return sets;
}

/**
 * §12.2 — read the live authored circuit topology.
 *
 * The topology is read from the direct base tables through the SDA kernel runner (a ROLLBACK
 * batch), or from a captured result set passed with --topology / SIDEFX_ESTATE_TOPOLOGY. It is
 * never inferred from the boundary. A selected circuit binding that is not a resolvable
 * CIRCUIT_BUNDLE fails the read: publish must not substitute a boundary lens for topology the
 * estate actually carries.
 */
function loadTopology(explicitFile) {
  const file = explicitFile ?? process.env.SIDEFX_ESTATE_TOPOLOGY;
  if (file) {
    const captured = JSON.parse(readFileSync(file, 'utf8'));
    return normalizeTopology(captured.resultSets ?? captured);
  }
  const runner = locateRunner();
  if (!runner) {
    throw new Error('Could not find the SDA kernel runner for the live topology read. Pass --topology <captured.json> or set SIDEFX_SDA_ROOT.');
  }
  const result = spawnSync(process.execPath, [runner, TOPOLOGY_SQL], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(result.stdout ?? '');
    console.error(result.stderr ?? '');
    throw new Error(`The live topology query failed with status ${result.status}`);
  }
  const sets = readResultSets(result.stdout ?? '');
  const captured = Object.fromEntries(sets);
  return normalizeTopology(captured);
}

function normalizeTopology(sets) {
  const summary = (sets.topology_summary ?? [])[0];
  const bundles = sets.topology_bundles ?? [];
  const cells = sets.topology_cells ?? [];
  if (!summary || !Array.isArray(bundles) || !Array.isArray(cells)) {
    throw new Error('The live topology read did not return its result sets (topology_summary, topology_bundles, topology_cells).');
  }
  const unresolved = [];
  const derivableKinds = new Set(['CIRCUIT_BUNDLE', 'BUNDLE', 'CIRCUIT_EMBED']);
  for (const bundle of bundles) {
    if (!derivableKinds.has(bundle.asset_kind)) {
      unresolved.push(`${bundle.object_kind} ${bundle.semantic_object_definition_pk} is bound to ${bundle.asset_kind}, which is not a circuit renderer`);
    } else if (bundle.asset_kind === 'CIRCUIT_BUNDLE' && !bundle.scenario_entry && !bundle.capability_entry && !bundle.catalog_entry) {
      unresolved.push(`${bundle.object_kind} ${bundle.semantic_object_definition_pk} bundle ${bundle.bundle_revision} carries no topology entry`);
    }
  }
  if (unresolved.length > 0) {
    throw new Error(`Authored circuit topology exists but cannot be resolved (${unresolved.length}): ${unresolved.slice(0, 5).join('; ')}`);
  }
  const bundleByScenarioDefinition = new Map();
  const bundlesByCapability = new Map();
  const editionBundlesByDefinition = new Map();
  for (const bundle of bundles) {
    if (bundle.asset_kind === 'CIRCUIT_BUNDLE' && bundle.object_kind === 'SCENARIO') {
      bundleByScenarioDefinition.set(String(bundle.semantic_object_definition_pk), bundle);
    }
    if (bundle.asset_kind === 'BUNDLE') {
      editionBundlesByDefinition.set(String(bundle.semantic_object_definition_pk), bundle);
      continue;
    }
    if (bundle.capability_id) {
      const list = bundlesByCapability.get(bundle.capability_id) ?? [];
      list.push(bundle);
      bundlesByCapability.set(bundle.capability_id, list);
    }
  }
  const cellsByCapability = new Map();
  for (const cell of cells) {
    const list = cellsByCapability.get(cell.capability_id) ?? [];
    list.push(cell);
    cellsByCapability.set(cell.capability_id, list);
  }
  return { summary, bundles, bundleByScenarioDefinition, bundlesByCapability, editionBundlesByDefinition, cellsByCapability };
}

function authoredUrl(bundle) {
  if (typeof bundle.url === 'string' && bundle.url.startsWith('/media/')) return bundle.url;
  const relative = bundle.scenario_entry ?? bundle.capability_entry ?? bundle.catalog_entry;
  if (!relative) throw new Error(`Bundle ${bundle.bundle_revision} carries no resolvable entry.`);
  return `/media/library/${relative.replace(/\\/g, '/')}`;
}

/** The live topology's authored mapping for one capability: scenario face, then capability,
 * then the capability's selected blueprint, then the capability's authored edition circuit.
 * Absent means the generation carries none. A binding that cannot produce a URL is a failure. */
function resolveAuthoredMapping(face, capability, topology, editionsByDefinition) {
  const scenario = topology.bundleByScenarioDefinition.get(String(face.semantic_object_definition_pk));
  if (scenario) return { bundle: scenario, subjectKind: 'SCENARIO' };
  const capabilityId = capability.capability_id;
  const available = topology.bundlesByCapability.get(capabilityId) ?? [];
  const bundle = available.find((b) => b.object_kind === 'CAPABILITY');
  if (bundle) return { bundle, subjectKind: 'CAPABILITY' };
  const blueprint = available.find((b) => b.object_kind === 'BLUEPRINT');
  if (blueprint) return { bundle: blueprint, subjectKind: 'BLUEPRINT' };
  const editionBinding = topology.editionBundlesByDefinition.get(String(capability.semantic_object_definition_pk));
  if (editionBinding) {
    const edition = editionsByDefinition.get(String(capability.semantic_object_definition_pk));
    if (!edition?.circuitUrl) {
      throw new Error(`Capability ${capabilityId} is bound to edition bundle ${editionBinding.bundle_revision} but the edition carries no circuit URL; the authored circuit cannot be resolved.`);
    }
    return { bundle: { ...editionBinding, url: edition.circuitUrl, scenario_id: edition.id }, subjectKind: 'CAPABILITY' };
  }
  return null;
}

/**
 * §12.2 — compile the circuit record for one scenario face.
 *
 * The projection is built from the live topology: when the estate carries an authored circuit
 * bundle for the face (or its capability/blueprint), the projection names that bundle so the page
 * can render it as a labelled comparison candidate. The execution graph itself is compiled by the
 * engine at request time; the publication never fabricates boundary-lens nodes or routes as a
 * substitute circuit, and a face without an authored bundle is published as an explicit absence.
 */
function compileScenarioCircuit(face, blueprintsForCapability, capability, topology, editionsByDefinition) {
  const diagnostics = [];
  const graph = { nodes: [], edges: [] };

  const authored = resolveAuthoredMapping(face, capability, topology, editionsByDefinition);

  if (authored) {
    const { bundle, subjectKind } = authored;
    const url = authoredUrl(bundle);
    diagnostics.push({
      code: 'AUTHORED_CIRCUIT_RESOLVED',
      message: `The authored ${subjectKind.toLowerCase()} circuit bundle ${bundle.bundle_revision.slice(0, 12)}… (${intOf(bundle.view_count)} topology view(s)) is published from the live topology as a labelled comparison candidate; the execution graph is compiled by the engine at request time and is never this bundle.`,
    });
    return {
      capabilityId: face.capability_id,
      scenarioId: face.scenario_id,
      sourceProfile: AUTHORED_SOURCE_PROFILE,
      sourceDigest: stableDigest(face),
      graphDigest: stableDigest(graph),
      sclVersion: SCL_VERSION,
      rendererVersion: AUTHORED_RENDERER_VERSION,
      lens: 'SCENARIO',
      fidelity: 'FULL',
      renderer: {
        kind: 'AUTHORED_CIRCUIT',
        subjectKind,
        bundleRevision: bundle.bundle_revision,
        url,
        label: bundle.scenario_id ?? bundle.capability_id ?? bundle.blueprint_id ?? null,
        topologyViews: intOf(bundle.view_count),
      },
      ...graph,
      diagnostics,
    };
  }

  // No authored bundle exists in the live topology for this face. The publication records the
  // absence explicitly: the engine compiles the execution graph at request time, and no boundary
  // lens, node or route is published as a substitute.
  diagnostics.push({
    code: 'NO_AUTHORED_CIRCUIT',
    message: 'The live topology declares no authored circuit bundle for this scenario face, capability or blueprint in this generation. The execution graph is compiled by the engine at request time; this record is the explicit absence and no substitute circuit is published.',
  });
  const withoutEdges = blueprintsForCapability.filter((b) => intOf(b.edge_count) === 0);
  if (withoutEdges.length > 0) {
    diagnostics.push({
      code: 'BLUEPRINT_EDGES_ABSENT_IN_MODEL',
      message: `${withoutEdges.length} selected blueprint(s) for this capability carry ${blueprintsForCapability.reduce((n, b) => n + intOf(b.node_count), 0)} declared cell(s) and no normalized edges in this generation.`,
    });
  }

  return {
    capabilityId: face.capability_id,
    scenarioId: face.scenario_id,
    sourceProfile: ABSENT_SOURCE_PROFILE,
    sourceDigest: stableDigest(face),
    graphDigest: stableDigest(graph),
    sclVersion: SCL_VERSION,
    rendererVersion: ABSENT_RENDERER_VERSION,
    lens: 'SCENARIO',
    fidelity: 'NONE',
    renderer: {
      kind: 'ABSENT',
      subjectKind: null,
      bundleRevision: null,
      url: null,
      label: null,
      topologyViews: null,
    },
    ...graph,
    diagnostics,
  };
}

function build(sourcePath, topology) {
  const raw = JSON.parse(readFileSync(sourcePath, 'utf8'));
  const rs = raw.recordsets;

  // §11.4 step 3 — a truncated result is never a complete estate.
  if (raw.truncated) {
    throw new Error('Source result is truncated; refusing to publish a partial estate as complete.');
  }
  if (raw.disposition !== 'READ_QUERY_COMPLETE') {
    throw new Error(`Source disposition is ${raw.disposition}; refusing to publish.`);
  }
  if (!Array.isArray(rs) || rs.length !== 10) {
    throw new Error('Source does not carry the expected recordset shape.');
  }

  const [meta] = rs[0];
  const media = JSON.parse(readFileSync(join(OUT_DIR, 'visual-publication.json'), 'utf8'));
  if (`sha256:${media.source.snapshotDigest}` !== raw.snapshotId || `sha256:${media.source.mappingDigest}` !== raw.projectionDigest) throw new Error('Media and estate source generations differ.');
  selectedVisuals = media.visuals;
  const capabilityRows = rs[9];
  const kindCounts = Object.fromEntries(
    rs[1].map((r) => [r.object_kind, { definitions: intOf(r.selected_definitions), identities: intOf(r.selected_identities) }]),
  );
  const managedCapabilities = intOf(rs[2][0]?.selected_managed_capabilities);
  const mechanicRows = rs[3].map((r) => pick(r, ALLOW_LIST.mechanic));
  const relationshipRows = rs[4].map((r) => pick(r, ALLOW_LIST.relationship));

  // One page per declared provider identity. A generation may carry several definitions of the
  // same provider; the definition carrying the selected visual is preferred, then the latest.
  const providerDefinitions = rs[5].map((r) => pick(r, ALLOW_LIST.provider));
  const providersByIdentity = new Map();
  const readyProviderDefinitions = new Set(
    selectedVisuals.filter((v) => v.kind === 'PROVIDER').map((v) => String(v.definitionPk)),
  );
  for (const row of providerDefinitions) {
    const key = `${row.namespace_id ?? ''}\u0000${row.provider_id}`;
    const rowReady = readyProviderDefinitions.has(String(row.semantic_object_definition_pk));
    const entry = providersByIdentity.get(key);
    if (!entry) {
      providersByIdentity.set(key, {
        row: { ...row },
        ready: rowReady,
        mechanicRelationships: intOf(row.mechanic_relationships),
        capabilityRelationships: intOf(row.capability_relationships),
      });
      continue;
    }
    entry.mechanicRelationships += intOf(row.mechanic_relationships);
    entry.capabilityRelationships += intOf(row.capability_relationships);
    const newer = Number(row.semantic_object_definition_pk) > Number(entry.row.semantic_object_definition_pk);
    if ((rowReady && !entry.ready) || (rowReady === entry.ready && newer)) {
      entry.row = { ...row };
      entry.ready = rowReady;
    }
  }
  const providerRows = [...providersByIdentity.values()].map((entry) => ({
    ...entry.row,
    mechanic_relationships: entry.mechanicRelationships,
    capability_relationships: entry.capabilityRelationships,
  }));
  const scenarioRows = rs[6].map((r) => pick(r, ALLOW_LIST.scenario));
  const blueprintRows = rs[7].map((r) => pick(r, ALLOW_LIST.blueprint));

  // §11.4 step 3 — validate declared row counts against what actually arrived.
  const declared = raw.rowCounts;
  const actual = [
    rs[0].length, rs[1].length, rs[2].length, mechanicRows.length,
    relationshipRows.length, providerDefinitions.length, scenarioRows.length,
    blueprintRows.length, rs[8].length, capabilityRows.length,
  ];
  declared.forEach((n, i) => {
    if (n !== actual[i]) {
      throw new Error(`Recordset ${i} declares ${n} rows but carries ${actual[i]}.`);
    }
  });

  const findings = [];

  // ---- Mechanics -----------------------------------------------------------
  const providersByMechanic = new Map();
  const mechanicsByProvider = new Map();
  for (const rel of relationshipRows) {
    if (!providersByMechanic.has(rel.mechanic_id)) providersByMechanic.set(rel.mechanic_id, new Set());
    providersByMechanic.get(rel.mechanic_id).add(rel.provider_id);
    if (!mechanicsByProvider.has(rel.provider_id)) mechanicsByProvider.set(rel.provider_id, new Set());
    mechanicsByProvider.get(rel.provider_id).add(rel.mechanic_id);
  }

  let mechanicsWithoutDeclaredName = 0;
  const mechanics = mechanicRows.map((m) => {
    // §5.20 — 137 platform-provided mechanics carry no display name; the identity stands in.
    const hasDeclaredName = Boolean(m.name) && m.name !== m.mechanic_id;
    if (!hasDeclaredName) mechanicsWithoutDeclaredName += 1;
    const urlNamespace = m.namespace_id ? slugifyNamespace(m.namespace_id) : 'estate';
    return {
      kind: 'MECHANIC',
      namespaceId: m.namespace_id,
      urlNamespace,
      urlNamespaceIsPublicationAssigned: !m.namespace_id,
      entityId: m.mechanic_id,
      urlKey: `${urlNamespace}/${m.mechanic_id}`,
      semanticObjectPk: String(m.semantic_object_pk),
      semanticObjectDefinitionPk: String(m.semantic_object_definition_pk),
      title: readableFromIdentity(m.mechanic_id),
      titleIsIdentityFallback: !hasDeclaredName,
      // The declared sentence is the mechanic's responsibility, kept verbatim.
      summary: hasDeclaredName ? m.name : null,
      definitionProfile: m.definition_profile,
      mechanicKind: m.mechanic_kind,
      providerIds: [...(providersByMechanic.get(m.mechanic_id) ?? [])].sort(),
      implementationRelationshipCount: intOf(m.implementation_relationships),
      visuals: visualRequirements('MECHANIC', String(m.semantic_object_pk), String(m.semantic_object_definition_pk), ['CARD', 'DETAIL']),
    };
  });

  if (mechanicsWithoutDeclaredName > 0) {
    findings.push({
      code: 'MECHANIC_DISPLAY_NAME_MISSING',
      message:
        'Platform-provided mechanics carry no declared display name in this generation. Their exact identity is shown; no editorial name has been sourced.',
      count: mechanicsWithoutDeclaredName,
    });
  }

  // ---- Providers -----------------------------------------------------------
  const providers = providerRows.map((p) => {
    const hasDeclaredName = Boolean(p.name) && p.name !== p.provider_id;
    const urlNamespace = p.namespace_id ? slugifyNamespace(p.namespace_id) : 'estate';
    return {
      kind: 'PROVIDER',
      namespaceId: p.namespace_id,
      urlNamespace,
      urlNamespaceIsPublicationAssigned: !p.namespace_id,
      entityId: p.provider_id,
      urlKey: `${urlNamespace}/${encodeURIComponent(p.provider_id)}`,
      semanticObjectPk: String(p.semantic_object_pk),
      semanticObjectDefinitionPk: String(p.semantic_object_definition_pk),
      // Provider identities are dotted assembly names; they are shown exactly as declared.
      title: p.provider_id,
      titleIsIdentityFallback: !hasDeclaredName,
      summary: hasDeclaredName ? p.name : null,
      definitionProfile: p.declaration_profile,
      declarationProfile: p.declaration_profile,
      mechanicIds: [...(mechanicsByProvider.get(p.provider_id) ?? [])].sort(),
      mechanicRelationshipCount: intOf(p.mechanic_relationships),
      capabilityRelationshipCount: intOf(p.capability_relationships),
      visuals: visualRequirements('PROVIDER', String(p.semantic_object_pk), String(p.semantic_object_definition_pk), ['CARD', 'DETAIL']),
    };
  });

  // A declared relationship must resolve on both sides or the join is not publishable.
  const mechanicIds = new Set(mechanics.map((m) => m.entityId));
  const providerIds = new Set(providers.map((p) => p.entityId));
  for (const rel of relationshipRows) {
    if (!mechanicIds.has(rel.mechanic_id) || !providerIds.has(rel.provider_id)) {
      throw new Error(`Relationship ${rel.provider_id} -> ${rel.mechanic_id} does not resolve within this generation.`);
    }
  }

  // ---- Capabilities --------------------------------------------------------
  const facesByCapability = new Map();
  for (const s of scenarioRows) {
    if (!facesByCapability.has(s.capability_id)) facesByCapability.set(s.capability_id, []);
    facesByCapability.get(s.capability_id).push(s);
  }
  const blueprintsByCapability = new Map();
  for (const b of blueprintRows) {
    if (!b.capability_id) continue;
    if (!blueprintsByCapability.has(b.capability_id)) blueprintsByCapability.set(b.capability_id, []);
    blueprintsByCapability.get(b.capability_id).push(b);
  }

  const editionsByDefinition = new Map((media.editions ?? []).map((edition) => [String(edition.definitionPk), edition]));
  const circuits = [];
  const capabilities = capabilityRows.map((sourceCapability) => {
    const capabilityId = sourceCapability.capability_id;
    const faces = (facesByCapability.get(capabilityId) ?? []).sort((a, b) => a.scenario_id.localeCompare(b.scenario_id));
    const bps = blueprintsByCapability.get(capabilityId) ?? [];

    for (const face of faces) circuits.push(compileScenarioCircuit(face, bps, sourceCapability, topology, editionsByDefinition));
    if (!faces.length) {
      const graph = { nodes: [], edges: [] };
      circuits.push({capabilityId,scenarioId:null,sourceProfile:ABSENT_SOURCE_PROFILE,sourceDigest:stableDigest(sourceCapability),graphDigest:stableDigest(graph),sclVersion:SCL_VERSION,rendererVersion:ABSENT_RENDERER_VERSION,lens:'CAPABILITY_OVERVIEW',fidelity:'NONE',renderer:{kind:'ABSENT',subjectKind:null,bundleRevision:null,url:null,label:null,topologyViews:null},...graph,diagnostics:[{code:'SCENARIO_NOT_DECLARED',message:'The selected capability has no scenario face. Its identity and unresolved scenario slot remain visible.'},{code:'NO_AUTHORED_CIRCUIT',message:'The live topology declares no authored circuit bundle for this capability in this generation. The execution graph is compiled by the engine at request time; no substitute circuit is published.'}]});
    }

    const capabilityCircuits = circuits.filter((c) => c.capabilityId === capabilityId);
    const authored = capabilityCircuits.some((c) => c.renderer?.kind === 'AUTHORED_CIRCUIT');
    const graphFidelity = authored
      ? (capabilityCircuits.every((c) => c.fidelity === 'FULL') ? 'FULL' : 'PARTIAL_BOUNDARY')
      : 'NONE';

    // Related capabilities: those sharing a declared input or outcome contract identity.
    const contracts = new Set(faces.flatMap((f) => [f.input_id, f.outcome_id]).filter(Boolean));
    const related = new Set();
    for (const [otherId, otherFaces] of facesByCapability) {
      if (otherId === capabilityId) continue;
      if (otherFaces.some((f) => contracts.has(f.input_id) || contracts.has(f.outcome_id))) {
        related.add(otherId);
      }
    }

    const semanticObjectPk = String(sourceCapability.semantic_object_pk);
    const semanticObjectDefinitionPk = String(sourceCapability.semantic_object_definition_pk);

    return {
      kind: 'CAPABILITY',
      namespaceId: sourceCapability.namespace_id,
      urlNamespace: 'estate',
      urlNamespaceIsPublicationAssigned: true,
      entityId: capabilityId,
      urlKey: `estate/${capabilityId}`,
      semanticObjectPk,
      semanticObjectDefinitionPk,
      title: readableFromIdentity(capabilityId),
      titleIsIdentityFallback: true,
      summary: sourceCapability.intent ?? null,
      definitionProfile: null,
      scope: 'MANAGED',
      scenarios: faces.map((f) => ({
        scenarioId: f.scenario_id,
        capabilityId: f.capability_id,
        semanticObjectPk: String(f.semantic_object_pk),
        semanticObjectDefinitionPk: String(f.semantic_object_definition_pk),
        scenarioVersionPk: String(f.scenario_version_pk),
        inputId: f.input_id,
        eventId: f.event_id,
        outcomeId: f.outcome_id,
        responsibility: f.responsibility,
        inputContractState: sourceState(f.input_contract_state),
        eventAuthorityState: sourceState(f.event_authority_state),
        visuals: visualRequirements('SCENARIO', String(f.semantic_object_pk), String(f.semantic_object_definition_pk), ['CARD', 'DETAIL']),
      })),
      blueprints: bps.map((b) => ({
        blueprintId: b.blueprint_id,
        capabilityId: b.capability_id,
        carrierProfile: b.carrier_profile,
        sourceDisposition: sourceState(b.source_disposition),
        nodeCount: intOf(b.node_count),
        edgeCount: intOf(b.edge_count),
      })),
      graphFidelity,
      // No target declaration is carried by this generation. Empty means undeclared (§11.3).
      targets: [],
      downloadEligibility: {
        authority: false,
        embodiments: false,
        reason:
          'No export manifest resolves in this publication: the capability export adapter is not connected in this build.',
      },
      relatedCapabilityIds: [...related].sort().slice(0, 8),
      visuals: visualRequirements('CAPABILITY', semanticObjectPk, semanticObjectDefinitionPk, ['CARD', 'DETAIL']),
    };
  });

  // §11.2 — do not reconcile a count difference silently; publish it as a finding.
  if (facesByCapability.size !== managedCapabilities) {
    findings.push({
      code: 'MANAGED_CAPABILITY_WITHOUT_SCENARIO_FACE',
      message: `The selected model records ${managedCapabilities} managed capabilities; ${facesByCapability.size} carry at least one scenario face in this generation.`,
      count: Math.abs(managedCapabilities - facesByCapability.size),
    });
  }

  const blueprintNodes = blueprintRows.reduce((n, b) => n + intOf(b.node_count), 0);
  const blueprintEdges = blueprintRows.reduce((n, b) => n + intOf(b.edge_count), 0);
  if (blueprintEdges === 0 && blueprintNodes > 0) {
    findings.push({
      code: 'BLUEPRINT_EDGES_ABSENT',
      message: `${blueprintRows.length} selected blueprints carry ${blueprintNodes} normalized cells and no normalized edges; the cells are retained as source facts and never drawn as routes. Capabilities whose live topology carries an authored circuit bundle render that bundle instead.`,
      count: blueprintRows.length,
    });
  }

  // The live topology read is estate authority for authored comparison bundles. A capability with
  // no authored bundle is published as an explicit absence: the execution graph is compiled by the
  // engine at request time, and no substitute circuit is ever published in its place.
  const circuitsAuthored = circuits.filter((c) => c.renderer?.kind === 'AUTHORED_CIRCUIT').length;
  const circuitsBoundary = circuits.filter((c) => c.renderer?.kind === 'BOUNDARY').length;
  const circuitsAbsent = circuits.length - circuitsAuthored - circuitsBoundary;
  const authoredCapabilityIds = new Set(circuits.filter((c) => c.renderer?.kind === 'AUTHORED_CIRCUIT').map((c) => c.capabilityId));
  const capabilitiesWithAuthoredCircuit = authoredCapabilityIds.size;
  const capabilitiesWithoutAuthoredCircuit = capabilities.length - capabilitiesWithAuthoredCircuit;
  if (capabilitiesWithoutAuthoredCircuit > 0) {
    findings.push({
      code: 'CIRCUIT_TOPOLOGY_ABSENT',
      message: `${capabilitiesWithoutAuthoredCircuit} of ${capabilities.length} selected capabilities have no authored circuit bundle in this generation's live topology (${intOf(topology.summary.selected_blueprint_cells)} declared blueprint cells, ${intOf(topology.summary.selected_blueprint_edges)} normalized edges, ${intOf(topology.summary.circuit_requirements_without_selection)} unselected circuit requirements). Their execution graphs are compiled by the engine at request time; the publication records the explicit absence and never a substitute circuit.`,
      count: capabilitiesWithoutAuthoredCircuit,
    });
  }

  const allVisuals = [
    ...capabilities.flatMap((c) => c.visuals),
    ...capabilities.flatMap((c) => c.scenarios.flatMap(s => s.visuals)),
    ...mechanics.flatMap((m) => m.visuals),
    ...providers.flatMap((p) => p.visuals),
  ];
  const visualsReady = allVisuals.filter((v) => v.state === 'READY').length;
  if (visualsReady < allVisuals.length) {
    findings.push({
      code: 'ENTITY_VISUALS_OUTSTANDING',
      message:
        'Some entity artwork is still in production. Every capability, scenario, mechanic and provider remains included in visual coverage.',
      count: allVisuals.length - visualsReady,
    });
  }

  const publication = {
    publicationId: '',
    contractVersion: CONTRACT_VERSION,
    source: {
      snapshotId: raw.snapshotId,
      projectionDigest: raw.projectionDigest,
      queryDigest: raw.queryDigest,
      resultDigest: raw.resultDigest,
      estateModelPk: String(meta.estate_model_pk),
      observedAt: sourceObservedAt(sourcePath),
      truncated: raw.truncated,
      rowLimit: raw.rowLimit,
      disposition: raw.disposition,
    },
    builtAt: new Date().toISOString(),
    adapterVersion: ADAPTER_VERSION,
    coverage: {
      managedCapabilities,
      capabilityIdentities: kindCounts.CAPABILITY?.identities ?? 0,
      capabilityDefinitions: kindCounts.CAPABILITY?.definitions ?? 0,
      publishedCapabilities: capabilities.length,
      mechanics: mechanics.length,
      providers: providers.length,
      providerMechanicRelationships: relationshipRows.length,
      scenarioFaces: scenarioRows.length,
      blueprints: blueprintRows.length,
      blueprintNodes,
      blueprintEdges,
      circuitsAuthored,
      circuitsBoundary,
      circuitsAbsent,
      capabilitiesWithAuthoredCircuit,
      capabilitiesWithoutAuthoredCircuit,
      mechanicsWithoutDeclaredName,
      visualsRequired: allVisuals.length,
      visualsReady,
    },
    capabilities,
    mechanics,
    providers,
    findings,
  };

  publication.publicationId = stableDigest({ ...publication, publicationId: '', builtAt: '' });
  return { publication, circuits };
}

/** The observation date is the source query's, not the build's (§11.4). */
function sourceObservedAt(sourcePath) {
  const match = /inventory-(\d{4}-\d{2}-\d{2})\.json$/.exec(sourcePath.replace(/\\/g, '/'));
  return match ? `${match[1]}T00:00:00.000Z` : new Date(0).toISOString();
}

function main() {
  const args = process.argv.slice(2);
  const allowMissing = args.includes('--allow-missing');
  const sourceIdx = args.indexOf('--source');
  const sourcePath = sourceIdx >= 0 ? args[sourceIdx + 1] : (process.env.SIDEFX_ESTATE_SOURCE ?? DEFAULT_SOURCE);
  const topologyIdx = args.indexOf('--topology');
  const topologyFile = topologyIdx >= 0 ? args[topologyIdx + 1] : undefined;

  mkdirSync(OUT_DIR, { recursive: true });

  if (!existsSync(sourcePath)) {
    const message = `Estate source not found at ${sourcePath}`;
    if (!allowMissing) {
      console.error(`${message}. Pass --source <file> or --allow-missing.`);
      process.exit(1);
    }
    // §11.4 — retain the last valid publication rather than replacing it with an empty catalog.
    if (existsSync(OUT_FILE)) {
      console.warn(`${message}; keeping the existing publication.`);
      return;
    }
    console.warn(`${message}; the site will render its unavailable state.`);
    return;
  }

  const topology = loadTopology(topologyFile);
  const { publication, circuits } = build(sourcePath, topology);

  // §11.4 step 5 — write, then select atomically via rename.
  const tmp = `${OUT_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(publication, null, 2));
  renameSync(tmp, OUT_FILE);

  const circuitFile = join(OUT_DIR, 'circuit-projections.json');
  const circuitTmp = `${circuitFile}.tmp`;
  writeFileSync(circuitTmp, JSON.stringify(circuits));
  renameSync(circuitTmp, circuitFile);

  const c = publication.coverage;
  console.log(`Published ${publication.publicationId}`);
  console.log(
    `  ${c.publishedCapabilities} capabilities · ${c.mechanics} mechanics · ${c.providers} providers · ${c.scenarioFaces} scenario faces · ${circuits.length} circuits`,
  );
  console.log(
    `  circuits: ${c.circuitsAuthored} authored comparison (${c.capabilitiesWithAuthoredCircuit} capabilities) · ${c.circuitsAbsent} engine-compiled absence (${c.capabilitiesWithoutAuthoredCircuit} capabilities without a selected bundle)`,
  );
  for (const f of publication.findings) console.log(`  finding ${f.code} (${f.count}): ${f.message}`);
}

main();
