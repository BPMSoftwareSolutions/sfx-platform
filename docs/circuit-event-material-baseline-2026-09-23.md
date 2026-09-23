# Circuit event & material baseline — 2026-09-23

**Status:** Analysis baseline. No application, layout, theme or geometry file was changed by this study.
**Scope:** the live SDA API event lane and compile-only graph endpoint, read against `sfx-platform`'s
current circuit renderer (`components/circuit/*`, `lib/run-graph.ts`, `lib/live-trace.ts`).
**Audience:** the layout lane, and anyone binding live testimony to drawn shapes.
**Authority:** the raw captures are the evidence; this document analyses them. Raw files live in
`%TEMP%\opencode\baseline` (machine-local, not committed) and are listed in §1.2.

Two capabilities were captured:

| Capability | Graph | Lane |
| --- | --- | --- |
| `say-hello-world` | compile-only, live via `GET /v1/runs/{id}/graph` | full live run, completed |
| `resolve-equity-market-price-evidence` | compile-only, 873 cells / 920 edges | full live run (`SPY`), completed |

The run graph and the compile-only graph are the same projection (same `graphId` and
`canonicalGraphDigest`, same cell/edge counts in both reads), so the compiled view and a run's
skeleton are the same graph.

---

## 1. What was captured

### 1.1 Identities

| | `say-hello-world` | `resolve-equity-market-price-evidence` |
| --- | --- | --- |
| runId | `d077fcab-14bf-4158-b6fc-8a98dbe5b031` | `c5de9058-7ef5-407b-b9fe-388977aa4c5b` |
| run state | completed (exit 0) | completed (exit 0, `durationMs` 4642) |
| graphId | `graph:say-hello-world` | `graph:resolve-equity-market-price-evidence` |
| canonicalGraphDigest | `sha256:8b859397e5bf18f8d24580ecfb3859fedc09f4150a69b40f7447273cbb014931` | `sha256:b7772ac171e119022df78963d2c481cea0357cc1aa75753a168a7a28a57565e3` |
| events on lane | 26 | 1079 |
| cell testimonies | 6 | 529 |
| edge testimonies | 5 | 528 |
| output | `hello-world-greeting.v1`, `Hello, World!` | `equity-market-price-evidence.v1`, `EQUITY_MARKET_PRICE_EVIDENCE_RESOLVED` |
| compile-only graph read | 6 cells / 5 edges, 2211 ms | 873 cells / 920 edges, 3034 ms |
| `graph.captured` after admission | 2.203 s | 2.927 s |

Notes:

- The `namespace` query is not admitted here: `GET /v1/capabilities/{id}/graph?namespace=sidefx`
  returns 404 for both. The estate namespace spelling (`sidefx:capabilities`) is not representable
  in the API's identity grammar, which matches the platform client sending no namespace.
- `graph.captured` carries only `{graphId, canonicalGraphDigest}`; cells and edges are served at
  `GET /v1/runs/{runId}/graph` and were fetched successfully in both runs.

### 1.2 Raw capture inventory (`%TEMP%\opencode\baseline`)

| File | Contents |
| --- | --- |
| `run-say-hello-world.json` | admission, all 16 event pages with per-request ms, run graph, output, evidence |
| `run-resolve-equity-market-price-evidence.json` | admission, all 32 event pages (tail drained after terminal), run graph, output, evidence, final run resource |
| `capability-graphs.json` | compile-only reads for both capabilities, no-namespace and `namespace=sidefx` |
| `events-hello.jsonl`, `events-equity.jsonl` | every event normalised one row per line |
| `flow-hello.jsonl`, `flow-equity.jsonl` | testimony only, joined to the run graph |
| `analysis.json`, `summary.json`, `readout.json`, `mapping-table.json`, `replay.json` | derived measurements, mapping tables, platform-pipeline replay |
| `capture.mjs`, `complete-run.mjs`, `analyze.mjs`, `mapping.mts`, `tables.mts`, `replay.mts` | capture and analysis scripts |

Scripts read `SDA_API_ENDPOINT` / `SDA_API_TOKEN` from `sfx-platform/.env.local`; no token, bearer
header or credential was written to any capture (checked, §7).

---

## 2. Event trace

### 2.1 Event kinds and counts

