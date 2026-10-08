# 13a — Explorer runtime: hard-coded, non-declared UI components (Lane A audit)

Research lane, 2026-10-08. Read-only audit of the ten Explorer runtime modules named by the lane:
`provider-profile.js`, `circuit-viewer.js`, `traversal.js`, `run-context.js`, `run-evidence.mjs`,
`objective-run.js`, `observe-panel.js`, `playback-clock.js`, `execution-cursor.js`, `deck-trace.js`
(all under `live-circuit/circuit/`). No code changed, nothing committed.

Strategy references are to [`implementation-strategy.md`](../implementation-strategy.md) Revision 3;
taxonomy references are to [`analysis/02`](02-rendering-inventory.md). "No invention": every
hard-code claim below is a direct line citation; every declarability promise is the strategy's own
line.

---

## 1. Baseline: the deployed vocabulary this audit measures against

| Item | Deployed evidence |
| --- | --- |
| 21 component kinds | `live-circuit/circuit/ui-components.js:777-904` (`UI_COMPONENT_ROLES`); client registry `page-runtime.js:25-33`; server allowlist `circuit-host.json:17` |
| 12 action kinds | `page-runtime.js:34-47`; server set `live-store.mjs:240-241`; strategy table `implementation-strategy.md:326-339` |
| Bindings / events / scopes | `page-runtime.js:60-64` (`literal read session release route`); events `load click submit change select seek toggle`; action scopes `literal route event form row source` (`implementation-strategy.md:341-347`) |
| Reader-shaped projection | "The browser is a transport and a projector … resolves declared sources through existing GET reads" (`implementation-strategy.md:260-263`); declared readers `circuit-host.json:18-23` |
| The strategy's own boundary | "The Explorer's deep components (`circuit-scene`, `run-report`, `provider-profile`, `objective-composer`, `timeline`) are **not declarable content components** in v1; they remain the Explorer runtime" (`implementation-strategy.md:295-299`) |
| New-kind boundary | "A new component kind requires a shell deploy and an acceptance route" (`implementation-strategy.md:310-314`) |
| Page reads are readings, not receipts | D8 `implementation-strategy.md:254` |

Lane 2 already proposed component shapes for `table` (`02-rendering-inventory.md:324`, derived from
`provider-profile.js:52-57`, `run-context.js:126-128`), `field-list` (`:325`), `list` (`:326`),
`tabs` (`:328`), `disclosure` (`:330`), `status-chip` (`:332`, from `objective-run.js:221-224`),
`notice` (`:333`), `form` (`:335`, from `observe-panel.js:22-87`), `json-editor` (`:336`),
`timeline` (`:338`, from `run-context.js:99-108`), `circuit-scene` (`:340`), `run-controls`
(`:341`), `provider-profile` (`:344`), `run-report` (`:345`), `objective-composer` (`:346`).
The strategy deployed the first eleven as kinds; the last five are the runtime this lane audits.

Current layout/CSS is also shell: the Explorer's whole stylesheet is embedded in
`explorer.html:10-192`, with `run-evidence.css` and `circuit-canvas.css` linked at
`explorer.html:8-9`.

---

## 2. `provider-profile.js` (169 lines) — profile regions, instruction editors, engagement staging

**Renders/controls.**

- Involvement profile regions: provider header chips (`provider-profile.js:98-103`), identity
  notice (`:108`), configuration fields + raw-JSON fold (`:109-112`), Mechanics·ports table
  (`:114`), Bindings table (`:115`), Engagements list (`:117-133`), Instructions list
  (`:135-160`), Invocations table (`:162`), Summary table (`:163`), raw result-sets fold
  (`:164-166`).
- Engagement staging: per-engagement path/value inputs and "Stage request change"
  (`:122-128`).
- Instruction editors: one textarea + "Stage change document" per editable instruction
  (`:82-89`), with the 200-row cap and "Show all" control (`:143,154-160`).
