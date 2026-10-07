# Lane 1 — Runtime model and page-as-circuit mapping

Scope: what the Live Circuit runtime is today, and the narrowest faithful mapping of the
"page as a circuit of capabilities" hypothesis onto it. Research only; every claim cites
`path:line`. Proposals are labelled `[proposal]`.

Primary sources read: `live-circuit/circuit/README.md`, `circuit-host.json`,
`circuit-runtime.js`, `live-store.mjs`, `explorer-model.mjs`, `home.js`/`home.html`,
`run-context.js`, `run-api.mjs`, `circuit-viewer.js`, plus the served pages
(`explorer.js`, `explorer.html`, `site.js`, `observe-panel.js`, `deck-trace.js`,
`navigation.js`, `objective-run.js`), the host (`dispatch-pair/observe-server.mjs`) and the
SDA repository (`scenario-driven-architecture/docs/*`, `sfx-embody/docs/*`).

## What exists (observed)

### 1. The host and its boot contract

- One dependency-free Node process serves everything: `observe-server.mjs` maps fixed paths
  to files (`CIRCUIT_FILES`, `live-circuit/dispatch-pair/observe-server.mjs:14-45`) and hosts
  the same-origin APIs (`:426-488`). New client modules must be added to that map by hand
  (`:14-45`; research brief `docs/sfx-website-product-evolution/research-brief.md:86-88`).
- Runtime policy is boot configuration, not database data: `circuit-host.json` declares the
  delivery type (`"delivery": "database-memory"`, `:3`), API proxy limits (`api`, `:4`),
  identity/observe policy (`identity`, `:5`), the only existing page composition (the `home`
  block, `:6`), read limits (`timeoutMilliseconds: 30000`, `maximumResponseBytes`,
  concurrency and queue, `:7-10`), cache bounds/TTL (`:11`), the provider-inspection readers
  (`retrieval`, `:12-16`) and the three kernel readers (`readers`, `:17-21`).
- Readers are kernel invocations through one envelope: `readCatalog`/`readScenario`/
  `readCapabilityDetails` call `read` → `deliver`, which spawns the installed kernel command
  from `sfx.config.json` (`live-store.mjs:117-163`) and validates the returned
  `contractId` (`:44`, `:156`). SQL returns all scenario semantics, geometry, SVG and
  observation bindings; this module is "platform transport only" (`:1-2`).

### 2. Reads and what the browser is allowed to know

- Browser reads are GET-only under `/api/circuit/v1/`: `capabilities`, `scenario`,
  `capability-details`, `provider-inspection` (`live-store.mjs:283-292`). Plus
  `/api/circuit/v1/home` (`observe-server.mjs:430-433`), session routes
  (`serveSessionApi`, `:429`), run routes (`serveRunApi`, `:434`) and `/healthz` via the
  gateway (`site.js:19-22`).
- The browser never computes page meaning. `explorer-model.mjs` takes one
  `capability-details.v1` document and projects the declared `capability_navigation` rows:
  `POLICY`, `NODE`, `COORDINATE`, `SCENARIO`, `SCENARIO_NODE`, `ALIAS`, `COVERAGE`,
  `UNRESOLVED_SET` (`:9-35`). Counts, states, placements and badges are "shown as returned,
  never recomputed" (`:3-5`, `:40-44`).
- An node's rows come from its declared `source_result_set`; scenario-scoped sets filter by
  the declared `scenarioKey`; `row_state` splits counted `ROW`s from markers
  (`explorer-model.mjs:49-59`). A row joins the circuit only through its declared
  `sceneKey` template (e.g. `provider:{provider_id}`, `:62-68`) and the reverse join
  `selectionForScene` searches only nodes declaring a scene key (`:72-80`).
- Home reads five things at load: host config, session, catalog, gateway health and the
  hero database scene, each independently unavailable as such (`home.js:83-97`; the scene
  is digest-checked against the returned `svgDigest` before display, `site.js:38-62`).
