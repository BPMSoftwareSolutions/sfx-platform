# 10 — Browser-binding change request (gate G2)

Lane A deliverable for the SFX website evolution, 2026-10-07. This is the formal request to
`scenario-driven-architecture` required by strategy §7.5 and gate G2
([`implementation-strategy.md:782-794`](../implementation-strategy.md), `:1024`). It is a **draft
for PO review, not a filed request**: strategy §7.5:793-794 and G2:1024 say file only after Phase 1
exit evidence exists; Phase 0 receipts exist (`evidence/WP0-*.json`) and the WP0.6/WP0.7 browser
tooling landed in `8b4fd6d`, but no WP1 receipt is recorded yet.

Method: read-only across `scenario-driven-architecture` (HEAD `01a33a7`), `sfx-embody` and this
repository (HEAD `8b4fd6d`). No SDA repository file was modified; nothing was committed. Every
claim about current behaviour cites `path:line`; everything marked `[proposal]` is design, not
observable behaviour.

---

## 1. The request in one table

| # | Request | Priority | SDA disposition sought |
| --- | --- | --- | --- |
| R1 | A `browser-runtime` binding target alongside `node`, `python`, `csharp` | Blocks G2 | Accept target; publish registry + catalog entries |
| R2 | Admit `ui-embodiment-plan.v1` as a provider protocol (plan applier) | Blocks G2 | Accept protocol identity; per-target provider implementations |
| R3 | Multi-child `invoke-scenario` composition for page → layout → sections (ordering, partial failure, outcome rules) | Blocks the umbrella package | Accept composition semantics and evidence vectors |
| R4 | Page-view testimony semantics | Optional; deferred (D8) | Note as deferred; keep field space open |

The request is grounded in concrete, already shipped v1 input (§7): the `ui-page.v1` schema,
`ui-component.v1` contracts, the twelve-kind action taxonomy and the ten shipped adapters. The
estate-side declarations are frozen at Phase 0 exit; this request changes no declaration meaning.

---

## 2. Current state, observed

**Binding targets are three.** `model.bind_slot_provider` names one target per call and its
evidence names exactly `node`, `python`, `csharp`
(`sfx-embody/sql/migrations/bind-slot-provider.sql:8-10`; the per-target implementation path
resolves the target's `binding_context` and `provider_profile_version_pk` the same way:
`sfx-embody/sql/migrations/declare-provider-port-implementation.sql:89-91`). The SDA platform
capability catalog carries `projectionTarget` values only for those three
(`scenario-driven-architecture/kernel/semantic-authority/consumer/sda-platform-capabilities.semantic-authority.json:1-2`
and per-entry fields, e.g. `:7-8,33-34`); no entry names a browser target, and a search of the
authority catalogs finds "browser" only in the UI-embodiment catalog's implementation refs (§3).

**The plan applier exists but is not a registered protocol.** `ui-embodiment-plan.v1` is a closed
instruction model — seven instruction kinds, a deterministic applier and a structural observer
(`scenario-driven-architecture/languages/typescript/runtimes/browser/runtime/ui-embodiment-plan-v1.mjs:1-9,26-108,110-146`).
The browser-dom and React adapters are shipped implementations: `targetKind`, `constructionApi`,
`nativeRoleFor`/`containerRoleFor` are the whole adapter contract
(`.../presentation/browser-dom/runtime/v3-plan-embodiment.mjs:15-24`,
`.../presentation/react/runtime/v3-plan-embodiment.mjs:15-24`). The UI-embodiment capability
catalog already records the browser and React embodiments as admitted — `sda-react-ui.v1`
(`.../kernel/semantic-authority/consumer/sda-ui-embodiment-capabilities.semantic-authority.json:32-57`)
and `sda-html-ui.v1` with `toolchainRequirements: ["standards-compliant-browser"]` (`:59-76`);
ADR-0009 records their Phase H admission as `PROVIDER_ADMITTED` with `STRUCTURAL` observation, not
browser-native proof (`scenario-driven-architecture/docs/decisions/0009-successor-normalized-ui-presentation-ir-identity.md:118-127`).
But `ui-embodiment-plan.v1` itself appears in **no** platform capability catalog and **no** mechanic
registry: the node registry's `eventPorts` list
(`scenario-driven-architecture/kernel/semantic-authority/consumer/node-mechanic-registry.authority.v1.json:192-438`)
does not name it, and no JSON authority document matches `ui-embodiment-plan`. No binding target
can select the plan applier by a registered identity.