- Change-document fold: Copy/Download + exact JSON + "Nothing is applied here" copy
  (`:67-80`).

**Data driving it.** The result sets `analysis.read_provider_details` returns
(`circuit-host.json:13`), mapped by fixed set name in `providerProfileModel`
(`provider-profile.js:17-28`); canonical-body fallback from `read_provider_canonical_body`
(`circuit-host.json:14`) surfaced at `:106`.

**Hard-coded.**
*Layout:* the `el('h3'/'h4')` region sequence and `table-wrap`/`answer-fields` markup
(`:49-62, :104-166`).
*Labels:* every heading and note — "Provider involvement" (`:104`), "Identity" (`:108`),
"Configuration" (`:109`), "Mechanics · ports" (`:114`), "Bindings" (`:115`), "Engagements · ports
that name this provider" (`:117`), "Instructions · SYSTEM / USER declarations, projections,
fixtures" (`:135`), "Invocations · fixtures" (`:162`), "Summary" (`:163`), "Raw result sets
(unchanged)" (`:164`), plus fallback copy `'namespace not returned'` (`:101`), `'Fixture,
projected or mapped copy — not the declared template; view only.'` (`:150`) and the raw-config key
names `raw_configuration`/`configuration_json` (`:110-111`).
*Controls:* textarea `rows: 4` (`:85`), stage buttons (`:86, :124`), Copy/Download
(`:70-71`), hard-coded default path `'$.configuration.resultMode'` (`:122`).
*State machine/projection:* the editable gate `/^DECLARED_/` plus digest presence (`:146`); the
writer-shaped projections `instructionChange`/`engagementChange` (`:32-47`); the 200-item
limit (`:143,160`).

**Could 21 kinds + 12 actions + a reader-shaped projection express it?** The read-only regions
mostly: `table` (`ui-components.js:838-843`), `field-list` (`:844-849`), `disclosure`
(`:850-855`), `badge` (`:856-861`), `status-chip` (`:862-867`), `notice` (`:832-837`); the staging
actions are deployed — `copy/download` (`strategy:337`, derived from `provider-profile.js:70-71`)
and `stage-change` (`strategy:338`, derived from `provider-profile.js:8-10,70-72`). The per-row
editor and per-engagement stage row are not: the deployed `form` kind is section-level and its
only row scope is event input binding (`strategy:343-347`); no kind renders one editor per
returned row with a per-row digest guard.

**Change surface.** Estate reader SQL already returns the sets (`circuit-host.json:13`);
a declared panel binding `table`/`field-list`/`disclosure` to the `details` or
`provider-inspection` source can carry the regions with no new kind. The editors/row staging need
a declared panel + generic projector, or a `provider-profile` kind (lane-2 proposal
`02-rendering-inventory.md:344`) which the strategy defers (`strategy:295-299`) and which would cost
a shell deploy + acceptance route (`strategy:310-314`). The module never calls a writer
(`provider-profile.js:8-10`).

---

## 3. `circuit-viewer.js` (225 lines) — circuit canvas

**Renders/controls.** One screen: the circuit canvas. It draws the slide image (`:131`), an SVG
wire layer (`:132`), a hit overlay of declared glyphs + located boundary glyphs (`:133-142`),
declared slide links (`:143-150`) and declared navigation links (`:151-156`), per-component state
attributes/`aria` (`:160-177`), evidence routes (`:178-194`), captured-span token dots
(`:195-208`) and telemetry (`:209-224`).

**Data driving it.** Deck/slide from the scenario reader (`live-store.mjs:204-210`;
`circuit-host.json:20`); `view` from `traversal.js`; options (`overlay`, `run`, `mode`, `paused`,
selectors) from the runtime. Geometry is declared: `slide.blueprint.viewBox` (`:13`), glyphs
(`:135`), routes (`:76`), commands (`:143`); boundary locating is policy-driven
(`:31-32, :214`).

