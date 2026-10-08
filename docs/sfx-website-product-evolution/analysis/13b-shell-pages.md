# 13b — Shell pages and shared chrome: the hard-coded surface audit

Prepared 2026-10-08. **Lane B audit lane**, research only: no code changed, nothing committed.
Method: every claim below cites `path:line` from the working tree, which is past
[`implementation-strategy.md`](../implementation-strategy.md) Revision 3 — Phase 0 (home) and Phase 1
(second page + crosswalk reader + five kinds) have landed, and a later U2 wave froze six more kinds
as specimen fixtures. Strategy references are to Revision 3; wherever the deployed code contradicts
a strategy promise the conflict is recorded in §6 with both citations. `[proposal]` marks design,
not current behaviour.

Question: for the shell pages (`home`, `login`, the generic declared page), the Explorer shell and
panes, the shared chrome (`site.js`, `site.css`), the page runtime and adapters, the pane layout,
navigation rendering and identity plumbing — **what is hard-coded, what is already declared, could
the deployed 21-kind/12-action vocabulary express it, and who must ship a change.**

---

## 1. The deployed vocabulary (baseline)

| Member | Count | Declared where | Realised where |
| --- | ---: | --- | --- |
| Component kinds | 21 (`hero` … `chart`) | `circuit-host.json:17`; client copy `page-runtime.js:25-33`; served manifest `live-store.mjs:407-415` | adapters `ui-components.js:915-943`; roles `ui-components.js:777-904` |
| Action kinds | 12 | `circuit-host.json` via manifest `live-store.mjs:416-429`; client copy `page-runtime.js:34-47` | see reality column below |
| Dispatch classes | 3 (`local`, `read`, `session-post`) | `live-store.mjs:416-429`; `page-runtime.js:34-47` | fixed table `page-runtime.js:64` |
| Sources | 7 (`catalog`, `scenario`, `details`, `provider-inspection`, `session`, `release`, `crosswalk`) | `live-store.mjs:430-439`; `page-runtime.js:48-56` | resolver `page-runtime.js:314-410` |
| Event names | 7 (`load`, `click`, `submit`, `change`, `select`, `seek`, `toggle`) | `page-runtime.js:62` | `page-runtime.js:507-528` |
| Binding kinds | 5 component (`literal`/`read`/`session`/`release`/`route`), 6 scope (`literal`/`route`/`event`/`form`/`row`/`source`) | `page-runtime.js:60-61` | `page-runtime.js:382-410,530-572` |

**The twelve actions are not twelve realised behaviours.** Of the twelve:

- **Realised for declared pages:** `navigate` (`page-runtime.js:615-620`), `session` with
  sign-in/sign-out/continue (`:621-636`), `observe` (`:638-646`), `objective` (`:647-654`),
  `copy/download` (`:655-671`), `refresh` (`:637`).
- **Vocabulary only:** `select`, `playback`, `view`, `toggle`, `pane`, `stage-change` are in
  `LOCAL_KINDS` (`page-runtime.js:64`) and dispatch nothing but a `CustomEvent('page-action')`
  (`page-runtime.js:672-674`). A repository-wide search finds **no listener** for `page-action`
  (only the dispatch site); the pane behaviour that `pane` names remains hard-coded in
  `pane-layout.js` and the Explorer.

The two registry copies (client `page-runtime.js:22-58`, served `live-store.mjs:413-439`) are
hand-kept and are not compared by any check (`analysis/11-trusted-shell-boundary.md:127-130`).

---

## 2. Page-by-page audit

### 2.1 `home.html` + `home.js` — converted page, chrome stays shell

**Hard-coded.**
- DOM skeleton and chrome: `<!doctype>`/`<title>`/meta (`home.html:6-7`), favicon and stylesheet
  links (`:8-9`), header with brand wordmark, "Live Circuit Platform" label, hard-coded
  Explorer/How-it-works nav and `#env`/`#identity` mounts (`:55-61`), footer with credit, links and
  `#release` (`:65-72`), module tag (`:73`).
