# Landing scenario circuit blueprint

Prepared 2026-10-08. Status: **[proposal] blueprint; the declarations below are not published.** Revision 2.
This is the landing instance of the deterministic design process in
[`ui-circuit-blueprint-strategy.md`](ui-circuit-blueprint-strategy.md) (blueprint first, projection
second, §1). The landing is declared as a **scenario circuit**, not a screen: a boundary panel, the
Given/When/Then scenario frames, an ordered operation chain with provider call boxes, observation
and timeline bindings, and a user-action-to-circuit lighting map — the grammar the deployed circuit
viewer already draws (`live-circuit/circuit/README.md:284-345,306-321`). It is design, not
observable behaviour: every member not yet admitted is labelled `[proposal]`, and claims about
deployed behaviour cite `path:line`. Nothing here authorises SDA, `sfx-embody` or `sfx-dal` changes
(`AGENTS.md`); the default remains no SDA change
(`ui-circuit-blueprint-strategy.md:222-235`).

How to read this document:

- **Observed** — deployed in the repository today, cited to code or contract documents.
- **[proposal]** — declared design; it becomes authority only through the admission path of the
  strategy (`ui-circuit-blueprint-strategy.md:237-251`) and its gates.
- The blueprint is the declared authority for circuit structure and meaning; the shell keeps only
  chrome, projector, validator, routing and security
  (`ui-circuit-blueprint-strategy.md:154-160,197-201`; `implementation-strategy.md:49-65`).
- The page runtime, component registry, circuit viewer and declared-view projector cited below are
  deployed shell code (`live-circuit/circuit/page-runtime.js`, `circuit-runtime.js`,
  `view-runtime.js`), not a realisation of this blueprint.

---

## 1. The scenario circuit template

Every circuit — login, landing, every region, every provider drill-down — declares the same
members: boundary panel, Given/When/Then frames, operation chain, provider call sites,
observation/timeline bindings and the user-action lighting map. The template is the unit of
conformance: a surface is a projection of one instantiated circuit, never a hand-built screen
(`ui-circuit-blueprint-strategy.md:24-29,85-97`).

### 1.1 The boundary panel

| Panel member | Declared carrier | Meaning | Ground |
| --- | --- | --- | --- |
| **Capability / namespace** | `capabilityId`, `namespaceId` | The circuit's identity in the estate; ports and execution locations are declared data. | `implementation-strategy.md:437-459`; `ui-circuit-blueprint-strategy.md:43-47,92` |
| **Ports** | `ports[]` `[proposal]` | The sockets the circuit exposes and consumes; a port names its contract and direction. | `ui-circuit-blueprint-strategy.md:43-47,92,237-244`; estate pattern `sfx-embody/sql/migrations/declare-authenticate-ide-user.sql:86-94,106-114` |
| **Execution locations** | `executionLocations[]` | Where the circuit may run (`private-identity-service`, `trusted-browser-shell`, `client-terminal`, …); declared, never inferred. | same estate cites; `ui-circuit-blueprint-strategy.md:43-47` |
| **Binding state** | `bindingState` | `UNBOUND` lets declaration precede admission and execution. | `ui-circuit-blueprint-strategy.md:237-244`; `sfx-providers/providers/ui-explorer-region/README.md:9-16` |
| **Readiness** | `readiness.declaration` / `readiness.execution` | `REVIEWABLE` / `HELD` until conformance and the strategy's G2. | `ui-circuit-blueprint-strategy.md:43-47,235-257` |

The boundary panel is the circuit's outer frame: the first thing the viewer draws and the last thing
a render may change. A panel member outside the closed vocabulary refuses visibly; a circuit without
an explicit boundary is not a circuit.

### 1.2 The Given / When / Then frames

| Frame | Declared carrier | Meaning | Ground |
| --- | --- | --- | --- |
| **Given** | `given` `[proposal]`: route params, session states, declared sources and their inputs | Scenario input face. The deployed equivalents are the route query, `when.session` scoping and `sources[].input`. | `implementation-strategy.md:437-459,505-517`; `page-runtime.js:260-269,314-346,411-433` |
| **When** | `when` `[proposal]`: event names + action ids | Event authority face. Events are declaration data over a fixed DOM event set. | `implementation-strategy.md:343-345,555-562`; `page-runtime.js:62,247-255` |
| **Then** | `then` `[proposal]`: reading statuses and scenario terminal faces | Outcome face. Reading outcomes are `READ`/`DEGRADED`/named refusals; execution outcomes are exact declared variants or the defect endpoint. | `implementation-strategy.md:564-603`; `live-circuit/circuit/README.md:360-369`; `circuit-runtime.js:270-276` |

