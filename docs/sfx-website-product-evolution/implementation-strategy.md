# Declarative UI circuits: implementation strategy

Prepared 2026-10-07. Status: **draft, not started.** Revision 4.
**Revision 1 (2026-10-07): first strategy revision; consolidates `intent.md`, `research-brief.md`
and the five lane analyses in [`analysis/`](analysis/) into one implementation-grade plan.**
**Revision 2 (2026-10-07): applies every correction C1–C19 from the adversarial review
([`analysis/06-review.md`](analysis/06-review.md)); see the revision history at the end.**
**Revision 3 (2026-10-07): applies the user review corrections C20–C27 and records the decisions
(G1/G4/G6, gates G8/G9) from [`review.md`](review.md); see the revision history at the end.**
**Revision 4 (2026-10-08): withdraws the G2 SDA change request as premature; its scope is derived
from blueprint evidence, not prespecified. See §7.5, G2 and the revision history at the end.**

**How this strategy relates.** [`intent.md`](intent.md) repositions the website around one argument
— intelligence may propose, capabilities authorize, effects are evidenced — and proposes a
nine-area top-level IA (`intent.md:970-1044`); [`research-brief.md`](research-brief.md:9-12)
frames the repositioning as six positioning stories.
[`research-brief.md`](research-brief.md) frames the hypothesis: each page is a declared circuit of
capabilities; a page capability leverages a layout capability as a provider; sections group
capabilities that drive display, data, actions and events; a reusable UI capability provider stack
lives in `sfx-providers/providers/`. The five lane documents in [`analysis/`](analysis/) are
read-only design. This document reconciles them and turns them into the v1 model, work items,
gates and rollout. It mirrors the house format of
[`../sfx-flight-recording/implementation-plan.md`](../sfx-flight-recording/implementation-plan.md):
honest status, staged phases, decision gates, retained receipts.

Everything marked `[proposal]` is design, not observable behaviour. Claims about current behaviour
cite `file:line`. Platform rules cite [`AGENTS.md`](../../AGENTS.md): SDA behaviour changes only by
request to `scenario-driven-architecture`; capability meaning only through `sfx-embody` migration
pairs; identity schema only through `sfx-dal` migrations and DAL regeneration.

**How to review.**

1. Confirm the resolved decisions in §4.0 (D1–D8); they answer the seven open questions.
2. Answer the decision gates in §11.4 (G1–G7). G1, G2, G4 and G6 change scope; the rest are
   recommendations on the record.
3. Check the v1 model (§4) and declaration anatomy (§5) before any implementation starts.
4. Lane reconciliation and the code spot-checks that resolve lane disagreements are in Appendix A.

**Contents.** 1 Status and scope · 2 Problem and evidence · 3 North-star model · 4 v1 model ·
5 Declaration anatomy · 6 Runtime and serving · 7 Estate and platform work ·
8 Security, authority and honesty · 9 Acceptance and verification · 10 Staged rollout ·
11 Risks, anti-patterns and decision gates · A Lane reconciliation and spot-checks ·
B Component registry and action taxonomy.

---

## 1. Status and scope

### 1.1 Outcome (proposed)

Page structure, section composition, copy and media become versioned estate declarations read at
runtime. A UI or content change is a **data publication with its own gate**, not a staging release.
The deployed shell keeps only what must be trusted before a request is served:

- the gateway, observer and SDA API hosts (`deploy/sda-kernel/**`,
  `live-circuit/dispatch-pair/observe-server.mjs`);
- the client page runtime and component adapter registry (`live-circuit/circuit/**` — new modules);
- the declaration schema and validator, the component/action/source allowlists;
- security and retrieval policy (`identity-policy.json`, `retrieval-policy.json`,
  `circuit-host.json` trust members);
- the design-token stylesheet (`live-circuit/circuit/site.css`).

Everything a visitor reads **below the shell chrome** — page list, layout, sections, copy, links,
component entries, action and event bindings, declared navigation, media references — is a
digest-referenced declaration. Header/footer chrome and the identity area stay shell (D6). Media
in v1 is restricted to assets already in the `CIRCUIT_FILES` allowlist; serving newly published
media is a class (a) deploy (§4.6, C5).

### 1.2 In scope

- The v1 declarative UI circuit document and the declared estate reader that returns it (§4, §5).
- The component registry boundary: declared semantic contracts plus shipped adapters with explicit
  refusals (§4.3).
- The action and event descriptor taxonomy mapped onto existing authority seams (§4.4).
- Change classes and the data-only publication gate that replaces the full staging pipeline for
  content changes (§4.6, §9).
- The first shallow cut: home conversion (§10 Phase 0), a second real page (§10 Phase 1), and the
  nine-area IA (`intent.md:970-1044`) as one renderer with declared routes (§10 Phase 2).

### 1.3 Not in scope

- Converting the Explorer or login deep runtime. The Explorer already consumes declared database
  reads and is the deepest page (`analysis/02-rendering-inventory.md:439-441`); its acceptance pins
  stay untouched in v1. One dependency this creates: the Explorer uses the `home` host block as
  its no-query default selection and environment label (`explorer.js:332,338-340`), so `home.hero`
  and `GET /api/circuit/v1/home` remain host route/trust data; only `home.featured` moves to
  declaration authority (C1).
- A browser CMS or any new browser write path. Authoring stays on the estate's governed publish
  path; runtime authoring is blocked on per-user authority that does not exist
  (`docs/live-circuit-browser-session.md:63-70`).
- SDA changes for the full capability/provider north star. Those are filed as one change request
  (gate G2), not performed here.
- New trust, run or evidence semantics. A page view is a reading, not an execution (§8.3).
- Media CDN, production rollout, SEO/top-level routing. Top-level paths are gate G3.

### 1.4 Honest limits of this draft

- No page declaration, page reader, UI component contract or browser binding target exists today.
  Appendix A records what was verified and what is proposed.
- The north-star model (page capability → layout capability as provider → section capabilities →
  UI providers) is only partially achievable on today's runtime; §3 states exactly which row is
  v1 data and which row requires the SDA change request.
- Cost, latency and cache behaviour of page reads are unmeasured until Phase 0; §6 states the
  measurement work.

---

## Phase 0 status (2026-10-07)

Phase 0 has started after the Revision 3 entry decisions (G1, G4, G6). This is a status record, not
a change to the phase deliverables or exit criteria in §10.

**Work landed.**

- **P0.1 — `sfx-embody` `5c4b3b4`, "Declare the UI page reading and its publication mechanics":**
  the `sidefx_ui` declaration content, the `read-ui-page` kernel reader, the CAS
  `stage_ui_page`/`promote_ui_page`/`rollback_ui_page` procedures (a stale promote is refused
  in-transaction as `UI_PAGE_POINTER_MOVED`, `declare-ui-page-reading.commit.sql:639-662`) and the
  `tools/publish-ui-page.mjs` orchestrator.
- **P0.2–P0.4 — `sfx-platform` `a75ea60`, "Serve declared UI pages from the estate":** the
  `readers.page` host reader, `page-runtime.js`, `ui-components.js`, `page.html`/`page.js`, the
  generic `/circuit/<slug>` route host, the home conversion, the page fixtures and
  `verify-pages.mjs`. `bcf1e52`, "Render the declared component contract roles", corrects the
  adapters to the `ui-component.v1` role vocabulary.
- **Receipt commits.** `cfc4341` records the first data-only home publication; `9139d23` records
  the declared page read latency receipt.
- **Staging.** Run `37678767890` is green for `composite-a75ea60168cd-37678767890-1` (head
  `a75ea60`); run `37686014991` is green for the role-vocabulary fix (head `bcf1e52`). Both run
  `verify-pages.mjs --fixtures` in checks; the public acceptance reads
  `/api/circuit/v1/page?path=/circuit/home` and `/api/circuit/v1/ui-registry` and exercises the
  page 404/409/400 refusals (`deploy/staging/accept.mjs`).

**Acceptance gates (§9.2).**

| Gate | Status | Evidence |
| --- | --- | --- |
| WP0.1 | Done | `evidence/WP0-publish-2026-10-07T200052.json`: revision 4 promoted, candidate and post-promotion reads at digest `b589288708f43051484b4375b340b5add0c54b430ea1751abeabee5f144d8cd8`; an earlier attempt refused `UI_PAGE_REVISION_EXISTS` (`…T200044.json`). |
| WP0.2 | Done | Named refusals exercised by `verify-pages.mjs --fixtures` over `fixtures/pages/unknown-component.json` and `unknown-action.json` (`422 UI_DECLARATION_INVALID`, no sections served); green in both staging runs. |
| WP0.3 | Done | Digest pin/mismatch/malformed groups (200/409/400) in `verify-pages.mjs --fixtures`; staged public acceptance asserts `PAGE_SNAPSHOT_CHANGED` 409 and malformed-digest 400 on `/api/circuit/v1/page`; degraded fallback exercised by `fixtures/pages/degraded.json`. |
| WP0.4 | Done | `evidence/WP0-publish-rev2.json` (clean promote) and `evidence/WP0-publish-rev3.json` (post-verify failure → automatic CAS rollback to revision 2, `UI_PAGE_POST_VERIFY_FAILED_DRILL`); the stale-promote CAS refusal is proved in-transaction by the migration pair (`declare-ui-page-reading.commit.sql:639-662`). |
| WP0.5 | Done | `evidence/WP0-latency-2026-10-07.json`: revision 4, cold 1,128–1,378 ms, warm 40–50 ms, inside the declared budget. |
| WP0.6 | **Pending** | Signed-in home was not captured: `capture.json` marks `home-signed-in-desktop`/`mobile` pending, reason `TEST_PRINCIPAL_CREDENTIALS_UNAVAILABLE`; the test-principal credentials are acquired only in CI through the workflow's OIDC identity (`deploy/staging/accept.mjs:1`). Plan: capture through the staging browser gate (`accept.mjs browser`). |
| WP0.7 | **Source-checked only** | `verify-pages.mjs --safety` checks `textContent`/`safeUrl` and the unsafe fixtures; its own limitation note says DOM execution proof needs the browser gate. The DOM proof is pending. |

