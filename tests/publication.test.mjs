import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

/**
 * Publication integrity — §8.3.
 *
 * These check integrity boundaries rather than restating static copy: that the publication
 * satisfies its contract, that its counts match its own records, and that nothing claims a
 * state the source did not declare.
 */

const ROOT = join(import.meta.dirname, '..');
const PUBLICATION = join(ROOT, 'generated', 'estate-publication.json');
const CIRCUITS = join(ROOT, 'generated', 'circuit-projections.json');

const hasPublication = existsSync(PUBLICATION);
const publication = hasPublication ? JSON.parse(readFileSync(PUBLICATION, 'utf8')) : undefined;
const circuits = existsSync(CIRCUITS) ? JSON.parse(readFileSync(CIRCUITS, 'utf8')) : undefined;

test('a publication exists to test', () => {
  assert.ok(hasPublication, 'run `npm run publish:estate` before the test suite');
});

test('the publication is not built from a truncated read', () => {
  assert.equal(publication.source.truncated, false);
  assert.equal(publication.source.disposition, 'READ_QUERY_COMPLETE');
});

test('the observation date comes from the source, not the build', () => {
  assert.notEqual(publication.source.observedAt, publication.builtAt);
  assert.ok(Date.parse(publication.source.observedAt) <= Date.parse(publication.builtAt));
});

test('coverage counts match the published records', () => {
  assert.equal(publication.coverage.publishedCapabilities, publication.capabilities.length);
  assert.equal(publication.coverage.mechanics, publication.mechanics.length);
  assert.equal(publication.coverage.providers, publication.providers.length);
  assert.equal(
    publication.coverage.scenarioFaces,
    publication.capabilities.reduce((n, c) => n + c.scenarios.length, 0),
  );
});

test('a managed-capability count difference is published as a finding, not reconciled away', () => {
  if (publication.coverage.managedCapabilities !== publication.coverage.publishedCapabilities) {
    const finding = publication.findings.find((f) => f.code === 'MANAGED_CAPABILITY_WITHOUT_SCENARIO_FACE');
    assert.ok(finding, 'a count difference must surface as a finding');
  }
});

test('every provider-mechanic relationship resolves on both sides', () => {
  const mechanicIds = new Set(publication.mechanics.map((m) => m.entityId));
  const providerIds = new Set(publication.providers.map((p) => p.entityId));
  for (const mechanic of publication.mechanics) {
    for (const providerId of mechanic.providerIds) {
      assert.ok(providerIds.has(providerId), `unresolved provider ${providerId}`);
    }
  }
  for (const provider of publication.providers) {
    for (const mechanicId of provider.mechanicIds) {
      assert.ok(mechanicIds.has(mechanicId), `unresolved mechanic ${mechanicId}`);
    }
  }
});

test('relationships are symmetric between the two libraries', () => {
  const fromMechanics = new Set(
    publication.mechanics.flatMap((m) => m.providerIds.map((p) => `${p}::${m.entityId}`)),
  );
  const fromProviders = new Set(
    publication.providers.flatMap((p) => p.mechanicIds.map((m) => `${p.entityId}::${m}`)),
  );
  assert.deepEqual([...fromMechanics].sort(), [...fromProviders].sort());
});

test('a mechanic with no declared name is flagged rather than given an invented one', () => {
  const unnamed = publication.mechanics.filter((m) => m.titleIsIdentityFallback);
  assert.equal(unnamed.length, publication.coverage.mechanicsWithoutDeclaredName);
  for (const mechanic of unnamed) {
    assert.equal(mechanic.summary, null, `${mechanic.entityId} must not carry an invented summary`);
  }
});

test('no capability claims a download it cannot deliver', () => {
  for (const capability of publication.capabilities) {
    if (!capability.downloadEligibility.authority && !capability.downloadEligibility.embodiments) {
      assert.ok(
        capability.downloadEligibility.reason,
        `${capability.entityId} must explain why no download is offered`,
      );
    }
  }
});

test('no capability claims a target the source did not declare', () => {
  for (const capability of publication.capabilities) {
    for (const target of capability.targets) {
      assert.ok(target.readiness.value !== undefined, 'a target must carry its source readiness');
    }
  }
});

test('every visual requirement is registered, including the missing ones', () => {
  const total = [
    ...publication.capabilities.flatMap((c) => c.visuals),
    ...publication.mechanics.flatMap((m) => m.visuals),
    ...publication.providers.flatMap((p) => p.visuals),
  ];
  assert.equal(total.length, publication.coverage.visualsRequired);
  const ready = total.filter((v) => v.state === 'READY');
  assert.equal(ready.length, publication.coverage.visualsReady);
  // A visual is only READY when bytes are actually committed (§11.5).
  for (const visual of ready) {
    assert.ok(visual.originalDigest, 'a READY visual must carry a stored byte digest');
  }
});

test('URL keys are unique and stable within each kind', () => {
  for (const kind of ['capabilities', 'mechanics', 'providers']) {
    const keys = publication[kind].map((entity) => entity.urlKey);
    assert.equal(new Set(keys).size, keys.length, `${kind} url keys must be unique`);
  }
});

test('a publication-assigned URL namespace is flagged as not source-derived', () => {
  for (const kind of ['capabilities', 'mechanics', 'providers']) {
    for (const entity of publication[kind]) {
      if (entity.urlNamespaceIsPublicationAssigned) {
        assert.equal(entity.namespaceId, null, `${entity.entityId} must not claim a source namespace`);
      } else {
        assert.ok(entity.namespaceId, `${entity.entityId} must carry the namespace it slugified`);
      }
    }
  }
});

test('every published capability has at least one circuit projection', () => {
  assert.ok(circuits, 'circuit projections must be published alongside the estate');
  const byCapability = new Set(circuits.map((c) => c.capabilityId));
  for (const capability of publication.capabilities) {
    assert.ok(byCapability.has(capability.entityId), `${capability.entityId} has no circuit`);
  }
});

test('a circuit that is not full topology explains why', () => {
  for (const circuit of circuits) {
    if (circuit.fidelity !== 'FULL') {
      assert.ok(circuit.diagnostics.length > 0, `${circuit.scenarioId} must carry a diagnostic`);
    }
  }
});

test('circuit edges never point at a node the graph does not contain', () => {
  for (const circuit of circuits) {
    const nodeIds = new Set(circuit.nodes.map((n) => n.id));
    for (const edge of circuit.edges) {
      assert.ok(nodeIds.has(edge.from), `${circuit.scenarioId}: edge from ${edge.from} is unresolved`);
      assert.ok(nodeIds.has(edge.to), `${circuit.scenarioId}: edge to ${edge.to} is unresolved`);
    }
  }
});

test('an unresolved node carries no invented source identity', () => {
  for (const circuit of circuits) {
    for (const node of circuit.nodes) {
      if (node.primitive === 'UNRESOLVED') {
        assert.equal(node.sourceId, null, `${circuit.scenarioId}: unresolved node must not claim a source`);
      }
    }
  }
});

test('a terminal outcome has no outgoing execution route', () => {
  for (const circuit of circuits) {
    const outcomes = circuit.nodes.filter((n) => n.primitive === 'OUTCOME').map((n) => n.id);
    for (const edge of circuit.edges) {
      assert.ok(
        !outcomes.includes(edge.from),
        `${circuit.scenarioId}: outcome ${edge.from} must not continue the graph`,
      );
    }
  }
});
