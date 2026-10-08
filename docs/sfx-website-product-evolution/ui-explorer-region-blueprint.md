# Explorer region scenario circuit blueprint

Prepared 2026-10-08. Status: **[proposal] blueprint; the declarations below are not published.** Revision 2.
This is the region instance of the deterministic design process in
[`ui-circuit-blueprint-strategy.md`](ui-circuit-blueprint-strategy.md) (blueprint first, projection
second, §1) and the landing template of [`landing-blueprint.md`](landing-blueprint.md) §1. It
declares the four Explorer regions as **scenario circuits**, not screens: each region is a provider
with its own circuit — boundary panel, Given/When/Then frames, operation chain, provider call
sites, observation/timeline bindings and a user-action-to-circuit lighting map — in the grammar the
deployed circuit viewer already draws (`live-circuit/circuit/README.md:284-345,306-321`). It is the
**declared authority** for `sfx-providers/providers/ui-explorer-region` — the four region circuits
of §2 and the provider circuit instance of §3 — and every future revision of that provider must
cite this document and move with it: a package version bump and a provider-definition change are
the same act (`analysis/12-ui-runtime-providers.md:99-103`). It is design, not observable
behaviour: members not yet admitted are labelled `[proposal]`, claims cite `path:line`, and nothing
here authorises SDA, `sfx-embody` or `sfx-dal` changes (`AGENTS.md`); the default remains no SDA
change (`ui-circuit-blueprint-strategy.md:222-235`).

How to read this document:

- **Observed** — deployed in the repository today, cited to code or contract documents.
- **[proposal]** — declared design; it becomes authority only through the admission path of the
  strategy (`ui-circuit-blueprint-strategy.md:237-251`) and its gates.
- The provider is implementation-only: not declared in the estate, contracts `PROPOSED`, every
  binding `UNBOUND`, browser execution waiting on G2
  (`sfx-providers/providers/ui-explorer-region/README.md:9-16`).
- A region render is a reading, never an execution receipt (D8, `implementation-strategy.md:256`;
  `landing-blueprint.md` §2.5).

---

## 1. The region circuit template

The landing circuit declares the page `ui-page-landing` and hosts four region providers by call box
(`landing-blueprint.md` §2.4). This document instantiates that landing template at provider scope:
one scenario circuit per region over one declared region set, each declaring the same members —
boundary panel, Given/When/Then frames, operation chain, provider call sites, observation
bindings, declared CSS/HTML/SVG content and named failure terminals
(`landing-blueprint.md` §1; `ui-circuit-blueprint-strategy.md:83-97`).

| Region circuit | Place | Landing call box | Role drawn on the circuit | Deployed backing |
| --- | ---: | --- | --- | --- |
| `header` | 1 | region resolve 01 | Shell chrome: identity / environment / navigation; chrome only, never meaning. | `landing-blueprint.md` §2.4; `live-circuit/circuit/explorer.html:180-186` |
| `left-sidebar` | 2 | region resolve 02 | Navigate and select a capability; counts, states and badges shown as returned. | `landing-blueprint.md` §2.4; `live-circuit/circuit/explorer.html:188-191` |
| `middle` | 3 | region resolve 03 | Scenario circuit canvas and execution; the viewer draws traversal state and decides nothing. | `landing-blueprint.md` §2.4; `live-circuit/circuit/explorer.html:193-257,302` |
| `right-sidebar` | 4 | region resolve 04 | Context, inspection and evidence; a reading, never a receipt. | `landing-blueprint.md` §2.4; `live-circuit/circuit/explorer.html:259-300` |

The provider package `sfx-ui-explorer-region` is the declared implementation of the landing
circuit's four `[proposal]` region providers (`ui-header-provider.v1`,
`ui-capability-tree-provider.v1`, `ui-circuit-canvas-provider.v1`, `ui-run-context-provider.v1`;
`landing-blueprint.md` §2.4). Its exact provider circuit instance — provider identities, ports,
capability links, contracts, content manifest and refusals — is §3; the package must match that
instance exactly (§4.1).

### 1.1 Closed provider vocabulary (a package value outside this list refuses)

