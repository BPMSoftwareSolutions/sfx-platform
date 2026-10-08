# Landing scenario blueprint

Prepared 2026-10-08. Status: **[proposal] blueprint; the declarations below are not published.** Revision 1.
This is the landing instance of the deterministic design process in
[`ui-circuit-blueprint-strategy.md`](ui-circuit-blueprint-strategy.md) (blueprint first, projection
second, §1) and the declaration anatomy of [`implementation-strategy.md`](implementation-strategy.md)
§3-5. It is design, not observable behaviour: every member not yet admitted is labelled `[proposal]`,
and claims about deployed behaviour cite `path:line`. Nothing here authorises SDA, `sfx-embody` or
`sfx-dal` changes (`AGENTS.md`); the default remains no SDA change
(`ui-circuit-blueprint-strategy.md:222-235`).

How to read this document:

- **Observed** — deployed in the repository today, cited to code or contract documents.
- **[proposal]** — declared design; it becomes authority only through the admission path of the
  strategy (`ui-circuit-blueprint-strategy.md:237-251`) and its gates.
- The blueprint is the declared authority for structure and meaning; the shell keeps only chrome,
  projector, validator, routing and security (`ui-circuit-blueprint-strategy.md:154-160,197-201`;
  `implementation-strategy.md:49-65`).
- The page runtime, component registry and declared-view projector cited below are deployed shell
  code (`live-circuit/circuit/page-runtime.js`, `ui-components.js`, `view-runtime.js`), not a
  realisation of this blueprint.

---

## 1. The landing blueprint template

Every page — login, landing, every declared route, every provider drill-down — declares the same
members over the same closed vocabularies. The template is the unit of conformance: a screen is a
projection of one instantiated template, never a hand-built surface
(`ui-circuit-blueprint-strategy.md:24-29,85-97`).

### 1.1 Members

| Member | Declared carrier | Meaning | Ground |
| --- | --- | --- | --- |
| **Boundary** | `boundary` `[proposal]` over the page definition: `capabilityId`, `namespaceId`, `ports`, `executionLocations`, `bindingState`, `readiness` | Capability/port/provider scope. Ports and execution locations are declared data; `bindingState: UNBOUND` with `REVIEWABLE`/`HELD` readiness lets declaration precede admission and execution. | `ui-circuit-blueprint-strategy.md:43-47,92,237-244`; estate pattern `sfx-embody/sql/migrations/declare-authenticate-ide-user.sql:86-94,106-114` |
| **Given** | `given` `[proposal]`: route params, session states, declared sources and their inputs | Scenario input face. The deployed equivalents are the route query, `when.session` scoping and `sources[].input`. | `implementation-strategy.md:437-459,505-517`; `page-runtime.js:260-269,314-346,411-433` |
| **When** | `when` `[proposal]`: event names + action ids | Event authority face. Events are declaration data over a fixed DOM event set. | `implementation-strategy.md:343-345,555-562`; `page-runtime.js:62,247-255` |
| **Then** | `then` `[proposal]`: reading statuses and scenario terminal faces | Outcome face. Reading outcomes are `READ`/`DEGRADED`/named refusals; execution outcomes are exact declared variants or the defect endpoint. | `implementation-strategy.md:564-603`; `README.md` (circuit) `:360-369`; `circuit-runtime.js:270-276` |
| **Operations** | ordered `sections[]` with `component`, `props`, `bindings`, `actions`, `events` | Per-section component entries and the operations they read. A section is a declared entry, not code. | `implementation-strategy.md:227,437-459,480-503`; `page-runtime.js:688-731` |
| **Providers** | `providers[]` `[proposal]`: `model.provider` identity + definition, port bindings, readiness | Provider scope: contracts live in the estate; packages implement them and never define meaning. | `ui-circuit-blueprint-strategy.md:93-94,121-130,156-160`; `implementation-strategy.md:225-231` |
| **Observation bindings** | `observationBindings[]` `[proposal]`: reader-sourced overlays and joins | Testimony attaches to declared addresses only; SQL returns scenario semantics, geometry, SVG and observation bindings. No invented receipt fills a gap. | `ui-circuit-blueprint-strategy.md:95-96,99-108`; `README.md` (circuit) `:274-282,284-310,338-345` |
| **Page members** | `pageId`, `namespaceId`, `path`, `revision`, `title`, `layoutRef`, `sources`, `sections`, `failure`, `publishedAt`, `digest` | Path, layout ref, sources, ordered sections, failure states, digest — the authored, versioned definition. | `implementation-strategy.md:437-461,562-601` |
| **User-action lighting** | each section's `actions[]` + `events[]`; every action id resolves | Actions light circuits through declared action ids and fixed dispatch classes only. | `ui-circuit-blueprint-strategy.md:99-108`; `implementation-strategy.md:318-357` |