- A 43-line page-local `<style>` block (`home.html:10-52`) defining `.hero`, `.counts`, `.cards`,
  `.runs`, `.steps` and their responsive rules — i.e. the presentation of declared kinds is
  page-local, not in the token stylesheet.
- JavaScript chrome: identity area with "Signed in as", "Sign out", "Sign in" (`home.js:12-23`);
  refusal copy (`:30-37`); same-path navigate (`:39-47`); read/digest bind/popstate loop
  (`:49-87`, duplicated from the generic entry); env/identity/footer wiring (`:89-97`).

**Declaration-driven.** The whole `#page-root` body: `home.js:78` mounts `createPageRuntime`; the
served declaration carries hero, section, stat, card-list, list, notice, heading and text sections
with `when.session` variants (`fixtures/pages/home.json:20-388`). The hero's figure is a declared
`read` binding (`home.json:36-47`), and signed-in/out variants are `when`-scoped
(`home.json:120-146,235-288`).

**21/12 expressibility.** Body: already expressed. Chrome: no `brand`/`nav`/`footer` kind exists in
the 21; the page document has a `navigation` member but home does not declare it (only generic
pages render it, `page.js:24-36`). Env label and footer release could be `text` bound to
`release`/host state, but D6 keeps them shell (`implementation-strategy.md:62-63,252`). Identity
area has no kind: `identity-session` was pruned from the declarable set (C26
`implementation-strategy.md:1166-1168`; §4.2 `:288-291`) and no adapter exists
(`ui-components.js:777-904`).

**Change surface.** Body copy/sections: estate declaration, class (c). Chrome, style block, identity
area, digest loop: class (a) shell deploy (`implementation-strategy.md:388-393`).

### 2.2 `page.html` + `page.js` — the generic declared-page shell

**Hard-coded.** Title "SFX Live Circuit Platform" (`page.html:6`); full chrome skeleton with the
same brand/footer markup (`:11-28`); only `site.css` is loaded (`:8`); `#site-nav` (`:14`),
`#identity`/`#env` (`:15`) and `#release` (`:26`) are static mounts. `page.js` binds path → page
read, digest binding, popstate, notice rendering and the nav mount (`page.js:6-84`).

**Declaration-driven.** Navigation renders from the served document into `#site-nav`
(`page.js:24-36,70-73`); body into `#page-root` (`:74`). The `navigation` member is a page-document
field, not one of the 21 kinds.

**What the shell forgets to wire.** `page.js` never calls `session()` or `release()` and never
touches `#identity`, `#env`, `#release` or `document.title` (`page.js:6-7`; imports only `json` and
the runtime). Generic declared pages therefore render an empty identity slot, hidden env, empty
release and the constant title, contradicting the strategy's promise that `page.html` is "shell
chrome (header/footer/nav mount/identity mount)" (`implementation-strategy.md:377-378`) and that a
page definition carries `title` (§5.1 `:444`). This is the largest concrete shell gap on the
declared-page path.

**21/12 expressibility.** Chrome is not expressible (no chrome kinds); declared nav is a document
member and works; the title needs only a shell projection line, no kind.

**Change surface.** class (a) shell deploy to wire identity/env/release/title; nav + body remain
class (c).

### 2.3 `login.html` + `login.js` — out of scope, fully hard-coded

**Hard-coded.** Title (`login.html:6`), 29-line `<style>` (`:9-37`), header/footer (`:40-46,90-97`),
lead copy and "Sign in to observe live runs." (`:51-54`), the `authenticate-ide-user` capability
link and the "DATABASE SCENE" circuit card (`:55-59`), the entire form skeleton with labels,
hints, placeholders, button copy and the password/privacy note (`:62-86`), plus the signed-in card
(`:73-82`). `login.js` hard-codes every disposition message (`:6-21`), the return-target guard
(`:23-27`), session-state rendering ("You are signed in", "Welcome", realm/session/expiry line
`:39-52`), sign-in submit flow and copy (`:61-83`), sign-out (`:85-96`) and the post-auth redirect
(`:98`).