| Vocabulary | Declared values | Package carrier |
| --- | --- | --- |
| Region set | `header`, `left-sidebar`, `middle`, `right-sidebar` (place 1-4) | `REGION_IDS`, `regions` |
| Region providers | `sfx-ui-explorer-region-<region>` | `regions[].regionProviderId` |
| Platform ports | `sda-ui-explorer-region-<region>-port.v1` | `regions[].platformCapabilityId` |
| Capabilities | `load-explorer-region-<region>`, role `PLATFORM`, status `PROPOSED` | `capabilities[]` |
| Module contract | `ui-runtime-provider.v1` | `descriptor.moduleContractId` |
| Operation | `ui.region.load`, effect `READ_ONLY` | `descriptor.operations[]` |
| Input contract | `ui-region-request.v1` | `REQUEST_CONTRACT_ID`, `inputShape` |
| Output contract | `ui-region-content.v1` | `OUTPUT_CONTRACT_ID`, `outputShape` |
| Manifest contract | `ui-content-manifest.v1`, manifest `explorer.v1` | `contentManifest` |
| Assets per region | `assets/<region>.css` (style), `.html` (structure), `.svg` (figure) | `contentManifest.regions[].assets` |
| Refusals | `UI_REGION_REQUEST_INVALID`, `UI_REGION_REQUEST_OVERSIZED` (16384 bytes), `UI_REGION_UNKNOWN` | `invoke` findings |

Nothing else is declared. A fifth region, another asset kind, another contract version or an
unnamed refusal is a blueprint revision first and a package change second (§4.1); a request outside
this vocabulary refuses visibly, never as a silent drop or fallback region
(`ui-circuit-blueprint-strategy.md:203-207`).

### 1.2 The region operation chain

Every region circuit runs one declared operation — `ui.region.load`, effect `READ_ONLY` — over the
same uniform `descriptor` + `capabilities` + `invoke` module contract. The chain is: request →
validate → load → candidate with per-asset and whole-candidate `sha256:` digests → disposition.
The candidate is the region's declared content (CSS/HTML/SVG linked by reference, not embedded
screens); the shell draws it, and the package defines no meaning
(`sfx-providers/providers/ui-explorer-region/ui-explorer-region.mjs:28-35,260-289`;
`landing-blueprint.md` §5.3-5.5).

| Chain element | Declared value | Ground |
| --- | --- | --- |
| Request | `{ contractId: "ui-region-request.v1", regionId }`; region in the declared set; maximum 16384 bytes | `ui-explorer-region.mjs:7-12,142-156` |
| Validation | runs before load; unknown member, contract, region or oversize refuses by name | `ui-explorer-region.mjs:215-258,274-289` |
| Load | one `READ_ONLY` operation, `ui.region.load` | `ui-explorer-region.mjs:28-35` |
| Candidate | region identity, role, place, basis and three content assets with `sha256:` digests | `ui-explorer-region.mjs:260-272`; `sfx-providers/providers/ui-explorer-region/README.md:30-33` |
| Disposition | `AUTHORED` with candidate and `shapeConforms: true`, or `HELD` with `candidate: null` and named findings | `ui-explorer-region.mjs:211-213,274-289` |

---

## 2. The four region circuits

Each region declares the landing template members. Region content is provider-owned data: the
package serves bytes, addresses and digests, and the shell draws them; the package defines no
meaning and mints no run, claim or trust state
(`ui-circuit-blueprint-strategy.md:132-143,156-160`; `landing-blueprint.md` §5).

### 2.1 Region circuit — `header` (identity / environment / navigation)

**Boundary panel.** Region provider `sfx-ui-explorer-region-header` (place 1) on platform port
`sda-ui-explorer-region-header-port.v1`, role `shell-chrome`, `bindingState: UNBOUND` with
`REVIEWABLE`/`HELD` readiness
(`sfx-providers/providers/ui-explorer-region/ui-explorer-region.mjs:40-47`;
`landing-blueprint.md` §2.4). Chrome only, never meaning.

**Given.** Route `/circuit/explorer`; session states `signed-in`/`signed-out`; environment label
from `GET /api/circuit/v1/home`; release from `/healthz` (`landing-blueprint.md` §2.4).

**When.** Events `load`, `click`, `submit`; action ids `navigate` (Home, Explorer) and `session`
with intents `sign-in`/`sign-out`/`continue` (`landing-blueprint.md` §1.6).