Template member names that are deployed vocabulary: `document`, `pageId`, `namespaceId`, `path`,
`revision`, `title`, `layoutRef`, `sources`, `sections`, `failure`, `publishedAt`, `digest`
(`implementation-strategy.md:439-460`), section `actions`/`bindings`/`events`/`when`
(`implementation-strategy.md:480-517,555-562`). `boundary`, `given`, `when`, `then`, `providers`
and `observationBindings` at page scope are `[proposal]` members; they carry no new authority until
admitted as class (c) estate data (`implementation-strategy.md:388-395`).

The authored template instantiates the served document: the reader composes `ui-page.v1` carrying
`contractId`, `status`, `path`, `pageId`, `revision`, `pageDigest`, `layout`, `sections`,
`readingDefinitionSha256`, `readAt` (`implementation-strategy.md:564-582`). The browser is a
transport and projector: it fetches, resolves declared sources and renders with adapters; it never
names result sets, synthesizes fields or picks SQL (`implementation-strategy.md:258-265`;
`live-circuit/circuit/README.md:110-113`).

### 1.2 Closed vocabularies (a declaration outside these refuses)

| Vocabulary | Admitted values | Ground |
| --- | --- | --- |
| Binding kinds (component props) | `literal`, `read`, `session`, `release`, `route` | `implementation-strategy.md:505-511`; `page-runtime.js:60` |
| Scope bindings (action input) | `literal`, `route`, `event`, `form`, `row`, `source` | `implementation-strategy.md:347-353`; `page-runtime.js:61` |
| Events | `load`, `click`, `submit`, `change`, `select`, `seek`, `toggle` | `implementation-strategy.md:343-345`; `page-runtime.js:62` |
| Session states (`when`) | `signed-in`, `signed-out`, `any` | `implementation-strategy.md:513-517`; `page-runtime.js:63` |
| Action kinds and dispatch classes | `navigate`, `select` (local); `session`, `observe`, `objective` (session-post); `playback`, `view`, `toggle`, `pane`, `copy/download`, `stage-change` (local); `refresh` (read) | `implementation-strategy.md:328-341`; `page-runtime.js:34-46,64` |
| Sources | `catalog`, `scenario`, `details`, `provider-inspection`, `session`, `release`, `crosswalk` (maximum 8) | `page-runtime.js:48-57`; `implementation-strategy.md:711`; `circuit-host.json:18-24` |
| Component kinds | the deployed `ui.components` allowlist (21 kinds), consumed-by rule | `circuit-host.json:17`; `implementation-strategy.md:267-301` |

### 1.3 The lighting law

A user action lights a circuit only when the surface declares the action and the action resolves.
Selection is one model — canvas click and tree/row click set the same selection state
(`explorer.js:89-107`) — and the viewer only draws what traversal decided
(`live-circuit/circuit/README.md:284-310`). Drill-downs follow returned typed targets and links,
never names (`ui-circuit-blueprint-strategy.md:105-108`). Executions resolve authority downstream
in the capability system, not in the UI (`implementation-strategy.md:347-357`).

| Action kind | Dispatch class | What it lights |
| --- | --- | --- |
| `navigate` | local | the destination read for the named path; never a hidden request (`page-runtime.js:616-621`) |
| `select` | local | the shared selection model and the declared target (node, row, component, slide) (`explorer.js:89-107`; `circuit-runtime.js:135-159`) |
| `session` | session-post | the identity circuit `authenticate-ide-user`; sign-in/sign-out/continue (`page-runtime.js:622-637`; `identity-session.mjs:143-183`) |
| `observe` | session-post | the selected capability's scenario circuit through one admitted run and its SSE testimony (`implementation-strategy.md:333`; `observe-panel.js:237-262`) |
| `objective` | session-post | `request-capability-from-objective-v3` and the requested-capabilities strip (`implementation-strategy.md:334`; `explorer.js:304-311`) |
| `playback`, `view`, `toggle`, `pane` | local | re-draws the already-loaded traversal model only; no execution (`implementation-strategy.md:335-338`; `circuit-runtime.js:416-435`) |
| `copy/download`, `stage-change` | local | stages a document only; mints no run, claim or trust state (`implementation-strategy.md:339-340`; `run-context.js:80-90`) |
| `refresh` | read | re-lights declared reads with `refresh=1` (`implementation-strategy.md:341`) |