**Visual review deck (U1).** `sfx-providers/outputs/capability-estate/live-circuit-platform-explorer/U1/declarative-ui-circuits-U1.pptx`
(with `sources/visual/capture.json` and its render PNGs) is built from real captures of the running
local host at revision 4 / digest `b5892887…d8cd8` — signed-out home (desktop and mobile) and
Explorer — and its annotation slides place the measured DOM rectangles of all ten declared
sections on the captures; `verify_deck.py` re-checks image hashes and rectangle geometry against
the capture (254 checks, 0 failures). This capture exposed the role-vocabulary defect (the adapters
used internal prop names instead of the `ui-component.v1` roles, so most home sections refused at
render); it is fixed in `bcf1e52` and redeployed in run `37686014991`. The deck's signed-in
captures remain pending with WP0.6.

**One shared database.** Local development (observer `8788` plus local API `8799` over the
installed `database-memory` kernel delivery, `SDA_ESTATE_DIR=sfx-embody`) and staging read one
estate database, so the `declare-ui-page-reading` pair is installed once: staging acceptance in
run `37678767890` read the published `/circuit/home` as `READ` with no staging-side install step,
and the U1 capture set shows the same revision 4 the local publisher wrote.

**Unconfirmed.** WP0.2 and WP0.3 have no standalone `evidence/WP0-<date>.json` receipts as the
§9.2 convention expects; their evidence is the green CI `verify-pages.mjs --fixtures` step and the
staged acceptance assertions. All other items above are supported by the cited commits, receipts,
runs or files.

---

## 2. Problem and evidence

### 2.1 Deploy-per-change

- Watched paths force a full release: `live-circuit/**`, `deploy/sda-kernel/**`,
  `deploy/staging/**`, `tools/live-circuit/**`, `tools/sfx-api/**`, `infra/azure.json`,
  `infra/authorize-staging-release.ps1`, the workflow itself
  (`.github/workflows/staging.yml:6-14`). Docs are outside.
- Measured releases (Oct 6–7 2026, lane 4): successes 12m43s–18m05s; failures 7m36s–14m37s plus a
  rollback (`analysis/04-serving-routing-deploy.md:393-398`). The brief's target is zero releases
  for UI/content change (`research-brief.md:18-22`).
- The failure class is real: a client module imported but not added to the static map made the
  Explorer fail to initialize and the browser acceptance time out; the fix commit is `586dafd` and
  public acceptance now pins `/circuit/pane-layout.js` 200 and removed modules 404
  (`deploy/staging/accept.mjs:47`; `analysis/04-serving-routing-deploy.md:91-104`).

### 2.2 Repetitive rendering code

Lane 2 documents the duplication cost (`analysis/02-rendering-inventory.md:240-269`): tables built
three ways (`explorer.js:212-217`, `provider-profile.js:54-56`, `run-context.js:126-128`);
key-value lists three ways; JSON folds four ways; four status-chip class families; header/footer
chrome and identity area copied across `home.html:55-61,111-118`, `login.html:40-46,90-97`,
`explorer.html:195-201`. The reusable shapes are already visible: `el()`/`svg()` factories
(`circuit-viewer.js:3-19`), `pane-layout.js:12-94`, `site.css` tokens (`site.css:4-12`), and the
declared presentation switch (`explorer.js:17-19,206-219`).

### 2.3 The home precedent

The only existing page declaration is the `home` block in host config
(`live-circuit/circuit/circuit-host.json:6`): hero capability/scenario plus a `featured` list with
editorial `title`/`body`/`promise`, served unchanged at `GET /api/circuit/v1/home`
(`observe-server.mjs:46-52,430-433`) and consumed by `home.js:83-96`. Its own `copyBasis` says the
featured list is "Host data until the list is declared as database authority (revamp P3)". Home
already reads everything it shows; it has no write path. It is the shallowest cut and the natural
first conversion (`analysis/02-rendering-inventory.md:420-445`).

One constraint C1 fixes: the same endpoint is the Explorer's fallback when the URL has no query
(`explorer.js:332,338-340` reads `/api/circuit/v1/home`, uses `environment` for the label and
opens `hero`), so retiring the whole block would change Explorer behaviour this strategy promises
not to touch. v1 therefore retires only `home.featured`; `home.hero` and the endpoint stay host
route/trust data until the Explorer fallback is migrated by a later class (a) deploy.

### 2.4 Target rule (preview of D6)

Deploy only what must be trusted before a request is served: shell, registry, validator, security
policy, retrieval policy, route host. Publish as data: page declarations, sections, component
entries, copy, and media references to allowlisted assets. The full staging acceptance and
rollback stay for the first list; a new data-only gate covers the second, with automatic pointer
rollback (§4.6).

---

## 3. North-star model

The hypothesis translated into the estate's own vocabulary (`analysis/03-ui-capability-providers.md:252-271`).
The status column is the honest split between v1 data and later SDA work.

| Hypothesis term | Estate / SDA vocabulary | v1 status | Later (gate G2) |
| --- | --- | --- | --- |
| page capability | capability + root terminal scenario + contracts + execution authority (`declare-scenario.sql:216-290`) | `read-ui-page` **reading** capability with one root terminal scenario, exactly like `read-capability-details` (`sfx-embody/sql/migrations/declare-live-scenario-circuit.commit.sql:785`); each page is a versioned declaration the reading returns | page declared as its own executed capability with a UI outcome contract and run testimony |
| layout capability "as provider" | capability with a UI port bound to `UiEmbodimentProvider` (`ADR-0007:17,40,48-57`; `ADR-0009:36-42`) | `ui-layout.v1` declaration referenced by digest; placement/regions are data | layout capability bound to a browser UI provider through an admitted port binding |
| section capabilities | `invoke-scenario` operations per section; multiple children declarable (`declare-scenario.sql:180-189`) | sections are entries in the page declaration with component, bindings, actions, events | section capabilities invoked by the layout scenario, outcomes composed into one page document |
| UI capability providers (`sfx-providers/providers/`) | provider packages with platform capability links (`declare-provider-identity.sql:143-159`) | semantic contracts in the estate; adapters shipped in the deployed shell | provider stack admitted in `sfx-providers/providers/`, executed by a browser binding target via `ui-embodiment-plan.v1` (`ui-embodiment-plan-v1.mjs:26-146`) |
| display/data/actions/events | section outcome contract members | declared members of the page document, executed by the shell only through existing seams | events resolve to operation ids / capability invocations in section authority |

**Honest note.** There is no UI capability kind, no browser binding target (targets resolve only
`node`, `python`, `csharp` — `bind-slot-provider.sql:10,30`), no demonstrated multi-child outcome
composition, and no UI event vocabulary in the kernel path
(`analysis/01-runtime-page-circuit.md:315-337`; `analysis/03-ui-capability-providers.md:539-580`).
v1 therefore implements the narrowest faithful mapping: **one declared reader capability returns a
composed page document; the shell renders it from declared component contracts.** The full north
star becomes an SDA change request once Phase 1 proves the model (§7.5).

---

## 4. v1 model that works with today's runtime

### 4.0 Resolved decisions

| # | Question | Decision | Why |
| --- | --- | --- | --- |
| D1 | Page declarations: estate capabilities/scenarios, a new declared reader, or host config? | **Estate data through a declared reader.** Page/layout/section/component definitions are admitted by `sfx-embody` migration pairs as versioned, digest-addressed rows; one new reading capability `read-ui-page` (like `read-capability-details`) returns the composed `ui-page.v1` document; `circuit-host.json` gains `readers.page`. Host config stays trust/route data: `home.hero` and `GET /api/circuit/v1/home` remain because the Explorer uses them for default selection and the environment label (`explorer.js:332,338-340`); only `home.featured` retires to declaration authority. Full page-as-executed-capability is deferred to G2. | Matches the proven reader pattern (`circuit-host.json:17-21`; `declare-live-scenario-circuit.commit.sql:785`); satisfies meaning-in-rows (`AGENTS.md`); makes publication data-only; avoids inventing page-run evidence. Reconciliation of lane 3's estate mapping with lane 4's reader is both, layered. |
| D2 | What runs where? | **Shell (deployed):** gateway/observer/API hosts, page runtime, adapter registry, validator, security/retrieval policy, host config, token CSS. **Estate (data):** page/layout/section/component definitions, copy, links, bindings, media references. Shell fetches only a fixed host-managed source registry (`catalog`, `scenario`, `details`, `provider-inspection`, `session`, `release`), each published with its route in the `ui-registry` manifest (§7.2). | The estate has no runtime (`sfx-embody/AGENTS.md:42-50`); the browser cannot be an estate provider yet; the shell is the browser analogue of ADR-0010's language kernels (`ADR-0010:21-31`). |
| D3 | Component registry | **Option C:** declared semantic contracts (`ui-component.v1`: kind, roles, props schema, states) in the estate + one shipped adapter registry keyed by kind. Unknown kind or unsupported role refuses visibly (`UI_COMPONENT_NOT_SUPPORTED`); never a silent drop, never a fallback renderer. | Lane 3's recommendation (`analysis/03-ui-capability-providers.md:389-407`); mirrors `ui-embodiment-plan-v1.mjs:15-24` and ADR-0007 `SUPPORTED`/`ADAPTED`/`NOT_SUPPORTED`; keeps meaning in rows and implementations replaceable. |
| D4 | Action and event taxonomy | **Twelve declared action kinds; three dispatch classes** (`local`, `read`, `session-post`). A dispatch class names the pre-existing browser seam an action may use; it is not authority — actual authority is resolved downstream by the capability system (C22). No new browser write path: the browser's only writes are `POST /api/circuit/v1/session[/logout]` and Observe/objective `POST /api/circuit/v1/runs`; the observer's `POST /events` and `/events/batch` are DA testimony ingestion, blocked publicly by the gateway 405 (`observe-server.mjs:463-466`; `gateway.mjs:162-164`; `accept.mjs:49`), not a browser route. Same-origin JSON + CSRF, `__Host-sfx-session`, idempotency unchanged. Events are declaration data over a fixed DOM event set; load events may only emit reads. | `run-api.mjs:23-24,62-68,50-52`; `identity-session.mjs:41-46`; `analysis/02-rendering-inventory.md:398-416`. |
| D5 | Change classes and target rule | **Deploy (a) shell/runtime, (b) policy/registry/schema/route host. Data (c) declarations/composition, (d) content/media.** Data publishes through a new gate: schema + contract-version + component/action/source allowlist + digest + asset checks, previous revision retained, publish receipt, visible degraded fallback, pointer rollback. | Watched-path economics (§2.1); lane 4's target rule (`analysis/04-serving-routing-deploy.md:153-168`); failures stay visible (`live-store.mjs:211-215`). |
| D6 | First shallow cut | **Home.** Keep `home.html` skeleton and its ids; `home.js` becomes a mount of the page runtime; main sections render from the declared page; header/footer/identity stay shell; signed-in copy is declared as state-scoped sections (§5.3, C9); circuit preview keeps its SVG digest check; post-conversion `home.featured` retires while `home.hero` stays host route data for the Explorer (C1). | Home is already fully read-driven with no write path and its structure is already host-declared (`circuit-host.json:6`; `home.js:83-96`); lane 2 nominates it (`analysis/02-rendering-inventory.md:420-445`). |
| D7 | Token source and one-workspace vs nine-area IA | **One web token source is `site.css` custom properties** (deployed shell); rename the accent to `--observation` with `--cyan` kept as a deprecated alias; ban page-local `<style>` blocks in new and converted pages only — the Explorer's existing blocks are untouched in v1 and migrating them is a separate deploy with its own acceptance note (C11). **One renderer, many declared routes:** the nine-area IA (`intent.md:970-1044`) is declared pages served by the same shell under `/circuit/<slug>`; no second renderer, no new workspace; top-level vanity paths are gate G3; navigation becomes declared data. | Deck `design_system.py` is a design artifact, not runtime (`analysis/05-prior-art-design-surface.md:15-16,142-159`); D4's "no second renderer" is learned cost (`revamp.md:449-451`); gateway already proxies `/circuit/*` (`gateway.mjs:140-163`). |
| D8 | Are page views executions? | **No.** A page render is a reading, not an execution receipt; no run, no claim, no trust state. The "reads are not receipts" rule extends to pages. | Provider inspection is explicitly a database read, not a receipt (`analysis/05-prior-art-design-surface.md:375-377`); observing stays the only browser-initiated execution. |