The three frames pin the scenario the way the viewer pins it: Given/Input at the left, Then/Outcome
at the right, execution bands between them (`live-circuit/circuit/README.md:86-94`). Given shows
one payload component — the input contract enclosing its field cards — and Then uses the scenario's
own return receipt, with exact declared variant cards and the dashed defect endpoint for unmatched
returns (`live-circuit/circuit/README.md:306-308,360-369`).

### 1.3 The operation chain

| Chain element | Declared carrier | Meaning | Ground |
| --- | --- | --- | --- |
| **Ordinal** | ordered `sections[]` / operation order | Declared operation order; the viewer and the historical call-site strip both read it. | `implementation-strategy.md:227,437-459,480-503`; `live-circuit/circuit/README.md:347-351` |
| **Step** | section entry with `component`, `props`, `bindings`, `actions`, `events` | One operation on the chain; a declared entry, not code. | `implementation-strategy.md:227,437-459,480-503`; `page-runtime.js:688-731` |
| **Call box** | typed target link on the step | The call site glyph; providers and called scenarios share the same drawing. | `live-circuit/circuit/README.md:310-321` |
| **Wire** | declared edge with geometry and kind | Execution wire requires an admitted edge with matching graph identity, destination address, direction, kind and mapped endpoints. | `live-circuit/circuit/README.md:338-345` |
| **Return** | own-operation receipt | The dot returns through the call box to the step; a descendant never completes or reopens a returned caller. | `live-circuit/circuit/README.md:310-321,418-424` |

### 1.4 Provider call sites

A provider call and an invoke-scenario call are drawn the same way: the step, its call box, and the
callee device (a declared provider, or a called scenario with drill-down to its own circuit). The
dot goes out through the call box and returns through it to the step
(`live-circuit/circuit/README.md:310-321`). Live admission opens the selected call when the captured
operation authority matches its declared binding; the dot waits at the callee, with the step and
call box busy, until the own operation return arrives. Missing or mismatched identities are
findings, never substituted callees (`live-circuit/circuit/README.md:315-321`). Shared provider
identities remain a single provider glyph (`live-circuit/circuit/README.md:347-351`).

### 1.5 Observation bindings and the timeline

Testimony attaches to declared addresses only: `read-deck-observation-map` binds operation
identities and ordinals to exact semantic addresses, the browser joins those addresses to the
captured graph, then joins testimony by cell identity
(`live-circuit/circuit/README.md:274-282`; `ui-circuit-blueprint-strategy.md:95-96,99-108`). The
observation lane carries, per binding: the declared address, the source reader, and the refusal rule
for unmatched observations. Timeline state is traversal state — current, busy, visited, terminal —
and live/replay evidence phases stay separate from it
(`live-circuit/circuit/README.md:284-298,300-304`). Replay uses captured `startedAt`/`completedAt`
intervals rebased to the scenario window, selected by `declare-captured-circuit-clock` (Normal 1×,
Slow 0.1×, Fast 2×); no invented receipt fills a gap
(`live-circuit/circuit/README.md:398-416`). Execution-generation equality is
`NOT_FORMALLY_OBSERVABLE`; the viewer never upgrades a declaration into execution proof
(`live-circuit/circuit/README.md:381-388`).

### 1.6 The user-action-to-circuit lighting map

A user action lights a circuit only when the surface declares the action and the action resolves.
Selection is one model — canvas click and tree/row click set the same selection state
(`explorer.js:89-107`) — and the viewer only draws what traversal decided
(`live-circuit/circuit/README.md:284-310`). Drill-downs follow returned typed targets and links,
never names (`ui-circuit-blueprint-strategy.md:105-108`). Executions resolve authority downstream in
the capability system, not in the UI (`implementation-strategy.md:347-357`).