**Hard-coded.**
*Layout:* image/SVG/overlay construction and percentage placement (`:3-19, :127-133`).
*Labels:* overlay `aria-label 'Deck component inspection and observations'` (`:133`), phase/where
strings (`:166-168`), defect text (`:118-121`), token title (`:207`).
*Controls:* hit buttons (`:137-140`), links (`:147, :153`).
*Projection:* `DEFECT_KINDS` (`:121`), token count/lane logic (`:197-208`), telemetry field map
(`:212-213` — the *fields* are declared at `:214` via `flowPolicy.telemetryFields`, but the
rect/fill/font rendering is hard-coded: `fill: '#102238'`, `fill: '#72D7EE'`,
`font-family: 'Arial'` (`:217-219`); token `r: 3.5` (`:203`)).

**Could 21 kinds + 12 actions + a reader-shaped projection express it?** Only the static image is
close: `media.figure` roles `svg/src/alt/caption/link/digest` (`ui-components.js:826-831`; lane-2
derivation `02-rendering-inventory.md:339`). No deployed kind expresses glyph hit regions, routes,
tokens or telemetry. `circuit-scene` is a lane-2 proposal (`02-rendering-inventory.md:340`) and is
explicitly not declarable in v1 (`strategy:295-299`).

**Change surface.** Estate reader SQL (scenario reader) already returns `observationMap`,
rendered slides and `flowPolicy` (`live-store.mjs:204-210`; `circuit-host.json:20`), so a
projection-shaped read is available; a `circuit-scene` kind needs a shell deploy + acceptance route
(`strategy:310-314`), or a declared panel + generic projector that interprets the declared deck
geometry and flow policy. The traversal state machine that feeds it stays a shell deploy
(class (a), `strategy:390`).

---

## 4. `traversal.js` (499 lines) — traversal state and projections (no DOM)

**Renders/controls.** Nothing directly; it decides every visible canvas state: `token`, `current`,
`busy`, `visited`, `terminal` (`traversal.js:1-11`), phases, findings, live motion
(`LiveMotion`, `:426-498`).

**Data driving it.** Deck geometry and `observationMap.flowPolicy` plus run receipts via
`joinFlow` (`:12-13, :181-238`).

**Hard-coded.**
*Contract/state machine:* `FLOW_CONTRACT = 'captured-operation-path.v1'` (`:15`), the
`LOCATIONS` kind set (`:16-17`), terminal selection logic and defect copy
(`:60-80`), callee-evidence codes `CALLED_SCENARIO_NOT_CAPTURED`/`PROVIDER_EXCHANGE_NOT_COMPLETED`/
`PROVIDER_EXECUTOR_NOT_MATCHED` (`:132, :158, :164-165`), finding codes
`OPERATION_PATH_NOT_DECLARED`/`CALLED_SCENARIO_INTERVAL_NOT_CAPTURED`/`SEQUENCE_TRAVERSAL_NOT_OBSERVED`/
`OUTCOME_ROUTE_NOT_DECLARED` (`:195, :207, :222, :236`), stage/basis strings (`:282-283,
:313-315, :381-384`), status copy (`:418`), `LiveMotion` default 120 ms and transition basis copy
(`:427, :494-495`).

**Could 21 kinds + 12 actions express it?** No. Its outputs could be *surfaced* as
`status-chip`/`notice`/`table` data, but the decisions are receipt joins; D8 states a page render
is a reading, not an execution receipt (`strategy:254`), so this logic must not move into page
declarations.

**Change surface.** Shell deploy that stays (class (a), `strategy:390`). A reader-shaped
projection of phase rows is possible, but receipt semantics remain in the shell.

---

## 5. `run-context.js` (148 lines) — run bar context tabs, run report, replay controls, evidence panel

**Renders/controls.**

- Context tabs Run/Runs/Evidence (`run-context.js:25-42`; tabs are shell DOM at
  `explorer.html:276-279`), keyboard arrow/Home/End handling (`:39`).