---

## 2. The concrete landing instance

### 2.1 Entry: login and `authenticate-ide-user`

The landing blueprint has one entry step and one landing layout.

| Member | Landing value | Ground |
| --- | --- | --- |
| Entry path | `/circuit/login`; return target `/circuit/explorer` (only same-origin `/circuit` targets admitted) | `live-circuit/circuit/README.md:190-198`; `login.js:23-27` |
| Entry circuit | declared capability `authenticate-ide-user`, namespace `sidefx:capabilities`, `page: scenario-1`, label "Sign-in circuit" | `circuit-host.json:5` |
| Entry scale | 17 operations, three server providers, three circuit pages | `deploy/sda-kernel/identity-login.md:27-28` |
| Providers / locations | four providers, three execution locations: `cli-login-input-provider` at `client-terminal`, principal/credential/session providers at `private-identity-service`; `inputProvider` ordered `before-server-scenario-entry` | quoted in `ui-circuit-blueprint-strategy.md:43-47`; estate `sfx-embody/sql/migrations/declare-authenticate-ide-user.sql:54-59,112` |
| Readiness | ports declare `"bindingState":"UNBOUND"`; envelope `"readiness":{"declaration":"REVIEWABLE","execution":"HELD"}` | same estate cites; `ui-circuit-blueprint-strategy.md:43-47,237-244` |
| Visible form | `form` kind, `submit`/`form` scope, `session` action intents `sign-in`/`sign-out`/`continue` | `ui-circuit-blueprint-strategy.md:47-49`; `login.html:67-71`; `page-runtime.js:62,551-557,622-637` |
| Transport | cannot and must not be declared: `POST /api/circuit/v1/session` forwards `{identifier, password}` to the identity host; the bearer lives only in the HttpOnly `__Host-sfx-session` cookie | `ui-circuit-blueprint-strategy.md:47-49`; `identity-session.mjs:1-8,143-171`; `docs/live-circuit-browser-session.md:27-46` |
| Entry page status | hard-coded today; conversion to a declared page is the first blueprint conversion | `analysis/13b-shell-pages.md:103-123`; `ui-circuit-blueprint-strategy.md:48-51` |

The sign-in page already reads the circuit it runs: the preview is the database scene for
`authenticate-ide-user` (`login.js:101-108`; `live-circuit/circuit/README.md:162-167`). Submit
status copy is a closed disposition map — `AUTHENTICATION_REJECTED`, `THROTTLED`,
`LOGIN_INPUT_INVALID`, `IDENTITY_NOT_CONFIGURED`, `IDENTITY_UNAVAILABLE`,
`IDENTITY_RESPONSE_INVALID`, `SAME_ORIGIN_JSON_REQUIRED`, `SESSION_ENDED` (`login.js:6-15`;
`identity-session.mjs:60,72,85-90,144-162`).

### 2.2 The landing page declaration

Landing page `[proposal]`: `pageId: ui-page-landing`, `namespaceId: sidefx:ui`,
`path: /circuit/explorer`, `title: Live Circuit Platform`, one `layoutRef`, declared sources,
ordered sections, failure states and a digest (`implementation-strategy.md:437-461`). The route is
the deployed Explorer today (`live-circuit/circuit/README.md:57-60`; `explorer.html:180-303`);
converting its deep runtime is out of v1 scope (`implementation-strategy.md:82-85`), so this
blueprint is the declared target, realised region by region per the migration order
(`ui-circuit-blueprint-strategy.md:162-193`).

Layout `[proposal]` `ui-layout-landing.v1` declares the four regions. Placement beyond
`regionId`+`order` is `[proposal]`; the deployed projector consumes `layout.regions` in order
(`implementation-strategy.md:463-475`; `page-runtime.js:435-453`).

