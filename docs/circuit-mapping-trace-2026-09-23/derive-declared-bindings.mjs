#!/usr/bin/env node
/**
 * Derive the declared bindings a run capture predates.
 *
 * A run capture taken before the kernel emitted each cell's declared `execution.authorityId`
 * (SDA commit 1322d1f) needs this join; the committed captures (re-captured on the U3 kernel,
 * SDA e398cd5) now carry it verbatim. The mapping trace measures the platform as it is,
 * so it joins the declared identities back onto the captured cells. This script derives that join
 * from the declared graph source and strips every configuration value:
 *
 *   node docs/circuit-mapping-trace-2026-09-23/derive-declared-bindings.mjs <graph-source.json> <out.json>
 *
 * The graph source is read through the estate's declared read (no credential value leaves the
 * estate; only the identity keys are written):
 *
 *   sfx capability invoke execution-graph-read-provider --json \
 *     --input '{"capabilityId":"resolve-equity-market-price-evidence"}'
 *
 * which is the `execution-graph-read-provider-port` read of
 * `analysis.v_capability_graph_source` (`redeclare-execution-graph-read-ports.sql`).
 *
 * Output: scenarios (Input / Event / Outcome identities), one row per operation
 * (`operation:<platformCapabilityId>` for invoke-port, `operation:<kind>` otherwise) and, per
 * transformation, the expression pointer -> operator map the compiler's `mechanic:<op>.v1`
 * authority uses. Nothing else is copied.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [sourcePath, outPath] = process.argv.slice(2);
if (!sourcePath || !outPath) {
  console.error('usage: node derive-declared-bindings.mjs <graph-source.json> <out.json>');
  process.exit(1);
}

const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
const bindingByPort = new Map((source.interfaceAuthority?.portBindings ?? []).map((binding) => [binding.portId, binding]));

const scenarios = (source.scenarios ?? []).map((scenario) => ({
  scenarioId: scenario.scenarioId,
  input: {
    inputId: scenario.input?.inputId ?? null,
    contractId: scenario.input?.contract?.contractId ?? null,
  },
  event: {
    eventId: scenario.event?.eventId ?? null,
    executionAuthorityId: scenario.event?.executionAuthorityId ?? null,
  },
  outcome: {
    outcomeId: scenario.outcome?.outcomeId ?? null,
    contractId: scenario.outcome?.contract?.contractId ?? null,
    terminal: scenario.outcome?.terminal === true,
  },
}));

const operations = [];
for (const authority of source.executionAuthorities ?? []) {
  const owningScenarioId = authority.owningScenarioId ?? null;
  (authority.operations ?? []).forEach((operation, index) => {
    const binding = operation.portId ? bindingByPort.get(operation.portId) : undefined;
    const platformCapabilityId =
      operation.kind === 'invoke-port' ? binding?.platformCapabilityId ?? null : operation.kind ?? null;
    operations.push({
      owningScenarioId,
      index: index + 1,
      portId: operation.portId ?? null,
      kind: operation.kind ?? null,
      platformCapabilityId,
    });
  });
}

/** Every expression node's pointer -> `op`, so the compiler's `mechanic:<op>.v1` can be joined. */
function pointerOps(expression) {
  const out = {};
  const walk = (node, pointer) => {
    if (node === null || typeof node !== 'object') return;
    if (typeof node.op === 'string') out[pointer] = node.op;
    for (const [key, value] of Object.entries(node)) {
      if (key === 'op') continue;
      const child = pointer.length > 0 ? `${pointer}/${key}` : key;
      if (Array.isArray(value)) value.forEach((item, index) => walk(item, `${child}/${index}`));
      else if (value !== null && typeof value === 'object') walk(value, child);
    }
  };
  walk(expression, 'expression');
  return out;
}

const transformations = {};
for (const transformation of source.semanticTransformations ?? []) {
  if (transformation?.id && transformation.expression) {
    transformations[transformation.id] = pointerOps(transformation.expression);
  }
}

const out = {
  declaredBindingsType: 'circuit-declared-bindings.v1',
  capabilityId: source.capabilityId ?? null,
  rootScenarioId: source.rootScenarioId ?? null,
  read: 'execution-graph-read-provider-port over analysis.v_capability_graph_source (redeclare-execution-graph-read-ports.sql); configuration stripped',
  scenarios,
  operations,
  transformations,
};
writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
console.log(
  `${outPath}: ${scenarios.length} scenarios · ${operations.length} operations · ${Object.keys(transformations).length} transformations`,
);