- Runs list (`:43-58`): fetch `GET /api/circuit/v1/session/runs` (`:46`), storage copy (`:51`),
  sort/filter (`:52`), run rows (`:53-54`).
- Run report (`:60-92`): outcome/duration, persistence/partial/held warnings (`:64-70`),
  "Asked"/"Answered" with `missing()` (`:9, :71-73`), summary player mount (`:75`), providers
  called (`:76-79`), Replay/Copy/Download evidence actions and the client export format
  `'sfx-run-evidence-export.v1'` (`:80-90`).
- Invocation timing / replay controls (`:93-114`): span bar, playhead, `replay-seek` range
  (`:99-108`), execution-step buttons (`:110-113`).
- Component evidence (`:115-131`): Request/response, Time, Called, Trace headings and the receipt
  table (`:119-129`), trace CSV download and own-testimony fold (`:129-130`).
- Selection/updates (`:134-146`): key signature, auto-switch to Run on an ended run (`:139`),
  playhead position (`:143-145`).

**Data driving it.** The `componentEvidence`/`evidenceModel` projections
(`run-evidence.mjs:14-61`) over retained run records; the session runs route; `PlaybackClock`
position from the runtime.

**Hard-coded.**
*Labels/controls:* all headings, warnings and button labels above; `missing()` "Not captured"
(`:9`); download format version (`:86`); limitations text (`:88`); run-link base route
`'/circuit/explorer'` (`run-evidence.mjs:8`).
*State:* tab scrollTop (`:27`), sort order and filter (`:52`), auto-tab on ended run (`:139`),
playhead percentage math (`:143-145`), step `aria-current` (`:145`).

**Could 21 kinds + 12 actions + a reader-shaped projection express it?** The strategy says yes for
the chrome: `list` is derived from `run-context.js:53-54` (`strategy:281`) — the runs list and
steps; `notice` from `run-context.js:9` (`strategy:283`); `tabs` from `run-context.js:26-42`
(analysis `02:328`, deployed `ui-components.js:868-873`); `timeline` from
`run-context.js:99-108` (analysis `02:338`, deployed `ui-components.js:874-879`); `table` from
`run-context.js:126-128` (analysis `02:324`, deployed `ui-components.js:838-843`); plus
`disclosure`, `field-list`, `code`, `status-chip`. Actions: `playback` seek (`strategy:333`),
`copy/download` from `run-context.js:80-90` (`strategy:337`), `toggle` runs-all from
`run-context.js:52,58` (`strategy:335`), `refresh` from `run-context.js:58` (`strategy:339`).
Not expressible: the receipt joins themselves (`evidenceModel`, `componentEvidence`).

**Change surface.** A declared panel binding `list`/`timeline`/`table` to the `session` and read
sources for runs/steps; the projection functions and tab state stay shell. Moving the joins
server-side needs a new reading — none exists in the declared reader registry
(`circuit-host.json:18-23`) and none is promised. The strategy's non-declarable list names
`run-report` and `timeline` (`strategy:295-299`).

---

## 6. `run-evidence.mjs` (70 lines) — evidence projections and CSV (no DOM)

**Renders/controls.** Nothing; `evidenceModel` (`:14-38`), `componentEvidence` (`:42-61`),
`traceCsv` (`:63-69`), `milliseconds` formatting (`:6`), `runLink` (`:7-12`).

**Hard-coded.** Basis string `'Time containment; ownership NOT_VERIFIED'` (`:60`), provider-call
basis (`:29`), CSV header columns (`:67`), export URL route (`:8`), duration formatting
thresholds (`:6`).

**Could the deployed vocabulary express it?** Rendering the outputs is covered (`table`,
`code`, `list`, `disclosure`, `field-list`; the CSV file is the deployed `copy/download` action,
`strategy:337`). The joins are receipt semantics (D8, `strategy:254`).