| Action kind | Dispatch class | Circuit it lights |
| --- | --- | --- |
| `navigate` | local | the destination read for the named path; never a hidden request (`page-runtime.js:616-621`) |
| `select` | local | the shared selection model and the declared target (node, row, component, slide) (`explorer.js:89-107`; `circuit-runtime.js:135-159`) |
| `session` | session-post | the identity circuit `authenticate-ide-user`; sign-in/sign-out/continue (`page-runtime.js:622-637`; `identity-session.mjs:143-183`) |
| `observe` | session-post | the selected capability's scenario circuit through one admitted run and its SSE testimony (`implementation-strategy.md:333`; `observe-panel.js:237-262`) |
| `objective` | session-post | `request-capability-from-objective-v3` and the requested-capabilities strip (`implementation-strategy.md:334`; `explorer.js:304-311`) |
| `playback`, `view`, `toggle`, `pane` | local | re-draws the already-loaded traversal model only; no execution (`implementation-strategy.md:335-338`; `circuit-runtime.js:416-435`) |
| `copy/download`, `stage-change` | local | stages a document only; mints no run, claim or trust state (`implementation-strategy.md:339-340`; `run-context.js:80-90`) |
| `refresh` | read | re-lights declared reads with `refresh=1` (`implementation-strategy.md:341`) |

### 1.7 Closed circuit vocabularies (a declaration outside these refuses)

| Vocabulary | Admitted values | Ground |
| --- | --- | --- |
| Binding kinds (component props) | `literal`, `read`, `session`, `release`, `route` | `implementation-strategy.md:505-511`; `page-runtime.js:60` |
| Scope bindings (action input) | `literal`, `route`, `event`, `form`, `row`, `source` | `implementation-strategy.md:347-353`; `page-runtime.js:61` |
| Events | `load`, `click`, `submit`, `change`, `select`, `seek`, `toggle` | `implementation-strategy.md:343-345`; `page-runtime.js:62` |
| Session states (`when`) | `signed-in`, `signed-out`, `any` | `implementation-strategy.md:513-517`; `page-runtime.js:63` |
| Sources | `catalog`, `scenario`, `details`, `provider-inspection`, `session`, `release`, `crosswalk` (maximum 8) | `page-runtime.js:48-57`; `circuit-host.json:18-24` |
| Component kinds | the deployed `ui.components` allowlist (21 kinds), consumed-by rule | `circuit-host.json:17`; `implementation-strategy.md:267-301` |
| Provider refusal codes | `UI_REGION_REQUEST_INVALID`, `UI_REGION_REQUEST_OVERSIZED`, `UI_REGION_UNKNOWN` | `sfx-providers/tests/ui-explorer-region.test.mjs:118-145` |

Template member names that are deployed vocabulary: `document`, `pageId`, `namespaceId`, `path`,
`revision`, `title`, `layoutRef`, `sources`, `sections`, `failure`, `publishedAt`, `digest`
(`implementation-strategy.md:439-460`), section `actions`/`bindings`/`events`/`when`
(`implementation-strategy.md:480-517,555-562`). `boundary`, `given`, `when`, `then`, `providers`
and `observationBindings` at circuit scope are `[proposal]` members; they carry no new authority
until admitted as class (c) estate data (`implementation-strategy.md:388-395`).

The authored template instantiates the served document: the reader composes `ui-page.v1` carrying
`contractId`, `status`, `path`, `pageId`, `revision`, `pageDigest`, `layout`, `sections`,
`readingDefinitionSha256`, `readAt` (`implementation-strategy.md:564-582`). The browser is a
transport and projector: it fetches, resolves declared sources and renders with adapters; it never
names result sets, synthesizes fields or picks SQL (`implementation-strategy.md:258-265`;
`live-circuit/circuit/README.md:110-113`).

---

## 2. The landing circuit — the Circuit Explorer

### 2.1 Boundary panel

Landing circuit `[proposal]`: capability `ui-page-landing`, namespace `sidefx:capabilities` (the
published, readable circuit; an earlier draft said `sidefx:ui`), path
`/circuit/explorer`, port `sda-ui-page-landing-port.v1` `[proposal]`, execution location
`trusted-browser-shell`, `bindingState: UNBOUND`, readiness `REVIEWABLE`/`HELD`
(`implementation-strategy.md:437-461`). The route is the deployed Explorer today
(`live-circuit/circuit/README.md:57-60`; `explorer.html:180-303`); converting its deep runtime is
out of v1 scope (`implementation-strategy.md:82-85`), so this circuit is the declared target,
realised region by region per the migration order (`ui-circuit-blueprint-strategy.md:162-193`).

### 2.2 Given / When / Then

