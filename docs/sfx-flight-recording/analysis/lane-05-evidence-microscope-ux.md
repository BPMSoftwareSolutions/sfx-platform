# Lane 05: programmable evidence microscope — Explorer UX

Produced 2026-10-06. **Design only**: this is the one new file; no repository was
changed. Read at sfx-platform `327a2c2` plus the uncommitted W1 UI work in the
working tree at `b9be6e8` (`run-context.js`, `run-evidence.mjs`, context tabs;
cited `worktree`). Sibling lanes in this folder: 02 recorder (`R2.*`), 03 storage
(`S3.*`), 04 expected-vs-observed (`V4.*`), 06 assurance/ops (`G6.*`). Plan:
[run-evidence-implementation-plan.md](../../run-evidence-implementation-plan.md)
§5.5/§6/§7; design E1 [explorer-run-evidence-design.md](../../explorer-run-evidence-design.md).

## Scope

Design the Explorer surface for the recorder: recording/trigger lists per run, a
before/after window timeline with trigger marker, causal-neighborhood lanes,
expected-vs-observed comparison, authority/effect-envelope overlays, dispositions
and limitations, an export bundle, and a sampling-corpus view. Map each onto the
existing Explorer (context aside tabs, selection wiring, `?run=`, playback bar),
state honesty and volume rules, name fixtures and U5 gates, and list U5 work items
with dependencies on W1.x/W2.5/W2.2 and the recording/storage lanes. Out of scope:
recorder capture itself (R2.*), storage schema (S3.*), comparison semantics
(V4.*), trigger authority (G6.1), and any repository change.

## Current-state foundations (file:line)

- **Shell, tabs, routing.** Context tabs Run|Runs|Evidence exist (worktree
  `explorer.html:199-238`), wired in `run-context.js:22-55`; component selection
  already switches to Evidence (`explorer.js:86-104`, `circuit-runtime.js:279`).
  `?run=` already replays/opens a run: param read `explorer.js:11`, scene request
  `:77` (`requested.run` → `runtime.openRun`), URL sync `:33-39`, link builder
  `run-evidence.mjs:7-12`. Extend this param contract; do not add a second one.
- **Playback bar.** `#invocation-timeline` (worktree `explorer.html:192`) renders
  phases, operation/provider spans and hatched `gap` spans (`run-context.js:87-108`,
  `run-evidence.css:26-32`); seek uses `PlaybackClock.seek` (`playback-clock.js:48-56`)
  through `circuit-runtime.js:37-43`. This bar is the V2 timeline's seed.
- **Run/capture model.** `newRun`/`applyRecord` collect per-run `events`, mark
  `ambiguous` on overlap or graph mismatch (`deck-trace.js:7-28`); windowed replay
  `replayTimeline` (`:239-308`) holds rather than guesses; wall phases, process
  spans and `gaps` come from `invocationTiming` (`:198-237`); time-containment
  receipts `componentEvidence` label ownership `NOT_VERIFIED` and expose
  `ambiguous` (`run-evidence.mjs:42-61`); traversal terminal is the own scenario
  return (`traversal.js:60-80`).
- **Live capture facts.** Observer ring 2,000 (`observe-server.mjs:47`); bridge
  drops `run.admitted`, cursor/kind/evidenceRef (`tools/live-circuit/api-host.mjs:31-36`);
  SDA run record carries `retainedFrom/evictedCount/partial` (E03 `:16-19`);
  attribution is host memory (`identity-session.mjs:18-19,96-105`); A2.4 scoping
  is partly built (worktree `run-api.mjs:30-34`).
- **Recording model (sibling, not built).** `evidence.recording` etc. with
  window/trigger/member rows and read endpoints (lane-03:65-135,195-217);
  runtime `ROLLING→PINNED→SEALED`, `flight-recording.v1`, gaps, sampling
  (lane-02:99-135); triggers are declared/admitted data (lane-06:36-71); recorder
  endpoints proposed as `/api/circuit/v1/runs/{runId}/recordings`,
  `/api/circuit/v1/recordings/{id}` (lane-03:211-217).
- **Fixtures.** `docs/replay-timing-fidelity/capture.sse` (5.6 MB, multi-run,
  delivery phases incl. `readAuthority`) + `scene.json`; E03/E04
  (`docs/run-evidence-plan/evidence/`); `tests/fixtures/circuit/*.json,.sse`; the
  W1 pure gate `verify-run-evidence.mjs` and offline browser gate
  `verify-run-evidence-browser.mjs` (worktree).