**Change surface.** Shell deploy stays (class (a), `strategy:390`). A reader-shaped projection
would need a new declared reading; the registry has none (`circuit-host.json:18-23`), so this is
candidate work, not a promise.

---

## 7. `objective-run.js` (236 lines) — objective composer, dictation, summary player

**Renders/controls.** The objective form/input/mic/Run and status (`:93-102`;
`explorer.html:224-238`), dictation start/stop/cancel and voice status (`:111-174`), admission
submit (`:183-199`), the requested-capabilities strip and summary strip (`:201-231`), and the
summary speech player (`:48-91`).

**Data driving it.** The ObjectiveRun hooks from `explorer.js:304-311` (admit, follow, run state);
constants `OBJECTIVE_CAPABILITY`/`CONTRACT`/`NAMESPACE` at `:14-16`.

**Hard-coded.**
*Labels:* voice states "Voice ready"/"Voice captured. Review or Run." (`:126, :140-142`), the error
map (`:112-119`), player labels/notes `'Play'/'Stop'`, rates `['1','1.25','1.5']`, "Audio is
unavailable…", "The summary is machine output…" (`:52-68, :71, :83`), strip limitation
`'requested capability · name NOT_OBSERVABLE (B13; S2 adds owner identity)'` (`:216-217`).
*Controls/state machine:* tap/hold 500 ms and Escape (`:160-174`), `elapsed` timer
(`:205-233`, 1000 ms), `autoSpoken` de-duplication (`:47, :89`), `spokenSummary` regexes
(`:30-40`).

**Could 21 kinds + 12 actions express it?** The submit path is already a deployed action:
`objective` with input `{ objective }` (`page-runtime.js:39`; `strategy:332, :348`), and the form
chrome could be `form` + `status-chip` (`ui-components.js:880-885, :862-867`). Dictation and
speech synthesis have no kind or action; the strategy lists `objective-composer` as not declarable
in v1 (`strategy:295-299`).

**Change surface.** Declared panel + generic projector for the form/strip (kinds `form`,
`status-chip`, `badge`; actions `objective` and `session`); dictation/speech and the follow
timer stay a shell deploy. Nothing in the estate reader list returns objective state
(`circuit-host.json:18-23`); the run state comes from the existing run admission.

---

## 8. `observe-panel.js` (311 lines) — observe form, schema fields, follow stream

**Renders/controls.** Schema-driven input fields (`:22-87`, rendered `:162-166`, synced
`:156-161`, `:187-198`, `:263-264`), the JSON textarea, template reset, Observe submit
(`:237-262`), sign-in/resume/external controls (`:128-145, :265-271`), SSE follow
(`:177-223`, `readEventStream` `:89-109`), persistence watch (`:226-236`).

**Data driving it.** The declared input contract found through scenario navigation rows
(`:296-303`) and the `detail.body` schema (`:302`); the runs API (`:121`, `:248-249`).

**Hard-coded.**
*Controls/projection:* `fieldKind` mapping (`:29-37`), one-control-per-leaf and value coercion
(`:22-61`), JSON↔field synchronization (`:147-161`), placeholders `'One item per line'`/`'JSON
value'` (`:74`), required/fixed markers.
*Labels/state:* status copy (`:125, :202-218`), sign-in link text (`:133`), 401/404 messages
(`:141-142, :215-217`), persistence poll 15 × 2000 ms (`:228`), identity validation regexes
(`:275`), admission-key message (`:259`).

**Could 21 kinds + 12 actions express it?** The form itself is the strongest match in the
runtime: `form` roles `fields/values/submit` (`ui-components.js:880-885`) was derived from
exactly these lines (lane 2 `02-rendering-inventory.md:335-336`), and the submit action `observe`
with `{ subject, namespace, input }` is deployed (`page-runtime.js:38`; `strategy:331, :348`). The
binding scopes (`form`, `source`) exist (`strategy:343-347`). SSE follow, resume and
persistence-watch behavior have no kind/action and stay shell.

