# SideFX observation altitudes

**Decision:** `sidefx-observation-altitudes.v1`  
**Established:** 2026-09-23  
**Status:** Accepted architecture and product requirements; implementation remains open.  
**Scope:** Observation and navigation through the Capability Data Center, including circuit layout,
material mapping and evidence presentation.  
**Basis:** The owner's supplied nine-level observation hierarchy and the selected behavior,
“show the selected altitude with its parent context.” This document retains that decision in the
repository; the original attachment is not needed to interpret it.

This is the canonical definition of **observation altitude** for the platform. It resolves the
previous ambiguity in which the four execution-cell altitudes were described as the observation
hierarchy. It does not change execution schemas, admit estate definitions, or claim the nine views
already exist. [Architecture §10](architecture.md#10-visual-system-architecture) and
[viewer requirements §12.4](website-design-spec.md#124-viewer-and-flow-interaction) reference this
decision. Older capture reports remain historical evidence, interpreted with the distinction below.

## 1. Definition and independent concepts

> Observation altitude is the level of circuit resolution at which an observer views the Capability
> Data Center—from the enterprise topology down to individual physical effects—without changing
> the underlying authority.

**Vocabulary.** Choosing what to show is a **view**, with a **grain** (what one drawn node
represents) and any declared **grouping**. **Projection** is reserved for generating code bodies
from declared meaning; it is not a display term.

Changing observation altitude changes the view and its focus. It preserves the authority,
identities, revisions, relationships and evidence that the view describes.

| Concept | Question answered | Vocabulary and scope |
| --- | --- | --- |
| **Semantic altitude** | What level of meaning owns this concept? | Strategic, product, capability, scenario, execution, provider, physical. These conceptual ownership levels are not a replacement enum for existing carriers. Each carrier retains its own declared vocabulary and version. |
| **Authoring altitude** | Which bounded part are we creating or resolving? | Intent, experience, capability, scenario, contract, responsibility, execution, transformation, mechanic, provider, physical. Authoring changes or proposes authority through its own workflow. |
| **Observation altitude** | How far into the integrated circuit are we looking? | The nine resolution levels OA0–OA8 in §2. Observation reads and views authority. |
| **Execution-cell altitude** | At which runtime level does this cell execute and testify? | The current SDA graph/testimony values `scenario`, `mechanic`, `provider`, `physical`. They are source data used by some observation views, not the observation selector's complete vocabulary. |
| **Observation overlay** | What property are we examining at that resolution? | Cost, risk, security, alignment, SLO, provider health, model performance, trust, conformance and other explicitly supported properties. |
| **Camera zoom** | How large is the current drawing on screen? | Pan, scale and fit. These change the viewport, not the subject, semantic level or observation altitude. |

The legacy CLI option `--observation-altitude` and request field `observationAltitudes` select
execution-cell testimony using the four runtime values. Their existing wire semantics remain
unchanged. New observation-view contracts must name the nine-level choice separately, such as
`observationAltitudeId`; an adapter must explicitly map a view to the runtime testimony it needs.
Do not pass OA0–OA8 into the existing four-value field or reinterpret stored traces.

The mapping is not one-to-one. OA3 can expose a capability's declared scenario topology while
OA4 and OA5 focus scenario networks and individual scenarios. OA6 and OA7 can both involve
mechanic-altitude runtime cells. OA8 includes both provider and physical cells. OA0–OA2 require
estate and integration authority that a single run graph does not contain.

The fifteen circuit materials, typed route kinds, visual planes and screen coordinates are also
independent of observation altitude. A decision, fan-out or convergence is a topology construct
within a view, not another observation altitude.

## 2. The nine observation altitudes

The order and meanings below are fixed for v1. `OA0`–`OA8` are readable design references; the
stable IDs are the contract vocabulary. Existing IDs must not be reused with different meanings.

| Level | Stable ID | Display name | Unit of observation |
| --- | --- | --- | --- |
| OA0 | `enterprise-capability-data-center` | Enterprise Capability Data Center | The enterprise capability estate and its integration topology |
| OA1 | `circuit-domain` | Circuit Domain | One governed semantic grouping |
| OA2 | `circuit-assembly` | Circuit Assembly | One connected network of capability circuits |
| OA3 | `capability-circuit` | Capability Circuit | One complete governed capability |
| OA4 | `scenario-network` | Scenario Network | A declared connected portion of scenario topology |
| OA5 | `scenario-cell` | Scenario Cell | One scenario's Input → Event → Outcome boundary |
| OA6 | `event-execution-authority` | Event / Execution Authority | The responsibility and operations that realize an event |
| OA7 | `mechanic-circuit` | Mechanic Circuit | The declared mechanics and transformation topology |
| OA8 | `provider-physical-realization` | Provider / Physical Realization | A provider requirement, binding and its physical realization |

Provider and physical inspection are related views within OA8. They do not introduce a tenth
altitude. Similarly, inspecting a contract, evidence receipt or individual operation is a focus or
detail action inside the appropriate altitude; it does not automatically create another level.

### OA0 — Enterprise Capability Data Center

**Purpose:** Study organization and integration across the enterprise estate.

**Show:** Business units, domains, platforms, products, independent capability inventories,
integrated circuit domains and cross-domain dependencies. Preserve standalone capabilities and
unresolved integration as explicit states.

**Source and descent:** Use declared estate membership and typed relationships. Focus a domain
at OA1, or a known assembly/capability directly when that is the declared entry point. Organizational
labels do not establish domain membership or executable connections by themselves.

### OA1 — Circuit Domain

**Purpose:** Inspect a governed semantic grouping, which may correspond to a business unit,
department, platform, product or team when its membership is declared.

**Show:** Assemblies, standalone capabilities, external dependencies and domain boundaries.
Health, fit and risk appear through selected overlays with an evidence basis.

**Source and descent:** Resolve the domain's exact membership and relationship authority. Focus
an assembly at OA2 or a standalone capability at OA3. A capability need not belong to an assembly
to be visible in a domain.

### OA2 — Circuit Assembly

**Purpose:** Inspect a connected network of capability circuits.

**Show:** Capability-to-capability flow, semantic backplane bindings, products becoming inputs,
convergence, external capabilities and domain crossings. Preserve contract identities and binding
dispositions at the connection boundaries.

**Source and descent:** A Circuit Assembly connects multiple Capability Circuits through admitted
backplane bindings. Proposed or unresolved connections retain those states and are not displayed
as admitted flow. Focus a constituent Capability Circuit at OA3; retain the assembly and its
incoming/outgoing boundaries as context.

### OA3 — Capability Circuit

**Purpose:** Inspect one complete governed capability.

**Show:** The complete canonical blueprint, scenario topology, input/output products, dependencies,
interfaces, branches and joins, provider requirements and proof state. This is the capability
overview, not an arbitrary collapsed runtime root.

**Source and descent:** A Capability Circuit is one capsule plus its canonical blueprint. Bind
both to their exact identities and revisions. A compiled execution graph is a related view,
not evidence that a missing blueprint exists or has been admitted. State absent, candidate or
unresolved authority explicitly. Focus a scenario network at OA4 or a scenario cell at OA5.

### OA4 — Scenario Network

**Purpose:** Follow how a selected portion of a capability progresses through connected scenarios.

**Show:** Scenario transitions, outcome variants, branching, convergence, semantic progress and
products becoming inputs. Keep the selected network's boundary and connections to the rest of
the capability visible.

**Source and descent:** Select a connected portion from declared scenario membership and typed
routes. Do not infer a chain or parallel fan-out from a scenario list. The network is an observation
scope, not a newly authored assembly. Focus an individual scenario at OA5.

### OA5 — Scenario Cell

**Purpose:** Inspect one scenario's exact Given/Input → When/Event → Then/Outcome contract.

**Show:** Input contract, event, responsibility/experience, outcome contract, variants,
incoming/outgoing routes and scenario evidence. Preserve the distinction between a semantic
outcome and the testimony of one particular invocation.

**Source and descent:** Resolve the scenario's own definition and contracts. Focusing its event
opens OA6. Parent context identifies the capability and the scenario network through which the
observer arrived, when one was selected.

### OA6 — Event / Execution Authority

**Purpose:** Inspect the authority that realizes the scenario event and closes its responsibility.

**Show:** Responsibilities, operations, declared execution order, dispatch policy, transformations,
ports, fan-out and joins where declared. Separate composite entry, child execution and composite
completion; an operation's final testimony may occur after all its members.

**Source and descent:** Resolve the event-to-execution-authority relationship and its exact
operation topology. Neither operation labels nor trace timestamps create ordering authority.
Focus a mechanic circuit at OA7 or a declared provider realization at OA8.

### OA7 — Mechanic Circuit

**Purpose:** Inspect how a responsibility is realized through generic mechanics and transformations.

**Show:** Primitive identities, transformations, selection, binding, validation, aggregation,
iteration, declared branching and resource requirements. Distinguish expression dependencies
from sequential execution and from observed visits.

**Source and descent:** Use the selected mechanic definitions and their declared relationships,
with links back to the operation/responsibility being realized. Nested mechanics remain at OA7
with a narrower focus. Follow a provider requirement or binding into OA8.

### OA8 — Provider / Physical Realization

**Purpose:** Inspect the declared requirement, its bound fulfiller and the physical effect.

**Show:** Mechanic context → provider slot → bound provider → physical operation/effect, preserving
the types of each relationship. HTTP, SQL, model, filesystem, process, queue, GPU and human
operations are possible realizations, not mandatory nodes in every view. Show applicable
contracts, binding state, measured timings, disposition and testimony references.

**Source and descent:** Resolve binding and realization authority and, when selected, the run's
own evidence. A provider slot is not its fulfiller; a configured provider is not an observed
effect. Inspect individual effects inside OA8 and return through the retained context path.
Remote infrastructure that is not represented in authority/evidence remains unknown.

## 3. Navigation and parent context

The hierarchy is an order of resolution, not proof that every estate has a strict ownership tree.
Domain membership, assembly membership, capability ownership, execution containment, provider
binding and navigation history are different relations. Shared dependencies retain one canonical
identity even when they appear in multiple contexts; cycles in execution do not create cycles
in ownership. A visual grouping or breadcrumb must not create an authority relationship.

The selected interaction is **the chosen observation altitude with its parent context**:

1. Keep the focus subject and its source selection explicit. Render relevant enclosing context
   as a frame, boundary or breadcrumb, distinguishable from the focused contents.
2. Follow declared membership, ownership, containment and realization links when changing level.
   Permit direct entry and skipping inapplicable levels; never manufacture a domain or assembly
   merely to fill the nine-level navigation path.
3. Preserve subject identity, source revision/digest, selected run, evidence window/cursor and
   applicable overlays when descending or ascending. Back restores the previous focus and camera.
4. Preserve cross-boundary references and route endpoints. An off-scope dependency remains an
   identifiable boundary connection, not a deleted route or an invented shortcut.
5. A parent frame is context. Child testimony does not become the parent's own testimony.
   A separately labeled roll-up may summarize children under an explicit aggregation policy.
6. The available altitude choices are derived from resolvable source relationships. An unavailable
   view names the missing source or mapping and retains context; it does not silently substitute
   a boundary diagram or an unrelated view under the requested altitude's name.
7. Changing altitude, overlays, materials or camera never executes a capability, edits authority,
   changes provider bindings, or promotes proof state.

Opening a capability starts at OA3 when its source supports that view. Scenario selection can
focus OA4/OA5; selecting WHEN descends to OA6; inspecting a mechanic or provider descends to
OA7/OA8. An observation-altitude control must identify the active level in words. It is independent
of Base/Material appearance, live/illustrative mode and camera zoom. The text outline and inspector
must describe the same focus, context and boundaries as the drawing.

Within one altitude, large graphs may use focused subgraphs, paging or explicit expansion.
Those operations retain that altitude and report coverage. A `30`-cell drawing limit is not an
altitude policy and cannot erase execution boundaries or claim that a partial view is complete.

## 4. View, layout and material laws

The observation view must be resolved before geometry is assigned:

```text
selected authority + subject + observation altitude + retained context
    -> typed observation view with source membership and boundary references
    -> deterministic layout and canonical material mapping
    -> selected evidence/property overlays
```

This sequence describes responsibilities; evidence can be used during view resolution to select a
run-specific focus. It must not rewrite declared topology.

- **Organization and integration (OA0–OA2):** Lay out governed groups and typed interconnections.
  A dependency or membership relation is not execution flow.
- **Meaning and flow (OA3–OA5):** Preserve capability/scenario boundaries, contracts, branches,
  variants, products and routes. Preserve Input/Event/Outcome at the applicable boundary.
- **Realization (OA6–OA8):** Show operation order, containment/descent, mechanic dependencies,
  selection, ports, provider bindings and physical effects according to their declared types.

Geometry may change between levels, but its represented identities and relationships must remain
traceable. Materials follow component meaning; they do not determine causal order or altitude.
Do not force a sequential operation chain into parallel lanes because the cells use the same
plate. A drawn split/merge rail is routing geometry unless it represents an actual declared
junction; its decorative dots are not additional execution cells.

A drawn connection across hidden detail must carry its exact source route/path membership,
boundary/port identities and view rule. Preserve selection variants, guards, group/join
policies, recurrence and return meaning. Routes with the same visible endpoints and kind but
different variants or policies must not merge into an indistinguishable connector. Unknown
endpoints or unqualified view rules remain explicit findings.

Canonical blueprint, compiled execution topology, mechanic dependency view and observed execution
are distinct representations available at suitable altitudes. Their basis must remain labeled.
An authored teaching circuit remains a comparison artifact; it cannot impersonate the compiled
graph or a run. Missing published media and incomplete semantic topology are different findings.

## 5. Overlays and the evidence spine

Cost, risk, security, alignment, SLO, provider health, model performance, modernization, trust and
conformance are **overlays**, never extra altitude numbers. Examples include enterprise + cost,
domain + modernization, capability + alignment, scenario + SLO, event + concurrency, and
provider realization + security. An overlay is available only where its data and policy support
the selected subject and resolution; unavailable is distinct from zero, healthy or compliant.

Every overlay must state its property, subject scope, source/evidence references, observation
window or revision, units, freshness and aggregation basis. Coverage and unknowns remain visible.
Changing altitude must preserve the evidence basis or explicitly disclose a changed scope.
Deduplicate shared subjects and evidence before aggregation; do not sum parent and child timings
as if independent, average percentiles, or invent enterprise SLOs from one successful run.

Keep these evidence modes distinct:

- **Declared/compiled:** Planned structure and declared dispositions; no execution inferred.
- **Observed execution:** One identified run and its testimony, including occurrence identity,
  ordering, dispositions and measured timestamps.
- **Aggregate observation:** A defined cohort/window of evidence with a declared metric policy.
- **Illustrative flow:** Explicitly labeled traversal for explanation; never an execution receipt.

Numeric dashboards and named company/provider walkthroughs in the source proposal illustrate
the experience. They are not estate facts, measured metrics or proof of available views.

For live observation, retain raw testimony independently of the active view. Draw each
occurrence by its cell/edge identity and execution/occurrence identity, in cursor order. Repeated
visits are retained even if their visible state is unchanged. Selected branch identity comes
from the observed edge plus its graph declaration, not a guessed branch from a cell label.
Provider evidence records remain receipts unless their declared contract also establishes a
state fact. Completion, admission, conformance, binding, availability and proof are separate.

Retain the selected run and cursor on altitude changes; redraw the retained occurrences
without executing again or presenting old occurrences as newly arriving. Show when a chosen
view needs testimony that was not captured. Drain paginated lanes through `hasMore=false` even
when a preceding page reports terminal; absence of the final page must not imply completion.

## 6. Minimum view and mapping contract

These are requirements for the next declared view contract, not a claim of an existing
endpoint or deployed schema. Preserve existing source/wire fields when implementing the adapter.

| Concern | Required information |
| --- | --- |
| View selection | Observation model/version, stable `observationAltitudeId`, focus subject references and retained navigation context |
| Source identity | Exact authority/definition revisions; source generation and canonical graph digest where applicable; compatible cross-source bindings |
| Representation | Blueprint, execution topology, dependency view or other qualified representation; supported/partial/unavailable disposition and findings |
| Context | Typed parent/enclosing references and their source relationships, distinguished from navigation history and focused entities |
| Drawn nodes | Stable visual identity, raw subject/cell membership, focus/context/boundary role, ports and any explicit grouping rule |
| Drawn routes | Raw edge/path membership, endpoints/ports, route type, selection/guard/group/join policy and boundary-crossing rule |
| Evidence selection | Mode, run identity, cohort/window where relevant, cursor, evidence references and actual coverage |
| Occurrence mapping | Raw cursor and event/testimony identity, `cellId`/`edgeId`, cell execution/parent/source execution identities and occurrence/iteration IDs when supplied; raw runtime altitude unchanged |
| Visual mapping | View version/digest, material token and asset revision, shape/port identity, geometry revision and node/route geometry reference |
| Mapping result | Visible target, contextual target, explicitly internal/grouped target, deliberately out of scope, or unresolved with a reason; no silent drop |
| Coverage | Focus/context/hidden/unresolved counts and source membership; selected routes vs omitted/internal routes with reasons |

Transport cursor, execution occurrence, semantic identity, visual identity and geometry identity
must remain distinguishable. A many-to-one visual summary keeps its full source membership.
Its state is a named summary, not a substitute for each member's own disposition. Unknown raw
IDs are mapping failures; deliberately excluded IDs are scope decisions and must be reported
separately.

Persist shareable selection using the observation-level ID and exact subject/context references.
Do not overload `scenario`, runtime `altitude`, renderer fidelity, material token or CSS rank to
carry the nine-level choice. URL spelling and the production schema will be defined with the
view implementation; this document establishes their semantics.

## 7. Equity baseline and current implementation gap

The [2026-09-23 baseline](circuit-event-material-baseline-2026-09-23.md) describes one compiled
graph and one observed equity run, not a complete nine-level observation implementation.

| Runtime cell altitude | Planned cells | Observed cell testimonies |
| --- | ---: | ---: |
| `scenario` | 1 | 1 |
| `mechanic` | 844 | 500 |
| `provider` | 14 | 14 |
| `physical` | 14 | 14 |
| **Total** | **873** | **529** |

The capture contains 1,079 events, including 529 cell and 528 edge testimonies. The 41 planned
junctions are mechanic-altitude cells; 28 were observed. They are not additional altitudes.
All 28 observed selections were FALSE; this capture does not prove TRUE-branch, recurrence,
fan-out or convergence playback. Thirty-four inter-operation transitions target a composite
whose child testifies next; this is entry/descent, not a broken destination identity.

The pre-implementation platform view collapsed the graph to 15 nodes and 28 routes, including
one 831-member scenario node; this hid the operation/branch structure before layout. Phase 3
(`7f809a7`) deleted that count collapse and draws the declared operation grain instead: the
presentation policy's `granularity.node: "operation"` groups every expression, binding, field
and selection cell into its nearest enclosing operation. For equity the committed trace summary
(`docs/circuit-mapping-trace-2026-09-23/equity-mapping-summary.json`) measures 39 drawn nodes —
the scenario, its Input/Event/Outcome boundary roles and all 35 operations — with 35 drawn edges
of 528 walked (493 internal to one operation) and the lit node changing 36 times: once per
operation op.1 → op.35, then the scenario root. Those counts follow the declared graph, not the
retired collapse.

The baseline's §8 state rule (root completion from `run.exited`; displayed states 5 done,
10 held and 0 failed) is kept here only as the pre-decision baseline: it contradicted this
document's §5 and OA5/OA6 (review finding 4) and is superseded by this revision, 2026-09-23
(plan §3 D1). The D1 rules are:

- The root shows its own testified outcome (variant and classification).
- `run.exited` sets the run status only.
- A failed attempt shows as failed, with its variant.
- Nothing is marked superseded; no declared rule says a later route superseded an attempt.
- A completed sibling never overrides a member's failure.

The two JSONL traces establish event identity, order and graph joins; they do not by themselves
contain the complete altitude → drawn node/route → material → geometry mapping in §6. The
captures were machine-local; durable fixtures and a regression test now regenerate the committed
summaries byte for byte on a clean checkout — `tests/fixtures/circuit/` and
`tests/mapping-trace.test.mjs`, committed as `d7109ae` (the derived declared-bindings and
presentation-policy fixtures followed in `9cdaf84`). The raw graph source remains machine-local
and uncommitted; the declared-bindings fixture derived from it strips configuration.

For this capability page, the OA3–OA8 circuit view work is delivered; §8 records its evidence
and what remains open. OA0–OA2 remain required product levels with separate estate/domain/assembly
source requirements. Do not infer those upper levels from this one run or mark them implemented
when the lower views work.

## 8. Delivery sequence and acceptance

| Work | Status (2026-09-23) | Completion evidence |
| --- | --- | --- |
| **Vocabulary and documentation** | Done | Nine stable levels, independent concepts, parent-context behavior and links from governing docs: this decision. The D5 rename and the authority documents were committed as `f0ad8eb`. |
| **Source and view authority** | Open (partly installed) | The declared presentation-policy read is installed (`sfx-embody` `31a95ad`) and consumed by the platform (`9cdaf84`). The nine-level source adapters are not built: each level's exact source adapter/mapping and named gap for absent source remain owed. |
| **OA3–OA8 circuit view** | Done | Declared identity and outcome variants reach the record (SDA `1322d1f`, `a55fa92`) and the run graph (`ca8bad2`); the declared operation grain and Input/Event/Outcome boundary replace the count collapse (`7f809a7`, `88c41b4`); D1 states (`b56ea2b`, `492f261`); variants and junction arms (`d29cf7d`, `4f58f8f`, `e20a449`, `a28736e`). Evidence: `docs/circuit-mapping-trace-2026-09-23/` — equity 39 drawn nodes, all 35 operations, 529/529 cells resolved. |
| **OA0–OA2 estate view** | Open | Requires estate, domain/assembly and integration authority not contained in a single run graph (§1). |
| **Navigation and layout** | Done | Rank by declared operation order, never a material band (review finding 8); the camera follows the active operation (M12): `69cc10e`, `tests/layout.test.mjs`. |
| **Evidence and material mapping** | Done | Declared exact-key maps, no word-stem or composite fallback (`sfx-embody` `31a95ad`; `9cdaf84`); the mapping is recorded per occurrence, driver and drawn target (`d7109ae`). Equity: 529/529 cells declared, 0 word-stem assignments. |
| **Overlays** | Open | No completion evidence yet; each supported property still owes scope, provenance, aggregation, units and unknown-state behavior. |
| **Regression and visual verification** | Done | Durable fixtures and byte-for-byte regeneration (`tests/fixtures/circuit/`, `tests/mapping-trace.test.mjs`, `d7109ae`); state replays and geometry are asserted by `tests/live-trace.test.ts` (`492f261`) and `tests/layout.test.mjs` (`69cc10e`). Screenshot-based verification is not part of the committed evidence for this work. |

Acceptance must demonstrate:

1. All nine IDs resolve to their defined level or an explicit source/implementation gap; no
   runtime four-value dropdown is presented as the complete observation model.
2. Each supported level preserves the focus, correct parent context, boundary references and
   source identity through down/up/direct navigation. Shared membership creates no duplicate
   authority or evidence counts.
3. Changing observation altitude preserves the selected authority and run; it triggers neither
   execution nor authoring. Camera zoom and overlay changes preserve the altitude.
4. Scenario I/E/O, execution entry/descent/return, serial operations, alternative branches,
   fan-out, ALL/ANY/quorum joins and bounded recurrence retain their declared semantics.
   Use additional fixtures wherever the equity trace does not exercise a construct.
5. Every captured occurrence has a mapping result; every drawn entity has source provenance.
   Repeated visits survive, out-of-scope events are distinguishable from unmatched IDs, and
   parent context does not inherit a child's execution identity or unqualified failure.
6. Material and geometry mappings retain route variants, endpoints and port contact; decorative
   rails add no semantic junctions. Text remains readable, bounds/overlaps/crossings are checked,
   and the text outline exposes the same entities as the diagram.
7. Observed, planned, illustrative and aggregate evidence remain distinguishable at every
   level; missing receipts, metrics, publication or source topology are reported accurately.
8. Deep links, back navigation, live altitude switching and reduced motion preserve context;
   switching does not restart execution or silently restart the evidence timeline.

## 9. Change control

The observation hierarchy is a shared product/architecture contract. Additions, removals,
renumbering or meaning changes require an explicit revision of this decision with migration
notes for stored selections and mappings. New overlays, material skins, nested subject focus
or runtime cell kinds do not silently create new observation altitudes.

Implementation work must update the delivery status and link its view contracts and
verification evidence here. Editing this document alone does not close implementation gates
or admit a capability, blueprint, binding or provider.

### Revisions

**2026-09-23 — D1 state semantics; D5 vocabulary.** Plan §3 D1 (ratified) resolved the
state-rule contradiction between §7's retained baseline §8 rule and §5/OA5/OA6 (review
finding 4): the root shows its own testified outcome (variant and classification), `run.exited`
sets the run status only, a failed attempt shows as failed with its variant, nothing is marked
superseded, and a completed sibling never overrides a member's failure. D5 renamed the display
sense of "projection" to view/grain/grouping. No altitude was added, removed, renumbered or
redefined.

**Migration:** stored selections and mappings are unaffected — the stable IDs and §2 meanings
are unchanged, and no stored selection or mapping encoded the superseded state rule.

**Implementation evidence:** `b56ea2b` and `492f261` (D1 in `lib/live-trace.ts` and
`tests/live-trace.test.ts`), `f0ad8eb` (D5 and the authority documents), with each phase commit
listed in §8.