- Errors are content: unknown/not-selected capabilities return 404 and namespace mismatch
  409 without sets, so "a failure is never shown as an empty workspace"
  (`README.md:48-53`; `live-store.mjs:214-215`).

### 3. Runtime state, rendering, and where decisions are made

- `createCircuitRuntime(shell)` owns the only mutable UI state: deck, slide/page,
  selected node, detail, runs, connection, playback, API-run fields
  (`circuit-runtime.js:30-34`). The Explorer shell owns capability/scenario/section
  selection and mounts the runtime (`explorer.js:26-33`).
- `install(deck)` stores the scene returned by `GET /api/circuit/v1/scenario`
  (`circuit-runtime.js:188-202`; `explorer.js:69-82`). The view chooses slides: paged
  scenario slides or the reader's single `scenario-linear` scene (`:49-62`).
- `render()` computes traversal state and paints: `context.update`, status, `traversalView`,
  layout, then `renderCircuitViewer` (`circuit-runtime.js:245-334`). The viewer is explicit
  that it "draws the traversal state and makes no decisions of its own"
  (`circuit-viewer.js:1-2`); positions come from returned SVG/geometry (`:13`, `:125-157`),
  and observation overlays join only through returned addresses (`:75-117`).
- The "one traversal model" rule: `traversal.js` decides every visible state once from
  database geometry and receipts; `circuit-viewer.js` only draws it (`README.md:282-284`).

### 4. Runs, testimony, replay

- Kernel reads are not execution; opening a circuit never executes the subject capability
  (`sfx-embody/docs/live-circuit-data-contract.md:12-13`).
- An **observer run** is a sequence of admitted records in the host ring
  (`observe-server.mjs:206-245`), scoped by `runId` or run-start/run-end when unattributed
  (`:224-233`, `:301-335`). Bare `/events` is live-only; `run=current|next|ordinal` and
  `since` replay ring records (`:337-374`).
- An **API run** is an admitted SDA execution: `run-api.mjs` forwards
  `POST /api/circuit/v1/runs` (shape `{object:'capability', operation:'observe', subject,
  namespace, input}`, `:62-68`) to `/v1/runs` with the host machine credential (`:85-93`),
  attributes it to the signed-in principal (`:94-104`), and exposes
  `GET .../runs/:id`, `/events`, `/events/stream`, `/graph`, `/output` (`:23`). The client
  follows `events/stream?after=` and rebuilds records via `apiRecord`
  (`observe-panel.js:177-223`, `:111-118`).
- Client-side run state joins testimony to declarations by exact identity: `newRun`,
  `observeRecord`, `applyRecord` keep cells/edges/graph/events (`deck-trace.js:3-47`);
  `joinTestimony` requires the captured `graphId` to equal `graph:<capabilityId>` and the
  mapping snapshot digest to match the scene (`:48-52`). `replayTimeline` requires a
  complete, unambiguous capture, own-operation receipts and the own scenario return, then
  rebases captured timestamps into the scenario-only window (`:258-327`).
- Replay controls are local clock actions: `startReplay` builds `PlaybackClock`, `Pause`,
  `Step`, speed selector and **Return to live** (`circuit-runtime.js:209-225`, `:389-393`);
  `replay latest` asks the observer for `/events?run=current&graphId=graph:<capability>`
  (`:336-341`; `README.md:388-394`).

### 5. Actions the browser can take

- **Observe** is the only browser-initiated domain action, and it is generic: the same POST
  shape targets any capability (`observe-panel.js:237-262`; `objective-run.js:22-25` fixes
  the objective composer to `request-capability-from-objective-v3`, `:14-16`).