| kind | hello | equity | notes |
| --- | --- | --- | --- |
| `run.admitted` | 1 | 1 | cursor 1 |
| `run.started` | 1 | 1 | cursor 2, carries `pid` |
| `delivery-phase` | 11 | 11 | operational telemetry, not capability experience |
| `graph.captured` | 1 | 1 | `{graphId, canonicalGraphDigest}` marker |
| `observation` | 11 | 1057 | cell and edge testimony |
| `provider-exchange-shape.v1` | 0 | 7 | evidence record kind, key-preserved + `evidenceRef` |
| `run.exited` | 1 | 1 | last cursor, `{exitCode, durationMs}` |
| **total** | **26** | **1079** | |

All events are untruncated (`truncated` absent, byteLength < 4096). No event carries
`selectedEdgeIds`; no event carries `iterationId`. Testimony counts: hello 6 cell / 5 edge;
equity 529 cell / 528 edge (500 mechanic, 14 provider, 14 physical, 1 scenario); 28 of the 500
mechanic cells are junction cells, 35 are operation composites, 437 are expression leaves.

### 2.2 Field inventory (what the lane actually carries)

Cell testimony (`cell-execution-testimony.v1`): `cellId`, `cellExecutionId`, `rootExecutionId`,
`parentCellExecutionId`, `logicalOrder`, `cellAltitude`, `semanticAddress`, `disposition`,
`outcomeVariant`, `outcomeContractId` (scalar cells), `occurrenceId`, `providerProfileId`,
`display.entry.{status,text}`.

Edge testimony (`edge-execution-testimony.v1`): `edgeId`, `sourceCellExecutionId`,
`destinationCellId`, `logicalOrder`, `admissionDisposition`, `semanticAddress`,
`display.entry.{status,text,admission}`. The edge's own route kind (`sequence`, `selection`, …)
is **not** on the lane; it comes from the graph. `selectsVariant` is also graph-only.

The lane's `cellAltitude` matches the graph's `altitude` for every observed cell (0 mismatches):
mechanic / provider / physical / scenario.

### 2.3 Cursor-order skeleton

`say-hello-world` (all 11 testimonies, in order):

```
9  cell  expression.fields.contractId          mechanic
10 edge  expression:dependency:1               sequence
11 cell  expression.fields.payload.fields.message
12 edge  expression.fields.payload:dependency:result
13 cell  expression.fields.payload
14 edge  expression:dependency:result
15 cell  expression
16 edge  expression→operation (return)
17 cell  operation.1                           mechanic composite
18 edge  operation.1→scenario (return)
19 cell  scenario                              scenario
```

`resolve-equity-market-price-evidence` closes identically: `... 1071 edge return,
1072 cell scenario, 1073 executeDeclaredGraph completed, 1074 observation-projection deferred,
1075-1078 delivery-finalization / session-teardown, 1079 run.exited`. Its 14 provider legs all
follow one shape (example, cursors 78-84): `sequence edge into operation.4 -> provider cell ->
sequence edge -> physical cell -> return edge -> operation.4 composite cell`.

### 2.4 Timing

| measure | hello | equity |
| --- | --- | --- |
| lane first → last testimony | 1 ms | 1466 ms |
| `executeDeclaredGraph` phase | 147.3 ms | 2533.7 ms |
| cell durations, sum / max | 3.38 ms / 2.65 ms | 2886.3 ms / 874.2 ms |
| edge durations, sum / max | 0.08 ms / 0.02 ms | 5.09 ms / 0.06 ms |
| cursor polling pages / avg request | 16 / 3 ms | 32 / 3 ms |

The provider exchange carries all the wall time (max cell 874.2 ms is a provider leg); edges are
sub-millisecond bookkeeping. `graph.captured` lands 2.203 s (hello) and 2.927 s (equity) after the
admission response.

---

## 3. Flow ordering rules (derived from these traces)

R1. **Lifecycle envelope.** `run.admitted` → `run.started` → `delivery-phase
readExecutionDelivery` (started/completed) → `readAuthority` (started/completed) →
`executeDeclaredGraph` started → `graph.captured` → testimony → `executeDeclaredGraph` completed →
`observation-projection` deferred → `delivery-finalization` → `session-teardown` → `run.exited`.
`graph.captured` precedes every testimony (cursors 8 vs 9 in both runs).

