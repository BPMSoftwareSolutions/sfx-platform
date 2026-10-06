# Lane 01: platform Explorer UI

Read-only recon + deep dive, 2026-10-06. Repos: sfx-platform `327a2c2`.
Scope: [plan](../../run-evidence-implementation-plan.md) §5.5, §6 W1.1–W1.4, W2.5,
W3.3, §7 gates A1.4/A1.5/A2.3/A3.5, design
[explorer-run-evidence-design.md](../../explorer-run-evidence-design.md).

## Current state

- **Framework/routing.** Next.js 16.3.4 + React 19.2.8, App Router under `app/`,
  `typedRoutes:false`, `output:'standalone'` (`next.config.ts:3-10`); Next 16
  uses `proxy.ts` (`proxy.ts:4`). Next routes cover the marketing site and
  `app/workbench/*`; staging treats them as retired (`deploy/staging/accept.mjs:41-44`).
- **The Explorer is not Next.js.** It is plain ES modules under
  `live-circuit/circuit/`, served on 8787 by
  `live-circuit/dispatch-pair/observe-server.mjs` (static map `:14-39`, dispatch
  `:418-424`), reached through the gateway for `/circuit/*`, `/api/circuit/*`,
  `/events` (`deploy/sda-kernel/gateway.mjs:152-173`).
- **Shell.** `live-circuit/circuit/explorer.html`: context aside `:196-217`, run
  bar `:165-181`, run-evidence `<details>` with `#verification`/`#inventory`
  `:192-193`. Visible tabs are DB-declared section aliases
  (`explorer.js:164-174`; `explorer-model.mjs:9-35`) — there is **no
  Run|Runs|Evidence context tab set**.
- **Admission/render.** Observe posts `/api/circuit/v1/runs`
  (`observe-panel.js:186-210`); host forwards + attributes (`run-api.mjs:70-81`;
  `identity-session.mjs:96-102`); streams per-run events and output
  (`observe-panel.js:149-185`; output is raw `<pre>` at `:174-178`). Live/replay
  draw via `circuit-runtime.js`.
- **Session runs list.** `GET /api/circuit/v1/session/runs` exists
  (`identity-session.mjs:118-125`), in-memory, bounded 2,000. Only
  `home.js:32-45` consumes it; the Explorer never calls it.
- **Playback today.** Clock `playback-clock.js`; timeline/window/frames
  `deck-trace.js:238-307`; run controls `circuit-runtime.js:196-212,245-251,277-283`;
  provider dwell inside traversal segments (`traversal.js:168-173,184-224`,
  `calleeEvidence` `:128-166`). No timeline bar, no execution steps list, no
  hatched no-record spans (gap data exists in `deck-trace.js:197-236` `gaps`).
- **Evidence today.** Clicking a component shows `#inspector` raw JSON facts and
  the `#verification`/`#inventory` details (`circuit-runtime.js:293-317`;
  selection bridge `explorer.js:97-103`, `explorer-model.mjs:72-80`). No Evidence
  tab/panel exists.

## Work item -> files

| Item | Existing scaffolding | Status |
| --- | --- | --- |
| W1.1 Run report in Run tab | run record + output fetched `observe-panel.js:172-178`; run lines `circuit-runtime.js:252-254,277-283`; raw output `explorer.html:208`. No outcome/duration/providers/time-split report, no report tab | None/minimal |
| W1.2 Playback bar, steps list, dwell | controls + clock + timeline `explorer.html:165-181`, `playback-clock.js`, `deck-trace.js:238-307`, `circuit-runtime.js:196-212`; dwell `traversal.js:168-173,184-224` (dot only). No bar, steps list, hatching | Partial (engine only) |
| W1.3 Evidence tab: Time/Trace/Called | component inspector `circuit-runtime.js:293-306`; trace = raw cell testimony `:307-317`; timing = `invocationTiming` `deck-trace.js:197-236` (not panelised) | Partial/raw |
| W1.4 Runs tab | endpoint `identity-session.mjs:104-125`; render pattern `home.js:32-45`; verifiers `verify-identity-session.mjs:123-124`, `verify-browser-session.mjs:140-146`; Explorer has no tab/fetch | Endpoint only |
| W2.5 Durable Runs + `?run=<id>` replay + disposition | replay is latest SSE run only `circuit-runtime.js:196-212,322-353`; URL params are capability/scenario/page/detail/view `explorer.js:10-14`; no `run` param, no stored-trace reader, no disposition UI | None |
| W3.3 In/Out + Request/Response + Download bundle + C2 | nothing; no evidence-content fetch anywhere; provider drill-down is declaration DB read `circuit-runtime.js:77-89` | None |