**Change surface.** Declared panel (`form` bound to the `scenario`/`details` read) + generic
projector; the contract comes from a declared navigation row already
(`observe-panel.js:296-300`). Follow/session-gate behavior stays a shell deploy. The panel is not
in the strategy's non-declarable list (`strategy:295-299`), but the strategy also never promises
it declarable; only the `observe` action is promised.

---

## 9. `playback-clock.js` (61 lines) — replay clock state machine

**Renders/controls.** No DOM; it controls replay: `pause`/`resume`/`speed`/`next`/`seek`, frame
application, `gap` (`playback-clock.js:3-60`).

**Hard-coded.** Frame cadence default 100 ms (`:4`), tick/arm/done logic (`:10-26`), seek reset
semantics (`:48-56`), invalid-rate error (`:34`). Clock policy *is* declared: `replayTimeline`
refuses unless `flowPolicy.replayClock === 'captured-execution-timestamps'`,
`replayIntervals === 'own-operation-timestamps'`, `replayRates.normal === 1` and the replay window
policy hold (`deck-trace.js:263-266`).

**Could 21 kinds + 12 actions express it?** The controls and display: `playback` action
(`page-runtime.js:40`; `strategy:333` maps `PlaybackClock` + run controls) and the `timeline` kind
roles `duration/playhead/seek` (`ui-components.js:874-879`). The clock behavior cannot be
declared.

**Change surface.** Declared timeline panel + `playback` action; the clock stays a shell deploy.
The clock's admitted policy is already estate declaration (`deck-trace.js:263-266`), the precedent
for declaring projection inputs.

---

## 10. `execution-cursor.js` (65 lines) — live cursor projection (no DOM)

**Renders/controls.** Nothing; derives cursor locations from receipts (`:1-63`).

**Hard-coded.** Graph/address identity filters (`:4-5, :14-17`), ancestor walk to
operation/boundary (`:29-59`), stage values `'outcome'|'activity'|'admission'|'completion'`
(`:44`), label `Outcome: …` (`:54`), provider-id prefix composition (`:52`), zero milliseconds
for ended runs (`:56`).

**Could 21 kinds + 12 actions express it?** No; it is receipt-location logic. Its result could be
shown via `table`/`list`, but the derivation must stay in the shell (D8, `strategy:254`).

**Change surface.** Shell deploy stays; inputs are already declared (scenario reader graph and
bindings, `circuit-host.json:20`; `live-store.mjs:204-210`). A cursor document would need a new
reading, not promised.

---

## 11. `deck-trace.js` (327 lines) — run model, testimony joins, frames, timing, replay timeline

**Renders/controls.** Nothing; `joinTestimony` (`:48-69`), `joinFlow` (`:74-180`, the declared
policy renderer), `replayFrames` (`:192-206`), `capturedTimestamp` (`:208-213`),
`invocationTiming` (`:217-256`), `replayTimeline` (`:258-327`).

**Data driving it.** Run records plus `deck.observationMap.flowPolicy` (`:76-78`) and declared
boundaries/bindings.

**Hard-coded.**
*Types/phases:* `'execution-graph-captured.v1'` (`:37`), `'cell-execution-testimony.v1'` /
`'edge-execution-testimony.v1'` (`:40, :44`), phase names (`:108-110, :126-127`).
*Copy/basis:* input participation copy and finding `INPUT_FIELD_PRESENCE_NOT_PUBLISHED`
(`:151-161`), outcome finding codes (`:166, :175-176`), replay hold messages
(`:259-266, :284, :291, :301, :313-314, :317-318`).
*Policy-driven already:* `ancestorActivity`, `failureDispositions`, `completedDispositions`,
`admittedDispositions`, `edgeKinds`, `boundaryPolicy`, `invocationTiming`,
`replayClock/Intervals/Rates/Window` (`:95, :108, :123, :129, :138, :147, :165-176, :218,
:260-266`).

