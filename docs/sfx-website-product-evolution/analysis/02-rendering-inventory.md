# 02 — Rendering inventory and reusable component taxonomy

Lane 2 of the SFX website evolution research (see
[`research-brief.md`](../research-brief.md)). Research only: no product code was
changed. Every claim about current behavior cites `path:line`. Proposals are
labelled `[proposal]`. The inventory covers the Live Circuit pages under
`live-circuit/circuit/` plus their CSS and the acceptance scripts named in the
brief.

---

## Inventory (observed)

### 0. DOM construction primitives

| primitive | where | generic? | reuse |
| --- | --- | --- | --- |
| `el(tag, attributes, children)` — attribute/`text`/`on*` element factory | `circuit-viewer.js:3-11` | generic, used by ~10 modules (e.g. `explorer.js:22-24`, `run-context.js:6-11`, `provider-profile.js:49-63`) | High |
| `svg(tag, attributes)` — SVG namespace factory | `circuit-viewer.js:15-19` | generic; only scene/wires use it (`circuit-viewer.js:132,191-203`) | Medium |
| `$ = id => document.getElementById(id)` | `site.js:4`, re-declared in `circuit-runtime.js:15`, `observe-panel.js:121`, `run-context.js:5` | generic | High |
| `json(path, options)` — same-origin fetch + parse | `site.js:6-12`; run-scoped copy `circuit-runtime.js:16` | generic | High |
| placement helper `placer` (percent coordinates) | `circuit-viewer.js:14` | scene-specific | Low |

### 1. Text, headings, prose

- Hero headline/lede/eyebrow are static HTML with ids filled by script:
  `home.html:67-69` filled at `home.js:24-27`; static classes `.eyebrow`,
  `.display`, `.lede`, `.micro`, `.section-title` at `site.css:52-56`.
- Section headings built in JS: `el('h1')` via `$('title').textContent`
  `explorer.js:116`; `el('h2', {text: node.label})` `explorer.js:186`;
  provider headings `provider-profile.js:49-51`.
- Paragraph helpers: `paragraph(text, className)` `circuit-runtime.js:17`;
  `p(text, cls)` `run-context.js:6`; login status strings `login.js:29`.
- Value formatting `show(value)` (null → `—`, object → JSON) duplicated:
  `explorer.js:21`, `provider-profile.js:13`.
- Generic? Text is trivially generic; the class vocabulary is shared.
  Reusability: **High** (text/heading component).

### 2. Cards and panels

- Home capability cards: skeleton via `innerHTML` then `querySelector` fills,
  `home.js:66-81`; CSS `.cards`/`.card` `home.html:34-41`, `.card.missing`
  `home.html:41`.
- `.panel` base token `site.css:59`; `.panel-label` `site.css:60`.
- Circuit preview card markup duplicated in two pages:
  `home.html:76-80` and `login.html:55-59` (same ids `circuit-figure`,
  `circuit-caption`, `circuit-link`, `circuit-label`), rendered by
  `site.js:38-62`.
- `.record` bordered row shape `explorer.html:72`, reused by
  `provider-profile.js:129,147`.
- Rating: **High** for a `card`/`panel` component; the two circuit-card
  occurrences are the same component already.

### 3. Tables

- Explorer rows view: column filter, sticky header, row click selection,
  row cap and "Show all": `explorer.js:206-219` (tbody/tr at `212-213`,
  `table-wrap`/`table` at `217`, show-all at `218`).
- Provider profile table from result-set columns: `provider-profile.js:52-57`.
- Run trace table with hard-coded headers `run-context.js:126-128`.
- CSS: `explorer.html:63-69` (`.table-wrap`, `th` sticky, `td` ellipsis,
  `tr[aria-selected]`), `run-evidence.css:20` (`.trace-table`).
- Generic? The pattern is generic and appears three times with three column
  sources (`explorer-model.mjs:57`, `provider-profile.js:55`,
  `run-context.js:126`). Reusability: **High**.

### 4. Key-value grids / field lists

- `fields(entries)` → `dl.fields` with `dt`/`dd`, `explorer.js:22`; CSS
  `explorer.html:70-71`.
- `fields(host, row, skip)` → `dl.answer-fields`, `provider-profile.js:58-62`;
  CSS `run-evidence.css:11-13`.