**Then.** Session outcome face `signed-in`/`signed-out`; identity dispositions are named, never a
silent signed-out state (`landing-blueprint.md` §3). The region load itself is `READ` or one of the
named refusals below — a reading, never an execution receipt (D8, `implementation-strategy.md:256`).

**Operation chain.** Three declared content entries — `assets/header.css` (style),
`assets/header.html` (structure; slots `brand`, `primary-navigation`, `environment-label`,
`identity-session-mount`), `assets/header.svg` (figure) — each with `sha256:` digest and byte count
(`sfx-providers/providers/ui-explorer-region/ui-explorer-region.mjs:77-104`;
`sfx-providers/providers/ui-explorer-region/assets/header.html:1-6`).

**Provider call sites.** The region provider above; the session circuit `authenticate-ide-user`
remains its own declared capability reached by the `session` action
(`landing-blueprint.md` §3); contracts live in the estate and the package defines none
(`ui-circuit-blueprint-strategy.md:156-160`).

**Observation bindings.** None. The header carries no scenario testimony; identity-result digests
belong to the session circuit, not to this render (`landing-blueprint.md` §2.5).

**User-action lighting.** The login submit runs `authenticate-ide-user` through the identity host;
sign-out dispatches session-post and re-renders signed-out (`landing-blueprint.md` §3).

**Declared content (CSS/HTML/SVG).** `assets/header.{css,html,svg}` over the `site.v1` token set
(`landing-blueprint.md` §5.3); declarations carry no executable markup
(`implementation-strategy.md:851-857`).

**Named failure terminals.** Provider request face: `UI_REGION_REQUEST_INVALID`,
`UI_REGION_REQUEST_OVERSIZED`, `UI_REGION_UNKNOWN` (§3.2). Identity face: `SIGN_IN_REQUIRED`,
`SESSION_ENDED`, `IDENTITY_NOT_CONFIGURED`, `IDENTITY_UNAVAILABLE`, `IDENTITY_RESPONSE_INVALID`,
`LOGIN_INPUT_INVALID`, `SAME_ORIGIN_JSON_REQUIRED`, `REVOCATION_UNCONFIRMED`
(`landing-blueprint.md` §2.6). Never blank, never silent, never fallback-rendered.

### 2.2 Region circuit — `left-sidebar` (capability tree / navigation)

**Boundary panel.** Region provider `sfx-ui-explorer-region-left-sidebar` (place 2) on platform
port `sda-ui-explorer-region-left-sidebar-port.v1`, role `navigate-and-select`,
`bindingState: UNBOUND` with `REVIEWABLE`/`HELD` readiness
(`sfx-providers/providers/ui-explorer-region/ui-explorer-region.mjs:49-56`).

**Given.** One selection model (capability, namespace, scenario); declared sources `details`
(navigation rows from `read-capability-details`) and `catalog` (picker datalist); selection state
bound as `session`/`route`/`read` props (`landing-blueprint.md` §2.4;
`ui-circuit-blueprint-strategy.md:99-108`).

**When.** `select` on tree items, tabs and rows; `navigate` on picker submit; `pane` for splitter
resize/collapse; `toggle` for narrow-window drawers (`landing-blueprint.md` §2.4); events `click`,
`submit`, `change`, `select`, `toggle` (`landing-blueprint.md` §1.7).

**Then.** `capability-details.v1` rows in emission order ending with `capability_navigation`;
counts, states and badges render as returned, never recomputed (`landing-blueprint.md` §2.3);
`CAPABILITY_NOT_FOUND` and `CAPABILITY_NOT_SELECTED` are named (`landing-blueprint.md` §2.6).

**Operation chain.** Three declared content entries — `assets/left-sidebar.css` (style),
`assets/left-sidebar.html` (structure; slots `capability-search`, `capability-picker`,
`section-navigation`, `group-navigation`, `node-navigation`, `counts`, `states`, `badges`),
`assets/left-sidebar.svg` (figure)
(`sfx-providers/providers/ui-explorer-region/assets/left-sidebar.html:1-10`).

**Provider call sites.** The region provider above; the navigation reading
`read-capability-details` returning `capability-details.v1`; the reading is a reading, not an
execution (`landing-blueprint.md` §2.3; `implementation-strategy.md:256`).

**Observation bindings.** None. Navigation rows attach no testimony; a selection is state, not
evidence (`landing-blueprint.md` §2.5).