R2. **Strict alternation.** Testimony is `cell → edge → cell → edge …`: 528 `cell→edge` and 528
`edge→cell` transitions in equity (5/5 in hello), starting and ending on a cell. No two cells and
no two edges are adjacent in the observed stream.

R3. **An edge's testimony immediately follows its source cell's** — 528/528. The source is named
by `sourceCellExecutionId`; the preceding observed cell is its raw source cell in every case.

R4. **An edge's destination is the next observed cell** — 494/528. The other 34 are exactly the
inter-operation sequence edges: the destination is a composite `operation.N` cell, and the next
observed event is that operation's first child (provider for exchange operations, an expression
leaf otherwise). The composite's own testimony comes **after all its members** (post-order): e.g.
provider(80) → physical(82) → `operation.4` composite(84).

R5. **Composite testimony is post-order.** Both runs show a parent cell testifying after its
children; in equity the 35 operation composites all testify once, after their members. The
scenario composite testifies last (1072), after all descending returns.

R6. **Provider shape.** A provider exchange is four steps: provider cell → sequence edge →
physical cell → return edge → the composite it belongs to. 14/14 exchange operations observed.

R7. **Junctions and branches.** 41 junction cells exist, all with `in=sequence`, `out=selection`.
28 were reached; each junction cell is immediately followed by its selection edge (28/28). All 28
walked selection edges carry `selectsVariant="FALSE"` from the graph. 41 `TRUE` selection edges and
7 recurrence edges were never walked; 13 junctions were never reached; all 36 return edges were
walked.

R8. **Evidence records ride the lane between testimonies.** 7 `provider-exchange-shape.v1` records
appear at cursors 79, 342, 475, 606, 751, 898, 1047, each between an edge and the next cell, with
key-preserved payload (`cellId`, `cellExecutionId`, `disposition`) plus `evidenceRef`. Their
dispositions (`retained-non-success`, `rejected-endpoint`, `completed`) restate the provider cell's
variant; they carry no `testimonyType`, so the current id binding ignores them.

R9. **A terminal page is not a drained page.** The first terminal page (`state=completed`,
`terminal=true`) still reported `hasMore=true`, `latestCursor=1079` after cursor 974 — 105 later
events. The lane must drain until `hasMore=false`; the run's tail (provider 34, scenario,
`run.exited`) is otherwise lost. The platform client does drain (`live-run.tsx`); the lab adapter
`runCapabilityToCompletion` does not (`lib/sda-api.ts:181-189`).

R10. **Selection truth is edge testimony plus graph.** The lane never names the taken edge in a
cell event (`selectedEdgeIds` is absent); the taken route is the `edgeId` that testifies, and its
branch identity is the graph edge's `selectsVariant`.

---

## 4. Material mapping (from evidence)

### 4.1 Inventory

- `public/media/materials/` holds 15 plate images; `generated/visual-publication.json` maps all 15
  to tokens (digests and `/media/materials/<sha256>.jpg` URLs). No orphan file, no token without a
  plate.
- `components/circuit/scl-theme.ts` defines 15 `MaterialToken`s with shapes:
  input/rounded-rectangle, event/beveled-rectangle, outcome/capsule, provider-port/socket,
  provider/tabbed-tile, validation/shield-check, evidence/document-stack,
  human-approval/person-in-gate, authority/top-band-frame, branch/fork, fan-out/radial-hub,
  convergence/merge, decision/diamond, termination/solid-end-cap, rejection/barred-octagon.
- `components/circuit/material-geometry.ts` implements one silhouette per shape plus label inset
  and decorative details; every path is a pure function of the drawn box.
- Resolution is table-driven: `CELL_MATERIAL` (exact `altitude|kind`), `MATERIAL_WORDS` (only
  refines a resolved `event`), `JUNCTION_MATERIAL` (route kinds), `EDGE_MATERIAL` (route kind
  substring), with `EDGE_FAMILY_MATERIAL` as the family fallback.

### 4.2 Observed cell contexts → token / shape

Hello (6/6 cells observed):

| altitude\|kind | context | cells | token | shape | status |
| --- | --- | --- | --- | --- | --- |
| mechanic\|mechanic | `say-hello-world-transform.v1#/expression…` leaves | 4 | event | beveled-rectangle | generic (no word stem matches) |
| mechanic\|mechanic | `operation.1` composite | 1 | event | beveled-rectangle | generic (structural address, no `#`) |
| scenario\|scenario | root | 1 | outcome | capsule | specific |