### 4.1 The declarative UI circuit document

The unit is a `ui-page.v1` document returned by the `read-ui-page` reading capability. It carries
the page identity, one layout reference, ordered sections, per-section component entries with
props, bindings, actions and events, and a page digest. The browser is a transport and a projector:
it fetches the document, resolves declared sources through existing GET reads, and renders with
adapters. It never names result sets, never synthesizes fields and never picks SQL
(`README.md:115-127`; `verify-explorer.mjs:33`).

### 4.2 Component taxonomy

Lane 2's taxonomy (`analysis/02-rendering-inventory.md:308-352`) is the source of truth. Phase 0
admits **only the component kinds the home declaration consumes** (used-by-Phase-0 rule, C26);
a kind with no declared use waits for the phase that uses it. The audited Phase 0 set and its
uses:

| Registry name | Purpose | Derived from |
| --- | --- | --- |
| `hero` | eyebrow/headline/lede/figure/primary action block | `home.html:67-69,76-80`; `home.js:24-27,93` |
| `section` | labelled region with heading/actions/body | `explorer.js:186-189` |
| `text` | eyebrow/display/lede/micro/section-title/paragraph/note | `site.css:52-56`; `explorer.js:21-23` |
| `heading` | level + chips/badges | `explorer.js:186-189` |
| `stat` | value/label/sub | `home.js:48-64` |
| `card` | title/body/promise/meta/link/missing | `home.js:66-81` |
| `card-list` | declared cards with optional catalog match | `home.js:66-81`; `circuit-host.json:6` |
| `list` | items with href/meta/badges/current | `home.js:38-45`; `run-context.js:53-54` |
| `media.figure` | svg/src/alt/caption/link/digest (digest-checked) | `site.js:38-62` |
| `notice` | info/error/warning/empty state | `explorer.js:23`; `run-context.js:9` |

Every kind above is consumed by the home body: `hero` (hero block), `section` (all sections),
`text` (copy roles), `heading`, `stat` (estate counts), `card`/`card-list` (featured circuits),
`list` (session runs and steps), `media.figure` (hero circuit preview), `notice` (failure and
empty states). The identity area remains shell chrome (D6), so `identity-session` is **not** a
Phase 0 kind; declared body sections render session values through `text`/`list` bindings to the
`session` source and `when` scoping. It is admitted only when a declared body section uses it
(C26).

Phase 1 adds the kinds its content actually needs: `table`, `field-list`, `disclosure`, `badge`,
`status-chip` (the data-bound Standards crosswalk, §10 Phase 1). `action-bar`, `tabs` and
`identity-session` wait until a page uses them. The Explorer's deep components (`circuit-scene`, `run-report`, `provider-profile`,
`objective-composer`, `timeline`) are **not declarable content components** in v1; they remain the
Explorer runtime. Each adapter accepts an explicit `id` prop and must reproduce contractual state
attributes (`aria-selected`, `aria-pressed`, `data-*`, `dataset.replayPosition`) when it renders a
migrated target (`circuit-runtime.js:3-5`; `circuit-viewer.js:160-170`).

### 4.3 Component registry boundary (concrete)

- **Declared side (estate).** `ui-component.v1` contracts: kind, version, roles, props schema
  (type/required), states. Stored as content-addressed definitions through the migration pair.
- **Shipped side (shell).** `ui-components.js` exports a registry map `kind → { version,
  render(node, entry, context), supportedRoles }`. An adapter declares which roles it supports.
- **Refusals.** Unknown kind: `UI_COMPONENT_NOT_SUPPORTED`. Known kind with a role/prop outside its
  schema: `UI_COMPONENT_ROLE_UNSUPPORTED` for that section. Both render a named notice in place of
  the section; the rest of the page still renders. Never drop a section silently.
- **Boundary rule.** A new component kind requires a shell deploy and an acceptance route: the
  deployed allowlist in `ui.components` and the `ui-registry` manifest change together (class (b)),
  so validate-then-refuse stays honest. A new **instance** of a deployed kind (copy, sections,
  pages) requires no deploy once the route host, modules and registry have shipped (class (a)/(b),
  C18).
- **North star.** The same adapters become provider packages in `sfx-providers/providers/` when a
  browser binding target exists; the semantic contracts do not move. G2.

### 4.4 Actions and events

The twelve kinds from lane 2 (`analysis/02-rendering-inventory.md:398-416`) mapped onto the
existing seams. Only `session` and `observe`/`objective` reach the server, and they use the routes
that already exist. `dispatchClass` names which pre-existing browser seam the action may dispatch
through; it is not authority — actual authority is resolved downstream by the capability system
(C22).

| Kind | Dispatch class | Existing seam |
| --- | --- | --- |
| `navigate` | local | `syncUrl`/`history` (`explorer.js:36-42`); same-origin links |
| `select` | local | `selectNode/selectRow/selectComponent`, `selectSlide/selectTarget` (`explorer.js:89-107`; `circuit-runtime.js:108-117`) |
| `session` (sign-in/sign-out/continue) | session-post | `POST /api/circuit/v1/session`, `POST /api/circuit/v1/session/logout` |
| `observe` | session-post | `POST /api/circuit/v1/runs` `{object,operation:'observe',subject,namespace,input}` (`run-api.mjs:62-68`) |
| `objective` | session-post | same POST; fixed capability `request-capability-from-objective-v3` (`objective-run.js:14-25`) |
| `playback` | local | `PlaybackClock` + run controls (`circuit-runtime.js:389-393`) |
| `view` | local | linear/paged/zoom local state (`circuit-runtime.js:394-398`) |
| `toggle` | local | follow/overlay (`circuit-runtime.js:387-388`); runs-all (`run-context.js:52,58`) |
| `pane` | local | `pane-layout.js:43-52` |
| `copy`/`download` | local | client document only (`run-context.js:80-90`) |
| `stage-change` | local | stages a document only; never writes (`provider-profile.js:8-10,70-72`) |
| `refresh` | read | existing GET reads with `refresh=1` (`live-store.mjs:286`) |

Events are `{ on: 'load'|'click'|'submit'|'change'|'select'|'seek'|'toggle', target?, actionId }`
embedded in a section. An event carries no free-form payload; it selects a resolution scope
(`event`, `form`, `row`) that action bindings may read (C7).

**Action input binding (C7).** An action's `input` members are bindings over a closed scope
vocabulary: `{ "literal": … }`, `{ "route": "<param>" }`, `{ "event": "value" }`,
`{ "form": "<name>" }`, `{ "row": "<field>" }`, `{ "source": "<sourceId>", "pointer": "/…" }`.
Admitted input shapes per kind: `observe` → `{ subject, namespace, input }`; `objective` →
`{ objective }`; `session` → `{ intent: 'sign-in'|'sign-out'|'continue', return? }`; all other
kinds are local and binding-free in v1. A binding that cannot resolve at dispatch time renders
`UI_ACTION_BINDING_UNRESOLVED` and does not dispatch; a binding naming an undeclared scope is
refused during declaration validation. The action adapter for `observe`/`objective` reuses the
existing session gate, same-origin JSON check, body caps and idempotency key; a declaration can
parameterize subject/input only within the admitted shape. **No action kind may invent a route, a
method, a header or a credential.**

### 4.5 Routing and the generic page host

- v1 pages live under `/circuit/<slug>` (reserved: `login`, `home`, `explorer`, and every existing
  asset/module name). The gateway already proxies `/circuit/*` and `/api/circuit/*`
  (`gateway.mjs:140-163`), so no gateway change is needed.
- Add one deployed route host in the observer: exact matches resolve first (existing map), then
  `/circuit/<slug>` (regex `^[a-z][a-z0-9-]*$`) serves `page.html` + `page.js`, the generic
  declared-page skeleton. `page.html`, `page.js`, `page-runtime.js` and `ui-components.js` are
  `CIRCUIT_FILES` entries and acceptance pins like every other client module (C18;
  `observe-server.mjs:14-45`; `accept.mjs:47`). The page runtime reads `location.pathname` and
  requests `GET /api/circuit/v1/page?path=…`.
- **Digest supply (C6) and navigation (C27).** First load, deep links, reloads and popstate arrive
  without a digest and omit `expectedPageDigest`; the served `pageDigest` is bound for subsequent
  reads of that page (refresh, source re-reads, popstate within the page). Ordinary declared
  navigation links resolve the **current published pointer** and carry no destination digest;
  destination digest pinning is reserved for intentional snapshot links (historical evidence, a
  publication receipt, a specific article revision, an audit/replay view). This preserves
  independent page publication: publishing one page never forces a navigation republication.
  `409 PAGE_SNAPSHOT_CHANGED` is reached when a bound digest or a snapshot link's pinned digest
  no longer matches at the next read (e.g. after a publish).