**User-action lighting.** A tree click sets the one selection model and re-renders tabs, section
and context; a row whose declared scene key names a circuit component focuses that component —
canvas and tree share the selection; a circuit click selects the row whose section declares it
(`landing-blueprint.md` §2.4). Picker submit reads details and scene in parallel
(`explorer.js:50-82`).

**Declared content (CSS/HTML/SVG).** `assets/left-sidebar.{css,html,svg}`; no page copy — labels,
coordinates, groups, counts, states and badges are returned navigation rows; CSS tokens only
(`landing-blueprint.md` §2.4, §5.3).

**Named failure terminals.** Provider request face (§3.2); reader path `CAPABILITY_NOT_FOUND`,
`CAPABILITY_NOT_SELECTED` (`landing-blueprint.md` §2.6); unknown source refuses visibly, never a
silent drop (`ui-circuit-blueprint-strategy.md:203-207`).

### 2.3 Region circuit — `middle` (scenario circuit canvas and execution)

**Boundary panel.** Region provider `sfx-ui-explorer-region-middle` (place 3) on platform port
`sda-ui-explorer-region-middle-port.v1`, role `scenario-circuit-canvas-and-execution`,
`bindingState: UNBOUND` with `REVIEWABLE`/`HELD` readiness; the status bar is chrome carried inside
this boundary, not a fifth region
(`sfx-providers/providers/ui-explorer-region/ui-explorer-region.mjs:58-65`;
`landing-blueprint.md` §2.4).

**Given.** Selected capability's scenario circuit `read-live-scenario-circuit`; live/replay
testimony over the observer stream; the declared input contract; the objective text
(`landing-blueprint.md` §2.3-2.4).

**When.** `observe`, `objective`, `playback`, `view`, `toggle`, `select`
(`landing-blueprint.md` §1.6); events `click`, `submit`, `change`, `seek`, `toggle`
(`landing-blueprint.md` §1.7).

**Then.** Received testimony lights admission → completion → return; unobserved branches stay
unlit and no endpoint lights before the scenario's own return; execution outcomes are exact
declared variants or the defect endpoint (`landing-blueprint.md` §1.2-1.3, §2.5). A replay or view
is a re-draw of the loaded traversal model, never execution
(`landing-blueprint.md` §1.6).

**Operation chain.** Three declared content entries — `assets/middle.css` (style),
`assets/middle.html` (structure; slots `capability-header`, `scenario-bar`, `objective-composer`,
`run-bar`, `circuit-scene`, `invocation-timeline`, `run-evidence-summary`, `selected-section`,
`status-bar`), `assets/middle.svg` (figure)
(`sfx-providers/providers/ui-explorer-region/assets/middle.html:1-11`).

**Provider call sites.** The region provider above; the scenario reading
`read-live-scenario-circuit` plus run testimony; the universal capability
`request-capability-from-objective-v3` for the objective row (`landing-blueprint.md` §2.3);
execution authority resolves downstream, not in the UI (`landing-blueprint.md` §7.3).

**Observation bindings.** Testimony attaches to declared node/edge addresses only; unmatched and
unaddressed observations are listed separately, never substituted; joins carry `snapshotDigest` and
`expectedSnapshotDigest` and stale selections refuse rather than display; execution-generation
equality is `NOT_FORMALLY_OBSERVABLE` and is never upgraded into execution proof
(`landing-blueprint.md` §2.5).

**User-action lighting.** Observe prepares the live root scenario, submits one `capability observe`
run and follows that run's own cursor; the objective Run admits
`request-capability-from-objective-v3`, switches capability and follows the run; replay and view
controls re-draw the same traversal model without executing anything
(`landing-blueprint.md` §2.3, §1.6).

**Declared content (CSS/HTML/SVG).** `assets/middle.{css,html,svg}`; the circuit SVG is the
reader's scene with its bytes retained beneath the animation layer and its digest checked
(`landing-blueprint.md` §2.3); kinds available to the canvas include `timeline`, `form`, `chart`,
`media.figure`, `code` (`landing-blueprint.md` §1.2).

