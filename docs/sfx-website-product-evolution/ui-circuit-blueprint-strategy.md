# UI circuit blueprint strategy — the deterministic UI circuit design process

Prepared 2026-10-08. Status: **strategy documented, not started.** Revision 1.
Companion to [`implementation-strategy.md`](implementation-strategy.md) Revision 4; evidence base
[`analysis/12-ui-runtime-providers.md`](analysis/12-ui-runtime-providers.md) and
[`analysis/13a-explorer-runtime.md`](analysis/13a-explorer-runtime.md), with code spot-checks from
[`analysis/13b-shell-pages.md`](analysis/13b-shell-pages.md) and
[`analysis/01-runtime-page-circuit.md`](analysis/01-runtime-page-circuit.md); authority frame
[`intent.md`](intent.md) and [`review.md`](review.md). Everything marked `[proposal]` is design,
not observable behaviour; claims cite `path:line`. Nothing here authorises SDA, `sfx-embody` or
`sfx-dal` changes (`AGENTS.md`).

The durable law this process serves (`review.md:8-28`):

```text
DURABLE MEANING → estate declarations → read → trusted browser shell → physical presentation
PAGE READ ≠ EXECUTION      PAGE PRESENCE ≠ EVIDENCE      UI DECLARATION ≠ NEW AUTHORITY
```

---

## 1. The design process: blueprint first, deterministic

The scenario blueprint is the declared authority. A screen is a projection of a blueprint, never
a hand-built surface: page, layout and section definitions are estate data admitted by migration
pairs and returned by one declared reader (`implementation-strategy.md:247,256-263`). The runtime
already draws from declared geometry — `slide.blueprint.viewBox` (`analysis/13a:107`) — and the
estate already binds providers through blueprint slots (`analysis/03-ui-capability-providers.md:104-107,144`).
This strategy names that fact as the process: **blueprint first, projection second.**

Determinism means conformance is checkable, not stylistic:

- Screens carry only declared sections, components, bindings, actions and events
  (`implementation-strategy.md:478-501,536-560`).
- Unknown kind, role, action, source or contract version refuses visibly; never a silent drop and
  never a fallback renderer (`implementation-strategy.md:303-316,843-845`;
  `analysis/12:161-162`).
- Providers implement contracts; they never define them (`analysis/12:212-218`). No package may
  define semantic meaning (`analysis/12:54`).
- No ad-hoc UI: no second renderer, no host-JSON CMS, no page-local style forks, no invented
  copy or evidence (`implementation-strategy.md:998-1010`; review risk R7 `:991`).

**Login (`authenticate-ide-user`) is the proven starting point.** Its circuit declares its
providers, execution locations and `bindingState: UNBOUND` with `REVIEWABLE`/`HELD` readiness —
declaration can precede admission and execution
(`analysis/03:155-164`; the pattern `analysis/12:50-52`). Its visible form maps onto deployed
vocabulary: `form` kind, `submit`/`form` scope and `session` action intents
(`analysis/13b:118-123`). The session transport itself cannot and must not be declared
(`analysis/13b:121-123`). Login is therefore the first blueprint to convert once the process is
started; v1 conversion remains out of scope for the page strategy
(`implementation-strategy.md:80-81`), which is a sequencing fact, not a design exception.

## 2. The landing blueprint: the circuit Explorer after login

After login the landing page is the circuit Explorer (`/circuit/explorer`, `live-circuit` static
route; `live-circuit/circuit/explorer.html:180-303`). This follows the intent's homepage
requirement to show an actual Scenario Circuit and live execution evidence, not a marketing
animation (`intent.md:882-890`); the nine-area IA (`intent.md:970-1044`) later becomes declared
routes of the same shell (`implementation-strategy.md:76`), not a second landing. The landing
blueprint declares the Explorer as a four-section layout. Each section is its own circuit entry in the page blueprint, backed by
declared sources/actions and — target state — a UI/UX provider realisation from the ui-runtime
family (§4). The roles below are inferred from the deployed Explorer surfaces; they are stated
here as the blueprint's true roles.