**The adjacent port identity is separately open.** The estate already binds its one page reader to
platform id `sda-embodiment-plan-port.v1` with a statement and
`providerId: sda-declared-read-graph-provider.v1`
(`sfx-embody/sql/migrations/declare-ui-page-reading.commit.sql:406,509-526`); the id has no
declared identity anywhere, which is the subject of the separate open request
`scenario-driven-architecture/docs/request-sda-embodiment-plan-port-registration.md:1-11,20-28`.
This request is adjacent but distinct: that request registers the **invocation port**; R2 admits
the **plan protocol** a target applies. Neither should absorb the other, and R2 does not reopen the
`read-ui-page` binding, which stays on the statement/declared-read path.

**Multi-child composition is declarable but unproven.** `model.declare_scenario` mints one
`operation_scenario_invocation` per `invoke-scenario` operation and fails closed when a link is
missing (`sfx-embody/sql/schema/declare-scenario.sql:161-195`), so several non-terminal child
invocations are legal today; the compiler resolves them after every scenario cell exists
(`scenario-driven-architecture/languages/typescript/runtimes/node/semantic-execution-graph/compiler.js:88-90,225-231`).
The only proven nested shape is one projected child per invocation, with digest-checked binding and
authority and a hard failure on any non-terminated child
(`.../runtimes/node/projected-capability-invocation-provider.mjs:90-124`). How several child
outcomes compose into one page document — ordering, partial failure, the composed outcome — is not
defined. The shipped shell already mirrors a candidate answer for ordering (region order, then
declaration order: `live-circuit/circuit/page-runtime.js:698-701`), but the v1 rule is one kernel
invoke per page, not per section (`implementation-strategy.md:1010`).

**Page views are readings, not receipts.** D8: a render mints no run, claim or trust state
(`implementation-strategy.md:254,835-839`). The plan applier's structural testimony
(`ui-embodiment-plan-v1.mjs:110-146`) is the only testimony that exists, and it is not connected to
the estate receipt stream.

---

## 3. R1 — browser-runtime binding target `[proposal]`

Request: admit `browser-runtime` as a fourth binding target, so an estate provider slot can be
bound for a browser context exactly as `node`/`python`/`csharp` are bound today
(`bind-slot-provider.sql:8-28`).

Proposed SDA-side shape `[proposal]` (names are suggestions; SDA owns exact provenance):

1. **Consumer runtime capability.** One catalog entry in
   `sda-platform-capabilities.semantic-authority.json`, modeled on `sda-node-consumer-runtime.v1`
   (`:4-28`): `capabilityId: sda-browser-consumer-runtime.v1`, `kind: consumer-runtime`,
   `status: ADMITTED`, `projectionTarget: browser-runtime`, provider naming the browser entry
   module, `implementationRef` and `conformanceRef` pointing at the browser runtime.
2. **Mechanic registry.** One authority document of the existing shape
   (`node-mechanic-registry.authority.v1.json:1-9,192-438,472`): `registryType`, `language:
   "browser"`, `providerModuleRoot`, `eventPorts[]` entries, `digestAlgorithm`. Proposed path
   `kernel/semantic-authority/consumer/browser-mechanic-registry.authority.v1.json`, generated into
   a browser-importable ESM artifact `[proposal]`.
3. **Registry loading.** The node registry resolves provider modules through filesystem paths; a
   browser target must resolve admitted modules from the served host surface, without `fs`,
   `process` or a build step (`sfx-platform/AGENTS.md:4-8`: dependency-free ES modules, no build).
   The request asks SDA to name the browser module-resolution rule; the loaders must fail closed on
   an un-admitted module exactly as the kernel does (`PROVIDER_BINDING_DIVERGENCE` /
   `UNDECLARED_EXECUTION_MECHANIC` are the node precedents,
   `sfx-platform/docs/sfx-website-product-evolution/analysis/03-ui-capability-providers.md:191-193`).

