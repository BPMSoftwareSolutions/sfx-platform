# Observation altitudes — implementation plan (2026-09-23)

**Status:** In progress. The owner said "get this done", so D1–D3 are taken as ratified in the recommended form. D4 and D5 are decided (2026-09-23): D4 replaces the C#-only `--plan-only` flag with a declared compile-only verb in the command operations authority, so Node and Python flag parity is no longer owed; D5 renames the display sense of "projection" to view/grain/grouping in obs (done 2026-09-23). Wave 1 lanes are running (phases 0, 1, 4, 8, the website half of 7, and the estate half of 2–3; see the §5 change-surface map). Wave 2 (the website halves of 1–3, and 5) follows.
**Governing decision:** `docs/observation-altitudes.md` ("obs"). The work follows its §8 delivery sequence.
**Basis:** the circuit mapping trace `docs/circuit-mapping-trace-2026-09-23/` ("the trace") and its review `docs/observation-altitudes-review.md` ("the review").
**Grounding:** `sfx-embody/docs/sidefx-architecture-decision-rubric.md`, `target-architecture.md` and `transistor-model.md`:
- Meaning is declared as rows.
- Resolvers are the only hand-authored code.
- Every kernel change is owed in all three languages.
- Evidence and receipts never share the outcome port.

**Supersedes:** the ordering of `docs/circuit-layout-flow-alignment-plan-2026-09-23.md` ("the layout plan"). Its P1–P6 become phase 6 here, after the drawing's meaning is declared. Its layout rules, measurements and non-goals stand.

## 1. What the drawing has to say, and where each fact is today

The trace measured what a correct circuit for any capability needs. Each fact below is shown with where it is declared and whether it reaches the platform.

| Fact | Where it is declared | In the circuit record (`execution-graph-captured.v1`)? | Today the platform… |
| --- | --- | --- | --- |
| **Scenario Input / Event / Outcome** (ids and contracts) | graph source `scenarios[].input/event/outcome` | Contracts only, as port `contractId`s; no roles | never draws Input or Event |
| **What each operation is** (port binding `platformCapabilityId`) | graph source `interfaceAuthority.portBindings` | **No.** `PublicProjection` drops `execution.configuration.binding`; the schema excludes "provider bindings" | guesses from word stems in names |
| **Transformation identity** (`transformationId`) | port binding `configuration.transformationId` | No | — |
| **Operation membership** (cell → its operation) | the record's `parentCellId` chain; the grain is declared for testimony by `read-capability-circuit` | Yes (as parent chain) | groups by a 30-cell count |
| **Declared operation order** | graph source `operations[]` order; the record's `sequence` edges | Yes (edges) | ranks by material or altitude bands |
| **Junction arm variant** | graph edges `selectsVariant` | Yes | merges arms into one drawn edge (`from\|to\|kind`) |
| **Outcome variant and classification per cell** | declared per capability (e.g. `classify-equity-outcome-variants.sql`); carried in testimony | Testimony lane, yes | turns `failure` into `held`, and shows no variant |
| **Material per declared identity** | not declared anywhere | — | `CELL_MATERIAL`, `MATERIAL_WORDS`, `COMPOSITE_MATERIAL`, `EDGE_MATERIAL` in `scl-theme.ts` |
| **Grain** (what one drawn node is) | `read-circuit-presentation` declares only `granularity.detailCellLimit: 30` | — | mirrors the number (`run-graph.ts:24`) and never reads the policy |

## 2. The three layers, and who owns what

| Layer | Repository | Owns | Must not |
| --- | --- | --- | --- |
| **Declared (estate)** | `sfx-embody` (`sql/migrations`, estate DB) | Every meaning: capability, operations, bindings, outcome variants and classification, **the presentation policy** (materials, grain, glyphs) | — |
| **Resolver (SDA)** | `scenario-driven-architecture` (kernel ×3 languages, `services/sda-api`) | Compiling declared graphs; the circuit record; testimony; the run API that supervises the CLI | Hold presentation meaning; emit configuration or credentials |
| **Website** | `sfx-platform` | Rendering the declared record and policy; laying out geometry | Decide meaning: no name matching, no count-based grouping, no inferred states |