**Named failure terminals.** Provider request face (§3.2). Observe/run face: sign-in required
before admission; interrupted streams expose Resume; a failed admission shows its idempotency key
(`landing-blueprint.md` §2.6). Kernel face: `CELL_EXECUTION_FAILED` and the reader codes
(`landing-blueprint.md` §2.6).

### 2.4 Region circuit — `right-sidebar` (context / evidence / inspection)

**Boundary panel.** Region provider `sfx-ui-explorer-region-right-sidebar` (place 4) on platform
port `sda-ui-explorer-region-right-sidebar-port.v1`, role `context-inspection-and-evidence`,
`bindingState: UNBOUND` with `REVIEWABLE`/`HELD` readiness
(`sfx-providers/providers/ui-explorer-region/ui-explorer-region.mjs:67-74`).

**Given.** The Explorer selection (capability, namespace, scenario, detail id, expected snapshot
digest); attributed session runs; run reads/stream; declared input contract; provider inspection;
the declared `ui-view.v1` drill-down (`landing-blueprint.md` §2.4, §6).

**When.** Context tabs are local; `observe` from the bound fields; `copy/download` for evidence
export; `stage-change` stages a provider change document only; `select`/seek for timeline steps
(`landing-blueprint.md` §1.6).

**Then.** Run/evidence reads render as returned; a missing session names sign-in and does not
submit; an interrupted stream exposes Resume without resubmitting; nothing in this region applies a
change or mints trust (`landing-blueprint.md` §2.4).

**Operation chain.** Three declared content entries — `assets/right-sidebar.css` (style),
`assets/right-sidebar.html` (structure; slots `evidence-tabs`, `run-report`, `run-steps`,
`observe-form`, `runs-history`, `component-evidence`, `selection-details`, `declared-authority`),
`assets/right-sidebar.svg` (figure)
(`sfx-providers/providers/ui-explorer-region/assets/right-sidebar.html:1-10`).

**Provider call sites.** The region provider above; the run/evidence reading circuit (session runs,
run read/events/output, declared input contract, provider inspection) and the declared `ui-view.v1`
drill-down (`landing-blueprint.md` §2.3).

**Observation bindings.** Component evidence attaches observed values to declared node/edge
addresses only; unmatched observations are listed separately, never substituted; inspection reads
and digests are testimony attached to declared addresses (`landing-blueprint.md` §2.5, §6).

**User-action lighting.** Selecting a component opens its declared authority and captured component
evidence; a provider glyph is the provider's door and opens the declared provider view;
`copy/download` stages the exact change document and `stage-change` stages only
(`landing-blueprint.md` §2.4, §6).

**Declared content (CSS/HTML/SVG).** `assets/right-sidebar.{css,html,svg}`; the observe form is
built from the returned input contract — constants fixed, enums lists, strings text, arrays one
item per line (`landing-blueprint.md` §1.2).

**Named failure terminals.** Provider request face (§3.2). Provider drill-down
`PROVIDER_VIEW_RENDER_FAILED`, `PROVIDER_VIEW_UNREADABLE` (`landing-blueprint.md` §2.6); session
and observe states as §2.1/§2.3; unknown kind, role, action or source refuses visibly, never a
fallback renderer (`ui-circuit-blueprint-strategy.md:203-207`).

---

## 3. The provider circuit instance — `ui-explorer-region`

The package is not a new kind of surface: it is the §1 landing template instantiated at provider
scope under the uniform `descriptor` + `capabilities` + `invoke` module contract
(`ui-circuit-blueprint-strategy.md:121-130`; `analysis/12-ui-runtime-providers.md:35-54`).