Estate-side work (not part of this request, gated on acceptance): a `model.binding_context` row
and profile for `browser-runtime`; `model.declare_provider_port_implementation` per provider/port
(`declare-provider-port-implementation.sql:54-105`); `model.bind_slot_provider` bindings that stay
`UNBOUND` until conformance is recorded. Today there is no browser binding context
(`analysis/03:225-227,546-551`; `analysis/12-ui-runtime-providers.md:29-31`).

Constraints: the browser target must select only admitted platform capabilities; a browser binding
may carry declared configuration, never credentials; no provider may register routes or widen the
gateway (see §8).

---

## 4. R2 — admit `ui-embodiment-plan.v1` as a provider protocol `[proposal]`

Request: give the closed plan model a registered provider-protocol identity so an estate binding
can select the plan applier, and so the browser/React adapters are replaceable realizations instead
of hard-wired code.

Proposed registration `[proposal]`:

- **Protocol identity.** A platform capability entry for `sda-ui-embodiment-plan.v1` (or the
  SDA-chosen id) in the platform catalog or a new protocol catalog, `kind: provider-protocol`
  (the existing catalogs use `consumer-runtime`, `event-port`, `contract-validator`,
  `state-projection`, `representation` — SDA chooses), `status: ADMITTED`.
- **Per-target provider implementations.** Entries in
  `sda-ui-embodiment-capabilities.semantic-authority.json` (the catalog that already carries
  `sda-html-ui.v1` and `sda-react-ui.v1`, `:32-76`) extended with `browser-runtime` as the
  execution target, `implementationRef` to the adapter (`v3-plan-embodiment.mjs`) plus the shared
  applier (`ui-embodiment-plan-v1.mjs`), and `conformanceRef` to the existing browser vector drivers
  (`.../presentation/browser-dom/conformance/browser-vector-driver.mjs`).
- **Behaviour contract** the provider must honour, taken from the shipped code: require
  `planType === "ui-embodiment-plan.v1"`; reject unsupported instruction kinds, duplicate
  instruction ids and unresolved root/child/element references with the named errors already in
  `ui-embodiment-plan-v1.mjs:16-24,69-79`; return the `ui-embodiment-projection.v1` shape
  (`:94-107`); observe as `ui-embodiment-structural-testimony.v1` (`:132-145`). The adapter
  contract is `{ targetKind, constructionApi, nativeRoleFor, containerRoleFor }`
  (`:28-30`; browser-dom `v3-plan-embodiment.mjs:15-20`).
- **Conformance demanded**, per ADR-0007: identical output for identical pinned inputs, complete
  feature-level resolution as `SUPPORTED`/`ADAPTED`/`NOT_SUPPORTED`, plan-digest integrity, stable
  blocking findings, and executable per-capability evidence
  (`docs/decisions/0007-...md:41-46,70-74`). Unknown-field tolerance and silent fallback cannot
  count (`0007:74`); the v3 rules require unknown-field rejection and preserved event/adaptation/
  visibility/token references (`0009:76-90`).

Non-goal: this admission does not re-point the `read-ui-page` statement binding
(`declare-ui-page-reading.commit.sql:523-526`) and does not resurrect any deleted estate provider.
The separate port-identity request stays the owner of the `sda-embodiment-plan-port.v1` id.

---

## 5. R3 — multi-child `invoke-scenario` composition `[proposal]`

Request: define the runtime law for composing a page root scenario that invokes a layout child and
several section children, so one kernel run yields one `ui-page.v1` document. The shipped shell
and the estate contracts already imply most of the answer; the request is to make it SDA law.

