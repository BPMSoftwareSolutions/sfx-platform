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
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT_DIR = join(ROOT, 'generated');
const OUT_FILE = join(OUT_DIR, 'estate-publication.json');

const ADAPTER_VERSION = 'estate-publication-adapter/1.1.0';
const CONTRACT_VERSION = '1.0.0';
const SCL_VERSION = '0.2';
const RENDERER_VERSION = 'boundary-projection/1.0.0';

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

/**
 * §12.2 — compile the circuit for one scenario face.
 *
 * This generation carries Input/Event/Responsibility/Outcome per scenario and blueprints with
 * zero normalized edges, so the qualified projection is the boundary lens. Deeper topology is
 * not invented; the missing part is reported as a diagnostic instead.
 */
function compileScenarioCircuit(face, blueprintsForCapability) {
  const nodes = [];
  const edges = [];
  const diagnostics = [];

  const add = (id, primitive, label, sourceId, state) => {
    nodes.push({ id, primitive, label, sourceId, state });
  };

  if (face.input_id) {
    add('input', 'INPUT', readableFromIdentity(face.input_id), face.input_id, sourceState(face.input_contract_state));
  } else {
    add('input', 'UNRESOLVED', 'Input not declared', null, sourceState(null));
    diagnostics.push({ code: 'MISSING_INPUT', message: 'This scenario face declares no input.' });
  }

  if (face.event_id) {
    add('event', 'EVENT', readableFromIdentity(face.event_id), face.event_id, sourceState(face.event_authority_state));
  } else {
    add('event', 'UNRESOLVED', 'Event not declared', null, sourceState(null));
    diagnostics.push({ code: 'MISSING_EVENT', message: 'This scenario face declares no event.' });
  }

  // The responsibility sentence is source text, shown verbatim.
  if (face.responsibility) {
    add('responsibility', 'RESPONSIBILITY', face.responsibility, face.scenario_id, sourceState(null));
  } else {
    add('responsibility', 'UNRESOLVED', 'Responsibility not declared', null, sourceState(null));
    diagnostics.push({
      code: 'MISSING_RESPONSIBILITY',
      message: 'This scenario face declares no responsibility.',
    });
  }

  if (face.outcome_id) {
    add('outcome', 'OUTCOME', readableFromIdentity(face.outcome_id), face.outcome_id, sourceState(null));
  } else {
    add('outcome', 'UNRESOLVED', 'Outcome not declared', null, sourceState(null));
    diagnostics.push({ code: 'MISSING_OUTCOME', message: 'This scenario face declares no outcome.' });
  }

  // Execution flow across the declared boundary. Product transfer is typed separately (§12.3).
  edges.push({ id: 'e-input-event', from: 'input', to: 'event', family: 'PRODUCT_TRANSFER' });
  edges.push({ id: 'e-event-responsibility', from: 'event', to: 'responsibility', family: 'EXECUTION' });
  edges.push({ id: 'e-responsibility-outcome', from: 'responsibility', to: 'outcome', family: 'EXECUTION' });

  const unresolved = nodes.filter((n) => n.primitive === 'UNRESOLVED').length;
  const withoutEdges = blueprintsForCapability.filter((b) => intOf(b.edge_count) === 0);
  if (withoutEdges.length > 0) {
    diagnostics.push({
      code: 'BLUEPRINT_EDGES_UNRESOLVED',
      message: `${withoutEdges.length} blueprint(s) for this capability carry nodes but no normalized edges, so deeper topology is not qualified in this generation.`,
    });
  } else if (blueprintsForCapability.length === 0) {
    diagnostics.push({
      code: 'NO_BLUEPRINT',
      message: 'No blueprint is selected for this capability in this generation.',
    });
  }

  const fidelity = unresolved > 0 ? 'PARTIAL_BOUNDARY' : 'BOUNDARY';

  const graph = { nodes, edges };
  return {
    capabilityId: face.capability_id,
    scenarioId: face.scenario_id,
    sourceProfile: 'estate-scenario-face.v1',
    sourceDigest: stableDigest(face),
    graphDigest: stableDigest(graph),
    sclVersion: SCL_VERSION,
    rendererVersion: RENDERER_VERSION,
    lens: 'SCENARIO',
    fidelity,
    nodes,
    edges,
    diagnostics,
  };
}

function build(sourcePath) {
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
  const providerRows = rs[5].map((r) => pick(r, ALLOW_LIST.provider));
  const scenarioRows = rs[6].map((r) => pick(r, ALLOW_LIST.scenario));
  const blueprintRows = rs[7].map((r) => pick(r, ALLOW_LIST.blueprint));

  // §11.4 step 3 — validate declared row counts against what actually arrived.
  const declared = raw.rowCounts;
  const actual = [
    rs[0].length, rs[1].length, rs[2].length, mechanicRows.length,
    relationshipRows.length, providerRows.length, scenarioRows.length,
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

  const circuits = [];
  const capabilities = capabilityRows.map((sourceCapability) => {
    const capabilityId = sourceCapability.capability_id;
    const faces = (facesByCapability.get(capabilityId) ?? []).sort((a, b) => a.scenario_id.localeCompare(b.scenario_id));
    const bps = blueprintsByCapability.get(capabilityId) ?? [];

    for (const face of faces) circuits.push(compileScenarioCircuit(face, bps));
    if (!faces.length) {
      const graph = { nodes: [{id:'scenario-unresolved',primitive:'UNRESOLVED',label:'No scenario is declared in this selection',sourceId:null,state:sourceState(null)}], edges: [] };
      circuits.push({capabilityId,scenarioId:null,sourceProfile:'estate-capability-boundary.v1',sourceDigest:stableDigest(sourceCapability),graphDigest:stableDigest(graph),sclVersion:SCL_VERSION,rendererVersion:RENDERER_VERSION,lens:'CAPABILITY_OVERVIEW',fidelity:'PARTIAL_BOUNDARY',...graph,diagnostics:[{code:'SCENARIO_NOT_DECLARED',message:'The selected capability has no scenario face. Its identity and unresolved scenario slot remain visible.'}]});
    }

    const capabilityCircuits = circuits.filter((c) => c.capabilityId === capabilityId);
    const graphFidelity = !faces.length || capabilityCircuits.some((c) => c.fidelity === 'PARTIAL_BOUNDARY')
      ? 'PARTIAL_BOUNDARY'
      : 'BOUNDARY';

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
      message: `${blueprintRows.length} selected blueprints carry ${blueprintNodes} normalized nodes and no normalized edges. Capability circuits render the source-backed boundary lens rather than a full topology.`,
      count: blueprintRows.length,
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

  const { publication, circuits } = build(sourcePath);

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
  for (const f of publication.findings) console.log(`  finding ${f.code} (${f.count}): ${f.message}`);
}

main();