- **Given** — route `/circuit/explorer` with query `capability`, `namespace`, `scenario`, `node`,
  `row`, `page`, `detail`; session states `signed-in`/`signed-out`; declared sources `catalog`,
  `details`, `scenario`, `session`, `release`, `provider-inspection` with their inputs
  (`live-circuit/circuit/README.md:57`; `page-runtime.js:411-433`).
- **When** — events `load`/`click`/`submit`/`change`/`select`/`seek`/`toggle`; action ids
  `navigate`, `select`, `session`, `observe`, `objective`, `playback`, `view`, `toggle`, `pane`,
  `copy/download`, `stage-change`, `refresh` (`page-runtime.js:62`; `implementation-strategy.md:328-341`).
- **Then** — reads return `ui-page.v1` status `READ`/`DEGRADED` or a named refusal; each region
  subcircuit resolves `AUTHORED` or `HELD`; testimony lights traversal states
  (`implementation-strategy.md:564-603`; `sfx-providers/providers/ui-explorer-region/ui-explorer-region.mjs:211-213`).

### 2.3 Operation chain and provider call sites

| Ordinal | Operation | Call box → callee | Return | Ground |
| ---: | --- | --- | --- | --- |
| 01 | session read | session reader → identity host `authenticate-ide-user` outcome | session state `signed-in`/`signed-out` | `explorer.js:332`; `identity-session.mjs:114-122` |
| 02 | environment read | host config reader → `GET /api/circuit/v1/home` | environment label, release from `/healthz` | `explorer.js:332,338`; `circuit-host.json:6` |
| 03 | navigation read | `details` reader → `read-capability-details` | `capability-details.v1` navigation rows, ending `capability_navigation` | `explorer.js:59-66`; `circuit-host.json:21`; `live-circuit/circuit/README.md:36-53` |
| 04 | scenario read | `scenario` reader → `read-live-scenario-circuit` | database scene + SVG, digest checked | `explorer.js:69-82`; `circuit-host.json:20`; `circuit-runtime.js:313-316,338` |
| 05 | region resolve | four region call boxes → region provider circuits (operation `ui.region.load`, `READ_ONLY`) | `AUTHORED` candidate with `sha256:` digests, or `HELD` with named findings | `sfx-providers/providers/ui-explorer-region/ui-explorer-region.mjs:28-35,274-289` |
| 06 | observe / objective | run admission → SDA API runs | admitted run + per-run SSE and observer testimony | `observe-panel.js:237-262`; `explorer.js:293-311` |

Provider call sites: the identity host (`/api/circuit/v1/session`), the kernel reading host
(`details`, `scenario`, `provider-inspection`), the four region providers, and the universal
capability `request-capability-from-objective-v3` on the objective row
(`circuit-host.json:5,20-21`; `explorer.js:293-311`).

### 2.4 Region subcircuits

Each region is a provider with its own circuit. The landing circuit hosts four region subcircuits
by call box; each declares its own boundary panel, frames, chain, observation bindings and lighting
map (full statements in [`ui-explorer-region-blueprint.md`](ui-explorer-region-blueprint.md) §2).

| Region (place) | Boundary panel | Given | When | Then | Own circuit | Observation | Lighting |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `header` (1) | `sfx-ui-explorer-region-header` on `sda-ui-explorer-region-header-port.v1`, role `shell-chrome`, `UNBOUND`, `REVIEWABLE`/`HELD` | route, session states, environment/release | `load`/`click`/`submit`; `navigate`, `session` intents | session state `signed-in`/`signed-out`, named dispositions | session circuit `authenticate-ide-user` | none | login submit and sign-out run the identity circuit |
| `left-sidebar` (2) | `sfx-ui-explorer-region-left-sidebar` on `sda-ui-explorer-region-left-sidebar-port.v1`, role `navigate-and-select`, `UNBOUND`, `REVIEWABLE`/`HELD` | one selection model; `details`, `catalog` sources | `select`, `navigate`, `pane`, `toggle`; `click`/`submit`/`change`/`select`/`toggle` | `capability-details.v1` rows in emission order; counts/states/badges as returned | navigation reading `read-capability-details` | none; selection is state, not evidence | tree click sets the one selection model; circuit target selects its row |
| `middle` (3) | `sfx-ui-explorer-region-middle` on `sda-ui-explorer-region-middle-port.v1`, role `scenario-circuit-canvas-and-execution`, `UNBOUND`, `REVIEWABLE`/`HELD` | selected scenario `read-live-scenario-circuit`; declared input contract; objective text | `observe`, `objective`, `playback`, `view`, `toggle`, `select`; `click`/`submit`/`change`/`seek`/`toggle` | testimony lights admission → completion → return; unobserved branches stay unlit; exact variant or defect endpoint | scenario reading + run testimony; `request-capability-from-objective-v3` | testimony to declared node/edge addresses only; digest joins; `NOT_FORMALLY_OBSERVABLE` generation | observe/objective light admitted runs; replay/view re-draw only |
| `right-sidebar` (4) | `sfx-ui-explorer-region-right-sidebar` on `sda-ui-explorer-region-right-sidebar-port.v1`, role `context-inspection-and-evidence`, `UNBOUND`, `REVIEWABLE`/`HELD` | Explorer selection; session runs; run reads/stream; input contract; provider inspection; `ui-view.v1` drill-down | context tabs local; `observe`; `copy/download`; `stage-change`; `select`/seek | run/evidence reads as returned; missing session names sign-in; Resume without resubmission | run/evidence reading circuit + declared `ui-view.v1` drill-down | component evidence to declared addresses only; unmatched listed separately | component selection opens authority; provider glyph opens the view |