## View design

| # | View | Surface | Data (honest basis) |
| --- | --- | --- | --- |
| V1 | Recording/trigger list per run | Context Run tab, short list; full list + detail in `#recording-window` (main column) | `evidence.recording`/`recording_trigger` via S3.3; until then derived candidate recordings from the capture, styled dashed "derived by this view, not declared, not sealed" |
| V2 | Before/after window timeline + trigger marker | main column, extending `#invocation-timeline` | resolved window (`window_kind`, bounds, `precision`, `snapping_loss`, lane-03:70); phase/operation/provider/gap spans (existing); record-density bucket strip for large traces; `retainedFrom/evictedCount/partial` census |
| V3 | Causal neighborhood lanes | main column, under V2; synced selection | stage classifier over records: identity (`run-start`, graph digest), intent (NOT_OBSERVABLE, B4), inference (exchange refs; content withheld B5/B13), authority (`readAuthority` phase, timing only, B20), trigger (declared/derived), disposition (W2.5/S3), recovery (post-trigger operations, findings), outcome (`traversal.terminal`), `other` (never dropped) |
| V4 | Expected vs observed trace | main column `#expected-observed`, opened from Run tab/compare | left: declared nodes/edges/routes/variants (`deck`, `observationMap`); right: `joinFlow` activity/routes, `unmatched`/`unaddressed`, `rejectedEdges`, `boundaryFindings`, `view.findings` (`deck-trace.js:29-161`, `circuit-runtime.js:284-287`); Phase 2 adds V4.* comparison outcomes per lane-04 (`SATISFIED/VIOLATED/NOT_OBSERVABLE/INCONCLUSIVE`) |
| V5 | Authority / effect-envelope overlays | circuit canvas mode on `#overlay` (`explorer.html:180`) | declared `authorityId`/`semanticAddress` per component + the receipt that asserted it (`activity.fact`, `basis`); envelope = declared boundaries/edges and receipt-backed admissions/refusals (`joinFlow:99-114`); undeclared envelope shows NOT_DECLARED (lane-04:27,37) |
| V6 | Dispositions and limitations | Evidence tab `#dispositions` above `#component-evidence`; run-level summary in Run report | W2.5/S3 read-for-principal: claim, subject digest, scope, state 0–8, basis ids/digests, rule/evaluator digests, limitations by kind, `decided_at/by`, invalidation/`supersedes`; Phase 1 fixture mode shows this run's known limitations (input/provider bodies NOT_OBSERVABLE, containment NOT_VERIFIED R4, no ledger disposition) |
| V7 | Export/download bundle | `Download captured evidence` action (`run-context.js:79-84`) extended | manifest `sfx-flight-recording-export.v1` (run, output, window, triggers, stage counts, limitations, retention, clock basis, per-record SHA-256 + manifest digest via `crypto.subtle`), trace NDJSON, trace CSV (`run-evidence.mjs:63-69`); label "browser capture; no ledger disposition"; stored bundle later from S3/G6.5 with access audit |
| V8 | Sampling corpus view | `#corpus` main workspace, opened from Runs tab ("Corpus / experiments") | paged/filtered recordings + aggregate endpoint (new; see decisions); columns run, capability, trigger kind, window, outcome, state, sampled, completeness; filters/search by **declared** trigger kind; A/B compare reuses V2/V3/V4; sampled-out counts and sampling declaration rendered as limitations (lane-06:68-71) |

## Integration with Explorer work items