- **Drill-down** is navigation over opaque typed targets: `openDetail` fetches
  `GET /api/circuit/v1/scenario` with `detailId`/`detailPointer`/`expectedSnapshotDigest`
  (`circuit-runtime.js:70-107`), then optionally
  `GET /api/circuit/v1/provider-inspection` for declared providers (`:90-102`);
  `navigation.js` follows returned `navigation.items`/`links` and never derives
  relationships from names (`navigation.js:1-20`, `:40-52`).
- **Canvas↔tree selection** is one model: circuit click → `selectNode`/`selectTarget`
  (`circuit-runtime.js:282`, `:108-117`), tree/row click → `selectRow`/`focus`
  (`explorer.js:89-107`; `circuit-runtime.js:119-127`).
- URL is the selection state; `syncUrl` writes capability, namespace, scenario, node, row,
  page, detail, pointer, view and run (`explorer.js:36-42`), and `popstate` restores them
  (`:312-330`).

### 6. The only existing "page declaration"

`circuit-host.json:6` (`home`) names a hero capability/scenario and a `featured` list with
editorial `title`/`body`/`promise`, plus `copyBasis` saying it is host data until declared
as database authority. `homeConfig()` serves it unchanged (`observe-server.mjs:49-52`) and
`home.js` renders cards against the live catalog (`home.js:66-81`). There is no page
model beyond this and the fixed HTML shells.

## Mapping

The hypothesis maps onto the runtime through four distinct pieces, three of which have
observable precedents and one that does not exist in this runtime.

### 1. "Page capability"

In SDA, a capability is canonical meaning with scenarios: a capability version links
scenarios and one root scenario (`scenario-driven-architecture/docs/scenario-declaration-mechanics.md:20-24`,
`:40`, `:44-45`), and a scenario versions the Given/input, When/event-authority and
Then/outcome faces with their contracts (`:21-24`, `:63-67`, `:109`). A `[proposal]` **page
capability** would be a capability whose terminal outcome is a declared page: its input is
route/query/session state, its event authority invokes the render/read actions the page
needs, and its outcome is the page declaration. It extends the existing capability identity
and scenario faces; what is genuinely new is that the outcome contract names a UI
composition rather than a domain result, and that no run/testimony exists today for
"viewing a page".

Important constraint: ADR-0007 makes the kernel presentation-opaque — it "may retain a UI
interface contract identity, version, and digest, but it does not own presentation
primitives, target names, or native mechanics"
(`scenario-driven-architecture/docs/decisions/0007-ui-semantic-presentation-protocol-and-deterministic-embodiment-planning.md:33-36`).
So a page capability should carry semantic meaning; presentation mechanics belong to a
separate UI-capability layer (`:19-31`).

### 2. "Layout capability as provider" — expressible in SDA, with an existing vocabulary

- A **port** is declared content (`port`/`port_version`, with `providerId` and
  `platformCapabilityId` in the port semantics) and an operation holds one
  `operation_port_invocation` (`scenario-declaration-mechanics.md:38-39`, `:158-159`;
  `execution-binding-mechanics.md:27-31`).
- A **provider binding** is exactly the pair (port → provider/platform capability):
  `model.bind_provider`, `bind_provider_port`, `replace_port_configuration`
  (`execution-binding-mechanics.md:87-97`), with `provider_capability_implementation`
  linking a provider to a platform capability (`:32`).
- SDA already has a UI embodiment provider concept: a `UiEmbodimentProvider` is "distinct
  from a physical realization provider", resolved deterministically against a normalized
  Presentation IR (`ADR-0007:17`, `:40`, `:48-57`); the semantic presentation contract is
  `sda-ui-semantic-presentation.v1`, compiled through IR v3 whose declared mechanics are
  flow, stack, grid, split, scroll, overlay, order, visibility, event binding, adaptation
  and tokens (`decisions/0009-successor-normalized-ui-presentation-ir-identity.md:36-42`;
  research `fully-declarable-ui-authority-projection-research-2026-08-12.md:17-67`).