The status bar (`explorer.html:302`) is chrome carried inside the middle region boundary, not a
fifth region (`ui-circuit-blueprint-strategy.md:72-73`).

### 2.5 Observation bindings and timeline

- The Explorer joins testimony to the selected circuit by `snapshotDigest` and
  `expectedSnapshotDigest` on every detail read (`circuit-runtime.js:82-83`); stale selections
  refuse rather than display (`live-circuit/circuit/README.md:129-135`).
- Evidence panels attach observed values to declared node/edge addresses only; unmatched and
  unaddressed observations are listed separately, never substituted
  (`circuit-runtime.js:319-362`; `live-circuit/circuit/README.md:300-321`).
- Replay retains the exact provider-child receipt span used for the executor check; a captured
  provider span is never replaced by box size, wire length or an arbitrary fraction
  (`live-circuit/circuit/README.md:323-336`).
- [proposal] `observationBindings[]` in the circuit template carry exactly these addresses, joins
  and refusal semantics as declared data (`ui-circuit-blueprint-strategy.md:95-96`); the status bar
  renders returned counts, digests and findings (`explorer.js:244-253`; `explorer.html:302`).

### 2.6 Named failure terminals

No failure is blank, silent or fallback-rendered (`ui-circuit-blueprint-strategy.md:203-207`;
`implementation-strategy.md:562-603,841-849`). Each is a visible terminal on the circuit, joined to
the face that refused.

| Circuit face | Named failure terminals |
| --- | --- |
| Read face | `PAGE_NOT_FOUND`, `PAGE_NOT_DECLARED`, `PAGE_SNAPSHOT_CHANGED`, `UI_DECLARATION_INVALID`, `UI_COMPONENT_NOT_SUPPORTED`, `UI_COMPONENT_ROLE_UNSUPPORTED`, `UI_ACTION_BINDING_UNRESOLVED`, `UI_SOURCE_NOT_SUPPORTED`, `DEGRADED` with requested/served revisions (`implementation-strategy.md:584-603`; `page-runtime.js:177-258`) |
| Publication face | `UI_PAGE_POINTER_MOVED`, `UI_PAGE_REVISION_EXISTS`, `UI_PAGE_POST_VERIFY_FAILED_DRILL` (`implementation-strategy.md:117-120,137-140,411-419`) |
| Reader face | `CAPABILITY_NOT_FOUND`, `CAPABILITY_NOT_SELECTED`, kernel codes such as `CELL_EXECUTION_FAILED` (`live-circuit/circuit/README.md:47-53`) |
| Drill-down face | `PROVIDER_VIEW_RENDER_FAILED`, `PROVIDER_VIEW_UNREADABLE` (`circuit-runtime.js:115-123`) |
| Session face | `SIGN_IN_REQUIRED`, `SESSION_ENDED`, `IDENTITY_NOT_CONFIGURED`, `IDENTITY_UNAVAILABLE`, `IDENTITY_RESPONSE_INVALID`, `LOGIN_INPUT_INVALID`, `SAME_ORIGIN_JSON_REQUIRED`, `REVOCATION_UNCONFIRMED` (`identity-session.mjs:60,72,85-90,144-162,178-181`) |
| Run face | sign-in required before admission; interrupted streams expose Resume; a failed admission shows its idempotency key (`observe-panel.js:128-145,256-260`; `live-circuit/circuit/README.md:220-223`) |

