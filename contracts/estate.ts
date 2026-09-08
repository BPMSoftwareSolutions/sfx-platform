/**
 * Publication contracts — §11.3.
 *
 * Field names here are *website projection* fields. They are not assertions that
 * identically named database columns exist. The publication service (scripts/publish-estate.mjs)
 * is the only producer of values satisfying these schemas; the website only ever reads a
 * validated publication.
 *
 * Availability dimensions are kept separate on purpose (§11.3): route/content published,
 * authority state, source evidence basis, graph fidelity, provider binding, target readiness,
 * executable artifact availability, and image production status. Unknown stays unknown.
 */
import { z } from 'zod';

/** A source-preserved value that may legitimately be absent. Absence means unknown, never "no". */
const unknownable = <T extends z.ZodTypeAny>(inner: T) => inner.nullable();

export const Digest = z.string().regex(/^sha256:[0-9a-f]{64}$/, 'expected a sha256 digest');

/** §12.2 — how much of the circuit the source actually qualifies. */
export const GraphFidelity = z.enum(['FULL', 'BOUNDARY', 'PARTIAL_BOUNDARY']);
export type GraphFidelity = z.infer<typeof GraphFidelity>;

/** §12.5 / §11.5 — image production status. A placeholder is a transient state, not fulfillment. */
export const VisualState = z.enum([
  'REQUIRED',
  'QUEUED',
  'GENERATING',
  'REVIEW_REQUIRED',
  'READY',
  'FAILED',
  'STALE',
]);
export type VisualState = z.infer<typeof VisualState>;

/** §12.7 — subject kinds that carry a visual requirement. */
export const EntityKind = z.enum(['CAPABILITY', 'MECHANIC', 'PROVIDER', 'SCENARIO', 'BLUEPRINT']);
export type EntityKind = z.infer<typeof EntityKind>;

/** §11.3 — EntityVisual. Records the requirement even when no image exists yet. */
export const EntityVisual = z.object({
  subjectKind: EntityKind,
  /** model.semantic_object primary key, preserved from source. */
  semanticObjectPk: z.string(),
  /** model.semantic_object_definition primary key — the exact definition the art binds to. */
  semanticObjectDefinitionPk: z.string(),
  purpose: z.enum(['CARD', 'DETAIL', 'SHARING']),
  state: VisualState,
  /** Null until bytes are committed to the media service (§11.5). A URL alone is not an image. */
  assetRevisionId: unknownable(z.string()),
  originalDigest: unknownable(Digest),
  mediaType: unknownable(z.string()),
  width: unknownable(z.number().int().positive()),
  height: unknownable(z.number().int().positive()),
  altText: unknownable(z.string()),
  /** The model actually configured for the job, recorded as run — not as requested. */
  generatorModel: unknownable(z.string()),
  publishedUrl: unknownable(z.string()),
});
export type EntityVisual = z.infer<typeof EntityVisual>;

/** A source-preserved state string plus the readable explanation the inspector shows. */
export const SourceState = z.object({
  /** Exact value as it appears in the estate. Never normalised away. */
  value: unknownable(z.string()),
  /** Editorial rendering of that value. Absent source state reads as "not declared". */
  readable: z.string(),
});
export type SourceState = z.infer<typeof SourceState>;

/** §11.2 — one scenario face: Input -> Event -> Outcome under an owning capability. */
export const ScenarioFace = z.object({
  scenarioId: z.string(),
  capabilityId: z.string(),
  semanticObjectPk: z.string(),
  semanticObjectDefinitionPk: z.string(),
  scenarioVersionPk: z.string(),
  inputId: unknownable(z.string()),
  eventId: unknownable(z.string()),
  outcomeId: unknownable(z.string()),
  /** The declared responsibility sentence, verbatim from source. */
  responsibility: unknownable(z.string()),
  inputContractState: SourceState,
  eventAuthorityState: SourceState,
  visuals: z.array(EntityVisual),
});
export type ScenarioFace = z.infer<typeof ScenarioFace>;

/** §12.3 — canonical primitives this renderer carries. */
export const CircuitNode = z.object({
  id: z.string(),
  primitive: z.enum(['INPUT', 'EVENT', 'RESPONSIBILITY', 'OUTCOME', 'PROVIDER_SLOT', 'UNRESOLVED']),
  label: z.string(),
  /** Source identity behind the label, shown on demand in the inspector. */
  sourceId: unknownable(z.string()),
  state: SourceState,
});
export type CircuitNode = z.infer<typeof CircuitNode>;

export const CircuitEdge = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  /** §12.3 — route families keep their type; a support link is not execution flow. */
  family: z.enum(['EXECUTION', 'PRODUCT_TRANSFER', 'SUPPORT']),
});
export type CircuitEdge = z.infer<typeof CircuitEdge>;

/** §11.3 — CircuitProjection. Topology is deterministic; nothing here is generated art. */
export const CircuitProjection = z.object({
  capabilityId: z.string(),
  scenarioId: z.string().nullable(),
  /** The exact source profile this graph was compiled from. */
  sourceProfile: z.string(),
  sourceDigest: Digest,
  graphDigest: Digest,
  sclVersion: z.string(),
  rendererVersion: z.string(),
  lens: z.enum(['CAPABILITY_OVERVIEW', 'SCENARIO', 'EVIDENCE']),
  fidelity: GraphFidelity,
  nodes: z.array(CircuitNode),
  edges: z.array(CircuitEdge),
  /** Why the graph is not full, when it is not. Never silently empty. */
  diagnostics: z.array(z.object({ code: z.string(), message: z.string() })),
});
export type CircuitProjection = z.infer<typeof CircuitProjection>;