- Therefore `[proposal]` a **layout capability** is a capability that owns presentation
  mechanics (regions, ordering, section slots) with a port bound to a **UI embodiment
  platform capability**; the **page capability** binds that port as its provider. In SDA
  terms this is "a capability with a UI port, bound to a provider whose platform
  capability is UI embodiment". What does not exist: any `kind: UI` marker, UI provider
  registry, or binding path in the live runtime. The runtime's `operationBindings` and
  `providerPorts` are execution bindings carried in the scene
  (`live-circuit-data-contract.md:25-33`), not UI bindings.

### 3. "Sections group capabilities" — the runtime already has a section reading

The generic precedent is the Explorer's declared navigation:

- coordinates (sections) contain groups (`group_label`) which contain nodes, plus
  `EMPTY_SECTIONS`/`DIAGNOSTICS` placements (`explorer-model.mjs:16-27`);
- each node reads a declared `source_result_set`, optional `scope: scenario` and
  `scenarioKey` (`:49-59`), and carries `presentation`, counts, badges and ordering
  (`:40-44`);
- rows bind to circuit components by `sceneKey` (`:62-80`).

`[proposal]` A **layout section** in the hypothesis is this structure promoted from an
Explorer-specific reading to a general page contract: a declared section with an order, a
presentation kind, a data source (result set or capability read/invocation) and a
component binding. What is genuinely new: the existing navigation rows are capability-declaration
metadata read through `read-capability-details` (`README.md:38-53`), not a page composition
over multiple capabilities; and sections are rendered by hard-coded views
(`explorer.js:179-243`), not by a declared component map.

### 4. Display, data, actions, events per section

- **Display** maps to a declared presentation kind plus a component reference. Today the
  only declared presentation hint is `node.presentation` with a fixed renderer map
  (`explorer.js:17-19`, `:206-219`).
- **Data** maps to a declared reader/result set (`source_result_set`,
  `explorer-model.mjs:49-58`) or, `[proposal]`, a capability invocation; reads are
  catalogue/scenario/details/provider-inspection (`live-store.mjs:288-291`).
- **Actions** map to the only admitted browser action, the generic observe submission
  (`run-api.mjs:62-68`), plus the navigation targets already declared as typed links
  (`circuit-runtime.js:108-112`). Anything else would need a new action surface: the run
  API accepts exactly POST `/runs` and GET `/runs/:id/(events|events/stream|graph|output)`
  (`run-api.mjs:23-24`).
- **Events** have a real SDA face: `scenario_event` resolves an execution authority
  (`scenario-declaration-mechanics.md:43`, `:68-70`), and the runtime consumes them as
  testimony records over SSE (`observe-server.mjs:78-92`, `:235-243`). What is missing is
  any declaration of a **UI event** (click, submit, route) or its binding to an action;
  there is no UI event vocabulary in the kernel path.

## Minimal new contracts [proposal]

All items below are proposals; each names the existing concept it extends and what is new.
Schemas only; no implementation.

1. **`page-declaration.v1`** — route/page identity, page capability + namespace, layout
   capability + namespace, section list, fallback/failure policy.
   *Extends:* host `home` block (`circuit-host.json:6`) as the only page declaration, and
   capability catalog entries (`live-store.mjs:188-192`).
   *New:* route→capability mapping, per-page layout binding, declared failure display.

2. **`layout-declaration.v1`** — regions/sections with stable ids, order/ordinal,
   placement (body/sidebar/diagnostics), responsive weight, and the port/mechanic identity
   of the layout capability.
   *Extends:* Explorer `COORDINATE`/group/placement/ordinal rows (`explorer-model.mjs:9-35`)
   and slide `blueprint.viewBox`/`endCaps`/`bands` (`circuit-viewer.js:13`;
   `circuit-runtime.js:155-179`).
   *New:* layout as provider-owned composition rather than scenario/deck geometry.