**Declaration-driven.** Only the sign-in circuit preview reads the database scene through
`site.js:38-62` (`login.js:106`); session state comes from the session read (`login.js:54-59`); the
env label comes from host config (`:101-104`). Nothing on the page is a declaration.

**21/12 expressibility.** The `form` kind (`ui-components.js:671-681`), `submit` event with `form`
scope (`page-runtime.js:61,550-556`), and the `session` action intents
(`page-runtime.js:37,621-636`) can express the visible form and its dispatch; `card`/`text` can
express the copy. The session transport cannot and must not be declared. But the page is explicitly
excluded from v1 conversion (`implementation-strategy.md:80-81`), so this is not-yet-declared, not
a v1 deliverable.

**Change surface.** Body: estate declaration + class (a) if ever converted. Transport: shell trust
(§2.10).

### 2.4 `explorer.html` + `explorer.js` — shell and panes only

**Hard-coded shell.** Title (`explorer.html:5`); three stylesheets (`:7-9`) plus a 183-line
page-local `<style>` (`:10-192`) owning the workspace grid, both splitters, drawers, tabs, objective
row, run bar, legend, evidence grid, provider profile and view controls; header with identity mount
(`:195-201`); the whole workspace DOM (`:202-315`) — tree aside and picker (`:203-206`), splitter
ARIA and numeric defaults (`:207,273`), capability head with hard-coded "Capability Explorer"
(`:210-218`), toggle/refresh/expand labels (`:213-216`), scenario bar (`:220`), tabs mount (`:221`),
objective panel with placeholder and mic SVG (`:223-239`), run controls ("LIVE RECEIPTS ·
real-time", Replay/Pause/Step/Speed/Return, Linear/Paged, Fit/100%/125%, follow/overlay)
(`:240-256`), legend (`:265`), run evidence disclosure (`:269-270`), context tabs (`:275-279`),
Observe box (`:283-297`), runs panel (`:299-305`) and evidence tab (`:306-314`); status bar
(`:317`).

**Hard-coded JS shell/panes.** URL parameter vocabulary (`explorer.js:13-15,36-42`), field/table
presentation limits (`:18-19`), header/titles ("Capability Explorer", document title `:116-117`),
tree/badge/chip rendering copy (`:135-167`), section fallback copy ("Not read…", "Read on demand…",
`Declared presentation: … shown as a table` `:191-217`), context labels (`:223-242`), status-bar
templates (`:244-253`), identity area ("Signed in as…", "Sign in", "Observe requires sign-in")
(`:257-268`), picker/expand wiring (`:269-282`), **the two pane descriptors** (ids, `--tree`/
`--context` variables, sides, min/max/default widths, names 'sections'/'details'
`:285-291`), objective follow (`:294-311`), popstate (`:312-330`) and the host-config boot with
`/api/circuit/v1/home` default selection (`:332-342`, especially `:338-340`).

**Declaration-driven.** The tree, tabs, sections, counts, badges and per-scenario attribution are
the capability-details document's declared navigation (`explorer.js:8,151-205`;
`explorer-model.mjs`); the circuit scene is a declared reader (`explorer.js:69-82`); the catalog is
a declared read (`:334-337`).

**21/12 expressibility.** The strategy keeps the Explorer's deep runtime out of declarable content
in v1 and out of scope for conversion (`implementation-strategy.md:80-81,295-299`); its
`circuit-scene`/`run-report`/`provider-profile`/`objective-composer` "are **not** declarable
content components in v1". Pane chrome cannot be expressed: the layout declaration has regions and
policy only (`implementation-strategy.md:461-476`), and `pane` is an inert action (§1).