## Reusable pieces

- Run/capture model: `newRun`/`applyRecord`/`joinTestimony`/`joinFlow`/`replayTimeline`
  (`deck-trace.js`), `PlaybackClock`, `buildTraversal` segments/pieces/provider dwell.
- Run admission/stream/output client: `observe-panel.js` (request helper, `apiRecord`, gap/resume).
- Session identity/runs: `identity-session.mjs`; session UI helpers `site.js:6-29`.
- Explorer selection/tab plumbing: `explorer.js:33-44,86-103,164-174`; `explorer-model.mjs`.
- Circuit drawing: `circuit-viewer.js` (`el`, `renderCircuitViewer`, `surface`,
  `boundaryGlyphs`); React counterpart `components/circuit/circuit-viewer.tsx`
  used only by the Next estate pages.
- Home runs-list markup pattern (`home.html` sections + `home.js:32-45`).

## Missing / gaps

- Context-column tab framework (Run | Runs | Evidence); current tabs are DB
  section aliases.
- Report component/state; provider-called table; Asked/Answered; Replay/Copy
  link/Download actions.
- Timeline bar, steps list, hatched spans (data partially in `invocationTiming.gaps`).
- Time/Trace/Called Evidence panels; In/Out; request/response; Download bundle.
- Trust-disposition/limitation rendering and vocabulary for C1/C2 (depends on
  Phase 2–3 services).
- `?run=<id>` routing and a durable run-list/trace reader in the Explorer.
- `explorer.js:10-14` is the single URL-param contract to extend.
- Next 16 caveat applies only if work targets `app/`; the plan's UI lane does not.

## Verification harness

- Unit/component: `node --test tests/*.test.{mjs,ts}` via `scripts/test.mjs`
  (Next components only; `tests/live-run.test.ts`, `run-service.test.mjs`,
  `mapping-trace.test.mjs`).
- Explorer/host: `live-circuit/circuit/verify-*.mjs` — `verify-explorer.mjs`
  (read-only projection, no runs assertion), `verify-identity-session.mjs`,
  `verify-run-api.mjs`, `verify-traversal.mjs`, `verify-timing.mjs`,
  `verify-live-flow.mjs`.
- Browser: Playwright loaded via `SFX_BROWSER_TEST_MODULE`
  (`.github/workflows/staging.yml:51`, `deploy/staging/accept.mjs:13-17`);
  `tools/live-circuit/verify-browser-session.mjs` (real sign-in/Observe/
  attribution); `tools/sfx-api/verify-circuit-replay.mjs` (1x/0.1x sampling of
  `#replay`/`#speed`, provider-interval assertion at `:91`).
- Plan gates absent: `verify-run-report.mjs` (A1.1), `verify-evidence-panel.mjs`
  (A1.4), `verify-run-evidence.mjs` (A2.x/A3.x), `verify-trust-ledger.mjs`
  (L0–L10); `verify-explorer.mjs` lacks the A1.5 runs check;
  `verify-circuit-replay.mjs` lacks `--source stored` (A2.3).

## Deep dive findings

### Phase 1 split and W1.1 data reality

All of Phase 1 is "sfx-platform only, no storage"
([plan](../../run-evidence-implementation-plan.md) W1 line), so W1.1–W1.4 have
zero backend dependency. The real split is front-end coupling: W1.1+W1.4 share
the new tab shell; W1.2+W1.3 share the time-containment join. Recommended:
Turn 1 = W1.1+W1.4; Turn 2 = W1.2+W1.3.

W1.1 field sources from today's lane:

| Field | Source | Availability |
| --- | --- | --- |
| Outcome variant | own scenario-return receipt via `boundaryPolicy` (`deck-trace.js:143-157`); `terminalText` (`circuit-runtime.js:225-231`) | Yes |
| API state/exit | `GET /runs/{id}` state+exitCode (`observe-panel.js:172-173`; `deck-trace.js:13-15`) | Yes |
| Output | `/runs/{id}/output` (`observe-panel.js:174-178`) | Yes |
| Duration | `replayTimeline` end−start (`deck-trace.js:269-271`); `invocationTiming.duration` (`:197-203`) | Yes |
| Per-provider time | provider child receipt found by `calleeEvidence` (`traversal.js:140-165`), dwell pieces `:168-173,204-211` | Yes where a provider-child receipt exists; otherwise schematic (`verify-circuit-replay.mjs:87-95`) |
| Per-provider status | cell `disposition` mapped by flow policy (`deck-trace.js:88-90`), provider activity `:93-97` | Execution disposition only (`completed/failed/observed`), **not HTTP status** |
| Time split | `invocationTiming` phases/gaps/processSpans/unlocated (`deck-trace.js:226-235`) | Partial: wall phases + gaps; no inside-operation values |
| Asked input | **Unavailable from server** (plan B4). Only the tab's draft (`observe-panel.js:118,130`) until reload | Tab-local only |

Unavailable today: HTTP status (discarded, B5), operation input/output values
(B12), model exchange bodies (B13). The report must show amber
"not captured today", never invent. A1.1 only requires report fields equal
`/v1/runs/{id}` and `/output`, so these absences do not block W1.1.

### W1.4 endpoint and A1.5

`GET /api/circuit/v1/session/runs` (`identity-session.mjs:118-125`): 200
`{ principalId, runs:[{runId, admittedAt, sessionId, capabilityId, namespaceId}] }`,
insertion order oldest-first, filtered by `principalId`; 401
`{ disposition }` (`SIGN_IN_REQUIRED`/`SESSION_ENDED`, cookie cleared); 503
`{ disposition }` when the identity host is down. Attribution fields written at
`:96-102`.

Smallest correct change: add a third context tab that fetches this endpoint on
open and renders newest-first (reverse pattern in `home.js:32-45`), labelled
"runs this server session admitted (in memory)". Files: `explorer.html`,
`explorer.js`; endpoint unchanged.

A1.5 must assert exact set equality both directions between DOM run rows and
endpoint `runs[].runId` for the signed-in principal, plus
capabilityId/admittedAt mapping and an empty/sign-in state; no invented or
missing rows. Warning: `verify-explorer.mjs:1-30` is a projection checker with
no browser, while attribution is already checked in
`verify-browser-session.mjs:140-146`. The gate needs an authenticated browser
mode (Playwright via `SFX_BROWSER_TEST_MODULE`) or an explicit hand-off to
browser acceptance.

### W1.3 time containment / A1.4

Source is nested step receipts by time containment: operation interval from own
cell testimony (`replayTimeline` `deck-trace.js:274-287`), provider call from
the provider-child cell receipt inside it (`traversal.js:128-165`). Plan states
it: W1.2 bullet and B13.

A1.4 can be asserted today only over lane cell/edge testimonies whose captured
`startedAt/completedAt` fall inside the operation interval — not over evidence
records (they carry only `evidenceRef` + key fields). Limitation: containment
cannot disambiguate parallel operations; ownership is `NOT_VERIFIED` until S2
(R4), so the panel must label/hold when intervals overlap rather than assert a
single owner.

### W2.5 / W3.3 external contracts and stubbing

- W2.2: identity host `/ledger/v1/*` + `/evidence/v1/*` (identify, assert,
  attach, decide, append trace, complete, read-for-principal; per-caller keys).
- Proposed shapes: disposition `{claim_id, scope, trust_state 0–8,
  basis(evidence/verification/authority ids+digests, rule_digest), limitations,
  invalidation/supersedes, decided_at}`; `evidence.run`,
  `evidence.run_trace_chunk` (Brotli+SHA-256), `evidence.evidence_object`,
  `evidence.access_audit`.
- W2.5 UI: durable list, `?run=<id>` stored-trace replay, disposition +
  limitations. Needs a read endpoint and a trace wire encoding (unspecified).
- W3.3: In/Out, Request/Response, Download bundle, C2 dispositions. Needs S1,
  W3.1 `POST /evidence/v1/objects`, S2 owner identity, W3.2 re-declaration,
  and `GET /v1/evidence/{ref}` resolving.
- Stubbing: retained real material exists —
  `docs/replay-timing-fidelity/capture.sse` + `scene.json`,
  `tests/fixtures/circuit/{run-*.json,*.sse}`,
  `docs/run-evidence-plan/evidence/E03-local-gemini-run.json`,
  `E04-local-equity-run.json`. The `verify-circuit-replay.mjs:35-37`
  route-fulfillment pattern already drives the UI from a capture; use it plus
  static fixture JSON behind a temporary adapter so the endpoint swap is one
  module.