## 3. Owner decisions

**D1 — Root and state semantics.** obs adopts baseline §8.1 through §7 line 348, while its own §5, OA5 and OA6 contradict it (review finding 4).
- **Recommendation:**
  - The root shows its own testified outcome (variant and classification).
  - `run.exited` sets run status only.
  - A failed attempt shows as failed, with its variant.
  - Nothing is marked "superseded". Route supersession isn't declared in the record, so marking it would be an inference. Each operation shows its own testified outcome instead.
  - A completed sibling never overrides a failure.
- Requires a revision of obs §7 (obs §9 change control).

**D2 — How the declared semantics (the §1 rows marked "No") reach the drawing.**
- **(a) The circuit record carries them.**
  - `PublicProjection` adds, per cell, the binding *identities* `platformCapabilityId` and `transformationId`, never the configuration.
  - The scenario cell carries its Input/Event/Outcome ids.
  - This reverses the schema's "no provider bindings" exclusion for identities only.
  - Today only C# emits the record at all. The Node and Python kernels have no `execution-graph-captured.v1` emitter, so the three-language debt exists already and grows with this change.
- **(b) A declared estate read serves them per capability.**
  - A declared read port over `analysis.v_capability_graph_source` already exists (`execution-graph-read-provider-port`, `redeclare-execution-graph-read-ports.sql`).
  - It is unverified whether it can be invoked through sda-api and whether its output is limited to non-sensitive fields. The graph source contains the credential binding's configuration.
  - The platform would join its rows to the record's `cellId`s, which is a second source keyed differently from `canonicalGraphDigest`.
- **Finding that narrows (a):** the compiled canonical graph already holds a declared, non-sensitive identity on every cell. The field is `execution.authorityId` (`SemanticExecutionGraphCompiler.cs` 117, 186, 268, 285, 671, 760, 779). The scenario cell's value is the event's execution authority. Operation cells hold `operation:<platformCapabilityId>`. Provider cells hold `provider:<id>` and physical cells `physical:<primitiveProfileId>`. Expression cells hold `mechanic:<op>.v1`, and junctions `junction:boolean-selection.v1`. The outcome port already carries `variants` and `variantClassifications`. So (a) only means the record stops dropping `authorityId` and the outcome port's variants. No binding or configuration is added, and the schema's "no provider bindings" exclusion stands. The scenario's Input, Event and Outcome are its input port contract, its `authorityId` and its outcome port contract, which is the same rule for every capability.
- **Recommendation: (a), in the narrowed form above.**
  - One record, tied to one digest, serves both the compiled drawing and the live drawing.
  - Nothing is joined across sources.
  - sda-api validates the record against the kernel schema named in its authority file (`services/sda-api/src/authority.ts:31`), so a schema change reaches the host without host code.
  - The three-language emitter debt is owed either way and should be scheduled, not hidden.

**D3 — Where the material map is declared.**
- **Recommendation:** extend `circuit-presentation.v1` (the `read-circuit-presentation` policy).
  - Its schema is open (`additionalProperties: true`).
  - It already holds per-altitude declarations (`labels.prefixes`) and the grain (`granularity`).
- Add three exact-key maps:
  - `materials.boundary`: the scenario cell drawn as its three roles, Input (input port contract), Event (`authorityId`) and Outcome (outcome port contract), each with its material token;
  - `materials.byAuthority`: exact `authorityId` → material token, for every non-scenario authority in the estate;
  - `materials.byEdgeKind`: edge kind → material token.
  - No map falls back to another, and nothing is matched by substring or prefix.
- Add `granularity.node` (for example `"operation"`) beside `detailCellLimit`.
- The platform reads the policy; any unmapped identity renders `UNRESOLVED`.

**D4 — Compiled graph without running.** `GET /v1/capabilities/{id}/graph` uses the C#-only `--plan-only` flag (SDA `da80de3`). The owner earlier called this approach bespoke. The choice is:
- keep the flag, with Node and Python parity owed; or
- replace it with a declared compile-only verb in the command operations authority (`sda-kernel-command-operations.v1`, `declare-kernel-carrier-authorities.sql`).
- **Decision (2026-09-23): replace.** Use the declared compile-only verb in the command operations authority; Node and Python flag parity is no longer owed.