| View | New surface | Modified files (worktree paths) | Reuses |
| --- | --- | --- | --- |
| V1 | `recording-window.js` list section, `#recording-window` | `explorer.html`, `run-context.js`, `explorer.js` (param `rec`) | runLink/openRun, session runs |
| V2 | `recording-window.js` bar; window controls (mode Event/Time, before/after, reset) | `explorer.html`, `run-context.js` timing seeding, `run-evidence.css`/new `recording.css` | `invocationTiming`, `PlaybackClock.seek`, `#viewer.dataset` |
| V3 | `recording-model.mjs` (pure classifier) + lanes in `recording-window.js` | `circuit-runtime.js` (pass model via `context.update`, `:246`) | `deck-trace.js` records, `execution-cursors` |
| V4 | `expected-observed.js` | `explorer.html`, `explorer.js` (`cmp`), `circuit-runtime.js` | `joinFlow`, `joinTestimony`, findings |
| V5 | overlay mode in viewer options | `circuit-viewer.js` (render options only), `explorer.html` mode select, `circuit-runtime.js:278-281` | traversal state; **no traversal semantics change** |
| V6 | `dispositions.mjs` adapter | `explorer.html`, `run-context.js` Evidence tab | `missing()` amber style (`run-context.js:8`) |
| V7 | manifest builder in `recording-model.mjs` | `run-context.js`, worktree export action | `traceCsv`, `runLink` |
| V8 | `corpus-view.js` (+ `corpus-model.mjs`) | `explorer.html`, `explorer.js` (`corpus`), `run-evidence.css` | run rows, virtualization pattern |

Rules: selection wiring stays one path (circuit click → `shell.component` →
Evidence; step/band click → `hooks.seek` + `hooks.select`, `run-context.js:104-107`);
`?run=` remains the only run identity, extended with `rec`, `trigger`, `from/to`,
`cmp`, `corpus`; the main `#tabs` (declared capability sections,
`explorer.html:164`) is untouched. `deck-trace.js`, `traversal.js`,
`playback-clock.js` should need no edits (pure reuse); any needed reads go into
`recording-model.mjs`. Lane-03's S3.5 ("trigger marker/shading, member list") is
the live-backend slice of V1/V2 — land it as U5.1's S3 wiring, not a duplicate.

## Honesty and volume handling

- **Missing/partial windows.** Show `partial`, `retainedFrom`, `evictedCount`, and
  recorder `windowGaps[]`/`TRACE_GAP`; requested vs retained counts (e.g.
  "before 100 requested · 37 retained"); absent edges hatched, never silently
  clamped; `trace_records = latestCursor` reconciliation rendered until A2.2
  passes.
- **NOT_OBSERVABLE.** First-class lane/status, never omitted: input (B4), provider
  bodies (B5), bound authority digests (B20), HOLD/safe-state/envelope where
  undeclared (lane-04:27). Amber `not-captured` style, never red, never green.
- **Clock skew (R6).** Event-count windows are the default and skew-free; time
  windows name the anchor clock ("kernel captured UTC" vs "observer receipt") and
  show the 0.4–1.3 s skew note; never subtract unrelated clocks (existing rule,
  `deck-trace.js:196-197`); recorder window rows must display the anchored clock
  (lane-03 risk).
- **R4 parallel/ambiguous.** `run.ambiguous` holds V2–V4 and disables A/B compare;
  containment lists candidate owners with "ownership NOT_VERIFIED"
  (`run-evidence.mjs:56-60`); causal lanes show concurrent candidates, never one
  attributed owner.
- **No blanket badges.** Every overlay/state is claim-scoped with visible basis
  text; component summaries say "N observations · M limitations", never
  "trusted"; historical dispositions carry a banner "decided under rule X; does
  not permit current reliance" when superseded/invalidated/rule-digest differs
  (plan §5.5:637-641; I8/T8). Exports carry lane-06's honest labels ("hash-linked
  attribution; no signatures").
- **Volume.** Classification is one O(n) pass; DOM lists cap at 200 rows (existing
  `TABLE_LIMIT`, `explorer.js:17`) with "show all"; record-density buckets above
  ~500 records expand to a virtualized window; corpus rows are server-paged
  (~50); filters and trigger-kind chips come from the declaration, not hardcoded
  client vocabulary (specification rule 7, `verify-explorer.mjs:22`); Phase-1
  derived kinds are labelled "derived".
- **Corpus honesty.** Show sampling rate/policy digest and sampled-out counts; a
  corpus describes the rate it was drawn at (lane-06:228-229); never render a
  10,000-row client array; until the read endpoint exists, a fixture corpus is
  labelled as such.

## Fixtures and verification

| Driver | Use |
| --- | --- |
| `docs/replay-timing-fidelity/capture.sse` + `scene.json` | primary V1–V4/V7 model cases: 6 runs, exact cursors/timestamps, delivery phases, provider intervals, ambiguous/missing cases |
| `run-evidence-plan/evidence/E03/E04` | provider-reference rendering, NOT_OBSERVABLE/501, event-kind counts, HTTP statuses (E01/E04) |
| `tests/fixtures/circuit/*.json,.sse` (`run-say-hello-world`, `run-resolve-equity…`, equity rejected trace, bindings) | expected/observed, refused edges, boundary findings, traversal parity |
| synthetic recording fixtures from lane-02/03 shapes | V1/V2 trigger/window/manifest rendering before S3.3 |