Equity (529/873 cells observed; condensed by operation family):

| observed context | cells | resolved token | shape | assessment |
| --- | --- | --- | --- | --- |
| `operation.N` composites (35) | 35 | event | beveled-rectangle | generic: no semantic address (`#`), no hints |
| `build-*` families (14, incl. binding/exchange/body-proof) | 341 | input 328 / branch 12 / rejection 1 | rounded-rectangle / fork / barred-octagon | **collision**: `input` comes from the word `request` in the mechanic name; the 12 `branch` cells are their junction cells; the 1 `rejection` is the `cancellationScopeReference` false positive |
| `normalize-equity-price-evidence` | 75 | evidence 59 / branch 10 / termination 3 / validation 3 | document-stack / fork / solid-end-cap / shield-check | evidence is right; `…bindings/completed*` → termination is a false positive; `…bindings/conforming*` → validation |
| `select-*-route` families (6) | 49 | decision 28 / termination 15 / branch 6 | diamond / solid-end-cap / fork | decision and branch are right; `…bindings/completed*` → termination false positive |
| provider cells | 14 | provider-port | socket | specific |
| physical cells | 14 | provider | tabbed-tile | specific |
| scenario root | 1 | outcome | capsule | specific |

The 28 `branch` tokens are the observed junction cells, counted once inside the build /
normalize / select family rows; 35 + 341 + 75 + 49 + 14 + 14 + 1 = 529.

Full graph (including never-observed branch cells) gives the vocabulary scale on `mechanic|mechanic`
(803 cells): event 35, input 346, decision 304, termination 18, rejection 1, evidence 96,
validation 3. `mechanic|junction` 41 (all branch); provider 14; physical 14; scenario 1.

**Generic/collision flags**

1. Every `operation.N` composite (35 observed, 35 planned) resolves to the generic `event` plate.
2. 328 observed leaves (346 planned) resolve to `input` only because their mechanic name ends in
   `-request`; the operation is a construction/transformation, not the capability's input.
3. 18 observed `termination` plates come from the expression-language word `completed`
   (`…bindings/completed…`) — a field/binding name, not capability termination.
4. 1 observed `rejection` comes from `cancellationScopeReference` — a scope reference, not a
   rejection.
5. No observed context resolves to `null`; the primitive fallback is not exercised by these runs.
6. At the default collapse (below), the plates actually drawn are event and outcome only —
   evidence, validation, decision, branch, termination, rejection, socket and tabbed-tile contexts
   all exist in the observed trace but are collapsed away.

### 4.3 Junction contexts

All 41 junctions: `in = [sequence]`, `out = [selection]` → `JUNCTION_MATERIAL` rule
`out: [selection, recurrence]` → **branch / fork**. 28 observed (all followed by a selection
edge), 13 never reached. No fan-out, convergence, join, or broadcast junction exists in either
graph, and no observed junction falls through to the structural fallback.

### 4.4 Edge kinds → material

| route kind | graph (equity) | observed | token | shape layer |
| --- | --- | --- | --- | --- |
| sequence | 795 | 464 | event | beveled-rectangle |
| selection | 82 (41 TRUE / 41 FALSE) | 28 (all FALSE) | branch | fork |
| recurrence | 7 (`CONTINUE`) | 0 | branch | fork |
| return | 36 | 36 | outcome | capsule |

Hello graph: sequence 3/3, return 2/2. Every route in both graphs is family `EXECUTION`
(`familyForEdge` default); no `PRODUCT_TRANSFER` or `SUPPORT` route exists, so the legend's other
two families are untested by live data. No observed route kind resolves to null.

### 4.5 What the default drawn view resolves to

`buildRunGraphView` with `DETAIL_CELL_LIMIT = 30` collapses equity to **15 nodes / 28 edges**
(892 routes internal to a collapsed node), hello stays 6/5.

| drawn view | nodes | edges |
| --- | --- | --- |
| hello | 5 × event/beveled + 1 × outcome/capsule | 3 × sequence→event + 2 × return→outcome |
| equity | 14 × operation exchange node (event/beveled) + 1 × scenario (outcome/capsule, 831 members) | 28 × sequence→event |