- `page.html` is shell chrome (header/footer/nav mount/identity mount) plus `#page-root`; it does
  not contain page copy. Declared navigation renders into the nav mount from a navigation
  declaration; links name their destination page (`analysis/05-prior-art-design-surface.md:418-420`).
- Because the route host matches dynamically, adding a declared page whose sections use deployed
  kinds needs **no deploy for the page instance** — after the route host, modules and registry
  have shipped (class (a)/(b)); a page that names a new kind needs the class (b) registry deploy
  (C18). Deep links and back/forward work per page via the query/`popstate` pattern already
  proven for the Explorer (`explorer.js:312-330`).

### 4.6 Change classes and the data-only publication gate

| Class | Examples | Who ships it | Gate |
| --- | --- | --- | --- |
| (a) shell/runtime | gateway, observer, `page.js`, `page-runtime.js`, `ui-components.js`, `site.css` | composite image on watched paths | full staging acceptance + rollback (unchanged) |
| (b) policy/registry/schema/route host | `circuit-host.json` readers/trust, validator, registry, gateway rules | composite image | full staging acceptance |
| (c) declarations/composition | page/layout/section/component definitions, bindings, actions, events | estate publication: the publisher/orchestrator `publish-ui-page` (governed workflow, C20) calls SQL mechanics `stage_ui_page`/`promote_ui_page`/`rollback_ui_page`; no DAL, no service release (§7.1) | **new data-only gate** (§9.2) |
| (d) content/media | copy, links, digest references to allowlisted assets; new media files | copy/links: estate publication. New media: class (a) media route deploy (C5) | data gate for copy/links; class (a) for new media |

The gate, in order (C4, C8, C20, C23): (1) the **publisher/orchestrator** `publish-ui-page`
(a governed workflow/capability, not a database procedure) fetches the deployed `ui-registry`
manifest (`GET /api/circuit/v1/ui-registry` `[proposal]`, schema in §7.2); (2) it validates the
candidate revision against the manifest — contract id/version, JSON schema, unknown
component/action/source refusal, digest recompute, referenced asset allowlist and digests;
(3) it calls `stage_ui_page`, which validates persistence invariants and appends the candidate
**without moving the pointer**; (4) it reads the candidate (`revision=N`) and runs `verify-pages`;
(5) only on a pass it calls `promote_ui_page(candidateRevision, expectedCurrentRevision)`, a
conditional pointer move that retains the prior revision; (6) it verifies again post-promotion
and either records a publish receipt or calls
`rollback_ui_page(fromRevision, toRevision, expectedCurrentRevision)` and records the refusal if
the pointer moved under it. The SQL procedures own bounded durable mechanics only — persistence
invariants, append, conditional pointer move, conditional rollback and publication facts — never
registry fetch, HTTP rendering or `verify-pages`. Ownership: the estate publication owner runs
`publish-ui-page` and its automatic rollback; the platform on-call owns registry/shell mismatches.

**Pointer CAS law (C23).** The pointer is compare-and-swap, never blind overwrite. Publisher A
holds current `10` and stages `11`; publisher B holds current `10` and stages `12`. A promotes
`11`, B promotes `12`, A's post-check fails, and A's rollback refuses because
`expectedCurrentRevision = 11` no longer holds — B's publication survives. The law:
**"Evidence that an earlier state existed does not grant authority to overwrite the current
state."** A rollback whose expected current no longer holds refuses and records the refusal; it
never overwrites another publisher's promotion.

**What still costs a deploy (C2).** One-time install: the declaration migration pair (installed
through the SDA-checkout lifecycle, `sfx-embody/AGENTS.md:66-90`), plus the class (a)/(b) shell
deploy that ships `readers.page`, the route host, the registry/manifest route and the adapters,
with the full staging acceptance. Recurring: a new component kind, a new media route, a token
change or any SDA change (G2). Per publish: one `publish-ui-page` run (stage → candidate verify →
promote → post-verify) and its `verify-pages` invocations; no release, no migration pair, no
`sfx-dal` regeneration and no service release on this path.

---

## 5. Declaration anatomy

All documents below are `[proposal]`; ids use the existing contract style
(`live-scenario-circuit.v1`, `capability-details.v1`). Digests are SHA-256 lowercase hex, matching
`expectedSnapshotDigest` (`live-store.mjs:199`).

### 5.1 Page definition (authored, stored versioned)

```json
{
  "document": "ui-page-definition.v1",
  "pageId": "ui-page-home",
  "namespaceId": "sidefx:ui",
  "path": "/circuit/home",
  "revision": 3,
  "title": "SFX Live Circuit Platform",
  "layoutRef": { "layoutId": "ui-layout-marketing.v1", "digest": "sha256:<64 hex>" },
  "sources": [
    { "sourceId": "catalog", "reader": "catalog" },
    { "sourceId": "session", "reader": "session" },
    { "sourceId": "release", "reader": "release" }
  ],
  "sections": [ "<see 5.3>" ],
  "failure": {
    "readFailed": "This page could not be read. The reading failed; no section is silently omitted.",
    "unknownComponent": "This page declares a component the deployed shell does not support."
  },
  "publishedAt": "2026-10-07T00:00:00.000Z",
  "digest": "sha256:<64 hex>"
}
```

### 5.2 Layout declaration

```json
{
  "document": "ui-layout.v1",
  "layoutId": "ui-layout-marketing.v1",
  "regions": [
    { "regionId": "main", "order": 1, "placement": "body", "width": "wide" }
  ],
  "policy": { "stack": "column", "density": "comfortable", "tokenSet": "site.v1" },
  "honesty": "Layout decides placement and disclosure only; status and meaning are rendered, never recomputed."
}
```

The last line carries the foundation's rule (`build_master.py:30-34`). Layout policy is declared
intent, never a CSS class list or framework name (`ui-authority-and-parity.md:39-48`).

### 5.3 Section entry

```json
{
  "sectionId": "home-hero",
  "regionId": "main",
  "order": 1,
  "component": { "kind": "hero", "version": 1, "contractDigest": "sha256:<64 hex>" },
  "props": {
    "eyebrow": "Your Live Circuit workspace",
    "headline": "Follow a declared circuit from intent to effect",
    "lede": "Choose a capability and follow its execution.",
    "primaryActionId": "open-explorer"
  },
  "bindings": {
    "figure": { "kind": "read", "reader": "scenario",
      "input": { "capabilityId": "authenticate-ide-user", "namespaceId": "sidefx:capabilities", "page": "scenario-1" },
      "pointer": "/slides/0" }
  },
  "actions": [
    { "actionId": "open-explorer", "kind": "navigate", "to": "/circuit/explorer" }
  ]
}
```

The hero's figure is resolved by its declared `read` binding; no `load` event is needed, and a
`load` event is declared only when it names an action that exists (C21).

Binding kinds are a closed set: `literal` (value in declaration), `read` (named host reader +
JSON pointer), `session`, `release`, `route`. A declaration naming a reader outside the host
registry is refused (`UI_SOURCE_NOT_SUPPORTED`). These are **data** bindings for a component's
props; action input bindings use the separate scope vocabulary in §4.4.

**State-scoped sections (C9).** A section may declare
`when: { "session": "signed-in" | "signed-out" | "any" }`; the runtime renders the first variant
whose condition matches and falls back to `any`. This is how the home signed-in copy swap
(`home.js:23-28`) becomes declaration data instead of a shell branch. The vocabulary is closed;
an unknown condition refuses at validation.

### 5.4 Component contract (authored, estate)

```json
{
  "document": "ui-component.v1",
  "kind": "hero",
  "version": 1,
  "roles": ["eyebrow", "headline", "lede", "figure", "primaryActionId"],
  "props": {
    "eyebrow": { "type": "text", "required": false },
    "headline": { "type": "text", "required": true },
    "lede": { "type": "text", "required": false },
    "figure": { "type": "media.figure", "required": false },
    "primaryActionId": { "type": "action-ref", "required": true }
  },
  "states": ["ready", "empty", "error", "not-supported"]
}
```

### 5.5 Action descriptor

```json
{ "actionId": "observe-subject", "kind": "observe", "dispatchClass": "session-post",
  "input": {
    "subject": { "row": "capabilityId" },
    "namespace": "sidefx:capabilities",
    "input": { "form": "observe-form" }
  } }
```

Bindings resolve against the scopes in §4.4 (C7). The declared `dispatchClass` must match the
kind's fixed class in §4.4; a mismatch refuses at validation time, not at click time.
`dispatchClass` describes the browser seam only and never grants authority (C22). A bound scope
that is undeclared refuses at validation; one that cannot resolve at dispatch refuses visibly
(`UI_ACTION_BINDING_UNRESOLVED`) and the action does not dispatch.

### 5.6 Event declaration

```json
{ "on": "submit", "target": "observe-form", "actionId": "observe-subject" }
```

The event names only a target and an action; values reach the action through its bindings
(`form.*` for this submit). An event naming an undeclared action refuses at validation.

### 5.7 Served document, digests and versioning

`GET /api/circuit/v1/page?path=/circuit/home[&expectedPageDigest=…]` `[proposal]` — the digest is
optional on first load and bound thereafter (§4.5, C6).

```json
{
  "contractId": "ui-page.v1",
  "status": "READ",
  "path": "/circuit/home",
  "pageId": "ui-page-home",
  "revision": 3,
  "pageDigest": "sha256:<64 hex>",
  "layout": { "layoutId": "ui-layout-marketing.v1", "digest": "sha256:<64 hex>", "regions": ["<…>"] },
  "sections": [ "<validated against the deployed registry>" ],
  "readingDefinitionSha256": "<64 hex>",
  "readAt": "2026-10-07T00:00:00.000Z"
}
```

Rules:

- `pageDigest` is computed over the canonical declaration (revision + section/component digests);
  it is the cache key and the publish rollback pointer.
- First load omits `expectedPageDigest`; the served `pageDigest` is bound for subsequent reads of
  the same page. Ordinary navigation resolves the current published pointer; only intentional
  snapshot links (historical evidence, a publication receipt, a specific article revision, an
  audit/replay view) carry a destination digest (§4.5, C6, C27). A bound or pinned digest that
  no longer matches at the next read is `409 PAGE_SNAPSHOT_CHANGED`, mapped like the existing
  `*_SNAPSHOT_CHANGED` refusals (`live-store.mjs:37,149`; `accept.mjs:97-98`). A malformed digest
  value is `400` (`live-store.mjs:199`).