- Recursive `values(value)` for API output, `run-context.js:16-21`.
- Authority tree renders nested objects with counted folds and batch loading,
  `navigation.js:24-38`.
- Nearly identical across files (`explorer.js:22` vs `provider-profile.js:58-62`
  vs `run-context.js:16-21`). Reusability: **High** (`field-list`).

### 5. Lists

- Home "your runs" list: static `ul.runs` `home.html:23-25`, filled
  `home.js:38-45`; CSS `home.html:23-25`.
- Explorer tree rows: `button.tree-item` with `.label`, `.count`, badges,
  chips `explorer.js:135-150`; CSS `explorer.html:29-40`.
- Runs tab list: `a.run-row` with strong/time/small `run-context.js:53-54`;
  CSS `run-evidence.css:17-19`, asserted in
  `verify-run-evidence-browser.mjs:88`.
- Reusability: **High** (`list`); the tree adds grouping/badges.

### 6. Tabs and segmented controls

- Section tabs (`role=tablist`): `explorer.js:168-178`, markup slot
  `explorer.html:221`, CSS `.tabs`/`.tab` `explorer.html:48-50`.
- Context tabs: markup `explorer.html:275-279`; behaviour incl. arrow-key
  roving tabindex `run-context.js:23-42`.
- Linear/Paged segmented control: `explorer.html:247-252`, wiring
  `circuit-runtime.js:394-395`, CSS `.seg` `explorer.html:180-184`.
- Generic? Two independent tab implementations with the same ARIA idea.
  Reusability: **High** (`tabs`), **Medium** (`segmented`).

### 7. Timelines / tracks

- Invocation timeline: interval spans, click-to-seek, playhead, seek range,
  `run-context.js:93-114`; CSS `.invocation-track`/`.timing-span`/
  `.invocation-playhead`/`#replay-seek` `run-evidence.css:24-32`; playhead
  position updated `run-context.js:142-145`.
- Replay clock readout inside the run bar `circuit-runtime.js:259`.
- Generic? The data mapping is domain-shaped, the track/span/playhead pattern
  is generic. Reusability: **Medium** (`timeline`).

### 8. Canvas / SVG scenes

- The only drawer of circuit scenes is `circuit-viewer.js`:
  `renderCircuitViewer(root, deck, slide, view, options)` `:125-225`; DOM built
  once per slide key `:128-157`; hit areas `:135-142`; slide links `:143-150`;
  navigation links `:151-156`; per-render state classes and ARIA `:160-177`;
  wires `:178-194`; tokens `:195-208`; telemetry `:209-224`.
- Geometry derivation `boundaryGlyphs` `:29-72`, hand-authored route resolution
  `slideRoutes` `:75-117`.
- Home/login preview renders the same database scene as an SVG image with
  digest verification `site.js:38-62`.
- traversal.js **computes** the model/state only (header `traversal.js:1-11`;
  `buildTraversal` `:181-238`, `traversalState` `:409-420`, `LiveMotion`
  `:426-498`) and never touches DOM. deck-trace.js computes joins/timelines
  (`joinTestimony` `:48-69`, `joinFlow` `:74-180`, `replayTimeline` `:258-327`).
- Generic? Domain renderer; must remain its own component/provider. Its
  options object `circuit-viewer.js:126` is the reusable mounting contract.
  Reusability: **Low** as a generic primitive, **High** as a retained
  domain component.

### 9. Forms and editors

- Login form: static labels/inputs `login.html:67-71`, submit + error mapping
  `login.js:61-83`.
- Schema-driven observe fields: `inputFields` `observe-panel.js:22-28`,
  `fieldKind` `:29-37`, `fieldControl` `:62-87` (IDs `field-<path>`
  `:76`), JSON↔field sync `:147-161`.
- Raw JSON editor `explorer.html:288` with stale-state banner
  `explorer.html:121` and `observe-panel.js:156-160`.
- Objective composer: textarea + mic + Run `explorer.html:224-236`, mount and
  dictation `objective-run.js:93-236`; mic icon is the prompt-shell SVG
  `explorer.html:230-233` (asserted `verify-objective.mjs:19`).
- Provider instruction editor `provider-profile.js:82-89`; engagement
  path/value row `provider-profile.js:122-132`.