---

## 3. The entry circuit — login and `authenticate-ide-user`

The landing circuit's entry is its own circuit, drawn in the same grammar.

- **Boundary panel** — declared capability `authenticate-ide-user`, namespace
  `sidefx:capabilities`, `page: scenario-1`, label "Sign-in circuit"; four providers across three
  execution locations: `cli-login-input-provider` at `client-terminal`, principal/credential/session
  providers at `private-identity-service`; `inputProvider` ordered
  `before-server-scenario-entry`; ports declare `"bindingState":"UNBOUND"` with
  `"readiness":{"declaration":"REVIEWABLE","execution":"HELD"}`
  (`circuit-host.json:5`; `deploy/sda-kernel/identity-login.md:27-28`; quoted in
  `ui-circuit-blueprint-strategy.md:43-47`; estate
  `sfx-embody/sql/migrations/declare-authenticate-ide-user.sql:54-59,106-114`).
- **Given** — route `/circuit/login`; return target `/circuit/explorer` (only same-origin
  `/circuit` targets admitted); signed-out session; the declared input contract
  (`live-circuit/circuit/README.md:190-198`; `login.js:23-27`).
- **When** — `submit`/`form` scope; `session` action intents `sign-in`/`sign-out`/`continue`
  (`login.html:67-71`; `page-runtime.js:62,551-557,622-637`).
- **Operation chain** — 17 operations, three server providers, three circuit pages; the chain runs
  the input provider, then the identity providers, then the session provider
  (`deploy/sda-kernel/identity-login.md:27-28`).
- **Then** — session state `signed-in`/`signed-out`; submit status is a closed disposition map —
  `AUTHENTICATION_REJECTED`, `THROTTLED`, `LOGIN_INPUT_INVALID`, `IDENTITY_NOT_CONFIGURED`,
  `IDENTITY_UNAVAILABLE`, `IDENTITY_RESPONSE_INVALID`, `SAME_ORIGIN_JSON_REQUIRED`, `SESSION_ENDED`
  (`login.js:6-15`; `identity-session.mjs:60,72,85-90,144-162`).
- **Observation bindings** — identity-result digests attach to the identity host's own circuit;
  the sign-in page previews the same database scene (`login.js:101-108`;
  `live-circuit/circuit/README.md:162-167`). A page view is a reading, not a receipt (D8).
- **Lighting map** — the form submit lights `authenticate-ide-user` through the identity host; the
  transport itself cannot and must not be declared: `POST /api/circuit/v1/session` forwards
  `{identifier, password}` to the identity host, and the bearer lives only in the HttpOnly
  `__Host-sfx-session` cookie (`identity-session.mjs:1-8,143-171`;
  `docs/live-circuit-browser-session.md:27-46`).

The login page is hard-coded today; conversion to a declared circuit is the first blueprint
conversion (`analysis/13b-shell-pages.md:103-123`; `ui-circuit-blueprint-strategy.md:43-51`).

---

## 4. The four region circuits

The full region circuits — boundary panel, frames, chain, provider call sites, observation
bindings, lighting map, declared CSS/HTML/SVG content and failure terminals for `header`,
`left-sidebar`, `middle` and `right-sidebar` — are declared in
[`ui-explorer-region-blueprint.md`](ui-explorer-region-blueprint.md) §2 and instantiated by the
provider package `sfx-providers/providers/ui-explorer-region`. This document owns the landing
circuit that hosts them by call box; the region document owns their internal circuits.

---

## 5. Separation of responsibility

Circuits first; every other artefact is a projection or a mechanic. The separation is binding on
every revision of this blueprint:

1. **Circuits first.** The declared scenario circuit is the authority for structure and meaning.
   Layout, pages and regions are projections of circuits, never hand-built screens
   (`ui-circuit-blueprint-strategy.md:24-29,197-201`).
2. **Each region is a provider with its own circuit.** The landing hosts four region providers by
   call box, and each region declares its own boundary panel, Given/When/Then frames, operation
   chain, provider call sites, observation bindings and lighting map (§2.4; region blueprint §2).