- A declaration that fails schema, contract-version or allowlist validation is
  `422 UI_DECLARATION_INVALID`, joining the existing 404/409/422 refusal vocabulary
  (`README.md:48-52`; C15).
- Unknown path is `404 PAGE_NOT_FOUND`; a page with no published revision is
  `404 PAGE_NOT_DECLARED`.
- A current revision that fails read-time registry validation falls back to the prior valid
  revision and returns `status: DEGRADED` with
  `degraded: { reason, requestedRevision, servedRevision }`; a visible notice renders. If no valid
  revision exists, the named failure state renders. Never a blank shell.

---

## 6. Runtime and serving

### 6.1 Loader sequence (per declared page)

1. `page.js` parses `location.pathname` (and the declared route), then
   `GET /api/circuit/v1/page?path=…` with session credentials (`same-origin`, cookies). First
   load carries no digest; the returned `pageDigest` is bound for subsequent reads (C6).
2. Registry validation runs server-side (component kinds/actions/sources vs the `ui-registry`
   manifest) and client-side before render; a mismatch is a named refusal (`422`).
3. The runtime resolves the declared `sources` in parallel, deduplicated per page (`catalog`,
   `session`, `release`, `scenario`, `details`, `provider-inspection` only), each through the
   route published for it in the manifest.
4. For each section, the runtime selects the first matching `when` variant (session state), then
   adapters render in region/order; every section gets its declared `id`; missing data renders
   `empty-state`, never nothing.
5. Event bindings attach after render; `load` actions fire once; action bindings resolve against
   the scopes in §4.4.

Session-specific content is never inside the cached page read: the page document is public and
cacheable; the shell binds `session`/`release` sources after fetch.

### 6.2 Caching

The page read uses the existing read machinery: queue, timeout, size cap, LRU (24 entries, 32 MiB,
30 s TTL) and strong ETag/304 (`live-store.mjs:117-187,283-301`; `circuit-host.json:7-11`).
Key the read by `(path, revision)`; the digest is the invalidation signal; `refresh=1` bypasses
for operators; errors and degradations are `no-store`. Sources keep their own ETags; the shell
serves one composed page from separately cached reads. Multi-instance invalidation is its own
later gate, **G8 (page cache publication consistency)**; it does not block Phase 0 on one
effective serving instance (C24).

### 6.3 Read budget

`maximumConcurrentReads: 2`, `maximumQueuedReads: 32`, 30 s timeout, 16 MiB response
(`circuit-host.json:7-10`; `live-store.mjs:22-25`). v1 sends **one** kernel invoke per page read;
per-section kernel invokes are the north star, not v1. A page declares at most 8 sources
`[proposal]`; the shell dedupes and enforces the cap. Uncached kernel reads took 3.9–5.0 s;
measure page reads in Phase 0 (gate WP0.5) before scaling.

### 6.4 Failure display and local development

- Failures are content, never empty (`live-store.mjs:211-215`; `home.js:94-96`). Page failures
  render the named refusal and keep the shell chrome; degraded reads render the served revision
  with the reason visible.
- Local dev stays dependency-free: add a file-backed page source (fixture directory) to the
  observer behind an env flag, so a declaration can be exercised with
  `node verify-pages.mjs <base>` before publication, mirroring the `SDA_ESTATE_DIR` pattern
  (`live-store.mjs:13`). No build step (`AGENTS.md`).
- Every new client module — `page.html`, `page.js`, `page-runtime.js`, `ui-components.js` — must be
  added to `CIRCUIT_FILES` (`observe-server.mjs:14-45`) and to the staging acceptance routes, or
  the deploy rolls back (`research-brief.md:86-90`). The `page.js` dot means it cannot match the
  route-host slug regex: it is served as a map entry, never as a page (C18).

---

## 7. Estate and platform work

### 7.1 `sfx-embody` migration pair (declarations and reader)

One pair (preflight ending `ROLLBACK`, commit twin ending `COMMIT`, in-transaction proof —
`sfx-embody/AGENTS.md:25-30`) declares:

- contracts `ui-page-definition.v1`, `ui-layout.v1`, `ui-component.v1`, `ui-page-request.v1`,
  `ui-page.v1` through the document surface (`declare-json-authoring-surface.sql:55-80`);
- content schema `[proposal] sidefx_ui`: `page_definition` (page id, revision, document JSON,
  digest, published_at, published_by), `current_page` (pointer), and append-only publication audit;
  layout/component definitions are content-addressed rows referenced by digest;
- the `read-ui-page` capability, declared through `model.declare_capability_document` exactly like
  `read-live-scenario-circuit` (`declare-live-scenario-circuit.commit.sql:785`): one root terminal
  scenario, `ui-page-request.v1`/`ui-page.v1`, request `{ path, revision?, expectedPageDigest? }`;
- SQL candidate mechanics `[proposal]`, each bounded and durable: `stage_ui_page` (validate
  persistence invariants, append the candidate revision, record staging facts; never touches the
  pointer), `promote_ui_page(candidateRevision, expectedCurrentRevision)` (conditional pointer
  move and publication facts) and `rollback_ui_page(fromRevision, toRevision,
  expectedCurrentRevision)` (conditional rollback; refuses when the expected current no longer
  holds). The pair installs these procedures once; they do **not** own registry fetch, HTTP
  rendering or `verify-pages` (C20, C23).
- the **publisher/orchestrator** `[proposal]`: the governed workflow/capability `publish-ui-page`,
  run by the estate publication owner. It fetches the deployed registry, validates the candidate,
  calls `stage_ui_page`, reads the candidate, runs `verify-pages`, calls `promote_ui_page`, verifies
  again and decides publication receipt versus `rollback_ui_page` (C20). It is not a database
  procedure, not a browser route and not a `sfx-dal` surface; each publish is one workflow run, not
  a migration-pair lifecycle event.

The kernel-invoked reader and its admission follow `read-capability-details`; no `sfx-dal`
registration, regeneration or service release is needed on this path (§7.4). The first content is
the home page declaration and its layout/component contracts.

### 7.2 `circuit-host.json` reader declaration

```json
"ui": {
  "components": [
    { "kind": "hero", "version": 1 },
    { "kind": "section", "version": 1 },
    { "kind": "text", "version": 1 },
    { "kind": "heading", "version": 1 },
    { "kind": "stat", "version": 1 },
    { "kind": "card", "version": 1 },
    { "kind": "card-list", "version": 1 },
    { "kind": "list", "version": 1 },
    { "kind": "media.figure", "version": 1 },
    { "kind": "notice", "version": 1 }
  ],
  "maximumSources": 8
},
"readers": {
  "page": { "operation": "invoke",
    "request": { "object": "capability", "verb": "invoke", "subject": "read-ui-page" },
    "inputContractId": "ui-page-request.v1", "outputContractId": "ui-page.v1" }
}
```

`ui.components` is the deployed allowlist used by the validator and the manifest. `hero` is in it
because the Phase 0 home example uses it (C3); a declaration may never use a kind not listed here.
Every kind listed is consumed by the Phase 0 home declaration (used-by-Phase-0 rule, C26);
`identity-session` is shell chrome, not a Phase 0 kind.

**`ui-registry` manifest (`GET /api/circuit/v1/ui-registry`, `[proposal]`, C8).** The manifest is
the machine-readable view of the deployed shell that the client validator and the publish gate
consume:

```json
{
  "contractId": "ui-registry.v1",
  "shell": { "routeHostVersion": "1",
    "pageContractVersions": ["ui-page.v1","ui-page-definition.v1","ui-layout.v1","ui-component.v1"] },
  "components": [ { "kind": "hero", "version": 1, "contractDigest": "sha256:…",
    "roles": ["…"], "states": ["…"] } ],
  "actions": [ { "kind": "observe", "dispatchClass": "session-post",
    "inputs": ["subject","namespace","input"] } ],
  "sources": [
    { "sourceId": "catalog", "reader": "catalog", "route": "/api/circuit/v1/capabilities" },
    { "sourceId": "scenario", "reader": "scenario", "route": "/api/circuit/v1/scenario" },
    { "sourceId": "details", "reader": "details", "route": "/api/circuit/v1/capability-details" },
    { "sourceId": "provider-inspection", "reader": "provider-inspection", "route": "/api/circuit/v1/provider-inspection" },
    { "sourceId": "session", "reader": "session", "route": "/api/circuit/v1/session" },
    { "sourceId": "release", "reader": "release", "route": "/healthz" }
  ],
  "limits": { "maximumSources": 8 }
}
```

Manifest fields — shell version, component kinds/versions, action kinds/inputs, source ids/routes,
contract versions and limits — are class (b): they change only with a shell deploy. Everything a
declaration supplies (section instances, props, bindings, copy, refs) is class (c). Instances and
pages are therefore class (c); a new kind or source is class (b).

### 7.3 Retrieval policy

Page reads are kernel invokes, not retrieval-service procedures, so `retrieval-policy.json` is not
extended for them. The rejected path and its real costs (C14): had the page reading gone through
the procedure-extract/retrieval chain, it would need an estate procedure, `sfx-dal` registration
and regeneration, `retrieval-policy.json` admission **and** a service release — the revamp
explicitly rejected that for readings because it "would tie every reading change to DAL
regeneration and a service release" (`docs/live-circuit-platform-revamp.md:362-364`). The kernel
readers `catalog`/`scenario`/`details` are absent from `retrieval-policy.json`
(`deploy/sda-kernel/retrieval-policy.json:2-9`; `circuit-host.json:17-21`) and follow the kernel
path instead. Order for this plan: install `read-ui-page` in the estate → ship `readers.page`, the
route host, the registry manifest and the adapters (class (b)/(a) deploy) → publish declarations
(class (c), no deploy). The rule that binds: retrieval is read-only and a writer never enters it
(`analysis/05-prior-art-design-surface.md:202-205`; `live-circuit-provider-details.md:122-126`);
page publication goes through the estate procedure, never through retrieval.

### 7.4 `sfx-dal`