- Generic? The observe field derivation is already a generic schema-form
  renderer. Reusability: **High** (`form`/`fields`), **Medium** for the
  specialized JSON editor and composers.

### 10. Action bars

- Capability header actions `explorer.html:212-217`; CSS `.actions`
  `explorer.html:46-47`.
- Run bar `explorer.html:240-256`; CSS `explorer.html:94-100`.
- Observe actions `explorer.html:289-290`, CSS `explorer.html:176`.
- Evidence actions `run-context.js:85-90`; CSS `.evidence-actions`
  `run-evidence.css:16`.
- Document row `provider-profile.js:132`.
- Reusability: **High** (`action-bar`).

### 11. Menus / selects

- `select` ids: `capability` (datalist picker) `explorer.html:204`,
  `scenario` `:220`, `speed` `:245`, `zoom` `:250`, `slide` `:255`,
  `detail-page` `:258`; summary rate `objective-run.js:54-55`.
- Reusability: **High** (plain `select`/`field`).

### 12. Badges / status

- `.badge` refuse/warn `explorer.js:140-141`, CSS `explorer.html:37-39`;
  `.chip` `explorer.js:142,187`, CSS `:40`.
- `.profile-chip` ok/warn `provider-profile.js:63,100-102`, CSS
  `explorer.html:166-168`.
- Requested-capability chips with `data-state` `objective-run.js:221-224`,
  CSS `explorer.html:156-160`.
- Run outcome chip `.run-outcome` `run-context.js:64`, CSS
  `run-evidence.css:7`; asserted `verify-run-evidence-browser.mjs:165`.
- Four class families express one concept. Reusability: **High**
  (`badge`/`status-chip`).

### 13. Banners / notices / errors

- `notice(text, kind)` `explorer.js:23`, CSS `.notice`/`.notice.error`
  `explorer.html:60-62`; used at `explorer.js:158-159,191,197,201`.
- `missing(text)` "Not captured" banner `run-context.js:9`, CSS `.not-captured`
  `run-evidence.css:8-10`.
- Plain warning/error paragraphs `.warning`/`.error` `explorer.html:109`
  (e.g. `circuit-runtime.js:288-290`).
- Login status line with error/ok class `login.js:29`, CSS `login.html:25-26`.
- Reusability: **High** (`notice`/`banner`).

### 14. Empty and loading states

- Explorer empty canvas `#empty` `explorer.html:56`, set at `explorer.js:54`
  and `circuit-runtime.js:64,199`; CSS dashed border `explorer.html:56`.
- Tree/section loading and error notices `explorer.js:153-156,182-184`.
- Circuit preview loading/error `site.css:68` (`.circuit-figure .state`), set
  `home.html:78`, `home.js:95-96`, `login.js:107`.
- Run report placeholders `run-context.js:62,68-73`.
- Observe statuses `observe-panel.js:125,183,202,244`.
- Reusability: **High** (`empty-state`/`loading`/`error-state`).

### 15. Media

- Brand images `site.css:32-34`; footer logos `site.css:75`; decorative
  artwork backgrounds with breakpoint swaps `site.css:21-27,24-27`.
- Circuit figure image `site.css:66-67`; deck slide image
  `circuit-viewer.js:131`.
- Reusability: **Medium** (`media.figure`, must keep digest check
  `site.js:48`).

### 16. Disclosure / folds

- Native `details`/`summary` used as a UI primitive throughout:
  run evidence `explorer.html:269`, observe box `:283`, API result `:295`,
  declared schema `:296`; `details()` helper `circuit-runtime.js:18`;
  `detail(label, content)` `run-context.js:10`; authority tree
  `navigation.js:24-38`; provider change fold `provider-profile.js:77-80`;
  raw sets `provider-profile.js:164-166`.
- Reusability: **High** (`disclosure`).

### 17. Status bar

- Explorer footer status `explorer.html:74-76`, rendered from read metadata
  `explorer.js:244-252`. Reusability: **Medium** (`status-bar`).

### 18. Layout: workspace, panes, grids, chrome

- Workspace grid with two resizable panes and splitters `explorer.html:17-24`;
  drag/keyboard/collapse/persistence engine `pane-layout.js:12-94`; mount
  config `explorer.js:285-291`; narrow-window drawers
  `explorer.html:86-92`.