| # | Section | Declared role (inferred) | Evidence in the deployed surface |
| ---: | --- | --- | --- |
| 1 | Top header | Shell chrome: brand, primary navigation, environment label, identity/session mount. Not declarable content; stays shell by D6 only as chrome, never as meaning. | `explorer.html:180-186`; shell-chrome decision `implementation-strategy.md:62-63,252`; trust classification `analysis/13b:295-298` |
| 2 | Left sidebar | Navigate and select a capability: search/picker plus declared section/group/node navigation; counts, states and badges shown as returned, never recomputed. | `explorer.html:188-191`; declared navigation rows `analysis/13b:152-155`; model `analysis/01:41-50` |
| 3 | Middle | Scenario circuit canvas and execution: capability header, scenario bar, objective composer, run bar (live/replay/view/follow), the declared circuit scene, invocation timeline, run-evidence summary, selected section. The viewer draws traversal state and makes no decisions of its own. | `explorer.html:193-257`; `analysis/01:58-73`; `analysis/13a:97-132,233-261,368-375` |
| 4 | Right sidebar | Context, inspection and evidence: Run/Runs/Evidence tabs, run report and steps, observe form bound to the declared input contract, runs history, captured component evidence, selection details and declared authority. | `explorer.html:259-300`; `analysis/13a:78-93,165-210`; authority/detail renderer `analysis/13b:256-267` |

The status bar (`explorer.html:302`) is chrome carried inside the middle section boundary, not a
fifth section.

Section backing, honestly stated: today the header is shell and the other three sections are
declaration-driven in part (navigation, scene, runs) and shell-deep in part (the five Explorer
runtime components; `implementation-strategy.md:295-299`; `analysis/13a:379-401`). The target
"[proposal]" is the north-star row set — page capability → layout capability as provider →
section capabilities → UI providers (`implementation-strategy.md:225-237`) — with each section's
realisation owned by a ui-runtime provider package and composed by the `ui-page-runtime` umbrella
(`analysis/12:64-71`). Browser-executed section providers wait for G2 (§7).

## 3. The scenario blueprint template

Every blueprint declares the same members. The page blueprint's admitted form is the
`ui-page.v1`/`ui-page-definition.v1` family (`implementation-strategy.md:437-459,562-579`); the
scenario faces it projects are the estate's own Given/When/Then faces
(`analysis/01:135-137`). The template, in estate terms:

| Member | Declared as | Ground |
| --- | --- | --- |
| Boundary | Capability/port/provider scope; ports and execution locations are declared data | `analysis/03:104-118,155-164` |
| Given / When / Then | Scenario input, event authority and outcome faces with contracts | `analysis/01:135-137`; `implementation-strategy.md:225` |
| Operations | Per-section component entries and the operations they read | `implementation-strategy.md:227,478-501` |
| Providers | `model.provider` + definition, port bindings; `bindingState`/readiness declared before admission | `analysis/03:73-100,137-146`; `analysis/12:50-52` |
| Observation bindings | Reader-sourced overlays and joins that attach testimony to declared addresses only; SQL returns scenario semantics, geometry, SVG and observation bindings | `analysis/01:26-33,64-71`; `analysis/13a:340-346` |
| Page members | Path, layout ref, sources, ordered sections, failure states, digest | `implementation-strategy.md:437-459,562-601` |

**Live watching.** User actions light the circuits through declared actions only: the twelve
action kinds dispatch through pre-existing browser seams and never invent a route, method, header
or credential (`implementation-strategy.md:318-325,340-355`). Selection is one model — canvas
click and tree/row click set the same selection state (`analysis/01:112-114`) — and the viewer
only draws what traversal decided (`analysis/01:72-73`). Live execution arrives as observed
testimony over the existing run/observer path (`analysis/01:75-99`; SSE follow
`analysis/13a:269-270`); the only browser-initiated executions remain observe and objective
(`implementation-strategy.md:250,331-332`). Drill-downs follow returned typed targets and links,
never names (`analysis/01:106-111`), and executions resolve authority downstream in the
capability system, not in the UI (`implementation-strategy.md:250`; review C22 `:1150-1153`).

**Provider drill-down uses the same template (the flywheel).** A provider profile is not a new
kind of surface: its read-only regions — header, identity, configuration, mechanics/ports,
bindings, engagements, instructions, invocations, summary — are `table`, `field-list`,
`disclosure`, `badge`, `status-chip` and `notice` bound to the existing `details`/
`provider-inspection` readers, with `copy`/`download` and `stage-change` already deployed
(`analysis/13a:78-93`). Because contracts live in the estate and packages only implement them
(`analysis/12:212-218`), every provider drill-down is the same blueprint template at provider
scope: declaring a provider grows declared surfaces without new hand-authored UI. Provider
inspection stays a reading, never a receipt (`implementation-strategy.md:254,835-839`;
`analysis/13a:396-401`).

## 4. The UI/UX provider architecture