**Input shape already legal.** A root terminal scenario with several `invoke-scenario` operations is
declarable (`declare-scenario.sql:161-195`); the page declaration already orders sections by
`regionId`, `order` and declaration position and carries `layout.regions`
(`sfx-embody/sql/migrations/declare-ui-page-reading.commit.sql:119,171-185`), and the shipped shell
sorts region order then declaration order (`page-runtime.js:698-701`).

**Proposed rules** `[proposal]`:

1. **Ordering.** Child `invoke-scenario` operations execute in declared operation ordinal order;
   each child outcome lands in the parent under its declared child slot (`sectionId`/`regionId`),
   and the parent emits sections in the order the parent declared. Composition is deterministic:
   same pinned authority + same child outcomes ⇒ same page bytes.
2. **Outcome composition.** The root scenario's outcome contract is `ui-page.v1`; the composed
   outcome carries `layout` and an ordered `sections[]` whose entries are the child outcomes bound
   to their declared slots, plus the parent composition digest and each child outcome digest. A
   child may declare its own outcome contract (e.g. a layout contract); the parent contract decides
   where it lands. Nested children remain bounded (no cycles; depth bound to be declared).
3. **Partial failure.** A failed child is terminal and named; the parent must not inline a
   different provider or silently drop the slot (`implementation-strategy.md:841-849`). Proposed
   dispositions `[proposal]`: `COMPOSED_COMPLETE` (every required child terminated),
   `COMPOSED_PARTIAL` (only if the parent declares the slot optional; failed slots carry their
   refusal state), `COMPOSITION_HELD` (a required child failed; no page is admitted). The shell
   renders `COMPOSED_PARTIAL` failed slots as visible named refusals, matching the existing
   section-refusal behaviour (`page-runtime.js:231-232,466-472,712-723`).
4. **Lineage and refusals.** Each cell keeps its own receipt lineage; the composed outcome binds
   child outcome digests and the parent authority digest. Undeclared child scenario, unresolved
   child contract and cycle all refuse deterministically.

**Evidence to demand.** Canonical vectors for: ordered composition; out-of-declaration-order
children; one optional child refused; one required child refused; all children refused; empty
child set; duplicate/cyclic child references; and digest equality across two identical runs.

---

## 6. R4 — page-view testimony semantics (optional, deferred) `[proposal]`

D8 says a page view is a reading, not an execution, and mints no run, claim or trust state
(`implementation-strategy.md:254,835-839`), so v1 asks for nothing here. If page views are ever to
produce evidence, the request would be:

- a render testimony derived from `ui-embodiment-structural-testimony.v1`
  (`ui-embodiment-plan-v1.mjs:132-145`), emitted by the admitted protocol under the requirement
  that it does not promote a reading into a receipt;
- a separate admission for any receipt-like stream, using the kernel's testimony pattern
  (`scenario-driven-architecture/languages/typescript/runtimes/node/semantic-execution-graph/scheduler.js:557-566`),
  with the browser write surface unchanged (GET-only reads; the POST allowlist is not widened,
  `implementation-strategy.md:808-822`).

Requested disposition now: **deferred, field space kept open**; do not spend SDA acceptance
capacity on it at G2.

---

## 7. Concrete v1 input (the grounding package)

Everything below is shipped and cited; it is the declaration input the request is filed with.

### 7.1 `ui-page-request.v1` / `ui-page.v1` schemas

Declared by the `read-ui-page` capability document
(`sfx-embody/sql/migrations/declare-ui-page-reading.commit.sql:406`), delivered as the single-value
reader `analysis.read_ui_page_document` (`:227-299`, result contract id at `:290`):

- `ui-page-request.v1`: `{ contractId, payload: { path, revision?, expectedPageDigest? } }`,
  `additionalProperties: false`.
- `ui-page.v1`: required `contractId`, `status` (`READ | NOT_FOUND | NOT_DECLARED |
  SNAPSHOT_CHANGED`), `path`, `readingDefinitionSha256`, `readAt`; optional `pageId`, `revision`,
  `pageDigest`, `requestedPageDigest`, `servedPageDigest`, `layout` (object), `sections` (array).