Browser approach follows the existing pattern: Playwright via
`SFX_BROWSER_TEST_MODULE`/`SFX_BROWSER_EXECUTABLE`
(`verify-run-evidence-browser.mjs:59-60`), an offline fixture HTTP server
(`:32-57`), `page.route` fulfillment for captures (`tools/sfx-api/verify-circuit-replay.mjs:35-41`),
and real-host acceptance (`tools/live-circuit/verify-browser-session.mjs`) only
once W2.5/S3.3 are live. Receipts are JSON + screenshots under
`docs/sfx-flight-recording/evidence/U5-*.json` with SHA-256 rows.

**Gates (prefix U5).**

| Gate | Passes when | Script |
| --- | --- | --- |
| U5.1 | Window bounds equal a manual slice of the fixture; trigger marker cursor/timestamp exact; retention/snapping limits shown | new `verify-recording-model.mjs` |
| U5.2 | Stage partition covers every fixture record exactly once (sum equals `trace_records`); `other` and NOT_OBSERVABLE visible; no invented stage | same |
| U5.3 | Run list ↔ recordings ↔ `?run=&rec=` deep link round-trips; step/band selection seeks and selects; ambiguous capture held | extend `verify-run-evidence-browser.mjs` |
| U5.4 | Expected set equals declared deck; observed equals `joinFlow`; unmatched/rejected/refused listed; compare disabled when ambiguous | new `verify-expected-observed.mjs` |
| U5.5 | Every authority/envelope visual state cites a receipt basis; undeclared envelope shows NOT_DECLARED; refused edges require receipts | extend browser gate |
| U5.6 | Fixture dispositions render claim/scope/basis/limitations; historical/stale banner; DOM contains no entity-global trust badge | new `verify-dispositions-panel.mjs` |
| U5.7 | Manifest digests recompute over the exported NDJSON; limitations and retention facts present; no ledger claim in the bundle | `verify-recording-model.mjs` |
| U5.8 | Corpus page holds ≤ page size rows; filters derive from declaration; sampled-out counts shown; A/B excludes ambiguous pairs | new `verify-corpus-view.mjs` (fixture corpus) |

## Work items (ID · files · produces · deps · size)

| ID | Files | Produces | Deps | Size |
| --- | --- | --- | --- | --- |
| U5.1 Window model + timeline | new `recording-model.mjs`, `recording-window.js`, `recording.css`; modify `explorer.html`, `run-context.js` | V2 bar, trigger marker, Event/Time geometry, retention caps | W1.2 (worktree), capture fixtures | 2–3 d |
| U5.2 Causal lanes | `recording-model.mjs`, `recording-window.js` | V3 lanes, classifier, basis labels | U5.1; R2.4/S3.3 trigger refs for live | 2–3 d |
| U5.3 Recording list + Run tab + deep links | `recording-window.js`, `run-context.js`, `explorer.js` | V1 list, `rec` param, `?run=` seek | U5.1; W1.1/W1.4 (worktree); S3.3 for live | 1–2 d |
| U5.4 Expected vs observed | new `expected-observed.js`; modify `explorer.html`, `explorer.js` | V4 pane (structural v1; V4.* outcomes later) | U5.1; W1.3; lane-04 V4.2 for Phase 2 | 2–3 d |
| U5.5 Overlay modes | `circuit-viewer.js`, `circuit-runtime.js`, `explorer.html` | V5 authority/envelope modes | U5.1; G6.1/V4.5 envelope for full mode | 1.5–2.5 d |
| U5.6 Dispositions panel | new `dispositions.mjs`; `explorer.html`, `run-context.js` | V6 claims/limitations/history; fixture adapter | W2.5, W2.2, S3.3; fixture-first | 3–4 d |
| U5.7 Export bundle | `recording-model.mjs`, `run-context.js` | V7 manifest + NDJSON/CSV | U5.1; S3/G6.5 stored export later | 1.5–2 d |
| U5.8 Corpus view | new `corpus-view.js`, `corpus-model.mjs`; `explorer.html`, `explorer.js` | V8 list/aggregate/compare, sampling labels | **new paged corpus read** (decision D-U5.8); W5.1 retention; S3.3 | 4–6 d |
| U5.9 Gates + receipts | `verify-recording-model.mjs`, `verify-expected-observed.mjs`, `verify-dispositions-panel.mjs`, `verify-corpus-view.mjs`; extend `verify-run-evidence-browser.mjs` | U5.1–U5.8 receipts | per item | 4–6 d total |
| U5.10 Honesty/volume pass | cross-cutting | labels, holds, virtualization, keyboard/aria audit | U5.1–U5.8 | 1–2 d |