No change in v1. Page declarations touch no identity schema and add no generated repository; the
reader is kernel-invoked like `read-capability-details`, the publisher `publish-ui-page` is a
governed workflow using public platform reads and `verify-pages`, and the SQL procedures
(`stage_ui_page`, `promote_ui_page`, `rollback_ui_page`) are bounded estate mechanics, so no
`sfx-dal` registration, DAL regeneration or service release appears anywhere in the publish path
(C2, C20). A DAL change becomes necessary only if a runtime content-writer route is added to the
identity host later (gate G4); that path must follow the sfx-dal migration and regeneration rules
(`AGENTS.md`; `live-circuit-provider-details.md:219-241`), and if it were chosen it would add
registration, regeneration and service-release costs to P0.1/P0.5 instead of the workflow and SQL
mechanics.

### 7.5 SDA decision gate

**Superseding note (Revision 4, 2026-10-08).** The G2 request is **not filed**. Its scope must be
derived from blueprint evidence rather than prespecified, and the four prescriptive asks
previously listed here — a `browser-runtime` binding target (today: `node`, `python`, `csharp`
only — `bind-slot-provider.sql:10,30`), `ui-embodiment-plan.v1` admission
(`ui-embodiment-plan-v1.mjs:26-146`), multi-child `invoke-scenario` composition (page → layout →
sections) and page-view testimony — are **withdrawn as a package**. The default is no SDA change:
the provider decoupling and the four-section landing blueprint rely only on existing
estate-provider/read machinery (`ui-circuit-blueprint-strategy.md` §7). A kernel ask may only be
derived later from a failing, captured design artifact (prove-then-request); no filing trigger is
pending.

### 7.6 Providers home

v1 adapters live in `live-circuit/circuit/ui-components.js` (shell, mapped and tested). The
north-star home for rendering/routing/action/event providers is
`sfx-providers/providers/ui-page-runtime/` `[proposal]`, with the uniform module contract pattern
(`altitude-01.mjs:4-41`). The semantic contracts already live in the estate, so the later code
move changes no meaning. Do not add a sync mechanism in v1.

---

## 8. Security, authority and honesty

### 8.1 Authority seams are preserved

- Reads stay GET-only under `/api/circuit/v1/` (`live-store.mjs:283-292`); the only new read is
  `GET /page` in the same shape.
- Browser writes stay exactly: session sign-in/out at `POST /api/circuit/v1/session[/logout]`
  (`identity-session.mjs:110-187`) and Observe/objective `POST /api/circuit/v1/runs`
  (`run-api.mjs:23-24,62-68`). Same-origin JSON + present Origin + `__Host-sfx-session` cookie +
  per-principal idempotency are unchanged (`identity-session.mjs:41-46`;
  `run-api.mjs:50-52,88-92`). The observer also accepts `POST /events` and `/events/batch` for DA
  testimony ingestion (`observe-server.mjs:463-466`); the public gateway 405s them
  (`gateway.mjs:162-164`; `accept.mjs:49`), so they are not a browser write path (C17).
- The gateway's explicit POST allowlist (`gateway.mjs:162-164`) is not widened. A declaration can
  never introduce a route, method or header.
- Credentials stay server-side: the browser never receives `SDA_API_TOKEN` (`live-store.mjs:242-249`;
  `live-circuit-provider-details.md:96-100`).

### 8.2 No invented evidence, no invented capability

- Copy is declaration data with a stated basis where it makes claims (the `copyBasis` discipline,
  `circuit-host.json:6`). Compliance, coverage and availability wording follows `intent.md`
  honesty boundaries: never "HIPAA compliant", never universal integration, never formal
  verification unless proof obligations are discharged (`analysis/05-prior-art-design-surface.md:345-355`).
- Architecture/research content is labelled In development / Lab / Preview until gates close
  (`intent.md:1414-1430`).
- The platform renders what declarations say; it does not infer status, recurrence or meaning
  (`build_master.py:30-34`).

### 8.3 Reads are not receipts

A page render is a current read, not an execution and not evidence. It creates no run, claim or
trust state (D8). Any page showing execution facts must show the retained receipt and its limits,
and must not present page presence as proof.

### 8.4 Refusals and failure rules

- Unknown component, action, source or contract version (`422 UI_DECLARATION_INVALID`), malformed
  digest (`400`) or digest mismatch (`409`): named, visible refusal; never a silent fallback to a
  different renderer (C15).
- Failures never render as empty (existing rule extended to pages); degraded reads name the served
  revision and reason.
- Unknown/undeclared data stays `NOT_DECLARED`/`EMPTY`/`UNRESOLVED` as distinct visible states,
  never a shared blank (`analysis/05-prior-art-design-surface.md:362-366`).

### 8.5 Declarative rendering safety invariant (C25)

Declarations never contain executable markup. Text roles render as text (`textContent`, never
`innerHTML`); URLs are validated against an admitted scheme/origin profile; no adapter may
evaluate declaration-provided script, HTML, CSS, event-handler text or arbitrary URL protocols
(`javascript:` and arbitrary `data:` are refused). This is a verification and acceptance gate
(WP0.7), not merely an implementation convention.

---

## 9. Acceptance and verification

### 9.1 What staging still proves (unchanged)

Checks, composite build, bind-by-digest, restart/readiness, public route refusals, browser
sign-in/Observe/replay, durable and external gates, Windows CLI —
`.github/workflows/staging.yml:35-42,99-107,117-177`; `accept.mjs:44-101`. Staging acceptance
never substitutes synthetic events or responses (`docs/automatic-staging-deployment.md:125`).

### 9.2 New data-only gate and scripts

| Gate | Passes when | Tool | Receipt |
| --- | --- | --- | --- |
| WP0.1 | `read-ui-page` returns the home declaration; serving digest equals publish digest; idempotent | `verify-pages.mjs` (local + `--staging`) | `docs/sfx-website-product-evolution/evidence/WP0-<date>.json` |
| WP0.2 | Unknown component/action/source, contract-version and schema-invalid fixtures all render named refusals (`422 UI_DECLARATION_INVALID` for schema); no section silently dropped | `verify-pages.mjs --refusals` | same convention |
| WP0.3 | `expectedPageDigest` mismatch is 409 `PAGE_SNAPSHOT_CHANGED`; degraded fallback names requested/served revisions | `verify-pages.mjs --digests` | same |
| WP0.4 | A copy publish changes home's public and state-scoped copy without any watched-path push: publish receipt + served digest change + no release run; a failed verify triggers the publisher's automatic CAS rollback, and a rollback with a stale `expectedCurrentRevision` refuses (drill) | `publish-ui-page` + `verify-pages --staging` | publish receipt + WP0 receipt |
| WP0.5 | Page read latency/cache measured: cold read, warm read, `refresh=1`; within declared budget | harness | WP0 receipt |
| WP0.6 | Signed-in home still renders after conversion: the declared `when: signed-in` variant and the session run list render in a real browser session (C9) | browser gate extension | WP0 receipt |
| WP0.7 | Rendering safety: markup in text roles renders as literal text; `javascript:`/arbitrary `data:` URLs refuse; no declaration-provided script, style or handler text executes (C25) | `verify-pages.mjs --safety` + browser gate | WP0 receipt |
| WP1.x | Second page served from declarations; the data-bound crosswalk section resolves its declared reader; registry churn measured; navigation declared | `verify-pages` + `accept.mjs public` extension | WP1 receipts |

`accept.mjs` public additions: declared page routes `200`, unknown page `404 PAGE_NOT_FOUND`,
`/api/circuit/v1/ui-registry` `200`, refusal fixtures. `page.html`, `page.js`, `page-runtime.js`
and `ui-components.js` are added to the map and pinned; `home.js` keeps its pin
(`observe-server.mjs:14-45`; `accept.mjs:47`; C18).

### 9.3 Rollback ownership

- Shell/registry changes: existing release rollback restores the prior digest
  (`staging.yml:207-212`; `docs/automatic-staging-deployment.md:224-241`).
- Data publishes: the publisher `publish-ui-page` verifies the candidate before promotion and
  performs an **automatic CAS rollback** on a failed post-promotion verify (C4, C20), mirroring
  the release discipline (`staging.yml:207-212`); the previous revision is retained by
  construction; degraded reads keep serving the last good page visibly. `rollback_ui_page`
  remains available for manual rollback under the same CAS law (C23). Both are owned by the
  publisher of record (§4.6).

---

## 10. Staged rollout

Each phase freezes its contract before the next begins: a schema or adapter-boundary change after
a phase exit requires a version bump and a full deploy. This is the "get it right on one page,
then scale" loop: Phase 0 proves correctness on the shallowest page, Phase 1 proves scale on a
real second page without changing the contract, Phase 2 floods the IA.

### Phase 0 — thin slice (home)

**Entry:** Revision 3 accepted; **G1 accepted**; **G4 accepted subject to the publisher/procedure
split (C20) and the CAS pointer law (C23)**; **G6 accepted with used-by-Phase-0 enforcement
(C26)**; reading of lane 2's home inventory frozen (C10).

**Deliverables.**

| ID | Work | Repo |
| --- | --- | --- |
| P0.1 | Migration pair: contracts, `sidefx_ui` schema, `read-ui-page` capability, home definition + layout + component contracts; SQL mechanics `stage_ui_page`/`promote_ui_page`/`rollback_ui_page`; the `publish-ui-page` publisher workflow (C20) | sfx-embody |
| P0.2 | Client runtime: `page-runtime.js`, `ui-components.js` (v1 registry), schema/registry validation, refusals, rendering-safety enforcement | sfx-platform |
| P0.3 | Serving: `readers.page`, `GET /api/circuit/v1/page`, `GET /api/circuit/v1/ui-registry`, generic `/circuit/<slug>` route host, fixture source | sfx-platform |
| P0.4 | Home conversion: `home.js` mounts the page runtime; `home.html` skeleton/ids kept; `home.featured` retired to the declaration while `home.hero`/`GET /api/circuit/v1/home` stay host route data for the Explorer (C1); signed-in copy rendered from `when`-scoped sections; circuit-preview digest check preserved | sfx-platform |
| P0.5 | Verification: `verify-pages.mjs`, `accept.mjs` public extension, latency/cache measurement, publisher drill (`stage → candidate verify → promote → post-verify → CAS refusal/rollback`), rendering-safety fixtures (WP0.7) | sfx-platform + sfx-embody |
| P0.6 | Home content authority: the home declaration visibly carries the settled propositions (Zero Implicit Authority, Sovereignty at Scale, Semantic Flight Recording, Evidence by Design, Independent Evaluation, Enterprise/Government) as content authority, not page-runtime semantics | sfx-embody + content owner |