**D5 — Vocabulary.**
- obs uses "projection" for choosing what to show.
- In the owner's vocabulary, projection means generating code from declared meaning.
- This plan uses "view", "grain" and "grouping" instead. Renaming the terms in obs is an obs revision.
- **Decision (2026-09-23): rename.** Done in obs the same day: the display sense is "view", "grain" and "grouping"; "projection" is kept only for generating code from declared meaning.

## 4. Phases

Every phase is accepted by re-running the trace generator on the same captures:

```text
node --import tsx docs/circuit-mapping-trace-2026-09-23/mapping-trace.mts <run.json> <outDir> <events.jsonl> [graph-source.json]
```

Acceptance compares the regenerated summary and trace with the targets below. Each phase must hold for **every** capability; the equity and hello-world captures are the measured pair. obs acceptance item 4 requires additional fixtures for constructs equity doesn't exercise: fan-out, joins and recurrence.

### Phase 0 — Durable measuring instrument (website; no decisions needed)

| Layer | Change surface |
| --- | --- |
| Estate | None |
| SDA | None |
| Website | Commit `docs/circuit-mapping-trace-2026-09-23/` (new files only). Move the equity (resolved), equity (rejected) and hello-world captures from `%TEMP%` into durable fixtures, e.g. `tests/fixtures/circuit/` (new). Add a test that runs the generator against the fixtures and asserts the summary. |

- **Acceptance:** the committed summary reproduces byte for byte from the committed fixtures on a clean checkout.
- **obs §8:** "Regression and visual verification".

### Phase 1 — Declared semantics reach the circuit record (D2)

Written for D2 (a). Under (b), the SDA rows become a declared read in the estate plus a platform join.

| Layer | Change surface |
| --- | --- |
| Estate | None. The telemetry allowlist is to be checked (lane A). |
| SDA | `kernel/schemas/execution-graph-captured.v1.schema.json`: add the required cell `authorityId` (the canonical `execution.authorityId`) and the outcome port's optional `variants` / `variantClassifications`. The "no configuration, no provider bindings" exclusion stays. `languages/csharp/src/ScenarioKernel.Adapters/Graph/SemanticExecutionGraphScheduler.cs` `PublicProjection` (line 1765). `languages/csharp/tests/ScenarioKernel.ConformanceTests/ExecutionGraphCapturedProjectionTests.cs`, including a leak test proving no configuration value appears. Node (`languages/typescript/src/kernel/bootstrap/…`) and Python (`languages/python/src/scenario_kernel/kernel/bootstrap/invocation_boot.py`, which has `on_plan`) emitters: new, owed. `services/sda-api/test/graph.test.ts` and `capability-graph.test.ts` fixtures; no sda-api source change, since the schema is read through `interfaces/sda-api/sda-api-v1.authority.json` `schemas.runGraphProjection`. |
| Website | `contracts/sda-api.ts` `SdaRunGraphCell`: type the new fields. `lib/run-graph.ts` `normalizeRunGraph`: carry them to `RunGraph` cells. |

- **Acceptance:**
  - Equity: 35 of 35 operations carry a `platformCapabilityId`, matching the graph source table in trace §1.
  - The scenario cell carries Input `live-equity-price-request`, Event `equity-market-price-evidence-requested` and Outcome `equity-market-price-evidence`.
  - The leak test passes.
- **obs §8:** "Source and projection authority".

### Phase 2 — Declared material map (D3)