Providers live in `sfx-providers`. The north-star home is
`sfx-providers/providers/ui-page-runtime/`, resolved into five sibling packages — kinds/renderers,
adapter behaviour, contract roles, token sets, action dispatch — plus the umbrella composite that
arrives only when G2 admits multi-child composition (`analysis/12:19-31,58-71`). The implemented
reference is `ui-runtime-token-set`, which carries the `site.css:4-12` tokens as deterministic
data with a digest and named refusals (`analysis/12:170-191`). The uniform module contract is
`descriptor` + `capabilities` + `invoke`, with explicit `bindingState: UNBOUND` readiness
(`analysis/12:35-54`).

Declarations link UI content by reference:

- Layout policy names a token set (`policy.tokenSet: "site.v1"`,
  `implementation-strategy.md:470`); the package resolves the CSS custom properties as data
  (`analysis/12:134,170-191`).
- The `ui-registry` manifest publishes component kinds/versions/roles/states, action kinds and
  source ids/routes; the estate supplies instances, props, bindings and digests
  (`implementation-strategy.md:719-751`).
- Media and figures carry `svg`/`src`/`alt`/`digest` roles with digest checks
  (`implementation-strategy.md:282`); declarations themselves never contain executable markup —
  text renders as text and URLs validate against an admitted profile
  (`implementation-strategy.md:851-857`).

An API loads provider content through the circuit: declared providers are readable through the
existing kernel-reader path, `GET /api/circuit/v1/provider-inspection` backed by
`analysis.read_provider_details` (`implementation-strategy.md:737-742`;
`analysis/03:121-126`), with the same read limits and cache as every reader
(`analysis/01:26-32`). The browser never holds the SDA token
(`implementation-strategy.md:821-822`).

As packages replace shell code, `sfx-platform` stops carrying hand-authored UI; the deployed
shell keeps only what must be trusted before a request is served
(`implementation-strategy.md:49-65`). **The trust boundary is unchanged:** the shell keeps the
projector, validator, routing and security seams (`implementation-strategy.md:808-822`;
`analysis/13b:291-303`); the adapter migration changes no meaning
(`analysis/12:124-137`); action dispatch never widens authority (`analysis/12:83-85`).
**Providers describe, never authorize** (`implementation-strategy.md:250`; review C22
`:1150-1153`), and a render mints no run, claim or trust state
(`implementation-strategy.md:835-839`; `analysis/12:164`).

## 5. Migration: module by module, code-mass leaving the platform repo

Hand-authored code stays in `sfx-platform` until each provider replaces it. The contracts are
already estate rows; only realisation moves, and the shell keeps its validator, refusals and fetch
loop (`analysis/12:124-127`). The migration table is the inventory
(`analysis/12:129-137`): `ui-components.js` adapters → kinds package; role tables → adapters
package; `supportedRoles`/manifest roles → contract-roles package; `site.css` properties →
token-set package; `dispatchClass` handling → action-dispatch package; `page.js`/`home.js` mount →
umbrella composite. No declaration is republished and no contract changes
(`analysis/12:136,157-166`).

Sequence and rules (`analysis/12:138-155`):

1. G2 lands in SDA; no repository change in this repo.
2. Estate pair declares the five provider identities, token contracts, browser port
   implementations and bindings; bindings stay `UNBOUND` until conformance passes.
3. Manifest extension ships as a class (b) shell deploy; refusal codes and the allowlist are
   unchanged.
4. One package per deploy, in dependency order: token-set → contract-roles → adapters →
   kinds/renderers → action dispatch.
5. Tokens publish as data (class (c)) once `ui-token-set.v1` is admitted.

**No big-bang, no fallbacks.** One package per deploy, each proven by the shell's existing gates
plus the package's own check (`analysis/12:149-151`). Unknown kinds/roles/actions/sources refuse
visibly; never a silent drop or fallback renderer (`analysis/12:161-162`;
`implementation-strategy.md:1005`). The family is the north-star home, not a bridge: no package
is shrink-only (`analysis/12:164-166`). The finish line is measured as code-mass leaving this
repository: each shipped v1 artefact in the `analysis/12` migration table replaced by its package,
with the shell retaining only projector/validator/routing/security functions
(`analysis/12:124,164-166`; `implementation-strategy.md:49-65`). Per-module change surfaces are
already recorded for every audited module (`analysis/13a:379-401`; `analysis/13b:324-336`), so
progress is countable, not asserted.

## 6. Process rules and anti-drift

1. **One authority per surface — the blueprint.** The declared page/blueprint is the authority
   for structure and meaning; shell chrome keeps only chrome (`implementation-strategy.md:208-214,247`;
   `review.md:30`). Where host data and declaration data meet, exactly one retires per surface —
   `home.featured` to declaration, `home.hero` retained for the Explorer
   (`implementation-strategy.md:202-206,247`). One traversal model decides state; the viewer only
   draws (`analysis/01:72-73`); no second renderer (R7, `implementation-strategy.md:991`).