**Could 21 kinds + 12 actions express it?** No; this is the receipt-join engine. The strategy
describes `joinFlow` as "a generic renderer of the database's flow policy"
(`deck-trace.js:71-73`) — policy is declarable, the engine is shell.

**Change surface.** Shell deploy stays (class (a), `strategy:390`). Estate reader SQL already
supplies the declared policy; moving joins server-side is candidate work, not promised in the
reader registry (`circuit-host.json:18-23`).

---

## 12. The run bar (shell chrome referenced by the audited modules)

The run bar itself is DOM in `explorer.html:240-256` and is wired by `circuit-runtime.js:384-398`,
which is outside this lane's module list. Its controls are already accounted for by the deployed
action vocabulary: `playback` (replay/pause/step/speed/live, `strategy:333`), `view` (linear/paged/
zoom, `strategy:334`), `toggle` (follow/overlay, `strategy:335`); lane 2 proposed the
`run-controls` shape (`02-rendering-inventory.md:341`) and the strategy keeps it runtime
(`strategy:295-299`).

---

## 13. Verdict summary

| Module | Screen/control | Markup in deployed 21 kinds? | Actions in deployed 12? | Change surface |
| --- | --- | --- | --- | --- |
| `provider-profile.js` | profile regions | yes: `table`, `field-list`, `disclosure`, `badge`, `status-chip`, `notice` | `copy/download`, `stage-change` (`strategy:337-338`) | declared panel + generic projector; reader SQL already returns sets (`circuit-host.json:13`) |
| `provider-profile.js` | instruction editors, per-engagement staging | no (per-row editor/form gap) | `stage-change` only at section level | new `provider-profile` kind → shell deploy + acceptance route (`strategy:310-314`); or declared panel + projector |
| `circuit-viewer.js` | circuit canvas | only base image (`media.figure`); overlay no | `select` only for hits | new `circuit-scene` kind → shell deploy (`strategy:310-314`); geometry/policy already declared |
| `traversal.js` | traversal states/findings | display only (`status-chip`, `notice`) | n/a | shell deploy stays (`strategy:390`) |
| `run-context.js` | tabs, runs list, steps | yes: `tabs`, `list`, `notice` (`strategy:281-283`) | `toggle`, `refresh` (`strategy:335,339`) | declared panel bound to `session` source + generic projector |
| `run-context.js` | run report, evidence panel | markup yes: `table` (`strategy:324` via lane 2), `field-list`, `disclosure`, `code` | `copy/download`, `playback` (`strategy:333,337`) | joins stay shell; declared panel for chrome |
| `run-evidence.mjs` | evidence projections / CSV | rendering yes (`table`, `code`, `list`) | `copy/download` | shell deploy stays; server join = new reading, not promised (`circuit-host.json:18-23`) |
| `objective-run.js` | objective form/strip | `form`, `status-chip`, `badge` | `objective`, `session` (`strategy:332`) | declared panel + projector for form; dictation/speech stay shell |
| `observe-panel.js` | observe form | `form` (derived from these lines, lane 2 `02:335-336`) | `observe` (`strategy:331`) | declared panel bound to scenario/details read; follow stays shell |
| `playback-clock.js` | replay controls | `timeline` | `playback` (`strategy:333`) | declared timeline panel; clock stays shell |
| `execution-cursor.js` | live cursor | no (display only) | n/a | shell deploy stays |
| `deck-trace.js` | policy joins/replay timeline | no (policy is data) | n/a | shell deploy stays; declared `flowPolicy` is the precedent |

**Honest limits.** The strategy promises declarability only for the listed kinds/actions and
explicitly excludes the five deep Explorer components (`strategy:295-299`); the reader registry has
no run/traversal/cursor reader (`circuit-host.json:18-23`). Everything else in this table is
this audit's classification of what the deployed vocabulary can already carry, not a strategy
commitment. No writer is called anywhere in the audited modules
(`provider-profile.js:8-10`; the only browser writes remain session and runs, `strategy:250`).