- `ui-page-definition.v1` seed: `pageId`, `namespaceId`, `path`, `revision`, `title`,
  `layoutRef { layoutId, digest }`, `sources[]`, `contentAuthority`, `sections[]`
  (`:147-185`).

### 7.2 `ui-layout.v1` and `ui-component.v1`

- Layout seed `ui-layout-marketing.v1`: `regions[{ regionId, order, placement, width }]`,
  `policy { stack, density, tokenSet }` (`:119`).
- Ten `ui-component.v1` contracts, digest-addressed, with the `roles`/`props`/`states` vocabulary
  (`:127-145`): `hero`, `section`, `text`, `heading`, `stat`, `card`, `card-list`, `list`,
  `media.figure`, `notice`. Example: `notice` roles `["title","body","action","state"]`, props
  `tone/title/body/actionId/state`, states `info|warning|error|empty` (`:138`).

### 7.3 Action taxonomy

Twelve kinds over three dispatch classes — `local` (`navigate`, `select`, `playback`, `view`,
`toggle`, `pane`, `copy/download`, `stage-change`), `session-post` (`session`, `observe`,
`objective`), `read` (`refresh`) — with the closed event vocabulary `load|click|submit|change|
select|seek|toggle` and input-binding scopes `literal|route|event|form|row|source`
(`implementation-strategy.md:318-355`). Shipped as the registry table
(`live-circuit/circuit/page-runtime.js:31-44`) and enforced in `validatePage`/`dispatchAction`
(`:114-133,142-170,609-671`). `dispatchClass` names a pre-existing seam; it is not authority —
actual authority is resolved downstream by the capability system (strategy `:322-324`; C22).

### 7.4 Shipped adapters as the reference embodiment

- Registry and role table: `UI_COMPONENT_ROLES` plus derived `UI_COMPONENTS`
  (`live-circuit/circuit/ui-components.js:463-524,528-552`); ten renderers.
- Safety primitives: `h()` drops handler attributes and writes text via `textContent`
  (`:13-28`); URLs pass `safeUrl` (`:51-58`; `page-runtime.js:82-96`).
- Runtime binding/refusal/ordering: `createPageRuntime` (`page-runtime.js:271-728`).
- Host contract: `ui.components` allowlist and `readers.page`
  (`live-circuit/circuit/circuit-host.json:17-23`); manifest shape and class (b)/(c) split
  (`implementation-strategy.md:723-751`).
- SDA reference adapters already shipped for the same plan model: browser-dom
  (`.../presentation/browser-dom/runtime/v3-plan-embodiment.mjs:6-71`) and React
  (`.../presentation/react/runtime/v3-plan-embodiment.mjs:6-65`).

### 7.5 Acceptance status carried by the input

Phase 0 receipts: WP0 publish (`evidence/WP0-publish-2026-10-07T200052.json`), CAS rollback
(`WP0-publish-rev3.json`), latency (`WP0-latency-2026-10-07.json`); WP0 status table in
`implementation-strategy.md` "Phase 0 status (2026-10-07)"; the signed-in-home and rendering-safety
browser gate landed in `8b4fd6d`. No WP1 receipt exists yet.

---

## 8. Security boundary — the browser proposes, the capability system authorizes

The boundary is already stated by the strategy and the trusted-shell analysis; the request binds
SDA to it:

- A provider may **describe and realize declared meaning; it may never validate, route, dispatch,
  authorize, or widen credentials** (boundary law, `analysis/11-trusted-shell-boundary.md:19-23`).
  The invariants I1–I7 are the acceptance contract after G2 (`:66-74`), and the six-question
  boundary test gates any provider change (`:145-158`).
- Browser reads stay GET-only; the gateway POST allowlist is not widened; credentials never reach
  the browser (`implementation-strategy.md:808-822`; `analysis/11:69-72`).
- `dispatchClass` and any browser binding are not authority; actual authority stays downstream in
  the capability system, resolved by the kernel for each child invocation (strategy `:322-324`;
  C22 `:1150-1153`).