/** §11.3 — EntityPage. CapabilityPage specialises this. */
export const EntityPageBase = z.object({
  kind: EntityKind,
  /** Source-derived namespace. Null when this generation did not carry one for the kind. */
  namespaceId: unknownable(z.string()),
  /**
   * Routing segment. Slugified from namespaceId when the source carried one; otherwise a
   * publication-assigned segment, flagged below so no page can present it as source identity.
   */
  urlNamespace: z.string(),
  urlNamespaceIsPublicationAssigned: z.boolean(),
  entityId: z.string(),
  /** Stable, URL-safe public key resolved by the server (§3.3). */
  urlKey: z.string(),
  semanticObjectPk: z.string(),
  semanticObjectDefinitionPk: z.string(),
  /** Reviewed editorial title. Falls back to the source identity when no name was declared. */
  title: z.string(),
  /** True when the source declared no display name and the identity stands in (§5.20). */
  titleIsIdentityFallback: z.boolean(),
  summary: unknownable(z.string()),
  definitionProfile: unknownable(z.string()),
  visuals: z.array(EntityVisual),
});

export const MechanicPage = EntityPageBase.extend({
  kind: z.literal('MECHANIC'),
  mechanicKind: unknownable(z.string()),
  /** Providers declaring an implementation. Zero means undeclared, not "none exists". */
  providerIds: z.array(z.string()),
  implementationRelationshipCount: z.number().int().nonnegative(),
});
export type MechanicPage = z.infer<typeof MechanicPage>;

export const ProviderPage = EntityPageBase.extend({
  kind: z.literal('PROVIDER'),
  declarationProfile: unknownable(z.string()),
  mechanicIds: z.array(z.string()),
  mechanicRelationshipCount: z.number().int().nonnegative(),
  capabilityRelationshipCount: z.number().int().nonnegative(),
});
export type ProviderPage = z.infer<typeof ProviderPage>;

export const BlueprintRecord = z.object({
  blueprintId: z.string(),
  capabilityId: unknownable(z.string()),
  carrierProfile: unknownable(z.string()),
  sourceDisposition: SourceState,
  nodeCount: z.number().int().nonnegative(),
  edgeCount: z.number().int().nonnegative(),
});
export type BlueprintRecord = z.infer<typeof BlueprintRecord>;

export const CapabilityPage = EntityPageBase.extend({
  kind: z.literal('CAPABILITY'),
  /** Managed estate capability vs. platform capability identity — kept separate (§11.2). */
  scope: z.enum(['MANAGED', 'PLATFORM']),
  scenarios: z.array(ScenarioFace),
  blueprints: z.array(BlueprintRecord),
  graphFidelity: GraphFidelity,
  /**
   * Target availability. Empty means no target declaration was published for this capability;
   * it does not mean the capability has no possible embodiment.
   */
  targets: z.array(
    z.object({
      target: z.string(),
      readiness: SourceState,
      executableArtifactAvailable: z.boolean(),
      conformanceEvidence: unknownable(z.string()),
    }),
  ),
  /** §1.6 — an export is offered only when its manifest resolves. */
  downloadEligibility: z.object({
    authority: z.boolean(),
    embodiments: z.boolean(),
    reason: unknownable(z.string()),
  }),
  relatedCapabilityIds: z.array(z.string()),
});
export type CapabilityPage = z.infer<typeof CapabilityPage>;

/** §11.3 — EstatePublication. The atomic release manifest the whole site binds to. */
export const EstatePublication = z.object({
  publicationId: z.string(),
  contractVersion: z.literal('1.0.0'),
  /** Identity of the selected model this generation was read from. */
  source: z.object({
    snapshotId: z.string(),
    projectionDigest: z.string(),
    queryDigest: z.string(),
    resultDigest: z.string(),
    estateModelPk: z.string(),
    /** When the source query actually ran — not when the site was built. */
    observedAt: z.string(),
    /** §11.4 step 3 — a truncated result is never a complete estate. */
    truncated: z.boolean(),
    rowLimit: z.number().int().positive(),
    disposition: z.string(),
  }),
  builtAt: z.string(),
  adapterVersion: z.string(),
  /** Counts come from this generation. They are never hardcoded into copy (§11.2). */
  coverage: z.object({
    managedCapabilities: z.number().int().nonnegative(),
    capabilityIdentities: z.number().int().nonnegative(),
    capabilityDefinitions: z.number().int().nonnegative(),
    publishedCapabilities: z.number().int().nonnegative(),
    mechanics: z.number().int().nonnegative(),
    providers: z.number().int().nonnegative(),
    providerMechanicRelationships: z.number().int().nonnegative(),
    scenarioFaces: z.number().int().nonnegative(),
    blueprints: z.number().int().nonnegative(),
    blueprintNodes: z.number().int().nonnegative(),
    blueprintEdges: z.number().int().nonnegative(),
    mechanicsWithoutDeclaredName: z.number().int().nonnegative(),
    /** §12.7 — the requirement registry is the denominator, including missing images. */
    visualsRequired: z.number().int().nonnegative(),
    visualsReady: z.number().int().nonnegative(),
  }),
  capabilities: z.array(CapabilityPage),
  mechanics: z.array(MechanicPage),
  providers: z.array(ProviderPage),
  /** Findings the source reported. Preserved, never smoothed over (§11.2). */
  findings: z.array(z.object({ code: z.string(), message: z.string(), count: z.number().int() })),
});
export type EstatePublication = z.infer<typeof EstatePublication>;