### Tab architecture

Put Run | Runs | Evidence in the **`#context` aside**, per plan §5.5 ("Context
column tabs", click switches to Evidence). `#tabs` (`explorer.html:163`) is
claimed by DB navigation aliases (`explorer.js:164-174`), and the context aside
(`explorer.html:196-217`) already hosts selection state (`#inspector`,
`#declaration-detail:214-215`) written by `circuit-runtime.js:293-306`; circuit
clicks route through `shell.component` → `explorer.js:97-103`. Files to modify:
`explorer.html` (context tablist + panels), `explorer.js` (`state.contextTab`,
`renderContext`, `selectComponent`→Evidence, terminal run→Run),
`circuit-runtime.js` (report/evidence render + expose `latestRun`),
`circuit-canvas.css` (styles). Do not touch main `#tabs`.

## Effort and 3-turn allocation

| Item | Eng-days | Files |
| --- | --- | --- |
| W1.1 report | 2–3 | modify `explorer.html`, `explorer.js`, `circuit-runtime.js`; new `live-circuit/circuit/run-report.js` |
| W1.2 bar/steps/dwell | 3–4 | modify `circuit-runtime.js`, `explorer.html`, `deck-trace.js`; new `playback-bar.js` |
| W1.3 Evidence Time/Trace/Called | 3–4 | modify `circuit-runtime.js`, `explorer.html`; new `evidence-panel.js` |
| W1.4 Runs tab | 1–1.5 | modify `explorer.js`, `explorer.html` |
| Verifiers A1.1/A1.4/A1.5/A2.3 | 0.5–2 each | new `verify-run-report.mjs`, `verify-evidence-panel.mjs`; modify `verify-explorer.mjs`, `verify-circuit-replay.mjs` |
| W2.5 | 3–5 | new client run-index + stored-trace adapter; modify `explorer.js` (`?run=`), disposition panel |
| W3.3 | 5–8 | new In/Out, Request/Response, bundle modules; wire `GET /v1/evidence/{ref}` |

Allocation (2 engineers, parallel where noted):

- **Turn 1** — tabs + W1.1 + W1.4 + A1.1/A1.5. Freeze tab markup/state contract
  early; ~6–8 eng-days.
- **Turn 2** — W1.2 + W1.3 + A1.3/A1.4. Can run parallel with Turn 1 only after
  the tab shell merges; pair containment math so bar and panel agree; ~8–10 eng-days.
- **Turn 3** — W2.5 then W3.3 + A2.3/A3.5 fixture runs, start when W2.2/W3.1
  land; build list/run-param and evidence panels against fixtures behind one
  adapter if backends slip; ~8–13 eng-days.

## Risks that would change the allocation

- Parallel runs make containment unsound (R4); if acceptance fixtures include
  concurrency before S2, W1.3/A1.4 balloon.
- Clock skew 0.4–1.3 s (R6) can make A1.4/A1.2 borderline; may force
  tolerance/labelling work into Turn 2.
- HTTP status / operation values (E1 slides 6–7) arriving in Phase 1 would block
  on S1/S2/W3.2 — move W3.3 earlier or descope.
- Stored-trace wire format/Brotli decode and disposition presentation are
  unspecified (plan notes an E1 extension is needed) — Turn 3 may need a design
  spike first.
- If `verify-explorer.mjs` cannot host a browser, A1.5 ownership shifts to
  `verify-browser-session.mjs`, adding CI surface.
- If any UI work moves to `app/` (Next 16.3.4), read `node_modules/next/dist/docs/`
  first (AGENTS.md caveat).

## Plan corrections from this lane

- W1.4/W2.5 "Runs tab" does not exist: `explorer.html:163` tabs are capability
  sections; only `home.js:32-45` reads session/runs. A1.5 needs the tab first.
- Report fields for HTTP status and operation values are not derivable from
  today's lane (B5/B12); the plan's report mock must label them not-captured.
- Open: whether Phase-1 tabs live in the `#context` aside (recommended) or main
  column; whether the design-E1 capability/All switch and Copy/Download actions
  are W1.1/W1.4 scope (plan does not state); the report's duration source given
  B4.

## Confidence

High on the current-state map and Phase-1 file surface (all cited first-hand).
Medium for W2.5/W3.3 because their endpoints/storage are explicitly proposed in
the plan and absent here. Medium on effort ranges.