**Exit evidence:** WP0.1–WP0.7 receipts; full staging acceptance green; a live home copy change
published as data with no release and an automatic-rollback/CAS-refusal drill; named refusals
demonstrated; the home declaration carries the settled propositions.

### Phase 1 — second real page

**Pick: the industry Solutions template, first instance Healthcare** `[proposal]`.

**Why.** The regulated-industry template is one template across the ten industries
(`intent.md:154-165,167-179`); Phase 1 proves the template, and Phase 2 converts the ten industry
**instances**. "Ten pages at once" would overcount: the Solutions IA also has three non-industry
doors (Independent Evaluation, Enterprise AI Governance, Government & Defense) that do not use
the template (`intent.md:990-998`). The template's five-stage narrative needs exactly `section`,
`text`, `heading`, `card`/`card-list`, `notice` and navigation actions; it exercises the honest
claims rules (capability-level mapping language, never compliance claims —
`intent.md:227-241`) and needs no action authority beyond navigation. To prove the **data half**
of the hypothesis (`research-brief.md:30-34`), Phase 1 adds one data-bound section: a Standards
crosswalk (`intent.md:1008`) rendered by `table` with `field-list` detail, `badge`/`status-chip`
states and a `disclosure` for basis and limits, reading a new declared reader. That reader is a
class (b) shell addition — exactly the kind of change that still deploys. Alternative "Why SFX"
was considered: it is the IA front door but is an essay shape close to home, so it proves neither
template reuse, navigation scale nor data binding.

**Entry:** Phase 0 exit evidence; schema v1 frozen; publish gate operational.

**Deliverables:** industry page declarations (Healthcare first, one reuse proof of a second
industry), declared nav, the crosswalk reader and the Phase-1 component kinds (class (b) shell
deploy), honest-claims content review.

**Exit evidence:** second page served; the crosswalk section resolves its declared reader and
renders its declared states; one publish receipt; browser acceptance for the new page; no schema
change from Phase 0.

### Phase 2 — scale to the IA

**Entry:** Phase 1 exit evidence; registry batch plan; media serving/storage gate G5 answered;
public-claim provenance gate G9 scoped.

**Deliverables:** waves by area (Why SFX, Platform, Solutions ×N, Standards, Ecosystem, Research,
Media, Academy, Product) using the nine-area IA (`intent.md:970-1044`); declared navigation; the
media serving route and digest-addressed media pipeline (gate G5); the public-claim provenance
model (statement, basis, sourceRefs, observedAt, effectiveAt, classification, status) at gate G9
before the Standards/Research/current-development waves; optional SDA request (G2) when the model
is proven.

**Exit evidence:** every IA destination served; releases per content change measured at zero;
component-kind churn bounded and batched; learning receipts per wave.

**Learning loop.** Each phase closes a receipt recording: pages converted, kinds added, releases
avoided, content-change lead time, refusal counts, read latency. A phase that needs a schema
change is scored as a contract failure, not a content success.

---

## 11. Risks, anti-patterns and decision gates

### 11.1 Risks

| # | Risk | Mitigation | Signal |
| --- | --- | --- | --- |
| R1 | Schema churn breaks declarations | Versioned contracts; unknown version refuses; additive-only within a major; Phase freezes | WP0.2, WP1.x |
| R2 | Data publishes ahead of the shell | Publish gate against the registry manifest; read-time validation; visible degraded fallback | publish receipts, WP0.3 |
| R3 | Page read cost/latency | One kernel invoke per page; per-page source cap 8; cache + ETag; measure WP0.5 | latency receipt |
| R4 | Cache incoherence per section | Digest-keyed page read; `refresh=1`; sources carry their own ETags; failures `no-store` | cache tests |
| R5 | Silent degradation | `status: DEGRADED` + reason + revisions always visible; receipts | WP0.3 |
| R6 | Content overclaim | Honest-claims review in the publish gate; basis labels; compliance wording rules | publish review |
| R7 | Second renderer/re-implemented rendering | One adapter registry; Explorer runtime untouched; no page-local style blocks | code review, WP1.x |
| R8 | Premature browser CMS | Authoring estate-side; G4 blocks CMS until per-user authority exists | gate G4 |
| R9 | Media ownership/backup undecided | v1 restricts declarations to allowlisted assets; new media needs a class (a) serving route, decided at gate G5 before heavy media | gate G5 |
| R10 | Acceptance erosion for data changes | Data gate is a real gate: fixtures, refusals, digest and rollback drills, retained receipts | WP0.4, §9.3 |
| R11 | Host-config creep (new presentation facts) | Only trust/route data in `circuit-host.json`; `home.featured` retired, `home.hero` retained with the Explorer dependency recorded (C1); review rule | code review |
| R12 | Route/SEO expectations unmet | `/circuit/` in v1; top-level paths gate G3; indexing stays disabled in staging | gate G3 |

### 11.2 Anti-patterns (do not do)

- A client registry that owns component meaning (lane 3 option B): every new component becomes a
  deploy and meaning leaves the database (`analysis/03-ui-capability-providers.md:391-395`).