```json
{
  "document": "ui-layout.v1",
  "layoutId": "ui-layout-landing.v1",
  "regions": [
    { "regionId": "header", "order": 1 },
    { "regionId": "tree", "order": 2 },
    { "regionId": "canvas", "order": 3 },
    { "regionId": "context", "order": 4 }
  ],
  "policy": { "stack": "row", "density": "comfortable", "tokenSet": "site.v1" },
  "honesty": "Layout decides placement and disclosure only; status and meaning are rendered, never recomputed."
}
```

One UI/UX provider per region, each with its own circuit `[proposal]`. Every provider declares
`bindingState: UNBOUND` and `REVIEWABLE`/`HELD` readiness until conformance; browser-executed
provider realisation waits on the strategy's G2 (`ui-circuit-blueprint-strategy.md:121-130,235-257`;
`implementation-strategy.md:230-236`). The "own circuit" column names the circuit the region hosts
today; the capability column names the `[proposal]` executed capability that replaces the reading
at G2.

| Region | Provider `[proposal]` | Own circuit | Deployed backing today |
| --- | --- | --- | --- |
| Header | `ui-header-provider.v1` | session circuit `authenticate-ide-user` | `circuit-host.json:5`; `identity-session.mjs`; `explorer.js:257-268` |
| Left sidebar | `ui-capability-tree-provider.v1` | navigation reading `read-capability-details` | `circuit-host.json:21`; `live-circuit/circuit/README.md:36-53` |
| Middle | `ui-circuit-canvas-provider.v1` | selected capability's scenario circuit `read-live-scenario-circuit` + run testimony | `circuit-host.json:20`; `circuit-runtime.js:220-234,368-392` |
| Right sidebar | `ui-run-context-provider.v1` | run/evidence reading circuit: session runs, run reads/stream, provider inspection, declared `ui-view.v1` drill-down | `identity-session.mjs:124-141`; `circuit-host.json:21`; `view-runtime.js:101-113` |

The status bar (`explorer.html:302`) is chrome carried inside the canvas region boundary, not a
fifth region (`ui-circuit-blueprint-strategy.md:72-73`).

### 2.3 Region — header (identity / environment / navigation)

**Role.** Shell chrome: brand, primary navigation, environment label, identity/session mount
(`explorer.html:180-186`). It is not declarable meaning; it stays shell by D6 as chrome only
(`ui-circuit-blueprint-strategy.md:67`; `implementation-strategy.md:254`).

**Own circuit.** The session circuit: `authenticate-ide-user`, `page: scenario-1`
(`circuit-host.json:5`). Its outcome face is session state, `signed-in`/`signed-out`
(`explorer.js:257-268`; `page-runtime.js:411-433`).

**Data sources.** `GET /api/circuit/v1/session` for identity (`explorer.js:332`;
`identity-session.mjs:114-122`); environment label from host config `GET /api/circuit/v1/home`
(`explorer.js:338`; `circuit-host.json:6`); release from `/healthz` (`explorer.js:332`);
primary navigation links are shell (`explorer.html:183`).

**Actions and events.** `navigate` (Home, Explorer); `session` intents `sign-in`/`sign-out`/
`continue` (`implementation-strategy.md:332,351`; `page-runtime.js:622-637`). Sign-out dispatches
session-post and reloads (`explorer.js:259-262`).

**Declared content it will link.** Token set `site.v1` as layout policy data
(`implementation-strategy.md:470`; `live-circuit/circuit/site.css:4-12`); wordmark asset
`assets/sfx-logo-wordmark.png` (`explorer.html:182`); header/footer/identity markup remains shell
chrome (D6). `[proposal]`: header copy, nav labels and the identity-mount section convert to
declared `text`/`list`/`session` bindings when the login page converts
(`implementation-strategy.md:287-293`).

**How user actions light its circuit.** Submitting the login form runs `authenticate-ide-user`
through the identity host (`login.js:61-83`; `identity-session.mjs:143-171`), and the login page
previews the same database scene (`login.js:102-108`). A successful session renders
`Signed in as …` in the header (`explorer.js:259-267`); sign-out revokes server-side and the header
re-renders signed-out (`identity-session.mjs:173-183`). A failed or ended session is a named
disposition, never a silent signed-out state (`identity-session.mjs:114-122`).

