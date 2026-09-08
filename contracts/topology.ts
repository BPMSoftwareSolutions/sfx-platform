import { z } from 'zod';

/**
 * Topology view contract — ADR 0001.
 *
 * The compiled estate topology as *data*, not as a rendered picture. Every field here comes from
 * the content lab's compiler output; the SVG it also emitted is discarded at ingest because it is
 * 91% markup that the website renderer reproduces from these fields.
 *
 * The one thing the renderer cannot recompute is Graphviz's spline routing, so `layout` retains
 * the measured route geometry alongside the node boxes.
 */

const Sha256 = z.string().regex(/^[a-f0-9]{64}$/);

/**
 * Provenance carried by every view, node and route. All observed values are `DECLARED`.
 *
 * Two source shapes exist and both are preserved as they are. A capsule-entry source carries
 * `id` and `encoding`; a SQL selected-blueprint source carries `definitionPk` and
 * `definitionDigest` instead. Only the five fields every source actually carries are required —
 * a field the source does not provide is absent, not defaulted.
 */
export const TopologySource = z.object({
  /** Path of the capsule entry or source document the record was read from. */
  path: z.string(),
  sha256: Sha256,
  /** JSON pointer into that document. */
  pointer: z.string(),
  kind: z.string(),
  label: z.string(),
  /** Capsule-entry provenance. */
  id: z.string().optional(),
  encoding: z.string().optional(),
  /** SQL selected-blueprint provenance. */
  definitionPk: z.string().optional(),
  definitionDigest: z.string().optional(),
});

/**
 * Canonical node vocabulary — the kinds the compiler emits. Each maps to exactly one
 * material texture and one grammar entry, so styling is a pure function of the kind.
 */
export const TopologyNodeKind = z.enum([
  'input',
  'event',
  'outcome',
  'provider',
  'provider-port',
  'decision',
  'termination',
  'rejection',
  'fan-out',
  'convergence',
  /** A declared reference the source does not resolve. Rendered as itself, never filled in. */
  'unresolved',
]);
export type TopologyNodeKind = z.infer<typeof TopologyNodeKind>;

/**
 * Route vocabulary. Kept open rather than enumerated: the compiler emits both lower-case
 * (`operation-order`) and upper-case (`BRANCH_ROUTE`) families, and a route kind the website
 * does not recognise must render as an unstyled declared route rather than fail the publication.
 */
export const TopologyRouteKind = z.string().min(1);

export const TopologyNode = z.object({
  id: z.string(),
  /** Stable semantic identity, e.g. `capability/scenario/input`. */
  identity: z.string(),
  kind: TopologyNodeKind,
  label: z.string(),
  /** Secondary caption under the node, e.g. "Input contract". */
  detail: z.string(),
  source: TopologySource,
  /** Compiler-attached facts (contract ids, port ids). Shape varies by kind. */
  facts: z.record(z.string(), z.unknown()).default({}),
});
export type TopologyNode = z.infer<typeof TopologyNode>;

export const TopologyRoute = z.object({
  id: z.string(),
  identity: z.string(),
  /** Node id. Named `source`/`target` by the compiler; endpoints must resolve within the view. */
  source: z.string(),
  target: z.string(),
  kind: TopologyRouteKind,
  label: z.string(),
  provenance: TopologySource,
  facts: z.record(z.string(), z.unknown()).default({}),
});
export type TopologyRoute = z.infer<typeof TopologyRoute>;

/**
 * Measured geometry from the Graphviz layout pass.
 *
 * `boxes` and `routes` are the irreplaceable part of the discarded SVG: box positions could in
 * principle be recomputed, but spline control points could not, so both are retained together.
 */
export const TopologyLayout = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
  /** node id -> [x, y, width, height] */
  boxes: z.record(z.string(), z.tuple([z.number(), z.number(), z.number(), z.number()])),
  /** route id -> the SVG path `d` produced by the spline router */
  routes: z.record(z.string(), z.string()),
  /** route id -> [x, y] anchor for the route's label, where the layout placed one */
  routeLabels: z.record(z.string(), z.tuple([z.number(), z.number()])).default({}),
});
export type TopologyLayout = z.infer<typeof TopologyLayout>;

export const TopologyView = z.object({
  /** Compiler contract version, preserved from the artifact. */
  version: z.string(),
  id: z.string(),
  identity: z.string(),
  label: z.string(),
  /** Which projection this view is: operations, native execution, expression or blueprint. */
  kind: z.enum(['operations', 'native', 'expression', 'blueprint']),
  source: TopologySource,
  nodes: z.array(TopologyNode),
  routes: z.array(TopologyRoute),
  layout: TopologyLayout,
  /** Scenario identities this view belongs to. */
  scenarioIds: z.array(z.string()),
  /** Compiler findings, preserved. An empty array means none were reported, not none exist. */
  findings: z.array(z.record(z.string(), z.unknown())),
  /** Counts the compiler measured, retained so the site can report coverage without recounting. */
  analytics: z.record(z.string(), z.unknown()),
  /**
   * Digest over nodes, routes and layout — the §12.2 identifier the iframe delivery never
   * carried. Computed at ingest, and re-derivable from this record alone.
   */
  graphDigest: Sha256,
});
export type TopologyView = z.infer<typeof TopologyView>;

/** One capability's compiled views, loaded at capability scope (§12.4). */
export const TopologyBundle = z.object({
  version: z.literal(1),
  capabilityId: z.string(),
  views: z.array(TopologyView),
  /** view id -> scenario ids, so a scenario can select its view without loading every view. */
  index: z.record(z.string(), z.array(z.string())),
});
export type TopologyBundle = z.infer<typeof TopologyBundle>;