- Page grids: hero `home.html:11-12`, counts `:14`, signed panels `:19`,
  steps `:27`, cards `:34`, auth `login.html:13`.
- Header/footer chrome repeated in all three pages: `home.html:55-61,111-118`;
  `login.html:40-46,90-97`; `explorer.html:195-201`.
- Reusability: **High** — `pane-layout.js` is already a provider-shaped module.

---

## Duplication

Ordered by cost:

1. **Tables, three ways.** `explorer.js:212-217`, `provider-profile.js:54-56`,
   `run-context.js:126-128` build the same `thead/tbody/td(title)` structure
   from three different column sources. Only the explorer one has selection
   and row caps (`explorer.js:213,218`).
2. **Key-value lists, three ways.** `explorer.js:22` (`dl.fields`),
   `provider-profile.js:58-62` (`dl.answer-fields`), `run-context.js:16-21`
   (`values()` recursion). Same `show()` formatter copied at
   `explorer.js:21` and `provider-profile.js:13`.
3. **JSON folds.** `circuit-runtime.js:18`, `run-context.js:10-11`,
   `navigation.js:51`, `provider-profile.js:112,164-166` all wrap
   `summary` + `pre(JSON.stringify…)`.
4. **Status vocabulary, four families.** `.badge` `explorer.html:37-39`,
   `.chip` `:40`, `.profile-chip` `:166-168`, `.requested-chip` `:156-160`;
   plus `.run-outcome` `run-evidence.css:7`.
5. **Chrome and identity.** Header/footer markup copied across
   `home.html:55-61,111-118`, `login.html:40-46,90-97`,
   `explorer.html:195-201`; identity area implemented twice
   (`home.js:10-21` vs `explorer.js:257-268`) with the same
   sign-in/sign-out/`slice(0,8)` logic.
6. **Circuit preview.** Identical markup `home.html:76-80`, `login.html:55-59`
   and calls `home.js:93`, `login.js:106`; the renderer is already shared
   (`site.js:38-62`).
7. **Row presentation switch.** The "fields vs table" decision is data-driven
   by presentation name in `explorer.js:18,208-210` but the two renderings
   (`explorer.js:208-219`) share selection semantics `explorer.js:93-99`.

---

## Design tokens and reusable CSS

Observed tokens and classes a component set should consume:

- **Variables** `site.css:4-12`: `--bg --bar --panel --panel-solid --white
  --muted --dim --cyan --blue --green --amber --red --line --shade --radius
  --gutter`, dark `color-scheme`, base font. Explorer adds `--observation
  --violet --tree --context --splitter` `explorer.html:14`; timing spans use
  `--violet` `run-evidence.css:29`; scene phase colors resolve through a local
  `--signal` `circuit-canvas.css:10-27`.
- **Type classes** `site.css:52-56` (`eyebrow`, `display`, `lede`, `micro`,
  `section-title`) and `panel-label` `site.css:60`.
- **Surfaces** `.panel` `site.css:59`, `.wrap` `site.css:18`, `.button`
  variants `site.css:42-49`, focus ring `site.css:16`, `[hidden]`
  `site.css:17`.
- **State classes as public API**: `.muted/.warning/.error/.observation`
  `explorer.html:109`; `.badge.refuse/.warn` `:38-39`;
  `.requested-chip[data-state=…]` `:157-160`;
  `.component-hit[data-phase|data-current|data-busy|data-visited]`
  `circuit-canvas.css:11-27`; `tr[aria-selected=true]` `explorer.html:69`;
  `.tab[aria-selected=true]` `:50`; `.tree-item[aria-current=true]` `:34`.
- **Responsive rules**: artwork swap at 900px `site.css:24-27`; nav collapse
  `site.css:81-87`; home grids 4→2→1 `home.html:42-51`; auth single column
  `login.html:32-36`; explorer desktop splitters vs mobile drawers at 1150px
  `explorer.html:78-92`; evidence grid single column `explorer.html:178`.
- **Reduced motion**: global `site.css:88`, scene `circuit-canvas.css:34`,
  runtime check `circuit-runtime.js:232`.

`[proposal]` Ship one shared task-UI stylesheet = `site.css` tokens + status
classes + component classes; ban new page-local `<style>` blocks
(`home.html:10-52`, `login.html:9-37`, `explorer.html:10-192`); scope
component CSS to `data-*` states already used as API (list above) so
acceptance selectors survive re-rendering.