**Change surface.** class (a) shell deploy only in v1; any declarable Explorer surface waits for a
later phase and G2.

### 2.5 `site.js` + `site.css` — shared chrome

**Hard-coded in `site.js`.** `$` (`:4`); same-origin JSON fetch wrapper (`:6-12`); endpoint
literals for home/session/release (`:14-15,20`); `circuitHref`'s hard-coded `/circuit/explorer?`
plus query-parameter names (`:24-29`, mirrored in `ui-components.js:117-122`); `sha256` and the
digest-checked `circuitPreview` (`:31-62`, digest refusal `:48`); `signOut` (`:64-66`);
`footerRelease`'s fallback copy "Release not reported by this host" (`:68-70`).

**Hard-coded in `site.css`.** All base tokens (`:4-12`), including the accent `--cyan: #72D7EE`
(`:7`); header/nav/identity chrome (`:30-39`); buttons (`:42-49`); type roles (`:52-56`); panels
(`:58-60`); circuit-card preview (`:62-70`); footer (`:73-79`); a 900 px breakpoint (`:81-87`).
The declared-component class vocabulary used by `ui-components.js` — `.counts`, `.count`, `.cards`,
`.card`, `.runs`, `.badge`, `.status-chip`, `.field-list`, `.declared-table`, `.timeline-wrap`,
`.gallery-grid`, `.declared-form`, `.chart-series`, `.page-section` — is **absent from every
deployed stylesheet**; it exists only inside page-local blocks (`home.html:14-41`,
`explorer.html:37-40,58-71,104-177`). A generic declared page loads only `site.css`
(`page.html:8`), so Phase-1/U2 kinds render unstyled there. `circuit-canvas.css:8-20` consumes
`var(--observation)`, which only `explorer.html:14` defines.

**Declaration-driven.** Nothing in `site.js`/`site.css`; they are shared shell code.

**21/12 expressibility.** Routes, cookie endpoints and the digest-check semantics are shell law
(`analysis/11-trusted-shell-boundary.md:47,59`). Footer release and env label could be `text`
bindings but are chrome by D6. The declared `hero`/`media.figure` adapters already reproduce the
site.js preview (including digest check, `ui-components.js:164-197`), so the login-only
`circuitPreview` path is duplicative shell.

**Change surface.** class (a) shell deploy. D7 names `site.css` the one web token source
(`implementation-strategy.md:253`); its incompleteness is a conflict (§6.3/§6.9).

### 2.6 `page-runtime.js` — the projector (trust boundary)

**Hard-coded.** `UI_REGISTRY` client copy (`:22-58`); closed binding/scope/event/when vocabularies
(`:60-64`); `safeUrl` (`:86-100`); client `validatePage` (`:177-258`); source plan and fetch
(`:314-366`); binding resolution (`:382-433`); region containers (`:435-453`); event attachment
and load firing (`:507-528`); scope binding and input resolution (`:530-582`); `postRun` to
`/api/circuit/v1/runs` with idempotency key (`:589-607`); `dispatchAction`
(`:613-675`, inert local event `:672-674`); render loop (`:687-730`).

**Declaration-driven.** Everything the document supplies: sections, variants, props, bindings,
actions, events, layout regions.

**21/12 expressibility.** This module *is* the expression mechanism. Adding a kind, source or
action requires editing this registry plus the served manifest plus the adapters — a shell deploy
by design (`implementation-strategy.md:310-314`). The client registry copy is not checked against
the server manifest (`analysis/11-trusted-shell-boundary.md:127-130`).

**Trust boundary.** Yes — client validator and the single dispatch decision
(`analysis/11-trusted-shell-boundary.md:45`; strategy §8.5 `:851-857`).

### 2.7 `ui-components.js` — adapters (trust boundary)

