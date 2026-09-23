# Review — observation altitudes and the circuit layout / flow alignment plan (2026-09-23)

**Subjects:**
- the governing decision `docs/observation-altitudes.md` ("obs", untracked, "Status: Accepted");
- the circuit layout / flow alignment plan `docs/circuit-layout-flow-alignment-plan-2026-09-23.md` ("the plan", commit `7ac170c`).

**Basis:** the circuit mapping trace, `docs/circuit-mapping-trace-2026-09-23/` ("the trace"). For every one of the equity run's 1,079 events and the hello-world control's 26, it records:
- which declared element the event belongs to;
- which material the platform gives it and what decided that material;
- which drawn element it lights, and in what order.

The trace uses the platform's own `buildRunGraphView` and material tables, so it measures the code as it is.

**Also checked against:**
- the code at `HEAD` `7ac170c` and the uncommitted working tree;
- the capability's declared graph source (`analysis.capability_graph_source`, read-only);
- the SDA kernel's circuit record (`execution-graph-captured.v1`) and its schema;
- the estate's circuit reads (`read-capability-circuit`, `read-circuit-presentation`);
- a second equity run observed through the `sfx` launcher and the demo observer, whose root was rejected.

**Implementation plan:** `docs/observation-altitudes-implementation-plan-2026-09-23.md` turns these findings into phases, with the change surface in each layer.

## Verdict

The plan lays out a drawing whose meaning the data doesn't carry.

The circuit record carries only five altitude/kind pairs and leaves out every declared fact that says what a cell *is*. Those missing facts are:
- the operation's port binding;
- its transformation;
- the scenario's Input, Event and Outcome.

So the platform guesses. Every mechanic material except `branch` comes from word stems in names or from a member-altitude rule.

The collapsed view then hides the orchestration: the default view hides 21 of the 35 operations and all 7 route decisions. The display rules also show a failed root outcome as done.