3. **UI/UX providers link CSS/HTML/SVG content in declarations.** A region declaration names
   `assets/<region>.css` (style), `.html` (structure) and `.svg` (figure) by path, byte count and
   `sha256:` digest; declarations carry no executable markup, text renders as text and URLs
   validate against an admitted profile (`sfx-providers/providers/ui-explorer-region/ui-explorer-region.mjs:77-140`;
   `implementation-strategy.md:851-857`).
4. **Providers live in `sfx-providers`.** Hand-authored UI/UX provider code and assets are owned
   and tested in `sfx-providers/providers/`; this platform repository is a thin consumer and
   carries no provider realisation (`ui-circuit-blueprint-strategy.md:121-130,152-160`;
   `sidefx-circuit-driven-ui-strategy.md:55-62`).
5. **The platform loads them through the circuit API.** Declared provider content is read through
   the existing reader path — `GET /api/circuit/v1/provider-inspection`, backed by
   `analysis.read_provider_details` — with the same read limits and cache as every reader; the
   browser never holds the SDA token (`implementation-strategy.md:737-742,821-822`;
   `live-circuit/circuit/README.md:129-135`).
6. **The drill-down reuses the same blueprint template (the flywheel).** A provider drill-down is
   this §1 circuit instantiated at provider scope, carried by `ui-view.v1`, read through the
   deployed page reader and projected by the same runtime and adapters; declaring a provider grows
   declared circuits without new hand-authored UI (`view-runtime.js:1-19,101-113`;
   `ui-circuit-blueprint-strategy.md:110-119`).
7. **Blueprint is authority; no deviation.** No second renderer, no fallback renderer, no
   page-local style forks, no host-JSON CMS, no invented copy or evidence; unknown kind, role,
   action, source or contract refuses visibly and by name
   (`ui-circuit-blueprint-strategy.md:31-41,195-220,203-207`;
   `implementation-strategy.md:303-316,998-1010`).

---

## 6. The provider drill-down circuit (the flywheel)

A provider drill-down is not a new kind of surface: it is the §1 template instantiated at provider
scope, carried by `ui-view.v1` — the same circuit members with the view's own identity (`viewId`,
`viewDigest`) — read through the deployed page reader at `/circuit/views/<viewId>` and projected by
the same `createPageRuntime` and the same 21 `ui-component.v1` adapters as a declared circuit
(`view-runtime.js:1-19,101-113`; `live-circuit/circuit/README.md:136-147`).

| Circuit member | Provider-scope instantiation | Ground |
| --- | --- | --- |
| Boundary panel | one provider identity + definition; port bindings and execution locations declared; `bindingState`/readiness explicit | `ui-circuit-blueprint-strategy.md:93-94,237-244`; `circuit-host.json:12-16` |
| Given | the Explorer selection (capability, namespace, scenario, detail id, expected snapshot digest), bound into the view's declared source inputs by `bindViewSelection` | `view-runtime.js:58-90`; `circuit-runtime.js:103-105` |
| When | declared events on the profile sections; `copy`/`download` and `stage-change` are the deployed writers-that-write-nothing | `ui-circuit-blueprint-strategy.md:110-119`; `implementation-strategy.md:339-340` |
| Then | `ui-view.v1` status `READ` renders the declared sections; an absent/unreadable view renders its named refusal, never a fallback | `view-runtime.js:14-15,101-106`; `circuit-runtime.js:109-123` |
| Operation chain | read-only profile regions bound to the `details`/`provider-inspection` readers | `ui-circuit-blueprint-strategy.md:110-119` |
| Provider call sites | contracts live in the estate; the package implements them and defines no meaning | `ui-circuit-blueprint-strategy.md:156-160` |
| Observation bindings | inspection reads, identity-result digests and the selected snapshot digest; a reading, never a receipt | `live-circuit/circuit/README.md:129-135,149-153` |
| Lighting map | provider glyph opens the view; component selections open declared authority; copy/download stage the exact change document | `circuit-runtime.js:132-139`; `run-context.js:80-90` |

`viewId: provider-profile` at `/circuit/views/provider-profile` is the declared instance
(`view-runtime.js:20,48-50`). Its only mount point is the Explorer drill-down — a provider glyph
opens it directly (`view-runtime.js:14-15`; `circuit-runtime.js:92-139`) — and the subject is
chosen by the Explorer and bound into the declared source inputs; a declaration names no concrete
provider (`view-runtime.js:52-57`). The inspection is read-only: instruction and engagement editors
stage the exact change document for `model.install_provider_details_change` and copy or download
it; nothing applies in the browser (`live-circuit/circuit/README.md:149-153`).