---

## Component taxonomy [proposal]

Names are taken from existing code identifiers. Property/event shapes are
derived from the cited current usage; `[proposal]` marks the declarative
wrapper, not the behavior.

| component | proposed properties | derived from |
| --- | --- | --- |
| `page` | `{ id, title, sections: Section[], chrome? }` | page shells `home.html:63-109`; host-declared `home` block `circuit-host.json:6` |
| `layout.workspace` | `{ panes: [{ id, variable, side, handle, aside, toggle, name, minimum, maximum, defaultWidth }] }` | `pane-layout.js:12-20`, `explorer.js:285-291` |
| `layout.grid` | `{ columns, gap, collapseAt }` | `home.html:11-12,14,19,27,34`; `login.html:13` |
| `section` | `{ id, label, chips?, badges?, actions?, body }` | `explorer.js:186-189`; `home.html:64,97` |
| `text` | `{ as: eyebrow\|display\|lede\|micro\|section-title\|note\|paragraph, text }` | `site.css:52-56`; `explorer.js:21-23` |
| `heading` | `{ level, text, chips?, badges? }` | `explorer.js:186-189`; `provider-profile.js:49-51` |
| `stat` | `{ value, label, sub }` | `home.html:84-87`; `home.js:48-64` |
| `card` | `{ title, body, promise, meta, link: { href, label, ariaLabel }, missing }` | `home.js:66-81` |
| `table` | `{ columns, rows, selection?, onSelect, limit?, showAllLabel?, emptyText }` | `explorer.js:206-219`; `provider-profile.js:52-57`; `run-context.js:126-128` |
| `field-list` | `{ entries: [[key, value]], skip?, format? }` | `explorer.js:22`; `provider-profile.js:58-62`; `run-context.js:16-21` |
| `list` | `{ items: [{ label, href?, meta?, badges?, current? }] }` | `home.js:38-45`; `run-context.js:53-54` |
| `tree` | `{ coordinates: [{ label, groups: [{ label, items }], empty, diagnostics }], current, onSelect }` | `explorer-model.mjs:9-36`; `explorer.js:151-167` |
| `tabs` | `{ tabs: [{ id, label, badges?, panelId }], selected, onSelect }` | `explorer.js:168-178`; `run-context.js:26-42` |
| `segmented` | `{ name, options, value, onSelect }` | `explorer.html:247-252`; `circuit-runtime.js:394-395` |
| `disclosure` | `{ summary, open, body }` | `circuit-runtime.js:18`; `run-context.js:10`; `navigation.js:24-38` |
| `badge` | `{ text, kind: 'refuse'\|'warn'\|'ok'\|'muted', title? }` | `explorer.js:140-141`; `provider-profile.js:63` |
| `status-chip` | `{ text, state: 'running'\|'completed'\|'failed'\|'not-observable' }` | `objective-run.js:221-224`; CSS `explorer.html:157-160` |
| `notice` | `{ text, kind?: ''\|'error'\|'warning' }` | `explorer.js:23`; `run-context.js:9` |
| `empty-state` | `{ message }` | `explorer.js:54`; `home.js:95-96` |
| `form` | `{ fields: [{ name, path, label, kind, required, value, schema?, hint? }], values, submit: { label, intent }, onChange }` | `observe-panel.js:22-87`; `login.html:67-71` |
| `json-editor` | `{ value, schema?, stale, onChange }` | `explorer.html:288`; `observe-panel.js:147-161` |
| `action-bar` | `{ actions: [{ label, kind: 'primary'\|'secondary'\|'small', disabled?, intent, params, confirm? }] }` | `explorer.html:212-217,240-256`; `run-context.js:85-90` |
| `timeline` | `{ duration, spans: [{ label, kind, from, to, nodeId? }], playhead?, seek: { min, max, value }, onSeek, onSpan }` | `run-context.js:99-108` |
| `media.figure` | `{ svg?, src?, alt, caption?, href?, digest? }` | `site.js:38-62`; `circuit-viewer.js:131` |
| `circuit-scene` | `{ deck, slide, view, options: { selectNode, selectSlide, selectTarget, overlay, run, mode, paused } }` | `circuit-viewer.js:125-128`; mounts `circuit-runtime.js:281-284` |
| `run-controls` | action-bar specialization: `{ mode, replay, pause, step, speed, live, follow, overlay, slide }` | `circuit-runtime.js:384-398` |
| `status-bar` | `{ parts: [{ text, kind? }] }` | `explorer.js:244-252` |
| `identity-session` | `{ authenticated, identifier, principalId, realm, expiresAt, signInHref, onSignOut }` | `home.js:10-21`; `explorer.js:257-268` |
| `provider-profile` | `{ providerId, resultSets, readAt, reader?, fallback? }` | `provider-profile.js:17-28,93-169` |
| `run-report` | `{ model, output, api, onSelect, onReplay, onCopy, onDownload }` | `run-context.js:60-92` |
| `objective-composer` | `{ value, voiceStatus, submitLabel: 'Run', onRun, onSignIn }` | `explorer.html:224-236`; `objective-run.js:93-236` |