- A second renderer (the retired website's ~3,400-line workbench): learned cost, D4 forbids
  (`analysis/05-prior-art-design-surface.md:339-341`).
- Deepening host JSON into a CMS (`circuit-host.json:6` `copyBasis` is the warning).
- Silent section drops, blank-on-failure, fallback renderers, invented copy/evidence.
- Any new browser write path, open route or widened gateway allowlist.
- Page-local `<style>` blocks in new or converted pages and any token fork; CSS class names or
  framework names in declarations. (The Explorer's existing blocks are out of scope in v1, C11.)
- Result-set names or capability allowlists in client code.
- Per-section kernel invokes before the SDA composition semantics exist.

### 11.3 Sequencing dependencies

Estate migration pair before home conversion; registry manifest before the publish gate; the
`publish-ui-page` workflow and CAS mechanics before any data publish; generic route host before
Phase 1; rendering-safety gate before declared content renders; measurement before Phase 2; G9
before Phase 2 claim-bearing waves; G2 only after Phase 1.

### 11.4 Decision gates for the user

| Gate | Decision | Recommendation | Owner |
| --- | --- | --- | --- |
| G1 | Accept the v1 declaration family + `read-ui-page` reader (D1) rather than full page-as-capability now | **ACCEPTED (Revision 3)** — declared page data → `read-ui-page` → trusted shell projection; full page-as-executed-capability stays with G2 | PO |
| G2 | File the SDA change request: browser binding target, `ui-embodiment-plan.v1` provider, multi-child composition, page-view testimony | **SUPERSEDED (Revision 4)** — request not filed; the four prescriptive asks are withdrawn as a package and its scope must be derived from blueprint evidence (prove then request; §7.5) | PO + SDA |
| G3 | Route/IA: keep `/circuit/<slug>` or add a gateway prefix rule for top-level story paths | Keep `/circuit/` in v1; decide before production SEO | PO |
| G4 | Content publication ownership and tool: estate workflow + SQL mechanics now vs runtime CMS later (blocked on per-user authority) | **ACCEPTED (Revision 3) subject to C20** (publisher `publish-ui-page` orchestrates; SQL procedures own bounded durable mechanics) and **C23** (CAS pointer law); CMS deferred | PO |
| G5 | Media serving and storage: observer route + digest-addressed persistent volume vs object store vs SQL | v1 uses allowlisted assets only; build the media serving route and choose storage before new media (C5) | Team |
| G6 | v1 component registry set and Phase 1/2 page conversion order | **ACCEPTED (Revision 3) with used-by-Phase-0 enforcement** — the pruned set in §4.2/§7.2; a kind with no Phase 0 use waits; the industry template next | PO + UI |
| G7 | Design-token reconciliation: `--observation` with `--cyan` alias; muted/dim/line values | Adopt live CSS as the web source of truth; alias deck names | Design owner |
| G8 | Page cache publication consistency: what consistency promise does a page publication make across multiple serving instances? | Later gate; does not block Phase 0 on one effective serving instance (C24) | Team |
| G9 | Public-claim provenance model (statement, basis, sourceRefs, observedAt, effectiveAt, classification, status) for Standards/Research/current-development content | Phase 2 gate; not a Phase 0 invention | PO |

---

## Appendix A. Lane reconciliation and spot-checks

### A.1 Reconciled lane disagreements

| Conflict | Resolution | Evidence |
| --- | --- | --- |
| Page declaration home: lane 3 estate capability/scenario (option A/B) vs lane 4 runtime reader (option A) vs host config | Both, layered: meaning is estate declarations admitted by migration pairs; delivery is one declared `read-ui-page` reader in `circuit-host.json`. `home.featured` retires to declarations; `home.hero` stays host route data for the Explorer fallback (C1). Full page-as-capability is G2 | `circuit-host.json:17-21` has readers but no page reader; `declare-live-scenario-circuit.commit.sql:785` proves the reader-capability pattern; `explorer.js:332,338-340` uses `/api/circuit/v1/home` |
| "Page capability" as scenario vs reading | v1 reading; a page view produces no run, so no scenario/authority/evidence is minted for it (D8) | `sfx-embody/docs/live-circuit-data-contract.md:12-13` (reads are not execution) |
| Lane 1 "no UI capability kind" vs lane 5's r3/r4 presentation-kind registry | Separate objects: presentation kinds are Explorer row presentation; page components are a new `ui-component` contract family. Reconciliation point of contact: both are declared registries, no client code names meaning | `analysis/02-rendering-inventory.md:266-268`; `analysis/05-prior-art-design-surface.md:190-199` |
| Lane 4 gap 5 (top-level IA paths vs gateway) vs lane 5 item 4 (one workspace, one renderer) | One renderer, many declared routes under `/circuit/`; top-level paths are G3. "One workspace" constrains the renderer, not the URL count | `gateway.mjs:140-163`; `accept.mjs:56-62` |
| Token source: design-system Python vs live CSS | Live CSS is the runtime token source; deck tokens are design artifacts; `--observation`/`--cyan` alias | `analysis/05-prior-art-design-surface.md:58-73,142-159` |

### A.2 Code spot-checks performed (2026-10-07)

- Readers today are exactly `catalog`, `scenario`, `details`; no page reader —
  `live-circuit/circuit/circuit-host.json:17-21`.
- Static map is a hand-maintained allowlist; miss is 404 —
  `live-circuit/dispatch-pair/observe-server.mjs:14-45,473-480`.
- Home reads config, session, catalog and release in parallel, then reads the hero scene inside
  `circuitPreview` — `live-circuit/circuit/home.js:83-96` (lane 1's "five reads" and lane 2's
  "four reads" are the same behavior counted before/after the lazy scene read).
- Observe write seam shape and origin/CSRF checks — `live-circuit/circuit/run-api.mjs:23-24,50-52,62-68`.
- Cookie shapes and session route — `live-circuit/circuit/identity-session.mjs:27,29-46,114-120`.
- GET-only circuit reads and cache/ETag — `live-circuit/circuit/live-store.mjs:283-301,164-187`.
- The Explorer uses `/api/circuit/v1/home` as its no-query default selection and environment
  label — `live-circuit/circuit/explorer.js:332,338-340` (C1).
- The observer admits testimony over `POST /events` and `/events/batch` while the public gateway
  405s them — `live-circuit/dispatch-pair/observe-server.mjs:463-466`;
  `deploy/sda-kernel/gateway.mjs:162-164`; `deploy/staging/accept.mjs:49` (C17).
- Public acceptance pins include `pane-layout.js` 200 and removed modules 404; `/circuit` 302;
  `/` is the platform home — `deploy/staging/accept.mjs:46-68`.
- Reader capabilities are full capabilities with a root terminal scenario declared through
  `sidefx-capability-authority.v1` — `sfx-embody/sql/migrations/declare-live-scenario-circuit.commit.sql:785`.

---

## Appendix B. Component registry and action taxonomy

### B.1 Registry status map

| Kind | v1 (Phase 0) | Phase 1 | Phase 2 / Explorer-only |
| --- | --- | --- | --- |
| `hero`, `section`, `text`, `heading`, `stat`, `card`, `card-list`, `list`, `media.figure`, `notice` | ship | reuse | reuse |
| `table`, `field-list`, `disclosure`, `badge`, `status-chip` | — | ship (crosswalk) | reuse |
| `identity-session`, `action-bar`, `tabs`, `timeline`, `segmented` | — | — | admitted only when a declared page uses it; `identity-session` is shell chrome today (C26) |
| `circuit-scene`, `run-controls`, `run-report`, `provider-profile`, `objective-composer`, `json-editor`, `status-bar` | — | — | Explorer runtime only; not declarable content in v1 |

### B.2 Action kinds and dispatch classes

Local: `navigate`, `select`, `playback`, `view`, `toggle`, `pane`, `copy`/`download`,
`stage-change`. Read: `refresh`. Session POST: `session`, `observe`, `objective`. A declaration's
`dispatchClass` must equal the kind's fixed class; it names the browser seam, never authority
(C22), and no kind adds a route, method, header or credential (§4.4).

---

## Revision history

**Revision 2 (2026-10-07) — every review correction applied.** Relative to the adversarial review
([`analysis/06-review.md`](analysis/06-review.md)):

- **C1 (blocker):** `home.hero` and `GET /api/circuit/v1/home` stay host route/trust data for the
  Explorer's default selection and environment label; only `home.featured` retires (D1, D6, §1.3,
  §2.3, P0.4, R11, A.1, A.2).
- **C2 (blocker):** the publish tool is named — `publish_ui_page` invoked by SQL from the estate's
  governed publish path, no DAL and no service release; one-time install/deploy costs versus zero
  per-publish release are stated (§4.6, §7.1, §7.4).
- **C3 (blocker):** `hero` added to the v1 allowlist in §4.2, §7.2 and B.1, so the §5.3/§5.4 home
  example passes its own validator.
- **C4:** the gate verifies the candidate before promotion and performs automatic pointer rollback
  on a failed post-promotion verify; ownership named (§4.6, §9.2 WP0.4, §9.3).
- **C5:** v1 media is restricted to allowlisted assets; new media is a class (a) serving-route
  deploy decided at G5 (§1.1, §4.6, R9, G5).
- **C6:** digest supply defined — omit on first load, bind the served digest thereafter, declared
  nav links may carry one; the 409 path is stated (§4.5, §5.7, §6.1).
- **C7:** binding scopes and per-kind admitted input shapes defined; unresolved bindings refuse
  (`UI_ACTION_BINDING_UNRESOLVED`) and do not dispatch (§4.4, §5.5, §5.6).
- **C8:** the `ui-registry` manifest schema added with its class (b)/(c) field split, and source
  ids/routes named (§4.6, §6.1, §7.2).
- **C9:** state-scoped `when` sections added for signed-in copy; WP0.6 proves the signed-in home
  variant after conversion (§5.3, §9.2, §10 Phase 0).
- **C10:** Phase 0 entry corrected to G1, G4 (publication ownership and tool), G6 (component set).
- **C11:** the `<style>` ban is scoped to new and converted pages; the Explorer's existing blocks
  are untouched in v1 (D7, §11.2).
- **C12:** Phase 1 is justified per component from the template's actual content and adds a
  data-bound Standards crosswalk section reading a declared reader; "ten industry instances"
  replaces "ten pages at once" (§10 Phase 1, WP1.x).
- **C13:** "six positioning stories" (the brief) separated from the nine-area IA
  (`intent.md:970-1044`) throughout (intro, §1.2, D7, §10 Phase 2).
- **C14:** the rejected retrieval path and its DAL/policy/service costs stated; install order fixed
  (estate `read-ui-page` → class (b)/(a) shell ship → class (c) declarations) (§7.3).
- **C15:** snapshot-refusal citations corrected (`live-store.mjs:37,149`) and
  `422 UI_DECLARATION_INVALID` added to §5.7, §8.4 and WP0.2.
- **C16:** the `runs-all` toggle seam citation added (`run-context.js:52,58`).
- **C17:** write enumeration completed — session paths in full, plus the observer's `POST /events`
  and `/events/batch` testimony ingress and its public gateway 405 (§4.4 D4, §8.1, A.2).
- **C18:** the new modules (`page.html`, `page.js`, `page-runtime.js`, `ui-components.js`) are named
  as map entries and acceptance pins, and "no deploy" is qualified to instances of deployed kinds
  after the route host/registry ship (§4.3, §4.5, §6.4, §9.2).
- **C19:** the declaration boundary is explicit — chrome and identity stay shell; nav, sections and
  page content are declared (§1.1).

**Revision 3 (2026-10-07) — user review corrections C20–C27 and recorded decisions.** Relative to
[`review.md`](review.md):

- **C20 (blocker):** the publisher/orchestrator `publish-ui-page` (governed workflow/capability)
  is separated from the SQL candidate mechanics
  `stage_ui_page`/`promote_ui_page`/`rollback_ui_page`; the procedures own only persistence
  invariants, append, conditional pointer move, conditional rollback and publication facts; every
  "one SQL call owns verification" statement is replaced
  (§4.6, §7.1, §7.4, P0.1/P0.5, §9.3, G4). This supersedes the Revision 2 C2 identity of
  `publish_ui_page`.
- **C21 (blocker):** the undeclared `load-hero` event is removed from the canonical home example;
  the figure's declared `read` binding covers loading, and the example passes its own validator
  (§5.3).
- **C22:** the UI "authority classes" are renamed dispatch classes — `dispatchClass` with
  `local`/`read`/`session-post` in the JSON examples; language equating browser dispatch with
  authority is removed and actual authority stays downstream in the capability system (D4, §4.4,
  §5.5, §7.2 manifest, B.2).
- **C23:** the pointer CAS law is added with publisher A/B and the sentence "Evidence that an
  earlier state existed does not grant authority to overwrite the current state";
  `promote_ui_page(candidateRevision, expectedCurrentRevision)` and
  `rollback_ui_page(fromRevision, toRevision, expectedCurrentRevision)` refuse when the expected
  current no longer holds (§4.6, §7.1, §9.3, WP0.4).
- **C24:** the cache/publication consistency question gets its own later gate **G8 (page cache
  publication consistency)**; **G5 remains media serving/storage**; G8 does not block Phase 0 on
  one effective serving instance (§6.2, §11.4).
- **C25:** the declarative rendering safety invariant is added — no executable markup, text roles
  render with `textContent`, URLs validate against an admitted scheme/origin profile, no adapter
  evaluates declaration-provided script/HTML/CSS/handler text/protocols — and it is a verification
  gate (WP0.7) (§8.5, §9.2).
- **C26:** the used-by-Phase-0 rule is applied; `identity-session` is removed from the Phase 0
  declarable set (it is shell chrome) and every admitted kind is re-audited against the home
  declaration's actual body use (§4.2, §7.2, B.1).
- **C27:** ordinary navigation resolves the current published pointer; destination digest pinning
  is reserved for intentional snapshot links (historical evidence, publication receipt, specific
  article revision, audit/replay view), preserving independent page publication (§4.5, §5.7).

**Recorded decisions.** **G1 ACCEPTED** (declared page data → `read-ui-page` → trusted shell
projection; no full page-as-executed-capability now). **G4 ACCEPTED** subject to the C20
publisher/procedure split and the C23 CAS pointer law. **G6 ACCEPTED** with used-by-Phase-0
enforcement (pruned set). **G8** (page cache publication consistency) and **G9** (public-claim
provenance model: statement, basis, sourceRefs, observedAt, effectiveAt, classification, status)
are recorded; G9 is a Phase 2 gate and does not block Phase 0. **Phase 0 content** must visibly
carry the settled propositions (Zero Implicit Authority, Sovereignty at Scale, Semantic Flight
Recording, Evidence by Design, Independent Evaluation, Enterprise/Government) as content
authority, not page-runtime semantics (§10 Phase 0, P0.6).

**Revision 4 (2026-10-08) — the G2 SDA request is withdrawn as premature.**

- The request is **not filed**; its scope must be derived from blueprint evidence, never
  prespecified. The four prescriptive asks (browser binding target, `ui-embodiment-plan.v1`
  provider, multi-child composition, page-view testimony) are **withdrawn as a package** (§7.5,
  G2).
- Why: the amendment replaces premature solutioning — including a past kernel-necessity claim
  that evidence did not support — with the prove-then-request rule: a kernel ask may only be
  derived later from a failing, captured design artifact. The provider decoupling and the
  four-section landing blueprint rely only on existing estate-provider/read machinery
  (`ui-circuit-blueprint-strategy.md` §7).