### 2.4 Region — left sidebar (capability tree / navigation)

**Role.** Navigate and select a capability: search/picker plus declared
section/group/node navigation; counts, states and badges shown as returned, never recomputed
(`explorer.html:188-191`; `live-circuit/circuit/README.md:62-65`).

**Own circuit.** The navigation reading: `read-capability-details` returning
`capability-details.v1` in emission order, ending with `capability_navigation`
(`circuit-host.json:21`; `live-circuit/circuit/README.md:36-53`). The reading is a reading, not an
execution (`implementation-strategy.md:256`).

**Data sources.** `GET /api/circuit/v1/capability-details` (`explorer.js:59-66`); the datalist is
the catalog read `GET /api/circuit/v1/capabilities` (`explorer.js:334-337`).

**Actions and events.** `select` on tree items, tabs and rows (`explorer.js:89-99,143,175,214`);
`navigate` on picker submit (`explorer.js:269-276`); `pane` for splitter resize/collapse
(`explorer.js:285-291`); `toggle` for the narrow-window drawers (`explorer.js:254`;
`explorer.html:86-92`).

**Declared content it will link.** No page copy: labels, coordinates, groups, counts, states and
badges are returned navigation rows (`live-circuit/circuit/README.md:62-65`;
`explorer.js:135-167`). CSS tokens only (`site.css:4-12`). `[proposal]`: the tree converts to
declared `list`/`tabs`/`heading` sections bound to the `details` source with `select` actions
(`implementation-strategy.md:274-285,295-296`), first at the `list` kind.

**How user actions light its circuit.** A tree click sets the one selection model
(node/row/component) and re-renders tabs, section and context (`explorer.js:89-99`). A row whose
declared scene key names a circuit component focuses that component — the canvas and tree share
the selection (`explorer.js:96`; `circuit-runtime.js:151-159`); a circuit click selects the row
whose section declares it (`explorer.js:101-107`; `live-circuit/circuit/README.md:99-102`).
Picker submit reads details and scene in parallel (`explorer.js:50-82`).

### 2.5 Region — middle (scenario circuit canvas and execution)

**Role.** Capability header, scenario bar, objective composer, run bar (live/replay/view/follow),
the declared circuit scene, invocation timeline, run-evidence summary and selected section
(`explorer.html:193-257`; `ui-circuit-blueprint-strategy.md:69`). The viewer draws traversal state
and makes no decisions of its own (`live-circuit/circuit/README.md:284-310`).

**Own circuit.** The selected capability's scenario circuit: `read-live-scenario-circuit` scene
(`circuit-host.json:20`) plus live/replay testimony over the observer stream
(`circuit-runtime.js:368-392`). The objective row is the universal capability
`request-capability-from-objective-v3` (`explorer.js:293-311`).

**Data sources.** `GET /api/circuit/v1/scenario` (`explorer.js:69-82`); `POST
/api/circuit/v1/runs` for observe/objective (`observe-panel.js:237-262`;
`page-runtime.js:590-655`); per-run SSE `/api/circuit/v1/runs/:id/events/stream`
(`observe-panel.js:186`) and the observer `/events` feed (`circuit-runtime.js:368-392`).

**Actions and events.** `observe` (`implementation-strategy.md:333`), `objective`
(`:334`), `playback` (`:335`), `view` (`:336`), `toggle` (`:337`), `select` (`:331`);
events `click`/`submit`/`change`/`seek`/`toggle` (`page-runtime.js:62`).

**Declared content it will link.** The circuit SVG is the reader's scene with its bytes retained
beneath the animation layer and its digest checked (`live-circuit/circuit/README.md:377-379`;
`circuit-runtime.js:313-316,338`); CSS `circuit-canvas.css` and `run-evidence.css`
(`explorer.html:8-9`); declared kinds include `timeline`, `form`, `chart`, `media.figure`, `code`
(`circuit-host.json:17`); text reaches the DOM only through `textContent`, URLs only through
`safeUrl` (`ui-components.js:1-28,51-72`); media figures carry `svg`/`src`/`alt`/`digest` roles
(`implementation-strategy.md:282`).