- A browser-bound provider may apply only an admitted plan and must report
  `SUPPORTED`/`ADAPTED`/`NOT_SUPPORTED` without reinterpreting meaning (ADR-0007 `:41-46`;
  ADR-0009 `:118-127`).
- Declarations can never install trusted code: no markup, style, handler text, script or arbitrary
  URL protocol executes (`implementation-strategy.md:851-857`; `analysis/11:73-74`).

The asymmetry the request encodes: the browser target *proposes* a projection; the capability
system *authorizes* every effect and every nested invocation.

---

## 9. Rollback and compatibility

- **Additive targets.** Admitting `browser-runtime` and the plan protocol leaves `node`, `python`
  and `csharp` untouched; v1/v2 and successor presentation paths are frozen and remain
  directional-compatibility only (ADR-0009 `:56-63`; ADR-0010 `:44-48`).
- **Digest-bound registries.** Registry/catalog changes re-mint authority digests; the kernel
  install receipt is regenerated and a rollback is a reinstall of the prior digest
  (`node-mechanic-registry.authority.v1.json:472`; the install/acceptance shape in
  `scenario-driven-architecture/languages/typescript/src/kernel/install/`).
- **No declaration changes.** `ui-page.v1`, `ui-layout.v1` and `ui-component.v1` documents are
  byte-identical through the migration; if browser admission regresses, provider bindings stay
  `UNBOUND` and the shell keeps its shipped adapters (`analysis/12-ui-runtime-providers.md:124-167`).
- **One package per deploy, no republication** (analysis/12 `:149-155`); shell releases restore the
  prior digest and data publishes have their own CAS rollback (strategy `:888-897`).
- **Version rule.** Any change to the plan instruction vocabulary is a new plan version, never an
  extension; unknown fields refuse (ADR-0007 `:36`; ADR-0009 `:80-90`).

---

## 10. Acceptance evidence required

| Side | Evidence | Gate |
| --- | --- | --- |
| SDA | Browser registry artifact + digest parity with the authority document | registry `--check`, install receipt |
| SDA | Catalog entries carry `implementationRef`, `conformanceRef`, digests and status for every admitted target | authority review |
| SDA | Per-target conformance: identical projection for pinned plans; empty-plan admission; unknown-field/unsupported-instruction rejection; stable findings | ADR-0007 `:70-74`; ADR-0009 `:76-90` |
| SDA | Composition vectors for §5 (ordering, partial failure, outcome composition, lineage) | new conformance suite |
| SDA | Kernel/browser code-path parity for the same plan corpus; provider unavailable refuses, never falls back | `PROVIDER_BINDING_DIVERGENCE` precedent |
| Platform | WP0.1–WP0.7 receipts (existing) plus WP1.x: second declared page, declared reader resolved, registry churn measured, no schema change | strategy `:870-881,954-956` |
| Platform | Browser gate green: signed-in home, rendering safety, declared navigation | `8b4fd6d`; strategy `:879-880` |
| Platform | After admission: estate pair declares provider identities/port implementations for `browser-runtime`; bindings stay `UNBOUND` until its conformance run; declarations republished = none | analysis/12 `:140-155` |
| Platform | Rollback drill: unbind/refuse path restores the shipped adapters with no declaration digest change | strategy `:888-897` |

The per-language conformance evidence format follows the open port-registration request's shape
(`scenario-driven-architecture/docs/request-sda-embodiment-plan-port-registration.md:151-179`) so
both requests land on one evidence convention.

---

## 11. Filing condition and non-goals

- **Filing condition.** Per strategy §7.5:793-794 and G2:1024, file only after Phase 1 exit
  evidence exists, with the v1 schema and page documents (§7) as the input. Until then this file is
  the reviewable draft.
- **Non-goals.** No change to the `read-ui-page` statement/declared-read binding; no resurrection
  of any deleted estate provider; no new browser write path, route, method or header; no
  page-local rendering code in declarations; no per-section kernel invokes in v1; no reopening of
  `consumer-ui-authority.v1`/v2 or the v3 identity; no identity-schema change (that path is
  `sfx-dal`, `AGENTS.md:14-16`).