2. **Named failures only.** Every refusal is a named, visible state — `UI_DECLARATION_INVALID`,
   `UI_COMPONENT_NOT_SUPPORTED`, `UI_COMPONENT_ROLE_UNSUPPORTED`,
   `UI_ACTION_BINDING_UNRESOLVED`, `PAGE_NOT_FOUND`, `PAGE_NOT_DECLARED`,
   `PAGE_SNAPSHOT_CHANGED`, `DEGRADED` with requested/served revisions
   (`implementation-strategy.md:562-601,841-849`). Never blank, never silent.
3. **Verification is click-path and screenshot based.** Acceptance exercises the real browser
   sign-in/Observe/replay path (`implementation-strategy.md:861-868`), and evidence is real
   captures: the U1 deck was built from captures of the running host with measured DOM rectangles
   and re-checked image/geometry hashes (254 checks, 0 failures)
   (`implementation-strategy.md:143-151`). Signed-in states and DOM execution proof run through
   the browser gate (WP0.6, WP0.7, `implementation-strategy.md:879-880`); source checks are not
   DOM proof (`analysis/13b:358-362`).
4. **Blueprint is authority; drift is detected and recorded.** Anti-patterns stay banned
   (`implementation-strategy.md:998-1010`); host-config creep is a named review rule (R11
   `:995`). The 13b audit is the model for drift detection: it recorded the 21-kind allowlist
   outrunning the used-by rule, a page-local `<style>` block surviving in the converted home, and
   uncompared registry copies (`analysis/13b:339-369`) — each is a finding against this process,
   closed only by class (a)/(b) deploys, never by tolerating a second authority.

## 7. Open gates: default no SDA change, ask only from evidence

**The default is no SDA change.** The provider decoupling (§4–§5) and the four-section landing
blueprint (§2) rely only on existing estate-provider/read machinery — declared providers with
`bindingState: UNBOUND` readiness, the `provider-inspection` reader and the existing read path
(`analysis/03:121-126,155-164`; `implementation-strategy.md:737-742`). No kernel change is
requested now.

**Prove then request.** A kernel ask may only be derived later from a failing, captured design
artifact: a blueprint attempt that the existing machinery refuses, evidenced by the capture, is
the only admissible basis for a request. The earlier four-point ask — a `browser-runtime` binding
target (today `node`/`python`/`csharp` only), `ui-embodiment-plan.v1` admission, multi-child
`invoke-scenario` composition (page → layout → sections) and page-view testimony
(`implementation-strategy.md:782-794,1024`; `analysis/12:107-120`) — is **withdrawn as premature**.

What can proceed now, through the existing circuit/read path:

- **Blueprint declaration and conformance:** page/layout/section definitions, contracts and
  instances are class (c) estate data served by the declared reader
  (`implementation-strategy.md:247,386-393`).
- **Provider declaration before admission:** provider identities and contracts can be declared
  with `bindingState: UNBOUND` and `REVIEWABLE`/`HELD` readiness, exactly as the login circuit
  proves (`analysis/03:155-164`; `analysis/12:50-52`).
- **Server-loaded provider content:** declared provider content is read through the existing
  reader path (`provider-inspection`; `implementation-strategy.md:737-742`;
  `analysis/03:121-126`), and pure-data provider operations need no browser — the token-set
  reference runs in node with no network, browser or estate (`analysis/12:170-191`).
- **The landing blueprint's declared sections:** navigation, sources, bindings, actions and
  evidence panels bind to existing readers today; the audited Expressibility verdict is the
  per-module checklist (`analysis/13a:379-401`).

**Derived later, if ever:** a kernel ask grounded in a captured failing blueprint artifact per the
prove-then-request rule. On current evidence nothing else is requested — browser-executed provider
realisation (DOM renderers/adapters/action dispatch moving behind the provider boundary),
multi-child composition, provider binding conformance and token publication as data are not an
open gate waiting to be filed (`analysis/12:107-120,138-155`).

## 8. Status

**Strategy documented, not started.** No code, declaration, provider binding, page or migration
has been created by this document. The deployed platform remains as audited: a proven declared
reader and home page, a hard-coded login and Explorer runtime, and shell adapters awaiting the
module-by-module migration above (`implementation-strategy.md:106-163`;
`analysis/13a:396-401`; `analysis/13b:371-380`). Any copy this process later declares keeps the
honesty boundary: architecture/research labelled in development/lab/preview until its gates close
(`intent.md:1414-1430`; `implementation-strategy.md:824-833`).