`[proposal]` Component events should be declarative bindings over the action
descriptors below (`events: [{ on: 'select', action: { kind, … } }]`), with the
current callback signatures kept as the local implementation contract
(`selectNode` `circuit-viewer.js:126`, `onSelect`-style `explorer.js:213`,
`hooks.*` `observe-panel.js:120-122`).

---

## Action taxonomy [proposal]

### Every user action and how it is wired today

| action | wiring | effect / authority |
| --- | --- | --- |
| Sign in (form submit) | `login.js:61-83` | `POST /api/circuit/v1/session` `{identifier,password}`; identity host runs `authenticate-ide-user`; bearer only in HttpOnly cookie `login.html:85` |
| Open sign-in (nav, CTAs) | `home.html:72`, `explorer.js:264`, `observe-panel.js:128-134` | same-origin link with validated `return` (`login.js:24-27`) |
| Sign out | `home.js:15-16`, `explorer.js:260-261`, `login.js:85-96` | `POST …/session/logout` |
| Continue after sign-in | `login.js:98` | navigate to validated return target |
| Pick/open capability | `explorer.js:269-276` | local selection + URL `syncUrl` `explorer.js:36-42` |
| Select node/tab | `explorer.js:143,175` → `selectNode` `:89-92` | reads declared sections; switches context tab |
| Select row | `explorer.js:213-214` → `selectRow` `:93-99` | focuses circuit component if declared |
| Show on circuit / open authority | `explorer.js:232-234` | `runtime.focus` / `runtime.openDetail` |
| Select scenario | `explorer.js:277` → `changeScenario` `:83-86` | re-reads scene |
| Refresh from database / expand | `explorer.js:278-282` | re-read with `refresh=1`; local layout |
| Pane resize / collapse | `pane-layout.js:54-87` | local, persisted `pane-layout.js:5,10` |
| Component hit / page link / nav link | `circuit-viewer.js:140,143-156` | select component, slide or target |
| Slide / detail-page pick | `circuit-runtime.js:384-385` | local view state + URL |
| View Linear/Paged | `circuit-runtime.js:394-395` | local, persisted `circuit-runtime.js:22,136` |
| Zoom fit/in/out/wheel | `circuit-runtime.js:396-402` | local view |
| Follow / animate-evidence toggles | `circuit-runtime.js:387-388` | local view |
| Replay latest / pause / step / speed / live | `circuit-runtime.js:389-393` | local `PlaybackClock` `playback-clock.js:27-46` |
| Seek timeline / range | `run-context.js:104,108` → `circuit-runtime.js:41-45` | local replay seek |
| Observe submit | `observe-panel.js:237-262` | `POST /api/circuit/v1/runs` `{object,operation:'observe',subject,namespace,input}` + `idempotency-key`; requires session `:136-145` |
| Resume observation / follow external | `observe-panel.js:265,271` | SSE `/runs/:id/events/stream` `:186-198` |
| Reset to contract template | `observe-panel.js:263` | local |
| Field edit ↔ JSON sync | `observe-panel.js:147-161` | local |
| Run objective | `objective-run.js:183-199` → `explorer.js:304-306` | admission body `objective-run.js:22-25` via POST `/runs` |
| Dictation start/stop/cancel | `objective-run.js:147-174` | browser speech API only |
| Summary play/rate | `objective-run.js:53-89` | browser speech synthesis only |
| Context tab switch | `run-context.js:26-42` | local |
| Runs filter/refresh | `run-context.js:43-58` | `GET /api/circuit/v1/session/runs` |
| Report replay/copy/download | `run-context.js:80-90` | local; download builds a client export `:85-89` |
| Stage provider change / copy / download | `provider-profile.js:73-79,86-88,125-128` | stages a document only; never calls a writer `provider-profile.js:8-10,72` |