| Layer | Change surface |
| --- | --- |
| Estate | New migration (e.g. `extend-circuit-presentation-materials.sql`) re-declaring the `circuit-presentation.v1` policy with `materials.boundary`, `materials.byAuthority`, `materials.byEdgeKind` and `granularity.node`. It follows the pattern of `extend-circuit-presentation-connectors.sql`: full policy literal, ASCII escapes, inspection queries. |
| SDA | None. |
| Website | `components/circuit/scl-theme.ts`: remove `MATERIAL_WORDS` (253), `COMPOSITE_MATERIAL` (278), the 13 dead `CELL_MATERIAL` keys (181) and `EDGE_MATERIAL` substring needles (233). `resolveCellMaterial` / `resolveEdgeMaterial` look up the declared maps by exact key; a miss is `UNRESOLVED` and visible. A server read of `read-circuit-presentation` passed to the circuit panel (`app/capabilities/[namespace]/[capabilityId]/page.tsx`, `components/estate/capability-circuit-panel.tsx`). |

- **Acceptance** (trace `materialDriver` column):
  - Every cell is either "declared" or `UNRESOLVED`, with 0 word-stem and 0 composite-rule assignments.
  - The credential binding and the HTTP exchange get different materials.
  - Hello-world's mechanics are no longer the generic plate unless the policy declares it.
  - No capability-specific code.
- **obs §8:** "Evidence and material mapping".

### Phase 3 — Declared grain replaces the count collapse

| Layer | Change surface |
| --- | --- |
| Estate | The same policy migration as phase 2 adds `granularity.node: "operation"`. `detailCellLimit` stays for the terminal renderer until its owner retires it. |
| SDA | None. |
| Website | `lib/run-graph.ts` `buildRunGraphView` (165): group by the declared grain along the `parentCellId` chain. Delete `DETAIL_CELL_LIMIT` (25) and the KNOWN DEFECT note once the policy is read. Draw the scenario's Input / Event / Outcome from phase 1. |

- **Acceptance** (equity):
  - The drawing has 1 scenario, its Input, Event and Outcome, and 35 operations.
  - All 7 route decisions are drawn.
  - The lit node moves once per operation, op.1 → op.35, then to the root. This follows from the trace's 0 interleaved operations.
  - Every walked edge is either drawn or internal to exactly one operation.
- **obs §8:** "OA3–OA8 circuit projection".

### Phase 4 — Truthful states (D1)

| Layer | Change surface |
| --- | --- |
| Estate | None: outcome variants and their classification are already declared per capability. A capability whose variants are unclassified is a declared gap, shown as such. |
| SDA | None. |
| Website | `lib/live-trace.ts`: `cellState` (98–117, stop mapping `failure` to `held`), `aggregateNode` (138–166, a completed member never overrides a failure), `applyLifecycle` (244–254, `run.exited` sets run status only). Update the module header, which states the §8.1 rule. `tests/` replays of the three fixtures. |

- **Acceptance:**
  - Equity resolved: the root shows `EQUITY_MARKET_PRICE_EVIDENCE_RESOLVED / success`.
  - Equity rejected: the root shows `NATIVE_MARKET_PRICE_TESTIMONY_REJECTED / failure`, not done.
  - Routes 1–2 show their failed exchange and `PROVIDER_UNAVAILABLE` attempts as failed. Route 3 shows RESOLVED.
  - Routes 4–7 show `CREDENTIAL_NOT_AVAILABLE` / `rejected-endpoint` as failed attempts.
  - No drawn node is failed because a member failed. Member failures are counted on the node instead.
  - Hello-world is unchanged.
- **obs §8:** "Overlays" (state scope and aggregation).

### Phase 5 — Outcome variants and junction arms in the drawing (OA5)

| Layer | Change surface |
| --- | --- |
| Estate | None. |
| SDA | None. |
| Website | `lib/run-graph.ts` drawn-edge key (309, working tree): include `selectsVariant` so arms stay distinct (M7). `components/circuit/circuit-viewer.tsx`: show the testified variant on the operation and the root. |

- **Acceptance:**
  - Each of the 7 selection junctions shows its walked arm (`FALSE` × 28 in the trace), and unwalked arms are never lit.
  - Every drawn operation shows its testified variant.
- **obs §8:** "OA3–OA8 circuit projection" (alternatives, ports).

### Phase 6 — Layout (the layout plan's P1–P5, re-based)