Because contracts live in the estate and packages only implement them, **declaring a provider
grows declared circuits without new hand-authored UI**: the same template, validator, projector and
adapters host every drill-down (`ui-circuit-blueprint-strategy.md:110-119,156-160`;
`view-runtime.js:1-19`). Provider inspection stays a reading, never a receipt
(`implementation-strategy.md:254,835-839`).

---

## 7. Conformance rules

### 7.1 The blueprint is the declared authority

1. Circuits render only from the published blueprint; shell chrome keeps only chrome
   (`ui-circuit-blueprint-strategy.md:197-201`; `implementation-strategy.md:247,258-265`).
2. Screens and providers must not deviate: no second renderer, no fallback renderer, no
   page-local style forks, no host-JSON CMS, no invented copy or evidence
   (`ui-circuit-blueprint-strategy.md:31-41,195-220`; `implementation-strategy.md:303-316,998-1010`;
   `page-runtime.js:14-16,719-727`).
3. A provider implements a contract; it never defines meaning, and a render mints no run, claim or
   trust state (`ui-circuit-blueprint-strategy.md:156-160`; `implementation-strategy.md:835-839`).
4. One selection/traversal model decides state; the viewer only draws
   (`live-circuit/circuit/README.md:284-310`; `explorer.js:89-107`).
5. Drill-downs follow returned typed targets; ordinary navigation resolves the current published
   pointer and carries no destination digest (`ui-circuit-blueprint-strategy.md:105-108`;
   `implementation-strategy.md:370-378`).

### 7.2 Named failures only

Every refusal is a named, visible terminal — never blank, never silent, never a fallback — and
joins the existing 404/409/422 vocabulary (`ui-circuit-blueprint-strategy.md:203-207`;
`implementation-strategy.md:562-603`). The landing circuit's terminal set is §2.6. Unknown
kind/role/action/source refuses visibly; validation runs before render, server and client
(`implementation-strategy.md:303-316,584-603`; `page-runtime.js:177-258,688-731`).

### 7.3 Trust and dispatch

Action dispatch never widens authority: **no action kind may invent a route, a method, a header or
a credential**; the browser's only writes are session and observe/objective
(`implementation-strategy.md:347-357`). The trust boundary is unchanged: the shell keeps the
projector, validator, routing and security seams; the browser never holds the SDA token
(`ui-circuit-blueprint-strategy.md:152-160`; `implementation-strategy.md:821-822`;
`live-circuit/circuit/README.md:226-233`).

### 7.4 Evidence and drift

A circuit view or provider drill-down is a reading, not an execution receipt
(`implementation-strategy.md:256`; `ui-circuit-blueprint-strategy.md:117-119`). Acceptance is
click-path and capture based with real evidence; source checks are not DOM proof
(`ui-circuit-blueprint-strategy.md:208-214`). Drift is detected and recorded as a finding against
this blueprint, closed only by a declared publication — never by tolerating a second authority
(`ui-circuit-blueprint-strategy.md:215-220`). The finish line is code-mass leaving the platform:
each shipped artefact replaced by its provider package, the shell retaining only
projector/validator/routing/security functions (`ui-circuit-blueprint-strategy.md:188-193`).

---

## 8. Status and sequencing

- The blueprint and its region circuits are `[proposal]`; no declaration, provider identity or
  binding has been published by this document.
- The default is no SDA change; the blueprint relies on existing read machinery, declared
  providers with `UNBOUND` readiness and the existing reader path
  (`ui-circuit-blueprint-strategy.md:222-235`). Browser-executed provider realisation,
  multi-child composition, provider binding conformance and token publication as data wait on G2
  and are not an open gate to be filed now (`ui-circuit-blueprint-strategy.md:253-257`).
- Sequencing follows the migration order: estate pair, manifest extension, then one package per
  deploy in dependency order — token-set → contract-roles → adapters → kinds/renderers → action
  dispatch — then the `ui-page-runtime` umbrella (`ui-circuit-blueprint-strategy.md:173-193`).
- Login is the first conversion; the landing regions follow, and each conversion is proven by the
  shell's existing gates plus the package's own check with no fallback
  (`ui-circuit-blueprint-strategy.md:43-51,184-193`).