**How user actions light its circuit.** Observe prepares the live root scenario, submits one
`capability observe` run and follows that run's own cursor (`live-circuit/circuit/README.md:200-223`;
`observe-panel.js:237-262`). The objective Run admits
`request-capability-from-objective-v3`, switches to that capability and follows the run
(`explorer.js:293-311`). Received testimony lights admission → completion → return; unobserved
branches stay unlit and no endpoint lights before the scenario's own return
(`live-circuit/circuit/README.md:300-345,418-433`). Replay and view controls re-draw the same
traversal model without executing anything (`circuit-runtime.js:416-435`).

### 2.6 Region — right sidebar (context / evidence / inspection)

**Role.** Run/Runs/Evidence tabs; run report and steps; observe form bound to the declared input
contract; runs history; captured component evidence; selection details and declared authority
(`explorer.html:259-300`; `ui-circuit-blueprint-strategy.md:70`).

**Own circuit.** The run/evidence reading circuit: attributed runs via
`GET /api/circuit/v1/session/runs` (`identity-session.mjs:124-141`), run read/events/output
(`observe-panel.js:194-209`), declared input contract via the `scenario` reader
(`observe-panel.js:286-309`), provider inspection (`circuit-host.json:21`;
`live-circuit/circuit/README.md:115-135`) and the declared `ui-view.v1` drill-down
(`view-runtime.js:101-113`).

**Data sources.** Run reads and stream as above; component authority from the `details` reader
(`explorer.js:59-66`; `circuit-runtime.js:82-131`); provider inspection through
`GET /api/circuit/v1/provider-inspection`.

**Actions and events.** Context tabs are local (`run-context.js:25-42`); `observe` from the bound
fields (`observe-panel.js:146-166,237-262`); `copy/download` for evidence export
(`run-context.js:80-90`); `stage-change` stages a provider change document only
(`implementation-strategy.md:340`; `live-circuit/circuit/README.md:149-153`); `select`/seek for
timeline steps (`run-context.js:77-78,104`).

**Declared content it will link.** CSS `run-evidence.css` (`explorer.html:9`); the observe form is
built from the returned input contract — constants fixed, enums lists, strings text, arrays one
item per line (`live-circuit/circuit/README.md:103-108`; `observe-panel.js:18-87`); `[proposal]`:
the panel converts to declared `table`/`field-list`/`disclosure`/`badge`/`status-chip` sections
bound to the `details`/`provider-inspection` readers with `copy`/`download` and `stage-change`
actions (`implementation-strategy.md:295-296`; `ui-circuit-blueprint-strategy.md:110-119`).

**How user actions light its circuit.** Selecting a component opens its declared authority and
captured component evidence (`circuit-runtime.js:132-139`; `run-context.js:115-131`). A provider
glyph is the provider's door: it opens the declared provider view (`circuit-runtime.js:92-139`).
A missing session names sign-in and does not submit (`observe-panel.js:128-145`); an interrupted
stream exposes Resume without resubmitting (`live-circuit/circuit/README.md:220-223`). Nothing in
this region applies a change or mints trust (`implementation-strategy.md:256,835-839`).

### 2.7 Observation bindings and status

- The Explorer joins testimony to the selected circuit by `snapshotDigest` and
  `expectedSnapshotDigest` on every detail read (`circuit-runtime.js:82-83`); stale selections
  refuse rather than display (`live-circuit/circuit/README.md:129-135`).
- Evidence panels attach observed values to declared node/edge addresses only; unmatched and
  unaddressed observations are listed separately, never substituted
  (`circuit-runtime.js:319-362`; `live-circuit/circuit/README.md:300-321`).
- Execution-generation equality is `NOT_FORMALLY_OBSERVABLE`; the viewer never upgrades a
  declaration into execution proof (`live-circuit/circuit/README.md:381-388`).
- A page view or drill-down is a reading, not an execution receipt (D8):
  `implementation-strategy.md:256`.
- [proposal] `observationBindings[]` in the page template carry exactly these addresses, joins and
  refusal semantics as declared data (`ui-circuit-blueprint-strategy.md:95-96`); the status bar
  renders returned counts, digests and findings (`explorer.js:244-253`; `explorer.html:302`).

### 2.8 Named failures of the landing

No failure is blank, silent or fallback-rendered (`ui-circuit-blueprint-strategy.md:203-207`;
`implementation-strategy.md:562-603,841-849`).