The 14 exchange nodes are the operations that own a provider/physical pair (2, 4, 7, 9, 12, 14,
17, 19, 22, 24, 27, 29, 32, 34); everything else (35 composites minus 14, all expression leaves,
all junctions, all physical/provider members, the rest of the scenario) is inside the 831-member
scenario node. So at the baseline collapse, the observed branch/fork/decision/evidence/socket
vocabulary never reaches a drawn shape.

---

## 5. Alignment study: traces vs the renderer

Method: the captured events were replayed through the platform's own pipeline —
`buildRunGraphView` → `emptyTrace` → `applyEvents` → `testimonyTrail` — with the run's own graph
(working tree: `lib/run-graph.ts`, `lib/live-trace.ts`, `components/circuit/*` at HEAD `e435dc5`
plus the uncommitted layout working tree, including the new `testimonyTrail`).

### 5.1 Replay result

| | hello | equity |
| --- | --- | --- |
| raw cells / edges | 6 / 5 | 873 / 920 |
| drawn nodes / edges | 6 / 5 | 15 / 28 |
| collapsed | no | yes (limit 30) |
| internal edges (not drawn, not unmatched) | 0 | 892 |
| raw ids with no binding | 0 | 0 |
| transitions / traveling token steps | 11 / 11 | 44 / 44 |
| final node states | 6 done | 4 done, 11 failed |
| final edge states | 5 done | 28 done |

Hello replays exactly: every testimony binds, the token order equals cursor order, everything ends
done.

Equity does not. The first trail step is the **scenario node** (the first expression cell's
nearest drawn ancestor is the 831-member root), then it walks `scenario → sequence:1 → operation.2
→ sequence:2 → sequence:3 → operation.4(failed) → …`. Eleven of fifteen nodes — including the
scenario root and ten fallback exchange operations — end **failed**, although the run completed,
the scenario testimony is `completed`, the output is `EQUITY_MARKET_PRICE_EVIDENCE_RESOLVED`, and
`run.exited` is exit 0.

### 5.2 Mismatches

| # | Mismatch | Evidence |
| --- | --- | --- |
| M1 | Fallback provider attempts are marked `failed` and stick. All 14 provider cells have `disposition=completed`; the failed read comes from `display.entry.status=failed` on variants `retained-non-success`, `rejected-endpoint`, `CREDENTIAL_NOT_AVAILABLE`. `cellState` treats display `failed` as failure, `aggregateNode` gives failure precedence, and `applyNode`/cells keep `failed` sticky. The successful run therefore draws as 11 failed nodes and a failed root. | `lib/live-trace.ts:88-110, 125-144, 197, 225`; provider cells at cursors 80, 343, 536, 607, 667, 752, 812, 899, 959, 1048; scenario cursor 1072 |
| M2 | The trail is a deduped transition list, not the observed sequence. 1057 testimonies compress to 44 token steps; branch/fallback detail is invisible. | `testimonyTrail` (`lib/live-trace.ts:160-162`); `seenRef` skip in `circuit-viewer.tsx:130-138` |
| M3 | The trail starts at the scenario root and jumps between spokes. The first expression cell maps to the scenario node; the drawn view is a hub with 14 exchange spokes, not the 35-operation chain. | 44-step trail head in `replay.json`; 831-member scenario node |
| M4 | Collapse erases the branch vocabulary. 28 observed junctions (fork), 28 selection edges (branch), 14 provider legs (socket + tabbed-tile), the 109 observed evidence/validation/decision/termination/rejection leaves and 892 internal routes never draw. | §4.2-4.5; `buildRunGraphView` (`lib/run-graph.ts:163-310`) |
| M5 | Junction dots are layout geometry, not observed junctions. The 28 observed junction cells and their selection edges produce no drawn edge and no evidence-driven dot. | `geometry.js` split/join channels; drawn edges are 28 sequence routes |
| M6 | The graph fetch can race the run. `graph.captured` was 2.20 s / 2.93 s after admission while the client's retry budget is 12 × 250 ms; if it expires the view silently has no graph and no cell can light. | `live-run.tsx:45-48, 85-98`; §2.4 |
| M7 | A terminal page can still carry events. The capture walk that mirrors the lab adapter stopped at cursor 974 of 1079; the run's last provider leg, scenario testimony and `run.exited` were in the tail. The capability page client drains; the adapter does not. | §3 R9; `live-run.tsx:165`; `lib/sda-api.ts:181-189` |
| M8 | Layout bands vs serial truth. All 14 exchange nodes resolve material `event` (band 1), so the working-tree single-row layout draws them side by side; the trace is a serial 35-operation descent with fallback alternates. | `geometry.js` `MATERIAL_BAND` / single lane row; §3 R1-R5 |
| M9 | Provider evidence is state, not just evidence. `provider-exchange-shape.v1` records restate the failed variants; the renderer ignores the records but keeps the failure via the provider cell display status. The lane carries both, so a display rule must decide which one state sees. | 7 records at the cursors in §3 R8 |
| M10 | Edge materials never exercise the vocabulary. All drawn edges are `sequence → event`; `branch` selection edges and `outcome` returns are only visible uncollapsed. The edge legend's execution/product/support distinction is untested. | §4.4-4.5 |