Observed authority boundaries: all effects are same-origin `fetch` to
`/api/circuit/v1/*` (`site.js:6-15`, `observe-panel.js:121`, `login.js:5`);
the session bearer never reaches page script (`login.js:2-4`); execution is
only admitted by the host (`observe-panel.js:248-250`); provider edits are
staged documents copied/downloaded (`provider-profile.js:70-72`).

### [proposal] action descriptor kinds

| kind | shape | maps to |
| --- | --- | --- |
| `navigate` | `{ to }` | `syncUrl` `explorer.js:36-42`; hrefs `site.js:24-29` |
| `select` | `{ of: 'capability'\|'scenario'\|'node'\|'row'\|'component'\|'slide'\|'detail'\|'target'\|'context-tab', id, index? }` | `selectNode/selectRow/selectComponent` `explorer.js:89-107`; `selectSlide/selectTarget` `circuit-runtime.js:108-117` |
| `session` | `{ intent: 'sign-in'\|'sign-out'\|'continue', return? }` | `login.js:24-27,61-99` |
| `observe` | `{ capabilityId, namespaceId, input }` | `observe-panel.js:242-249`; sign-in required |
| `objective` | `{ objective }` | `objective-run.js:22-25` |
| `playback` | `{ intent: 'replay'\|'pause'\|'resume'\|'step'\|'live'\|'speed'\|'seek', value? }` | `circuit-runtime.js:389-393`; `playback-clock.js` |
| `view` | `{ mode: 'linear'\|'paged', zoom? }` | `circuit-runtime.js:394-398` |
| `toggle` | `{ of: 'follow'\|'overlay'\|'runs-all', value }` | `circuit-runtime.js:387-388`; `run-context.js:58` |
| `pane` | `{ pane, collapsed?, width? }` | `pane-layout.js:43-52` |
| `copy` / `download` | `{ document, filename? }` | `run-context.js:80-90`; `provider-profile.js:70-71` |
| `stage-change` | `{ document }` | `provider-profile.js:32-47` (data only) |
| `refresh` | `{ source: 'details'\|'scene'\|'runs' }` | `explorer.js:278`; `run-context.js:58` |

Every kind maps to an existing state mutator or same-origin route; none grants
new authority. Identity and admission stay server-side exactly as observed.

---

## First page candidate

**Home** is the shallowest cut that proves the model.

- Its content is already fully returned data: `home.js:83-86` reads host
  config, session, catalog and health, then fills the page; no write path
  exists on the page.
- Its section structure is already declared in host configuration:
  `circuit-host.json:6` carries `home.hero` and `home.featured[]`, with the
  explicit note that this is "Host data until the list is declared as database
  authority (revamp P3)" `circuit-host.json:6`.
- Every needed component shape already exists as data: cards
  `home.js:66-81`, stats `home.js:48-64`, runs list `home.js:38-45`, circuit
  media `site.js:38-62`.
- The only bespoke behaviour is the identity area `home.js:10-21` and the
  signed-in copy swap `home.js:23-46` — one `identity-session` component plus
  conditional text.
- Contrast: login contains a session state machine and return-target
  validation (`login.js:24-27,39-99`) that should be preserved, not declared;
  explorer mounts the entire runtime (`explorer.js:26-33,285-311`) and is the
  deepest page.

`[proposal]` Convert `main` (`home.html:63-109`) into declared sections —
hero/text+media, counts/stats, signed panels, steps, cards — rendering into
the existing skeleton ids. Keep header, footer and identity mount point as
shell.

---

## Acceptance constraints

Contractual DOM ids and state, by test:

- `verify-objective.mjs:17-24` requires ids `objective-form`,
  `objective-input`, `objective-voice-status`, `objective-mic`,
  `objective-run` (label exactly `Run` `:20`), `objective-run-status`,
  `summary-strip`, `requested-capabilities`; the mic SVG path literal
  `M18.585 13.412…` `:19`; the literal `Voice ready` `:21`; a
  `createObjectiveRun(` call in `explorer.js` `:22`; and `objective-run.js`
  in the host file map `:24`.