3. **`section-binding.v1`** — section → data source (result set or capability read) +
   `sceneKey`-style component binding + presentation kind + empty/failure text.
   *Extends:* `source_result_set`, `scenarioKey`, `sceneKey` joins
   (`explorer-model.mjs:49-59`, `:62-80`) and observation-map identity joins
   (`deck-trace.js:55-58`).
   *New:* binding sections to capability invocations (not just declaration result sets)
   and a declared presentation registry.

4. **`action-intent.v1`** — declared action kinds (`observe`, `invoke`, `navigate`,
   `set-state`), the input mapping from section state to capability input, and required
   authority (session, same-origin, idempotency).
   *Extends:* the admitted observe submission shape (`run-api.mjs:62-68`) and typed
   navigation targets (`circuit-runtime.js:108-112`; `navigation.js:15`).
   *New:* actions other than observe, and input mapping.

5. **`ui-event-binding.v1`** — declared UI events (route load, click, submit, change) and
   the action each event emits.
   *Extends:* `scenario_event`/`execution_authority` (`scenario-declaration-mechanics.md:43`)
   and observed records (`deck-trace.js:10-47`).
   *New:* browser/DOM events as declarable input to a page capability.

6. **`page-snapshot.v1`** `[proposal]` — one digest over the selected page declaration,
   layout declaration and all section sources, so a page can be validated as one revision.
   *Extends:* the per-capability `snapshotDigest` contract (`live-circuit-data-contract.md:36-44`;
   `live-store.mjs:204-207`).
   *New:* cross-capability page-level coherence; today each read is digest-checked per
   capability/scenario only.

## Limits and risks

### Read timeouts and capacity

- Reader calls time out at 30 s (`circuit-host.json:7`; enforced in
  `live-store.mjs:94-105`, `:133`); provider inspection uses the same timeout
  (`live-store.mjs:249`). The SDA API proxy times out at 630 s (`circuit-host.json:4`;
  `run-api.mjs:25-27`); identity at 130 s (`circuit-host.json:5`). A page that reads many
  capability sources serially (queue 2 concurrent, 32 queued, `live-store.mjs:22-25`) can
  exceed a page-load budget; there is no page-level read budget today.
- Response cap is 16 MiB (`circuit-host.json:8`; `live-store.mjs:67`, `:134`), and request
  bodies for observe are capped at 1 MiB (`circuit-host.json:4`; `run-api.mjs:53-58`).

### Snapshot digests

- `snapshotDigest` is the declaration snapshot of the selected capability scene; the scene
  must not disagree with its own observation map (`live-store.mjs:204-207`), and joins are
  refused when `observationMap.snapshotDigest !== deck.snapshotDigest`
  (`deck-trace.js:50-51`, `:77-78`, `:261`). Drill-down carries `expectedSnapshotDigest`
  and is refused if changed (`live-circuit-data-contract.md:35-44`). Provider inspection
  revalidates the provider definition digest after a forced reread and returns 409 on
  change (`live-store.mjs:277-278`). A multi-capability page would have several digests and
  no single revision to validate; a page-level snapshot would be new work.

### SSE and run scoping

- Observer streams are process-wide, not page-scoped: bare `/events` is live-only, run
  selectors replay ring records (`observe-server.mjs:301-335`, `:360-370`). Overlapping
  unattributed starts hold the overlay because the sink cannot safely attribute
  interleaved observations (`README.md:388-390`).
- API runs are per-run SSE and per-session attribution (`run-api.mjs:31-43`, `:94-104`);
  the idempotency key is scoped by principal (`:88-92`). Multiple sections each driving a
  run would create independent 630 s proxy contexts and independent streams; there is no
  aggregate page-run concept.

### Caching in live-store

- LRU cache: 24 entries, 32 MiB, 30 s TTL (`circuit-host.json:11`; `live-store.mjs:164-187`);
  `refresh=1` bypasses it (`:286`). ETags make repeated fetches 304
  (`live-store.mjs:294-296`). The cache is keyed by reader + payload; a page composition
  would inherit all-or-nothing staleness per capability, with no invalidation signal from a
  page declaration change.