Critical path: W1.2 (in flight) → U5.1 → U5.2/U5.3; U5.6 waits on W2.5/S3.3; U5.8
waits on a paged corpus read and W5.1. Total ≈ 22–34 eng-days, of which U5.1–U5.4
are the fixture-first slice that can start now.

## Decisions needed

1. **Manifest home.** lane-02 D3 (evidence_object + `recordings[]`) vs lane-03
   (`evidence.recording` tables). Corpus filtering/paging needs indexed rows;
   recommend lane-03 tables storing the same sealed manifest digest. Resolve
   before U5.3/U5.8.
2. **Corpus surface.** Fourth context tab vs Runs-mode + `#corpus` workspace;
   recommend the latter (plan §5.5 froze three tabs).
3. **Trigger-kind authority.** Host `recorder.json` (Phase 2) vs estate
   `flight-trigger.v1` admitted via G6.1; UI must show which one it is and label
   derived kinds.
4. **Window defaults/semantics.** Follow lane-02 D2 (union vs first-satisfied) and
   expose the declared rule digest; otherwise label "view default".
5. **Clock anchors.** Confirm event-index default and dual-clock display for time
   windows (R6).
6. **Open recordings in the UI.** Show OPEN/`persistence unconfirmed` recordings
   for review, never as disposition basis; ABORTED visibly non-evidence.
7. **Export dual path.** Distinguish browser-capture export from server-issued
   admitted export (G6.5) by basis label; decide signing (lane-06 D14) before any
   "non-repudiation" wording.
8. **Corpus read contract.** Paged/filtered list + aggregate endpoint ownership
   (S3.3 extension vs new W2.2 route) and its sampling fields; required before
   U5.8.
9. **A/B compare scope.** Same capability + window rule only in v1.

## Risks and corrections

- **Correction to plan §5.5/E1:** neither contains recording, trigger, window or
  corpus concepts; the microscope is a new surface beyond Run|Runs|Evidence.
  Add U5 to the traceability table and decision register.
- **Correction to lane-01/analysis README:** its current-state map predates the
  uncommitted W1 files (`run-context.js`, `run-evidence.mjs`, context tabs,
  `verify-run-evidence*.mjs`); W1.1–W1.4 are partially built in the worktree —
  build on them, don't re-plan.
- **Trigger coverage overclaim.** The bridge drops `run.admitted`/cursors/kinds
  (`api-host.mjs:31-36`); derived triggers must be labelled until R2.2/W2.3 land;
  partial trigger coverage is NOT_OBSERVABLE.
- **Authority is timing only today** (B20): overlays must never imply a granted
  decision; lane-04 Q2/Q4 stay NOT_OBSERVABLE.
- **Provider status ≠ HTTP status** (`deck-trace.js:88-97`); only E01/E04 facts
  carry HTTP values; Gemini bodies remain withheld (B5/B13).
- **Attribution under parallel runs (R4)** is where a microscope most tempts
  unsound claims: hold or show candidates only.
- **Clock skew (R6)** and time-window bounds must record the anchored clock.
- **Corpus feasibility.** 10k executions ≈ 26 GB raw / ~0.6–0.85 GB Brotli,
  ~47 h wall (lane-02:152-156); show cost honestly; retention (W5.1) is a
  precondition.
- **Sampling bias** must label every corpus view (lane-06).
- **Double-count risk.** U5.1–U5.3 absorb lane-03 S3.5; land S3.5 as the live
  slice and avoid duplicate effort.

## Confidence

High on the Explorer current state including the in-flight W1 files, selection
wiring, playback and fixtures (read first-hand). Medium on the recording object
model and corpus reads: two sibling designs propose different manifest homes and
no endpoint/index exists for corpus queries. Medium on effort ranges.