### 5.3 Invariants the layout lane can rely on

1. Cursor order is the only true order: cell, then its outgoing edge, then the next cell. The
   token may follow only testimony, and the raw sequence is strictly alternating.
2. Composites close after their members (post-order); an edge into a composite is realized by the
   composite's first child.
3. A provider exchange always reads provider → physical → parent (socket, tabbed-tile, composite).
4. Branching is junction cell → one selection edge (variant from the graph) → destination;
   in this estate the walk used only `FALSE`; `TRUE`/recurrence routes are declared but unwalked.
5. Loop-backs are real: 36/36 return edges were walked, all as the operation→scenario or
   expression→operation close-out; the scenario testimony is last.
6. Bind by raw `cellId`/`edgeId` through membership; no observed id was left unbound, including
   the 892 internal routes (they bind to their enclosing node).
7. A run is drained only when `hasMore=false`.

---

## 6. Gaps the baseline leaves for the layout lane

- **G1 - collapse granularity.** `DETAIL_CELL_LIMIT = 30` keeps 15 nodes but produces one
  831-member root; promotion crosses operation boundaries. The presentation rule (what may
  collapse into what) is not declared; the drawn view currently hides the entire branch story.
- **G2 - fallback state.** There is no observed-renderer state for "attempt failed, route
  continued". Either a node state must be derived from the route that survives (outcome-based), or
  the display of a failed attempt must not taint the enclosing composite/root.
- **G3 - repeated vocabulary plate.** 35 composite cells and 346 construction leaves share generic
  plates; a per-operation material vocabulary (declared, not word-stem) is the missing authority.
  The false positives in §4.2 show the word table cannot be the long-term home.
- **G4 - branch rails.** If the drawn view is the collapsed one, branch edges are internal and
  never need rails; if the lane deepens the view (or the collapse limit grows), selection edges,
  junction forks and fan-out/joins become live and need the declared presentation data.
- **G5 - edge family coverage.** No `PRODUCT_TRANSFER` / `SUPPORT` route has ever been observed;
  their materials and dash behavior rest on the table alone.
- **G6 - graph timing.** The graph fetch window is tight for equity (2.93 s vs ~3 s). Either the
  retry budget or the graph transport should change; a missing graph currently produces a silent
  unlit view.
- **G7 - evidence records on the lane.** Seven key-preserved evidence records rode the lane; the
  binding ignores them by design. Their dispositions duplicate provider-cell state; a display
  policy (show as receipts, not states) should be declared.
- **G8 - drain assertion.** Tests and tools that stop at `terminal=true` can truncate a run; the
  drain rule (`hasMore=false`) should be asserted wherever the lane is consumed.

---

## 7. Provenance and hygiene

- Live captures taken 2026-09-23 on `127.0.0.1` (local SDA API), token from
  `sfx-platform/.env.local`, never written to disk or to this document.
- Capture scripts read credentials from the environment; captured JSON contains no token, no
  `authorization` header, no bearer value (verified by scan of the capture directory).
- `sfx-platform` measured at HEAD `e435dc5` plus the uncommitted layout working tree
  (`components/circuit/{geometry.js,layout.ts,circuit-viewer.tsx,scl-theme.ts}`,
  `lib/{run-graph.ts,live-trace.ts}`, `app/globals.css`, tests). The mapping and replay reflect
  that working tree, not HEAD; the raw captures are independent of it.
- No file under `components/`, `lib/`, `app/` or `contracts/` was changed by this study.