| Surface | Named failures |
| --- | --- |
| Page declaration/read | `PAGE_NOT_FOUND`, `PAGE_NOT_DECLARED`, `PAGE_SNAPSHOT_CHANGED`, `UI_DECLARATION_INVALID`, `UI_COMPONENT_NOT_SUPPORTED`, `UI_COMPONENT_ROLE_UNSUPPORTED`, `UI_ACTION_BINDING_UNRESOLVED`, `UI_SOURCE_NOT_SUPPORTED`, `DEGRADED` with requested/served revisions (`implementation-strategy.md:584-603`; `page-runtime.js:177-258`) |
| Publication mechanics | `UI_PAGE_POINTER_MOVED`, `UI_PAGE_REVISION_EXISTS`, `UI_PAGE_POST_VERIFY_FAILED_DRILL` (`implementation-strategy.md:117-120,137-140,411-419`) |
| Reader path | `CAPABILITY_NOT_FOUND`, `CAPABILITY_NOT_SELECTED`, kernel codes such as `CELL_EXECUTION_FAILED` (`live-circuit/circuit/README.md:47-53`) |
| Provider drill-down | `PROVIDER_VIEW_RENDER_FAILED`, `PROVIDER_VIEW_UNREADABLE` (`circuit-runtime.js:115-123`) |
| Session/identity | `SIGN_IN_REQUIRED`, `SESSION_ENDED`, `IDENTITY_NOT_CONFIGURED`, `IDENTITY_UNAVAILABLE`, `IDENTITY_RESPONSE_INVALID`, `LOGIN_INPUT_INVALID`, `SAME_ORIGIN_JSON_REQUIRED`, `REVOCATION_UNCONFIRMED` (`identity-session.mjs:60,72,85-90,144-162,178-181`) |
| Observe/run | Sign-in required before admission; interrupted streams expose Resume; a failed admission shows its idempotency key (`observe-panel.js:128-145,256-260`; `live-circuit/circuit/README.md:220-223`) |

---

## 3. The provider drill-down template (the flywheel)

### 3.1 The same template at provider scope

A provider drill-down is not a new kind of surface: it is the §1 template instantiated at provider
scope, carried by `ui-view.v1` — the same page-shaped members (`layout`, `sources`, `sections`,
`actions`, `events`) with the view's own identity (`viewId`, `viewDigest`) — read through the
deployed page reader at `/circuit/views/<viewId>` and projected by the same `createPageRuntime`
and the same 21 `ui-component.v1` adapters as a declared page
(`view-runtime.js:1-19,101-113`; `live-circuit/circuit/README.md:136-147`).

| Template member | Provider-scope instantiation | Ground |
| --- | --- | --- |
| Boundary | one provider identity + definition; port bindings and execution locations declared; `bindingState`/readiness explicit | `ui-circuit-blueprint-strategy.md:93-94,237-244`; `circuit-host.json:12-16` |
| Given | the Explorer selection (capability, namespace, scenario, detail id, expected snapshot digest), bound into the view's declared source inputs by `bindViewSelection` | `view-runtime.js:58-90`; `circuit-runtime.js:103-105` |
| When | declared events on the profile sections; `copy`/`download` and `stage-change` are the deployed writers-that-write-nothing | `ui-circuit-blueprint-strategy.md:110-119`; `implementation-strategy.md:339-340` |
| Then | `ui-view.v1` status `READ` renders the declared sections; an absent/unreadable view renders its named refusal, never a fallback | `view-runtime.js:14-15,101-106`; `circuit-runtime.js:109-123` |
| Operations | read-only profile regions bound to the `details`/`provider-inspection` readers | `ui-circuit-blueprint-strategy.md:110-119` |
| Providers | contracts live in the estate; the package implements them and defines no meaning | `ui-circuit-blueprint-strategy.md:156-160` |
| Observation bindings | inspection reads, identity-result digests and the selected snapshot digest; a reading, never a receipt | `live-circuit/circuit/README.md:129-135,149-153` |
| User-action lighting | provider glyph opens the view; component selections open declared authority; copy/download stage the exact change document | `circuit-runtime.js:132-139`; `run-context.js:80-90` |