### Failure display rules

- Failures must never render as empty: details/search refusals are explicit codes
  (`live-store.mjs:214-215`), the Explorer renders "Reading failed" for details and keeps
  the circuit separate (`explorer.js:154-155`, `:182-183`), drill-down shows "Detail held:
  …" (`circuit-runtime.js:103-106`), and provider-inspection degrades to a declared
  canonical reader with the reason (`live-store.mjs:264-280`). A page-level contract must
  preserve this rule per section.

### Structural obstacles to UI-as-capability

- **No UI capability kind.** The estate's capability/port/provider vocabulary is execution
  semantics (`scenario-declaration-mechanics.md:28-46`); the runtime declares only kernel
  readers as boot config (`circuit-host.json:17-21`). UI meaning lives on a separate,
  older SDA path (`consumer-ui-authority.v1` → semantic presentation → IR v3 →
  `UiEmbodimentProvider`, ADR-0007:19-31; ADR-0009:36-42; ADR-0010:21-43) that this host
  does not consume. Reusing that path is a lane-3/5 question; inventing a parallel one
  would be new architecture.
- **Browser actions are limited to the run API.** GET-only reads
  (`live-store.mjs:283-292`); the only POST is observe (`run-api.mjs:23-24`, `:62-68`); the
  browser holds no SDA token and is a transport, not a capability implementation
  (`README.md:224-238`). Any richer action contract is new host surface and new authority
  rules.
- **The shell is deployed code.** Pages are fixed HTML/JS listed in `CIRCUIT_FILES`
  (`observe-server.mjs:14-45`), and the runtime element ids are "the page contract the
  staging browser acceptance drives" (`circuit-runtime.js:1-5`). A page declaration can
  change data and composition only within what the deployed renderer already supports;
  new component kinds still require a deploy and acceptance (research brief `:86-90`).
- **The client cannot name result sets or synthesize fields.** The browser must not
  contain capability/scenario/contract allowlists (`live-circuit-data-contract.md:20-23`)
  and never picks SQL or synthesizes fields (`README.md:115-127`). A section-to-component
  binding therefore must be database authority, not browser code.

## Gaps and unknowns

1. **No layout/UI capability exists in the estate as observed.** `circuit-presentation`
   (`sfx-providers/providers/circuit-presentation/circuit-presentation.mjs:1-14`) is an
   authoring/compile boundary, not a runtime layout renderer. Whether ADR-0007/0009/0010
   providers are meant to be the "UI capability providers" of this hypothesis needs lane 3
   confirmation.
2. **Page declaration location.** Where a page declaration is admitted (Estate DB via
   `sfx-embody`, `circuit-host.json`, or generated DAL) is not determined by the runtime;
   `circuit-host.json` is boot config and explicitly "host data until declared as database
   authority" (`circuit-host.json:6`).
3. **Page-level run/evidence semantics.** Observable runs are capability executions; a page
   view produces none. Whether a page capability has scenarios, a root scenario and
   evidence, or is a separate reading kind, is unresolved.
4. **Multi-capability snapshot coherence.** No page-level digest exists; per-read
   `expectedSnapshotDigest` guards are the only coherence mechanism
   (`live-circuit-data-contract.md:35-44`).
5. **UI event vocabulary.** No declaration path was observed for DOM/route events; the
   nearest concept is `scenario_event`/`execution_authority`
   (`scenario-declaration-mechanics.md:43`). Whether UI events are capabilities, ports, or
   a new contract family is open.
6. **Read budget.** `maximumConcurrentReads: 2` / `maximumQueuedReads: 32`
   (`circuit-host.json:9-10`) versus a page reading N capability sources; no page-load
   scheduling policy was observed.