- `verify-explorer.mjs:16-23` requires `resizer-tree`/`resizer-context` to be
  `class="splitter"`, `role="separator"`, `aria-controls` their pane,
  `tabindex="0"`, and a `createPaneLayout(` call.
- `circuit-runtime.js:3-5` states `#viewer`, `#slide`, `#mode`, `#follow`,
  `#speed`, `#replay`, `#payload`, `#observe`, … are "the page contract the
  staging browser acceptance drives".
- `verify-run-evidence-browser.mjs` drives `#run-report` `:71`,
  `#slide` `:74`, `#view-linear[aria-pressed]` `:78`, `.run-row` `:88`,
  `#replay`/`#pause` `:91`, `#replay-seek` `:100`, `#viewer` dataset
  `replayPosition` `:101`, `#observe-resume` `:110-116`, `#observe-status`
  `:114,132,140,152`, `#observe-sign-in` `:119,127,134`, `#payload`
  `:118,131`, `#observe` `:117,130,142`, `.run-outcome` `:165`,
  `.component-hit[data-current=true][data-node-id]` `:166`, `#mode` `:167`,
  `#observer-status` `:168`.
- `[observed]` All other ids are de facto contract because page scripts read
  them directly (`explorer.js:14-15`, `home.js`, `login.js`); renaming one
  breaks the page even where no test asserts it.
- `[observed]` The client must not name returned result sets
  (`verify-explorer.mjs:33`, `verify-objective.mjs:45`); a declarative renderer
  must therefore carry content in declarations, not component code.
- `[observed]` New client modules must be added to the host file map
  (`observe-server.mjs:14-44`) and to the staging acceptance routes or the
  deploy rolls back (`research-brief.md:87-90`).

`[proposal]` How declarative rendering preserves ids and state:

1. Components accept explicit `id` props, and page declarations bind sections
   to the existing mount ids; the static HTML skeleton (e.g.
   `explorer.html:195-318`) stays and the renderer fills the same nodes, so
   selectors resolve exactly as today.
2. Components must reproduce the non-id contract too: `aria-selected`,
   `aria-pressed`, `data-phase/current/busy/visited`, `dataset.replayPosition`
   etc. (`circuit-runtime.js:277-279`, `circuit-viewer.js:160-170`) because
   tests query them.
3. Field ids remain derived the current way (`field-<path>`
   `observe-panel.js:76`) and buttons keep their labels (`Run`
   `verify-objective.mjs:20`).
4. The acceptance scripts read client sources for calls
   (`createObjectiveRun(` `verify-objective.mjs:22`) and for result-set names
   (`verify-explorer.mjs:33`); declarative runtimes must keep those greps true
   or the checks must be updated deliberately.

---

## Gaps and unknowns

- The staging acceptance routes are referenced by the brief
  (`research-brief.md:87-90`) but were not read here; the complete set of ids
  the staging browser run drives beyond `verify-run-evidence-browser.mjs` is
  unknown. (Lane 4 territory.)
- How a page declaration is admitted, bound and read (the mechanism that
  replaces static `<style>`/`<script>` pairs) is lanes 1 and 3; this lane only
  asserts the rendering seams and component shapes.
- `home.html`/`login.html` ids are not enumerated by any verify script I read;
  conversion risk there is behavioural rather than test-visible. Worth
  confirming with lane 4 before treating home ids as free.
- The objective mic icon is asserted by literal SVG path
  (`verify-objective.mjs:19`); a component-ised composer must reproduce that
  markup (or the assertion must move).
- `circuitPreview` verifies an SVG digest and uses blob object URLs
  (`site.js:46-53`); a generic media component must retain digest failure as a
  visible error state.
- Explorer drawer/`expanded` behaviors (`explorer.html:86-92`,
  `explorer.js:279-282`) have no acceptance coverage beyond the splitter
  attributes checked in `verify-explorer.mjs:16-23`.
- No timer/animation primitive exists for "loading"; all states are text
  (`explorer.js:156`, `home.js:78`). Declarative rendering may need a
  loading-state convention, not a component.