| Circuit member | Provider-scope instantiation | Ground |
| --- | --- | --- |
| Boundary panel | Provider `sfx-ui-explorer-region` plus the four region identities; each region declares its own platform port, `bindingState: UNBOUND` and `REVIEWABLE`/`HELD` readiness | `sfx-providers/providers/ui-explorer-region/ui-explorer-region.mjs:14-36,106-111` |
| Given | Request `{ contractId: "ui-region-request.v1", regionId }`; region in the declared region set; maximum 16384 bytes | `ui-explorer-region.mjs:7-12,142-156,205-258` |
| When | One declared operation call, `ui.region.load`; validation runs before load | `ui-explorer-region.mjs:28-35,215-258,274-289` |
| Then | `disposition: AUTHORED` with candidate and `shapeConforms: true`, or `disposition: HELD` with `candidate: null` and named findings; never a fallback region | `ui-explorer-region.mjs:211-213,274-289` |
| Operation chain | One `READ_ONLY` operation; the candidate carries the region identity, role, place, basis and its three content assets with per-asset and whole-candidate `sha256:` digests | `ui-explorer-region.mjs:260-272`; `sfx-providers/providers/ui-explorer-region/README.md:30-33` |
| Provider call sites | Contracts live in the estate; the package implements `ui-region-request.v1` and `ui-region-content.v1` and defines no meaning | `analysis/12-ui-runtime-providers.md:54`; `ui-circuit-blueprint-strategy.md:156-160` |
| Observation bindings | None; the content manifest pins bytes and addresses only, and a content load carries no scenario testimony | `ui-explorer-region.mjs:131-140`; `landing-blueprint.md` §2.5 |
| User-action lighting | The instance defines no actions; the region actions remain the declared circuit actions of §2 that light the session, navigation, scenario and run/evidence circuits | `landing-blueprint.md` §1.6 |

### 3.1 Declared instance values

- Provider identity `sfx-ui-explorer-region`, package `providers/ui-explorer-region`, version
  `0.1.0`, runtime `node`, type `ui-runtime`, method `in-process`, execution location
  `browser-runtime`, declaration profile `sfx-provider-catalog.v1`
  (`ui-explorer-region.mjs:14-36`).
- Module contract `ui-runtime-provider.v1`; contracts `ui-region-request.v1` (input, `PROPOSED`) and
  `ui-region-content.v1` (output, `PROPOSED`); operation `ui.region.load`, `READ_ONLY`
  (`ui-explorer-region.mjs:5-10,26-35,142-203`).
- Region set exactly `header`, `left-sidebar`, `middle`, `right-sidebar` (place 1-4), each with a
  region provider, platform port, `PLATFORM` capability and `PROPOSED` status as §1.1
  (`ui-explorer-region.mjs:12,38-75,106-121`).
- Content manifest `ui-content-manifest.v1`, manifest `explorer.v1`, derived from
  `live-circuit/circuit/explorer.html:180-302`, captured 2026-10-08; twelve assets — one `css`
  (style), one `html` (structure) and one `svg` (figure) per region — each with path, byte count
  and `sha256:` digest, plus a whole-manifest digest; no content bytes
  (`ui-explorer-region.mjs:123-140`; `sfx-providers/providers/ui-explorer-region/README.md:25`).
- Envelope `{ providerId, toolId, providerExecution: "deterministic", elapsedMs, requestBytes,
  disposition, candidate, shapeConforms, findings }` (`ui-explorer-region.mjs:274-289`).

### 3.2 Declaration, binding and the request face

To become an estate provider, one `sfx-embody` migration pair declares the provider identity, the
two contracts, the four platform ports for the `browser-runtime` target and the four bindings;
bindings stay `UNBOUND` until conformance passes
(`sfx-providers/providers/ui-explorer-region/README.md:69-84`; `landing-blueprint.md` §5.4-5.5).

The request face is closed and refuses by code, never by fallback
(`sfx-providers/tests/ui-explorer-region.test.mjs:118-145`):

| Refusal terminal | Condition |
| --- | --- |
| `UI_REGION_REQUEST_INVALID` | Not an object; unknown member; wrong `contractId`; missing or non-string `regionId` |
| `UI_REGION_REQUEST_OVERSIZED` | Request over 16384 bytes |
| `UI_REGION_UNKNOWN` | A `regionId` the blueprint does not declare |

### 3.3 The flywheel rule

Because contracts live in the estate and packages only implement them, declaring a provider grows
declared circuits without new hand-authored UI: the same template, validator, projector and
adapters host every region and every provider drill-down
(`ui-circuit-blueprint-strategy.md:110-119`; `landing-blueprint.md` §6). Provider inspection stays
a reading, never a receipt (`landing-blueprint.md` §6).

---

## 4. Separation of responsibility

The same separation as [`landing-blueprint.md`](landing-blueprint.md) §5, instantiated at region
scope:

1. **Circuits first.** The declared region circuit is the authority for that region's structure and
   meaning; any physical rendering is its projection (`ui-circuit-blueprint-strategy.md:24-29,197-201`).