**Hard-coded defaults and chrome per adapter.** State strings ("Reading the circuit from the
database…", "The scene returned no circuit page.", digest failure `:7-9`); `h()` handler-stripping
primitive (`:15-28`); `safeHref` (`:51-58`); role resolution helper (`:87-92`); button/link default
labels "Open the Live Circuit" (`:227`), "Continue" (`:260`), "Open circuit" (`:345`), "Open"
(`:408,411`), "Continue" (`:456`), "Submit" (`:676`), "Not in the current estate" (`:341`), empty
defaults (`:502,710,724,756`); figure chrome "Circuit"/"DATABASE SCENE"/"Database circuit"
(`:200,205,207`); hard-coded class vocabulary and DOM wrappers per kind.

**Declaration-driven.** Kind/role/prop/state table (`:777-904`) with `supportedRoles` derived
(`:908-913`); `UI_COMPONENTS` map (`:939-943`); all rendered content through `declared()` /
`context.resolve` (`:87-98`) with text via `textContent`.

**21/12 expressibility.** All 21 kinds have adapters; several default labels are overridable by
declared props (`item.linkLabel`, `item.missing`, `empty`, `submit.label`) while others are not.
New kinds or role changes need a shell deploy (`implementation-strategy.md:303-314`).

**Trust boundary.** Yes — registry, role table, handler-free construction
(`analysis/11-trusted-shell-boundary.md:46`).

### 2.8 `pane-layout.js` — Explorer pane behaviour

**Hard-coded.** Storage key `sfx.explorer.panes.v1` (`:5`), mobile media query (`:6`), minimum/
step constants (`:7`), localStorage read/write (`:9-10`), pane mounted-check and state
(`:12-20`), splitter measurement (`:21`), min/max math against `MAIN_MINIMUM` and the neighbour
(`:24-28`), ARIA/title sync with labels "Show/Hide ${name}"/"Open ${name}" (`:31-40`), pointer
drag (`:54-75`), keyboard resize (Enter/Space/arrows/Home/End, `:76-85`), toggle click (`:86`) and
viewport clamping (`:89-92`). Pane descriptors are passed hard-coded from `explorer.js:285-291`.

**Declaration-driven.** Nothing.

**21/12 expressibility.** `pane` exists as a declared action kind (`page-runtime.js:43`;
strategy B.2 `:1084`) but has no realisation or listener; the layout declaration offers regions and
policy only (`implementation-strategy.md:461-476`). Expressing pane layout as data would need a
layout-schema extension plus a listener — a shell deploy, not a publication.

**Trust boundary.** No credential/authority concern; this is **merely not-yet-declared** shell
chrome (client-local persistence and pointer handling).

### 2.9 `navigation.js` — authority/detail renderer

**Hard-coded labels.** "Related declarations" (`:19`), "Used by · …" (`:17`), "Declared authority"
and "items/members" (`:27`), "Show more members" (`:29`), the 50-member batch (`:30-34`), and the
detail renderer's headings, "Database declaration", warning text, "Complete returned declaration
JSON" and the reads-are-not-execution disclaimer (`:41-51`).

**Declaration-driven.** Its data — targets, links, findings, definition digests, bodies — all come
from the reader documents (`:11-20,40-51`).

**21/12 expressibility.** It is an Explorer deep renderer (`circuit-runtime.js:9`), not a
declarable component; no kind matches "authority tree/detail". Stays shell in v1.

**Change surface.** class (a) shell deploy.

### 2.10 `identity-session.mjs` — identity plumbing (trust boundary)

**Hard-coded.** Policy load from `circuit-host.json` (`:12`); route prefix
`/api/circuit/v1/session` (`:13`); cookie name from policy (`:14`), bearer shape (`:16`), bounded
label/attribution maps (`:18-20`); endpoint env and fetch (`:22,58-74`); cookie flags
HttpOnly/Secure/SameSite=Strict (`:169,27`); same-origin JSON CSRF half (`:41-46`); session
validation and refusal disposition mapping (`:83-93,110-187`); Observe attribution (`:97-108`).

**Declaration-driven.** None, deliberately. The displayed identity strings come from callers:
`home.js:16-21`, `explorer.js:257-268`, `login.js:39-51`.

**21/12 expressibility.** The transport can never be a declaration (credential handling). The
visible identity area could be a declared component only after a shell deploy; the `session` action
already expresses sign-in/out/continue intent on declared controls (`page-runtime.js:621-636`), and
home already declares a sign-in notice (`home.json:264-288`).

**Trust boundary.** Yes — cookie/bearer/session (`analysis/11-trusted-shell-boundary.md:59`).

---

## 3. Classification: trust boundary vs merely not-yet-declared

| Surface | Class | Why |
| --- | --- | --- |
| `page-runtime.js` validator/dispatch/`safeUrl`; `ui-components.js` registry/role table/`h()` | **Trust boundary — shell** | A declaration must never validate, dispatch or install code (`analysis/11:45-46,73-74`) |
| `identity-session.mjs`; session/run endpoints in `site.js`, `page-runtime.js:589-607` | **Trust boundary — shell** | Cookie, bearer, CSRF, route/method law; provider/declaration must never widen it (`analysis/11:58-59`) |
| Route→page binding, digest bind/popstate (`page.js:38-84`, `home.js:49-87`) | **Trust boundary — shell** | Path/revision/digest synchronisation (`analysis/11:44`) |
| Chrome header/nav/footer, brand, env label, footer release, identity area mounts | **Shell chrome by decision (D6)** | Strategy keeps chrome and identity shell (`implementation-strategy.md:62-63,252`); not a security boundary beyond the session display |
| `pane-layout.js`, splitter ARIA, pane descriptors | **Not-yet-declared shell chrome** | No authority, no credentials; `pane` vocabulary exists but is inert |
| Login page body/copy/form | **Not-yet-declared, out of v1 scope** | `implementation-strategy.md:80-81`; `form`/`session` vocabulary could carry it |
| Adapter default labels, empty-state copy, figure chrome | **Shell (adapter code) but partly declarable** | Overridable roles exist (`item.linkLabel`, `empty`, `submit.label`); defaults need a deploy |
| Page-local `<style>` blocks and page-specific layout classes | **Shell deploy surface** | Conflict with D7/C11 (§6.2); Explorer exempted in v1 |
| Home/login/Explorer bodies, sections, copy, nav once converted | **Estate declaration (class c)** | Already proven for home (`fixtures/pages/home.json`) and the second page |

---

## 4. Expressibility against the 21 kinds / 12 actions

| Hard-coded surface | Closest deployed vocabulary | Verdict |
| --- | --- | --- |
| Home/generic/login header, footer, brand, chrome | none (no chrome/nav/brand kind; `navigation` is a page-document member only, `page.js:24-36`) | **Not expressible today; stays shell by D6** |
| Identity area (signed-in-as, sign out/in) | `session` action intents (`page-runtime.js:37,621-636`) on `notice`/`section`/`hero` action roles; `identity-session` kind pruned, no adapter | **Actions expressible; the chrome component is not** until a shell deploy admits a kind (C26 removed it) |
| Env label, footer release | `text` bound to `release` (`page-runtime.js:399-402`) | Expressible, but kept shell by D6 |
| Home hero figure / login circuit preview | `hero` figure binding + `media.figure` digest check (`ui-components.js:164-197,392-437`) | Already expressed for home; login not converted |
| Login form and copy | `form` + `text`/`heading`/`card` + `session` action + `submit`/`form` scope | Expressible; page out of v1 scope |
| Explorer tree/tabs/sections | capability-details declared navigation (already) | Already declaration-driven, not 21-kind based |
| Explorer deep components (circuit scene, run report, provider profile, objective) | deliberately not declarable in v1 (`implementation-strategy.md:295-299`) | Expressibility deferred to later phase/G2 |
| Pane layout/splitters/keyboard/persistence | `pane` action kind exists but inert (`page-runtime.js:672-674`); layout schema regions/policy only | **Not expressible without shell work** (layout schema + listener + adapter) |
| `select`/`playback`/`view`/`toggle`/`stage-change` behaviour on declared pages | kinds are declared; local dispatch emits an unlistened event | **Vocabulary without a seam** (§6.6) |
| Media references | `media.figure`/`media.gallery` admit any safe http(s) URL (`page-runtime.js:91-97`; `ui-components.js:417-423,685-697`) | Expressible, but the strategy's allowlist promise is not enforced (§6.8) |

---

## 5. Change surface summary

| Change | Surface | Citation |
| --- | --- | --- |
| Copy, sections, cards, nav instances, `when` variants, bindings, actions/events on declared pages | Estate declaration, class (c) | `implementation-strategy.md:392`; `fixtures/pages/home.json` |
| New page instance of deployed kinds | Estate declaration after route host/registry shipped | `implementation-strategy.md:310-314` |
| `readers.page`, `ui-registry` manifest, `circuit-host.json` allowlist/trust | Reader projection / class (b) shell deploy | `circuit-host.json:17-24`; `live-store.mjs:413-439` |
| Chrome, identity mount, page title/env/release wiring on generic pages | class (a) shell deploy | `page.html:6,14-15,26`; `page.js:6-7` |
| New component kind/source/action or adapter role; client registry parity | class (a)/(b) shell deploy | `page-runtime.js:22-58`; `ui-components.js:777-904` |
| Token rename/alias, component-class styles in the one stylesheet | class (a) shell deploy | `site.css:4-12`; `implementation-strategy.md:253` |
| Pane behaviour, layout policy extension | class (a) shell deploy | `pane-layout.js:5-92`; `implementation-strategy.md:461-476` |
| Session cookie/transport/CSRF, routes, run POST | Never declarable; shell trust | `analysis/11:49-59`; `identity-session.mjs:110-187` |

---

## 6. Strategy promises vs the deployed code

| # | Promise (strategy) | Reality (code) | Severity |
| ---: | --- | --- | --- |
| 1 | Phase admission is **used-by rule**: only kinds a phase consumes are admitted; `identity-session` waits for a page use; Phase 1 adds exactly `table`, `field-list`, `disclosure`, `badge`, `status-chip` (`implementation-strategy.md:267-270,293-299,718-721,1077-1080`; C26 `:1166-1168`) | The deployed allowlist advertises **21 kinds** (`circuit-host.json:17`; `page-runtime.js:25-33`), including six with no published page use — `tabs`, `timeline`, `form`, `media.gallery`, `code`, `chart` — carried by U2 specimen fixtures (`verify-pages.mjs:21-22,27-34`; commits `a59babb`, `48bd0e8`) | High: the staged-admission promise no longer describes the shell |
| 2 | "Ban page-local `<style>` blocks in new and converted pages" (D7 `implementation-strategy.md:253`; anti-pattern `:1007-1008`) | The converted home page still ships a 43-line `<style>` block (`home.html:10-52`); `login.html:9-37` and `explorer.html:10-192` also carry blocks (Explorer explicitly exempt; login out of scope) | High for home: converted page violates its own rule |
| 3 | Rename the accent to `--observation`, keep `--cyan` as deprecated alias (D7 `implementation-strategy.md:253`; G7 `:1029`; A.1 `:1045`) | `site.css:7` still defines only `--cyan`; `--observation` exists only page-locally (`explorer.html:14`), and `circuit-canvas.css:8-20` consumes it with no global definition | Medium: alias direction inverted |
| 4 | `page.html` is shell chrome including the **identity mount** (`implementation-strategy.md:377-378`) | `page.js` never reads session/release and never fills `#identity`, `#env`, `#release` (`page.html:14-15,26`; `page.js:6-7,84`) | High: generic declared pages have a dead identity area |
| 5 | Page definition carries `title` (`implementation-strategy.md:444`) | `page.html:6` hard-codes the title; `page.js` never projects the declared title | Low/medium: declared field unused |
| 6 | The twelve action kinds name pre-existing browser seams; `pane` maps to `pane-layout.js` (strategy §4.4 `:326-339`; B.2 `:1084-1086`) | `select`, `playback`, `view`, `toggle`, `pane`, `stage-change` dispatch only an unlistened `page-action` event (`page-runtime.js:64,672-674`); pane behaviour is not reachable from a declaration | High: vocabulary claims seams that do not exist for declared pages |
| 7 | `refresh` = "existing GET reads with `refresh=1`" (strategy §4.4 `:339`) | `refresh` calls `render()` and re-reads sources with no `refresh=1` parameter (`page-runtime.js:637,348-366`) | Medium: bypass is not reached; server cache unchanged |
| 8 | v1 media is restricted to `CIRCUIT_FILES` allowlisted assets; new media is a class (a) deploy (strategy §1.1 `:63-65`; C5 `:393-394`) | `safeUrl` admits any http/https host (`page-runtime.js:86-100`), and `media.figure`/`media.gallery` render declared external `src`/`items[].url` with provider digests attached (`ui-components.js:417-423,685-697`) | High: the media allowlist is not enforced in the shell |
| 9 | `site.css` is the one deployed token source and the design-token stylesheet (strategy `:59,253`) | Component classes emitted by the adapters (`.counts`, `.cards`, `.badge`, `.status-chip`, `.field-list`, `.declared-table`, `.timeline-wrap`, `.gallery-grid`, `.declared-form`, `.chart-series`, `.page-section`) exist only in page-local blocks, not in any deployed stylesheet; generic pages load only `site.css` (`page.html:8`) and render those kinds unstyled | High for Phase 1/U2 pages: presentation stranded per page |
| 10 | Only `home.featured` retires; the host endpoint stays for the Explorer (C1 `implementation-strategy.md:205-206`) | Consistent: `home.js` no longer reads `featured`; `observe-server.mjs:58-61` still serves the now-empty `featured` field (residue, not a violation) | Informational |

---

## 7. Verification and limits

- The client validator, `safeUrl` and inert-local-action behaviour are source-verified here; the
  specimen posture checks are the client validator's vocabulary, not DOM proof, by their own
  limitation note (`verify-pages.mjs:409-414`).
- Rendering-safety is source-scanned (`textContent`, no `innerHTML`, `safeUrl` present,
  `verify-pages.mjs:383-397`); DOM execution proof is the browser gate's (WP0.7).
- No check compares the client `UI_REGISTRY` (`page-runtime.js:22-58`) with the served manifest
  (`live-store.mjs:413-439`); the gap was already recorded in
  `analysis/11-trusted-shell-boundary.md:127-130` and remains open.
- No check reads the `<style>` blocks or token aliases, so conflict §6.2/§6.3 stays invisible to
  acceptance.
- File-backed specimens (`verify-pages.mjs:27-34`) prove the deployed vocabulary, not that any
  published page uses the six U2 kinds.

## 8. Bottom line

The shell's trust boundary is correctly minimal in the places that matter: validation, dispatch,
URL admission, the registry/role table and the whole identity transport are shell code, and the
home body is genuinely declaration-driven. Everything else is a spectrum: **mere chrome** (header,
footer, brand, env, release), **a dead mount** on generic pages (identity/env/release/title),
**inert vocabulary** (six local action kinds and `pane`), **presentation stranded in page-local
styles**, and **an admitted-kind set that outran the strategy's staged-admission rule**. The
change surface for all of it is already named: estate declarations for content, the reader/manifest
for sources, and a class (a)/(b) shell deploy for chrome, adapters, tokens and seams.