The profile's read-only regions — header, identity, configuration, mechanics/ports, bindings,
engagements, instructions, invocations, summary — are `table`, `field-list`, `disclosure`,
`badge`, `status-chip` and `notice` bound to the existing `details`/`provider-inspection`
readers, with `copy`/`download` and `stage-change` already deployed
(`ui-circuit-blueprint-strategy.md:110-119`; `implementation-strategy.md:295-296`).

### 3.2 Drill-down instance: `provider-profile`

`viewId: provider-profile` at `/circuit/views/provider-profile` is the declared instance
(`view-runtime.js:20,48-50`). Its only mount point is the Explorer drill-down — there is no
standalone view page — and a provider glyph opens it directly (`view-runtime.js:14-15`;
`circuit-runtime.js:92-139`). The subject is chosen by the Explorer and bound into the declared
source inputs; a declaration names no concrete provider (`view-runtime.js:52-57`). The inspection
is read-only: instruction and engagement editors stage the exact change document for
`model.install_provider_details_change` and copy or download it; nothing applies in the browser
(`live-circuit/circuit/README.md:149-153`).

### 3.3 Flywheel rule

Because contracts live in the estate and packages only implement them, **declaring a provider
grows declared surfaces without new hand-authored UI**: the same template, validator, projector
and adapters host every drill-down (`ui-circuit-blueprint-strategy.md:110-119,156-160`;
`view-runtime.js:1-19`). Provider inspection stays a reading, never a receipt
(`implementation-strategy.md:254,835-839`; `ui-circuit-blueprint-strategy.md:117-119`).

---

## 4. Conformance rules

### 4.1 The blueprint is the declared authority

1. Structure and meaning render only from the published blueprint; shell chrome keeps only chrome
   (`ui-circuit-blueprint-strategy.md:197-201`; `implementation-strategy.md:247,258-265`).
2. Screens and providers must not deviate: no second renderer, no fallback renderer, no
   page-local style forks, no host-JSON CMS, no invented copy or evidence
   (`ui-circuit-blueprint-strategy.md:31-41,195-220`; `implementation-strategy.md:303-316,998-1010`;
   `page-runtime.js:14-16,719-727`).
3. A provider implements a contract; it never defines meaning, and a render mints no run, claim or
   trust state (`ui-circuit-blueprint-strategy.md:156-160`;
   `implementation-strategy.md:835-839`).
4. One selection/traversal model decides state; the viewer only draws
   (`live-circuit/circuit/README.md:284-310`; `explorer.js:89-107`).
5. Drill-downs follow returned typed targets; ordinary navigation resolves the current published
   pointer and carries no destination digest (`ui-circuit-blueprint-strategy.md:105-108`;
   `implementation-strategy.md:370-378`).

### 4.2 Named failures only

Every refusal is a named, visible state — never blank, never silent, never a fallback — and joins
the existing 404/409/422 vocabulary (`ui-circuit-blueprint-strategy.md:203-207`;
`implementation-strategy.md:562-603`). The landing's refusal set is §2.8. Unknown
kind/role/action/source refuses visibly; validation runs before render, server and client
(`implementation-strategy.md:303-316,584-603`; `page-runtime.js:177-258,688-731`).

### 4.3 Trust and dispatch

Action dispatch never widens authority: **no action kind may invent a route, a method, a header or
a credential**; the browser's only writes are session and observe/objective
(`implementation-strategy.md:347-357`). The trust boundary is unchanged: the shell keeps the
projector, validator, routing and security seams; the browser never holds the SDA token
(`ui-circuit-blueprint-strategy.md:152-160`; `implementation-strategy.md:821-822`;
`live-circuit/circuit/README.md:226-233`).

### 4.4 Evidence and drift

A page view or provider drill-down is a reading, not an execution receipt
(`implementation-strategy.md:256`; `ui-circuit-blueprint-strategy.md:117-119`). Acceptance is
click-path and screenshot based with real captures; source checks are not DOM proof
(`ui-circuit-blueprint-strategy.md:208-214`). Drift is detected and recorded as a finding against
this blueprint, closed only by a declared publication — never by tolerating a second authority
(`ui-circuit-blueprint-strategy.md:215-220`). The finish line is code-mass leaving this
repository: each shipped artefact replaced by its provider package, the shell retaining only
projector/validator/routing/security functions (`ui-circuit-blueprint-strategy.md:188-193`).

---

## 5. Status and sequencing

- The blueprint and its region providers are `[proposal]`; no declaration, provider identity or
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