2. **Each region is a provider with its own circuit.** The package hosts four region circuits, each
   with its own boundary panel, frames, chain, call sites, observation bindings and lighting map
   (§2).
3. **UI/UX providers link CSS/HTML/SVG content in declarations.** The manifest names
   `assets/<region>.css|.html|.svg` with path, byte count and `sha256:` digest; no content bytes or
   executable markup live in the declaration (`ui-explorer-region.mjs:77-140`;
   `implementation-strategy.md:851-857`).
4. **Providers live in `sfx-providers`.** The package `providers/ui-explorer-region` owns the
   hand-authored realisation and its tests; the platform carries none
   (`ui-circuit-blueprint-strategy.md:121-130,152-160`).
5. **The platform loads them through the circuit API.** Declared providers are read through the
   existing kernel-reader path (`provider-inspection`), same read limits and cache as every reader;
   the browser never holds the SDA token (`implementation-strategy.md:737-742,821-822`).
6. **The drill-down reuses the same blueprint template (the flywheel).** Provider drill-down is
   the same circuit template at provider scope, carried by `ui-view.v1`
   (`view-runtime.js:1-19,101-113`; `landing-blueprint.md` §6).
7. **Blueprint is authority; no deviation.** The package must match §1.1 and §3 exactly: region
   set, region providers, ports, capability links, contract names, manifest and refusals. Any
   deviation is a finding against this blueprint; no second authority and no page-local fork
   (`ui-circuit-blueprint-strategy.md:195-202,215-220`).

---

## 5. Conformance rules

### 5.1 The blueprint is the declared authority

1. The package must match §1.1 and §3 exactly: region set, region providers, ports, capability
   links, contract names, manifest and refusals. Any deviation is a finding against this blueprint.
2. **All future provider revisions must cite this document** — region `basis` strings and the
   package README — and move with it; a new region, asset kind, contract version or refusal is a
   revision of this blueprint first, a package change second. No second authority and no page-local
   fork (`ui-circuit-blueprint-strategy.md:195-202,215-220`).
3. The package defines no meaning and mints no run, claim or trust state
   (`ui-circuit-blueprint-strategy.md:156-160`; `implementation-strategy.md:835-839`).

### 5.2 Named failures only

Every refusal is a named, visible terminal — never blank, never silent, never a fallback region —
and joins the declared vocabulary of §2.6 of the landing blueprint and §3.2 above
(`ui-circuit-blueprint-strategy.md:203-207`; `landing-blueprint.md` §2.6). Validation runs before
load; unknown member, contract, region or oversize refuses visibly.

### 5.3 Trust and dispatch

The package serves CSS, HTML structure slots and SVG figures as data; declarations contain no
executable markup, text renders as text and URLs validate against an admitted profile
(`implementation-strategy.md:851-857`). It adds no route, method, header or credential and widens
no authority; the browser's only writes remain session and observe/objective
(`landing-blueprint.md` §7.3; `implementation-strategy.md:347-357`).

### 5.4 Evidence and drift

A region load or render is a reading, not an execution receipt (D8, `implementation-strategy.md:256`).
Browser-executed provider realisation waits on gate G2
(`ui-circuit-blueprint-strategy.md:253-257`); until then the trusted shell consumes the same
`invoke` shape directly (`sfx-providers/providers/ui-explorer-region/README.md:83-84`). Drift is
recorded as a finding against this blueprint and closed only by a declared revision, never by
tolerating a second authority (`ui-circuit-blueprint-strategy.md:215-220`).

---

## 6. Status and sequencing

- This blueprint and its provider circuit instance are `[proposal]`; no declaration, provider
  identity or binding has been published by this document.
- The default is no SDA change; the instance relies on existing read machinery, declared providers
  with `UNBOUND` readiness and the existing reader path
  (`ui-circuit-blueprint-strategy.md:222-235`).
- The four region circuits follow the migration order: estate pair, then one package per deploy,
  each proven by the shell's existing gates plus the package's own check
  (`ui-circuit-blueprint-strategy.md:173-193`).
- The package's check is `node --test tests/ui-explorer-region.test.mjs`; it proves the exports, the
  four regions and capabilities, every manifest digest against the files on disk, deterministic
  loads and every refusal, with no browser, network or estate
  (`sfx-providers/providers/ui-explorer-region/README.md:86-95`).