Layout (the plan's P1–P6) is the last step, not the first. It has to wait until:
1. the declared semantics reach the drawing;
2. materials are declared;
3. states are truthful.

## What the data says (from the trace)

- **The capability is 7 provider routes × 5 declared steps = 35 operations.** The routes are equity, fallback, finance15, finance15bodyproof, gemini, gemini-live and gemini-live-2. The steps, in order, and their declared port bindings:
  1. build the binding request: `sda-authority-transformation-port.v1`
  2. bind the provider credential: `sda-external-credential-reference-binding-port.v1`
  3. build the exchange request: `sda-authority-transformation-port.v1`
  4. observe the exchange: `sda-governed-http-exchange-port.v1`
  5. normalize (route 1) or select the route (routes 2–7): `sda-authority-transformation-port.v1`
- **The orchestration is strictly serial.** Operations run op.1 → op.35 with 0 interleaved. Each operation's own testimony follows its members. A port leg runs provider → physical → return → operation.
- **Cells and edges strictly alternate:** 529 cell testimonies, 528 edge testimonies, 0 unbound.
- **What happened on each route:**
  - Routes 1–2: the credential was BOUND, the exchange was `retained-non-success`, and the route result was `PROVIDER_UNAVAILABLE`.
  - Route 3 **resolved**.
  - Routes 4–7: the credential was `CREDENTIAL_NOT_AVAILABLE`, the exchange was `rejected-endpoint`, and each route carried RESOLVED forward.
  - The root (cursor 1072) is `completed / EQUITY_MARKET_PRICE_EVIDENCE_RESOLVED / success`.
  - The chain has no short-circuit: routes 4–7 run after route 3 has resolved.
- **The default view draws 15 nodes:** 14 `provider-port` sockets and 1 `outcome` root.
  - 500 of 528 walked edges are internal to a node; 28 are drawn.
  - The lit node changes 29 times across 529 cell testimonies.

## Findings, most serious first

### 1. Materials are guessed from names, not taken from declared data

The trace records what decided each material (§4):

| Material | Decided by | Cells |
| --- | --- | ---: |
| input | word stem `request` in the operation name | 329 |
| input | composite member-altitude rule | 14 |
| evidence | word stem `evidence` | 66 |
| decision | word stem `select` | 43 |
| decision | composite member-altitude rule | 6 |
| branch | junction route kinds | 28 |
| provider-port | `provider\|provider` | 14 |
| provider-port | composite member-altitude rule | 14 |
| provider | `physical\|physical` | 14 |
| outcome | `scenario\|scenario` | 1 |

- **13 of the 17 `CELL_MATERIAL` keys can never match.** The compiler emits no `mechanic|<token>` kinds (`scl-theme.ts:181`).
- **The drawing is wrong wherever the names mislead.**
  - `input` goes to the outbound request builders, not to the capability's Input.
  - Hello-world's five mechanics all fall to the generic `event` plate.
- **`EDGE_MATERIAL` (`scl-theme.ts:233`) is substring matching on edge kinds** (`'return'` → outcome, `'sequence'` → event). A declared kind should map by exact key.
- **P1's acceptance freezes the guess.** It requires "input 14, provider-port 14, decision 6, evidence 1". All four come from the word stems or the composite rule.

**Fix:**
- Materials come from declared identity (implementation plan, phases 1–2).
- Anything unmapped shows `UNRESOLVED`.
- P1 accepts on shape only.

### 2. The capability's Input and Event are never drawn, and different mechanics look identical

- **The declared boundary is absent from the drawing.** The Input `live-equity-price-request` (`live-equity-price-request.v1`) and the Event `equity-market-price-evidence-requested` are not drawn anywhere. The circuit record carries contracts only as port `contractId`s, with no Input/Event/Outcome roles.
- **Two different mechanics get the same material.** The credential binding (`sda-external-credential-reference-binding-port.v1`) and the governed HTTP exchange (`sda-governed-http-exchange-port.v1`) both draw as `provider-port`.
- **The distinction isn't in the record at all.** `PublicProjection` (`SemanticExecutionGraphScheduler.cs:1765`) copies `cellId`, `altitude`, `execution.kind`, `parentCellId`, `semanticAddress` and the port `portId`/`contractId`s. It drops `execution.configuration.binding`, so `platformCapabilityId` and `transformationId` never reach the platform.
- **The schema excludes it on purpose.** `execution-graph-captured.v1` says: "no execution configuration, no provider bindings". Carrying the binding identity is therefore a schema decision, not an oversight to patch.
- **This contradicts obs OA5,** which says: "Show: Input contract, event, …, outcome contract, variants".

**Fix:** supply the declared semantics to the drawing (implementation plan D2 and phase 1).

### 3. The orchestration is invisible, and the grouping is platform code

- **The collapse hides the orchestration.** It is a count cut (`DETAIL_CELL_LIMIT = 30`, `run-graph.ts:25`). It hides all 21 transformation operations, the 7 select decisions and route 3's success inside the root.
- **P1's grain is right:** one node per operation, 36 nodes. That matches the orchestration the trace measured.
- **P0's interim rule keeps the grouping decision in platform code:** "projection = declared parent/containment membership".
- **The estate already declares this grain for testimony.** `read-capability-circuit` states the nearest-enclosing-operation rule: "Every expression, binding, field and selection cell collapses into its enclosing operation".
- **The presentation policy has no granularity rule yet.** `read-circuit-presentation` declares only the count (`granularity.detailCellLimit: 30`), and the platform mirrors that number instead of reading it (`run-graph.ts:24`).

**Fix:**
- Declare the grain in the presentation policy and have the platform read it (implementation plan phase 3).
- Until that ships, record P0's interim rule next to the existing KNOWN DEFECT note in `run-graph.ts`, with the trigger "declared granularity ships".

### 4. The state rules can show a failed outcome as done

L9, P2, P5 and acceptance items 4 and 6 require that `held` never taints its parent and that "the scenario closes last from `run.exited` exit 0".

**In the plan's capture, "done" happens to be right.** Cursor 1072 testifies `EQUITY_MARKET_PRICE_EVIDENCE_RESOLVED / success`.

**The rules can't tell success from rejection.** In the second equity run, the root testified `NATIVE_MARKET_PRICE_TESTIMONY_REJECTED / failure`, and the process exited 0. A replay through the committed `lib/live-trace.ts` showed:
- The root `done`, with or without `run.exited`. `cellState` (`live-trace.ts:112`) turns `failure` into `held`, and then two paths turn the root `done`:
  - `aggregateNode` lets a completed member supersede a held one (`live-trace.ts:163`).
  - `applyLifecycle` sets every non-failed scenario node to `done` on exit 0 (`live-trace.ts:244`).
- All 15 failure-classified cells `held`.
- The drawn view at 11 done, 4 held, 0 failed.

**The orchestration contradicts `held`'s justification.**
- Baseline §8.1 justifies `held` as "a declared non-success attempt superseded by a later route (429 → fallback)". That fits routes 1–2, which a later route (route 3) did supersede.
- It doesn't fit routes 4–7. Their `CREDENTIAL_NOT_AVAILABLE` and `rejected-endpoint` happen *after* route 3 resolved, and no later route supersedes them.
- It doesn't fit the scenario root either, which has no later route at all.
- The code applies `held` to every failure-classified cell anyway and never checks that a superseding route exists.

**The governing doc contradicts itself.**
- It adopts both rules by reference. obs §7 (line 348) retains baseline §8 ("State semantics — decision", `c867b24`). That section says "Root/scenario completion is a lifecycle fact: `run.exited` with `exitCode 0` completes the scenario node … whether or not the scenario's own testimony arrived".
- Its own rules say otherwise:
  - obs §5 (line 290): "Completion, admission, conformance, binding, availability and proof are separate". A zero exit is completion, not the outcome.
  - obs OA5 says to "preserve the distinction between a semantic outcome and the testimony of one particular invocation".
  - obs OA6 says to "separate composite entry, child execution and composite completion".
- Resolving the conflict is the owner's decision (implementation plan D1). The plan should not settle it through acceptance criteria.

**Fix (recommended for D1):**
- The root shows its own testified outcome: variant and classification.
- `run.exited` sets the run's status only.
- An attempt is shown as a failed attempt with its variant. It is marked superseded only where a later route in the declared order actually resolved.
- A completed sibling never overrides a member's failure.

### 5. Outcome variants never reach the drawing

- **The per-route results exist in testimony but not in the drawing.** The failed exchanges, the carried RESOLVED and the root's variant are all testified, but no drawn element shows a variant.
- **Junction arms are merged regardless of variant.** The declared `selectsVariant` is in the record, but the drawn-edge key is `from|to|kind` (M7, committed at `HEAD` `run-graph.ts:305`).
- **The plan never shows the root's outcome variant.**

**Fix:** implementation plan phase 5.

### 6. P6 solves the graph race with timing

- **The fetch runs on a timer:** 12 attempts, 250 ms apart (`live-run.tsx:45-46`).
- **The plan's option to "raise/adaptive budget" keeps the timer.**
- **Fix:** fetch when the `graph.captured` marker arrives on the lane. Alternatively, use the compiled graph the page already has, once the marker's `canonicalGraphDigest` matches it.
- **The plan is right about the failure case:** a missing graph must be a visible error.

### 7. The drain defect (M10) is live on the lab command path

**Correction:** an earlier version of this review called this defect latent with no callers. That was wrong. The call chain is:
- `app/lab/commands/route.ts:28` calls `invokeCapabilityToView` (`lib/sda-api.ts:201`);
- `invokeCapabilityToView` calls `runCapabilityToCompletion` (`lib/sda-api.ts:168`, `HEAD`).

**The defect:**
- The loop returns as soon as a page says `terminal`.
- The host sets `terminal` from the run record alone (`services/sda-api/src/server.ts:190`), whatever `hasMore` says.
- A page holds 100 events by default (`server.ts:11`).

**The effect:** if the run has finished by the time a page is read, the loop stops after that page. `observationCount` then undercounts. On a run that finished before the first poll (for example the equity run's 1,079 events), it would report at most 100.
- The outcome itself is read separately (`readRunOutput`), so it is unaffected.
- This is from reading the code; it has not been reproduced.

**Fix:** drain until `hasMore` is false, then read the output. The live UI (`live-run.tsx`) already drains.

### 8. Some citations point at uncommitted code

- **M2 (material bands deciding order) exists only in the working tree.** `MATERIAL_BAND` (`geometry.js:81`) isn't at `HEAD`. `HEAD` ranks by a floor keyed to the altitude primitive (`BAND`), which keeps all operations in one band.
  - The fix for M2 is not to commit that part of the work in progress; it doesn't need a phase.
  - Under finding 1, a material band would order the drawing by a guess.
- **M7 is committed.** The `from|to|kind` key is at `HEAD` `run-graph.ts:305`; the plan's line number (309) comes from the working tree.
- **Fix:** pin every citation to a commit.

### 9. The authority files aren't committed

`docs/observation-altitudes.md` ("Status: Accepted") and `docs/observation-altitudes-intent.md` are untracked. Commit them, or have the plan state their status.

### 10. The compiled graph depends on the `--plan-only` flag

- Acceptance item 8 ("compiled (no-run) and observed modes remain the same drawing") relies on `GET /v1/capabilities/{id}/graph`.
- That endpoint uses the kernel's `--plan-only` flag (SDA `da80de3`), which is C#-only; the Node and Python kernels have no counterpart.
- Earlier the same day, the owner rejected this approach as bespoke in favour of a declared compile-only capability.
- Keeping it, or replacing it, is the owner's decision (implementation plan D4).

### 11. Vocabulary

- **The documents use "projection" for choosing what to show:** "observation projection", "projection rule", "OA3–OA8 circuit projection".
- **The owner's meaning is different:** projection means generating code bodies from declared meaning, building them and executing them.
- **Renaming it in the governing doc is the owner's call** (implementation plan D5).
- **This review says "view", "grain" and "grouping" instead.**

## Minor

P1's serial column measures 720 × 4,492 px (M12). The trace shows why: 35 operations in strict order. For watching a run live, P1's acceptance should say how the view keeps the active operation in sight. obs allows focused subgraphs for exactly this.

## Corrections to earlier versions of this review

- **Finding 7 (drain):** the earlier version said the function had no callers. It does (see finding 7).
- **Rebase:** findings 1–5 were rebased on the mapping trace, and findings 2, 3 and 5 are new. The earlier material finding (now finding 1) and the interim-rule finding (now in finding 3) were strengthened with the trace's driver counts and the estate's declared granularity.