| Layer | Change surface |
| --- | --- |
| Estate | Only if the owner declares geometry in the policy (the `layout.stableIndent` precedent). |
| SDA | None. |
| Website | `components/circuit/geometry.js`, `components/circuit/layout.ts`: rank by declared operation order (`sequence` edges), never by material band (review finding 8). Focused subgraph for live watching (M12). `tests/layout.test.mjs`. |

- **Acceptance:** the layout plan's acceptance, with its material counts replaced by phase 2's rule. The active operation stays in view during a live run.
- **obs §8:** "Navigation and layout".

### Phase 7 — Graph binding without a timer, and the compiled graph (D4)

| Layer | Change surface |
| --- | --- |
| Estate | Under D4 "replace": a declared compile-only verb in `sda-kernel-command-operations.v1` (`declare-kernel-carrier-authorities.sql`). |
| SDA | Under D4 "keep": Node and Python `--plan-only` parity (`command-carrier.mjs`, `invocation_boot.py`). Under "replace": remove the flag from `CarrierContext`, `RequestFields`, `KernelEntry` and `InvocationBoot`, and point `services/sda-api/src/capability-graph.ts` at the declared verb. |
| Website | `components/estate/live-run.tsx` (45–46, 84–100): fetch the run graph when the `graph.captured` marker arrives, or use the compiled graph once its `canonicalGraphDigest` matches. A missing graph is a visible error. |

- **Acceptance:** no retry timer remains, and the compiled and observed drawings are identical for the same digest (layout plan acceptance item 8).

### Phase 8 — Lab command drain (independent; can go any time)

| Layer | Change surface |
| --- | --- |
| Website | `lib/sda-api.ts` `runCapabilityToCompletion` (168–195): read pages until `hasMore` is false before returning at `terminal`. `tests/invocation.test.ts`: a test with a terminal first page and `hasMore: true`. |

- **Acceptance:** `/lab/commands` reports the equity run's full observation count.

## 5. Change-surface map

| Phase | Estate (`sfx-embody`) | SDA (`scenario-driven-architecture`) | Website (`sfx-platform`) |
| --- | --- | --- | --- |
| 0 Instrument | — | — | trace docs, fixtures, test |
| 1 Declared semantics | — (allowlist check) | schema, `PublicProjection`, C# conformance, **Node and Python emitters**, sda-api test fixtures | `contracts/sda-api.ts`, `normalizeRunGraph` |
| 2 Materials | policy migration (`materials.*`) | — | `scl-theme.ts`, policy read, panel/page |
| 3 Grain | policy migration (`granularity.node`) | — | `buildRunGraphView`, Input/Event/Outcome nodes |
| 4 States | — (variants already declared) | — | `live-trace.ts` |
| 5 Variants | — | — | `run-graph.ts` edge key, `circuit-viewer.tsx` |
| 6 Layout | optional geometry rows | — | `geometry.js`, `layout.ts`, layout tests |
| 7 Graph binding | (D4 replace) compile verb | (D4) flag parity or removal, `capability-graph.ts` | `live-run.tsx` |
| 8 Drain | — | — | `lib/sda-api.ts`, invocation test |

**Order and parallelism:**
- Phase 0 first.
- Phases 1 (SDA) and 2–3 (estate policy) can run in parallel. Their website halves need phase 1's fields.
- Phase 4 needs only D1.
- Phase 8 is independent.
- Phases 5 and 6 come last.

## 6. Coordination

Other workers are editing these website files now:
- `circuit-viewer.tsx`, `geometry.js`, `layout.ts`
- `run-graph.ts`, `capability-circuit-panel.tsx`, `contracts/estate.ts`
- `tests/layout.test.mjs`, `globals.css`

Phases 2, 3, 5 and 6 touch them. Before any of those phases starts, its owner has to coordinate with the current editor. Nothing in this plan reverts work in progress.

## 7. Non-goals

- No material, grouping or state decided by name matching, counts or per-capability code.
- No unwalked arm lit and no join invented (layout plan non-goals stand).
- No evidence or receipts on the outcome path. Provider exchange evidence stays behind its evidence reference, on the observation lane.
- No configuration, credential locator or invocation input in the circuit record.
