# Circuit layout / flow alignment plan — 2026-09-23

**Status:** Analysis and implementation plan. Read-only study: no application, layout, theme or
geometry file was changed. The only repository change is this document.
**Scope:** Align the circuit renderer with the observed equity flow and the observation-altitude
intent — operation order, branch rails, merges, loop-backs, containers and connectors.
**Authority:** The captures are the evidence. Raw captures live in `%TEMP%\opencode\baseline`
(machine-local, not committed); this lane's scripts and derived captures live in
`%TEMP%\opencode\align` (`aggregate.mjs`, `align-facts.json`, `layout-run.mts`, `layout-dump.json`,
`p1-shape.mts`, `p1-shape-stdout.txt`, `aggregate-stdout.txt`, `layout-stdout.txt`). Reproduce with
`node %TEMP%\opencode\align\aggregate.mjs`, and
`node --import tsx %TEMP%\opencode\align\layout-run.mts` / `p1-shape.mts` from the `sfx-platform`
working tree. Corrected state/material proof artifacts are in `%TEMP%\opencode\correct`
(`corrected-replay.json`, `corrected-summary.json`).
**Inputs read in full:** `docs/circuit-event-material-baseline-2026-09-23.md` (§1–§8),
`docs/observation-altitudes-intent.md`, `docs/observation-altitudes.md` (the governing decision),
`flow-equity.jsonl` (1,057 rows), `events-equity.jsonl` (1,079 rows), `flow-hello.jsonl` (11),
`events-hello.jsonl` (26), plus the working-tree renderer (`components/circuit/*`,
`lib/run-graph.ts`, `lib/live-trace.ts`, `components/estate/{live-run,capability-circuit-panel}.tsx`,
`lib/sda-api.ts`).

The question this plan answers: **the equity trace is a declared serial 35-operation circuit with
provider legs, selection forks and close-out returns; the current drawing is a 15-node hub with 14
side-by-side spokes and decorative rails. What, exactly, must change for the drawing to be the
data's shape?**

---

## 1. Intent rules

Quoted verbatim where they constrain layout order, direction, branching or grouping. `intent` =
`docs/observation-altitudes-intent.md`; `obs` = `docs/observation-altitudes.md`; `spec` =
`docs/website-design-spec.md` §12.

### 1.1 The five execution-cell altitudes and the event context (what each is supposed to express)

| Context (material token) | Shape | What it must express visually | Source |
| --- | --- | --- | --- |
| `input` | rounded rectangle | The capability/operation input boundary; a contract enters here | `scl-theme.ts:154`; `spec:856` |
| `event` | beveled rectangle | The event / execution step and the sequence conduit; the default execution plate | `scl-theme.ts:155,244` |
| `outcome` | capsule | The declared outcome and the return/close conduit; the scenario closes here | `scl-theme.ts:156,242` |
| `provider-port` | socket | The declared responsibility boundary a provider leg binds; a port is not its fulfiller | `scl-theme.ts:157,266`; `obs:180-182` |
| `provider` | tabbed tile | The realized fulfiller (bound provider) — a distinct record from the port | `scl-theme.ts:158,267`; `token provider` in `intent:210-226` |
| `authority` | top-band frame | Policy/authority over the step; a governance scope, not execution order | `scl-theme.ts:162,257` |
| `branch` | fork | A declared single-choice junction; each arm keeps its variant identity | `scl-theme.ts:163,209`; `spec:857` |
| `fan-out` | radial hub | ALL-branch dispatch to declared arms (none exists in this capture) | `scl-theme.ts:164,262`; `spec:857` |
| `convergence` | merge | A declared join with all/any/quorum policy (none exists in this capture) | `scl-theme.ts:165,263` |
| `decision` | diamond | Comparison/selection at a mechanic; a decision is not a generic branch glyph | `scl-theme.ts:166,260`; `spec:864` |
| `validation` | shield-check | Conformance/verification semantics | `scl-theme.ts:159` |
| `evidence` | document stack | Evidence/receipt/proof semantics; support links land on evidence | `scl-theme.ts:160,259` |
| `human-approval` | person in gate | Approval scope | `scl-theme.ts:161` |
| `termination` | solid end-cap | A terminal has no outgoing execution or product-transfer route | `scl-theme.ts:167`; `spec:860` |
| `rejection` | barred octagon | Hold/rejection disposition — not a failure of the enclosing operation | `scl-theme.ts:168` |
| connector | route family + route kind | Execution/product/support family; kind refines it (sequence→event, selection→branch, recurrence→branch, return→outcome, join→convergence, broadcast→fan-out) | `scl-theme.ts:94-110,233-245` |

Observed on this capture (529 cells): mechanic `input` 343, `decision` 49, `evidence` 66,
`branch` 28, `provider-port` 28, `provider` 14, `outcome` 1. Declared but unobserved vocabulary:
`fan-out`, `convergence`, `authority`, `validation`, `human-approval`, `termination`,
`rejection` (`%TEMP%\opencode\correct\corrected-summary.json`).

### 1.2 Altitude diagrams (verbatim, layout-constraining)

OA5 — Scenario Cell (`intent:134-140`):

```text
        GIVEN / INPUT
              │
              ▼
        WHEN / EVENT
              │
              ▼
        THEN / OUTCOME
```

OA6 — Event / Execution Authority (`intent:156-167`):

```text
             EVENT
               │
               ▼
       Execution Authority
               │
       ┌───────┼────────┐
       ▼       ▼        ▼
     Op A    Op B     Op C
       │       │        │
       └───────┼────────┘
               ▼
             Result
```

OA7 — Mechanic Circuit (`intent:185-194`):

```text
        Responsibility
              │
              ▼
          Mechanic A
          /        \
         ▼          ▼
   Mechanic B    Mechanic C
         \          /
          ▼        ▼
             Result
```

OA8 — Provider / Physical Realization (`intent:213-226`):

```text
         Mechanic
            │
            ▼
       Provider Slot
            │
            ▼
       Bound Provider
            │
            ▼
   HTTP / SQL / model / filesystem /
   process / queue / GPU / human / etc.
            │
            ▼
       Physical Effect
```

OA3/OA4 add the same laws one level up (`intent:81-126`): capability → scenarios → root outcome;
scenario chain with a declared split (`Scenario A → B → {C, D}`).

`intent:233-273` freezes the direction: organization/integration at the top, **meaning and flow**
at OA3–OA5, and **realization** at the bottom (`Event → Execution → Mechanics → Providers →
Physics`). The walkthrough (`intent:279-404`) shows the depth-first path: capability → scenario
Input/Event/Outcome → execution authority list → mechanics list → provider → physical chain "Same
capability … You have just changed observation altitude."

### 1.3 Geometry laws (verbatim)

- `obs:218-220` — "Within one altitude, large graphs may use focused subgraphs, paging or explicit
  expansion. Those operations retain that altitude and report coverage. A `30`-cell drawing limit
  is not an altitude policy and cannot erase execution boundaries or claim that a partial view is
  complete."
- `obs:224-231` — "The observation projection must be resolved before geometry is assigned:
  selected authority + subject + observation altitude + retained context -> typed observation
  projection with source membership and boundary references -> deterministic layout and canonical
  material mapping -> selected evidence/property overlays."
- `obs:232-247` — "**Meaning and flow (OA3–OA5):** Preserve capability/scenario boundaries,
  contracts, branches, variants, products and routes. Preserve Input/Event/Outcome at the
  applicable boundary. … **Realization (OA6–OA8):** Show operation order, containment/descent,
  mechanic dependencies, selection, ports, provider bindings and physical effects according to
  their declared types. Geometry may change between levels, but its represented identities and
  relationships must remain traceable. **Materials follow component meaning; they do not determine
  causal order or altitude. Do not force a sequential operation chain into parallel lanes because
  the cells use the same plate.** A drawn split/merge rail is routing geometry unless it represents
  an actual declared junction; its decorative dots are not additional execution cells."
- `obs:249-253` — "A projected connection across hidden detail must carry its exact source
  route/path membership, boundary/port identities and projection rule. Preserve selection
  variants, guards, group/join policies, recurrence and return meaning. Routes with the same
  visible endpoints and kind but different variants or policies must not merge into an
  indistinguishable connector."
- `obs:298-299` — "Project each occurrence by its cell/edge identity and execution/occurrence
  identity, in cursor order. Repeated visits are retained even if their visible state is unchanged.
  Selected branch identity comes from the observed edge plus its graph declaration, not a guessed
  branch from a cell label."
- `obs:195-205` — "Keep the focus subject and its source selection explicit. Render relevant
  enclosing context as a frame, boundary or breadcrumb, distinguishable from the focused contents.
  … A parent frame is context. Child testimony does not become the parent's own testimony."
- `obs:294-295` — "Drain paginated lanes through `hasMore=false` even when a preceding page reports
  terminal; absence of the final page must not imply completion."
- `spec:856-861` — "Keep Input/Event/Outcome and responsibility/experience visible across supported
  altitudes. In 0.2, altitude and visual plane are independent… Distinguish single-choice
  branch/decision, all-branch fan-out, and convergence with explicit all/any/quorum policy. Match
  actual arm counts, endpoints and route identities. Product transfer requires matching
  outcome/input contract identities. Provider binding, authority, dependency and evidence links
  retain their types and cannot be inferred as execution flow. … A terminal has no outgoing
  execution or product-transfer route. … Use the compiler's shared port/junction geometry for both
  glyphs and routes."

---

## 2. Data facts (aggregated, not eyeballed)

All counts from `%TEMP%\opencode\align\aggregate.mjs` → `align-facts.json` and the real pipeline
run `layout-run.mts` → `layout-dump.json`. Hello run kept as the control.

### 2.1 Event inventory

| kind | hello | equity |
| --- | ---: | ---: |
| `run.admitted` / `run.started` | 1 / 1 | 1 / 1 |
| `delivery-phase` | 11 | 11 |
| `graph.captured` | 1 | 1 |
| `observation` (cell / edge) | 11 (6 / 5) | 1057 (529 / 528) |
| `provider-exchange-shape.v1` | 0 | 7 |
| `run.exited` (exit 0) | 1 | 1 |
| **total** | **26** | **1079** |

Equity cell testimonies by altitude: `mechanic` 500, `provider` 14, `physical` 14, `scenario` 1.
Walked edge testimonies: `sequence` 464, `return` 36, `selection` 28; every edge `admitted`.

### 2.2 Graph census (compile-only graph = run skeleton, 873 cells / 920 edges)

| dimension | count | detail |
| --- | ---: | --- |
| `mechanic\|mechanic` cells | 803 | 35 operation composites + 768 expression leaves |
| `mechanic\|junction` cells | 41 | all `in:sequence, out:selection` |
| `provider\|provider` cells | 14 | each encloses 1 `physical` child (provider is a container) |
| `physical\|physical` cells | 14 | children of the provider cells |
| `scenario\|scenario` cell | 1 | root; direct parent of all 35 operations |
| composites / leaves | 50 / 823 | scenario 1 + operations 35 + providers 14 |
| edges | 920 | `sequence` 795, `selection` 82 (41 `TRUE` / 41 `FALSE`), `return` 36, `recurrence` 7 (`CONTINUE`) |

Operation model: all 35 operations are direct children of the scenario; **34 `sequence` edges chain
`operation.N → operation.N+1`** (1→2 … 34→35); `operation.1` has no incoming edge (the chain
entry); 35 `return` edges close into operations (21 expression→operation, 14 physical→operation)
and 1 `return` closes `operation.35 → scenario`. 14 operations own a provider leg (2, 4, 7, 9, 12,
14, 17, 19, 22, 24, 27, 29, 32, 34); 21 own an expression body. Declared materials for the 35
composites (corrected lane): input 14, provider-port 14, decision 6, evidence 1.

### 2.3 Ordering invariants

| invariant | measured | deviations |
| --- | --- | --- |
| Strict alternation `cell → edge → cell …`, starts/ends cell | equity 528/528 and 528/528; hello 5/5 | none |
| An edge's testimony immediately follows its source cell (`sourceCellExecutionId`) | 528/528 | none |
| An edge's destination is the next observed cell | 494/528 | 34 inter-operation edges |
| Inter-operation edge: destination is composite; next testimony is **inside** its body | 34/34 | next is the destination's only child (provider) 14×; an expression child 20×; array-first child only 14/34 (the baseline's "first child" is the first *executed* child, not graph array order) |
| Provider leg: provider → sequence → physical → return → operation composite | 14/14 exact | none |
| Operation composite testimony is post-order (closes after all members) | 35/35; scenario closes last at cursor 1072 (return 1071, after op.35) | none |
| Provider enclosure order | provider (e.g. cursor 25) precedes its physical child (cursor 27) | 14/14 pre-order — containment is *descent*, not close-order |
| Return edges walked | 36/36, all close into an ancestor | none unwalked, none unknown |
| Operation chain order | 34/34 `op.N → op.N+1`; `op.1` is the head; `op.35 → scenario` is the final close | none |

Worked shape (provider example, cursors 78–84): `sequence edge into operation.4 → provider cell(80)
→ sequence edge(81) → physical cell(82) → return edge(83) → operation.4 composite(84)`.

### 2.4 Branching, junctions and loops

| fact | count | evidence |
| --- | ---: | --- |
| Junction cells (`mechanic\|junction`) | 41 | all `in:[sequence]`, `out:[selection]` |
| Reached / never reached | 28 / 13 | junction cell testimony; 28/28 immediately followed by their selection edge |
| Walked selection edges | 28, all `selectsVariant="FALSE"` | edge testimony + graph (e.g. cursor 95 `operation.5…bodyText:selection:false`) |
| Declared but unwalked selection edges | 41 `TRUE` | e.g. `operation.10:expression.value:selection:true → …payload.value.value` |
| Declared but unwalked recurrence edges | 7 `CONTINUE` (self-loops) | `operation.10…absent:recur` |
| Fan-out / join / broadcast / convergence junctions | 0 | none exist in either graph |
| Walked returns | 36/36 | 21 expression→operation, 14 physical→operation, 1 operation→scenario |

Selected-branch truth is the `edgeId` that testifies plus its graph `selectsVariant`
(`obs:288`); the lane never names a taken edge (`selectedEdgeIds` absent; `hasSelectedEdgeIds`
false on all 1,079 events).

### 2.5 The baseline collapse (current view) — measured

`buildRunGraphView` at `DETAIL_CELL_LIMIT = 30` promotes one containment level per pass:
**873 → 50 → 15**. The survivor set is an artifact, not a declaration: scenario (831 members) plus
the **14 operations that directly parent a provider cell** (3 members each: operation + provider +
physical). The 21 expression-bearing operations vanish into the root.

| drawn view | value |
| --- | ---: |
| nodes / edges | 15 / 28 (14 × scenario→op, 14 × op→scenario, all `sequence`) |
| scenario member count | 831 |
| internal routes (bound, not drawn) | 892 = 767 sequence + 82 selection + 7 recurrence + 36 return |
| internal routes by node | scenario 864; each provider operation 2 |
| layout geometry (real pipeline) | ranks `{0,3}`; 14 operations in one row at y=98, x=48…3142; scenario frame 3342×177 at (30,20); canvas 3402×425 |
| back edges (loop-backs) / decorative dots | 14 / 29 |
| replay trail | 43 steps; step 1 is the scenario root (nearest drawn ancestor of the first expression cell) |

### 2.6 Tail and drain

The first terminal page (`pages[30]`) reports `terminal=true`, `state=completed`, **but
`hasMore=true`, `nextCursor=974`, `latestCursor=1079`**. Events after cursor 974: **105** —
`operation.34` provider leg (1047–1052), `operation.35` expression (1053–1070), the
`operation.35 → scenario` return (1071), scenario testimony (1072), 6 `delivery-phase` (1073–1078)
and `run.exited` (1079). The platform client drains (`live-run.tsx:163-165`); the lab adapter
returns at `terminal` without checking `hasMore` (`lib/sda-api.ts:181-189`), losing the
close-out and the root's completion fact.

### 2.7 Corrected states (supersedes baseline §5.1)

Corrected lane (`%TEMP%\opencode\correct\corrected-summary.json`): equity drawn **5 done / 10 held
/ 0 failed**; raw 529 cells **497 done / 32 held**; 43 transitions / 43 trail steps; 0 unmatched.
Hello: 6 done nodes, 5 done edges, 11 transitions. Replaying the **normalized JSONL** under the
same corrected rules reproduces 43 transitions but only 523 done / 6 held, because the normalized
lane drops `outcomeClassification` (present in the raw payload: `success`/`failure`). The durable
fixture must carry the raw classification fields (`obs:349-355`).

---

## 3. Derived layout rules (deterministic)

Each rule states its data authority (what must be declared) and its layout consequence (what the
geometry may compute). R-rules are ordered by dependency.

**L1 — Rank by declared order; altitude/context is the floor, material is only a plate.**
Data: projection membership + declared operation routes (`sequence` 34, `return` 1) + containment.
Layout: `rank(node) = max(floor(declared context), max(rank(predecessor)+1))` over forward declared
routes; a declared `sequence`/entry route is forward **regardless of material band**; a `return`
that closes a composite after its members is forward (post-order); only an upward close or a
`recurrence` is a loop-back. Evidence: 34/34 chain edges descend in cursor order; 35/35 operations
close post-order; `obs:244-247` forbids materials from determining order. **Counter-evidence for
the current code:** ranking the declared operation view through `MATERIAL_BAND` produces 20 back
edges and 19 non-descending chain edges (four rows: 14/6/14/1); the same view ranked by declared
order produces exactly 1 back edge, 35 edges, one serial column (measured, §5 P1).

**L2 — Serial chain = one lane column; parallel siblings = one shared rank row.**
Data: consecutive `sequence` edges are serial. Layout: siblings of one rank share y (the working
tree's rule, `tests/layout.test.mjs:156-192`) and the drawing widens; the serial chain stacks
ranks. Never wrap a rank into sub-rows (HEAD's `MAX_LANES=6` chunking is the rejected behavior);
never place serial dependents side by side.

**L3 — Branch rails exist only at declared junctions.**
Data: junction cell (`kind=junction`) with declared `in`/`out` route kinds; the taken arm is the
observed `edgeId` + graph `selectsVariant`. Layout: a fork glyph at the junction, one rail tapping
the declared arms; the walked arm carries state, unwalked declared arms are drawn as declared
alternatives (ghost/dashed) and never lit. Evidence: 41 junctions, all `in:sequence/out:selection`;
28 observed, 28 immediately followed by their selection edge; 28/28 walked `FALSE`; 41 `TRUE` + 7
recurrence declared/unwalked; 13 junctions never reached. No drawn dot may imply a junction the
data does not declare (`obs:246-247`).

**L4 — Merges exist only at declared joins/close-outs.**
Data: `join`/`broadcast`/`convergence` junctions or declared return close-outs. Layout: converge on
a shared rail at the declared join; a return close merges under the container it closes. Evidence:
0 fan-out/join/broadcast/convergence junctions exist; the only real convergence points are the 35
composite close-outs and the scenario close. Decorative rails add no junctions (`obs:246-247`).

**L5 — Loop-backs are real and routed outside/under the frame.**
Data: `recurrence`, upward `return` (op.35→scenario), and same-band cycles. Layout: outside the
band or under the target frame; a loop into a container merges on the frame bottom. Evidence:
36/36 returns walked; only `op.35 → scenario` points upward at operation depth (the 35 composite
closes descend); 7 recurrence self-loops declared/unwalked.

**L6 — Containment draws frames; close-order tolerates descent.**
Data: `parentCellId` membership per drawn node (`obs:302-310`). Layout: a drawn cell with ≥2 drawn
children is a frame with a header band; a single-child chain stays a chain. Evidence: 35 operation
containers and the scenario frame; provider cells enclose their physical child but testify first
(14/14), so provider containment is a descent inside the operation frame, not a post-order close.

**L7 — Connector identity includes variant and policy.**
Data: route kind + `selectsVariant` + `groupId`, source/target ports, and raw edge membership. Layout:
grouping routes on the same visible endpoint pair requires identical variant/policy; otherwise
separate connectors. Evidence: 41 paired TRUE/FALSE selection edges; the current drawn-edge key
`from|to|kind` (`lib/run-graph.ts:309`) would merge variants if they ever share endpoints.

**L8 — Hidden detail is projected, not dropped.**
Data: explicit projection rule (focus/context/internal), full source membership, coverage counts.
Layout: internal routes bind to their enclosing drawn node and are reported (the 892); no silent
drop (`obs:311-320`). The `30`-cell limit cannot be the projection policy (`obs:218-220`).

**L9 — Evidence binding is cursor order; repeats are retained; decoration carries no state.**
Data: raw `cellId`/`edgeId`, disposition/classification/variant, run lifecycle. Layout: the token
advances only through observed testimony, retaining repeated visits (no seen-set compression of
the observed sequence); states aggregate to drawn nodes; `held` never taints the enclosing
composite; scenario completion comes from `run.exited` exit code; junction dots are geometry,
never state. Evidence: 1,057 testimonies become 43 state transitions / 43 trail steps today, and
the 43 figure is identical in the corrected lane — repeating a node or edge re-advances neither,
so the observed sequence itself (repeats included, `obs:298-299`) is not represented; 28 observed
junctions produce 0 drawn nodes/dots; `run.exited` is the only root-closing fact in the 105-event
tail.

---

## 4. Current renderer mismatches (with `file:line`)

| # | Mismatch | Why it breaks alignment | Evidence |
| --- | --- | --- | --- |
| M1 | **Count collapse is the projection.** `lib/run-graph.ts:25` (`DETAIL_CELL_LIMIT = 30`) and `:165-183` (promote-one-level loop); the surviving 15 nodes are a promotion artifact (873→50→15), not a declared focus. | `obs:218-231` requires a typed projection before geometry; the 21 expression operations and every branch/return route are erased. | §2.5; `aggregate.mjs` pass trace; `layout-dump.json` |
| M2 | **Material band overrides execution order.** `components/circuit/geometry.js:67-97` (`BAND`/`MATERIAL_BAND`), `:171-178` (`bandFor`). A `provider-port` operation gets floor 3; an `input` operation floor 0. | The serial chain renders as parallel rows; ranking the declared 35-op view through `MATERIAL_BAND` gives 20 back edges / 19 non-descending chain edges vs 1 back edge under declared order. Violates `obs:244-247`. | §5 P1 measurement; current view ranks `{0,3}`, 14-op row |
| M3 | **Collapsed hub replaces the chain.** `lib/run-graph.ts:185-195` (`nearestDrawn`) maps 831 cells to the scenario; `:294-331` draws only 28 spoke routes. | Baseline M3/M8: the drawing says "hub with 14 spokes"; the trace says "serial 35-operation descent with provider legs". | §2.5; `layout-dump.json` (28 edges, all sequence) |
| M4 | **Decorative junction dots.** `geometry.js:528-614` creates split/join channels and `junctions`; `circuit-viewer.tsx:350-361` draws them. | 29 dots are drawn while 0 declared joins exist and the 28 observed junctions draw nothing. Violates `obs:246-247`. | current layout 29 dots; §2.4 |
| M5 | **Branch/return vocabulary never drawn.** `lib/run-graph.ts:305-307` internalizes every same-node edge; all 82 selection + 7 recurrence + 36 return routes are internal. | The observed 28 forks, 41 declared arms and 36 close-outs have no glyph; only `sequence → event` edges draw. | §2.5; baseline M4/M5/M10 |
| M6 | **Trail is deduped state-change steps, not the observed sequence.** `lib/live-trace.ts:217-237` (only on state change), `circuit-viewer.tsx:130-138` (`seenRef` skip). | 1,057 testimonies become 43 steps; fallback attempts and repeats are invisible; step 1 is the scenario root. Violates `obs:298-299`. | `layout-dump.json` trail = 43; baseline M2/M3 |
| M7 | **Variant-insensitive edge merge key.** `lib/run-graph.ts:309` keys drawn edges by `from|to|kind` only. | TRUE/FALSE or policy-distinct routes could merge into one connector. Violates `obs:250-253`. | §2.4 (41/41 pairs) |
| M8 | **Drawn labels hide declared semantics.** `lib/run-graph.ts:255-278` labels collapsed nodes `label · N cells`; `geometry.js:155-169` strips shared prefixes. The current view shows `operation.12 · 3 cells`. | The declared mechanic root (`build-…-exchange-request`, `select-…-route`) is the only naming authority; `obs:305-310` requires stable source identity per drawn node. | `layout-dump.json` node labels |
| M9 | **Held state depends on raw-only fields.** `lib/live-trace.ts:112` (`outcomeClassification === 'failure'`), `:98-117`. | The normalized JSONL fixture drops `outcomeClassification`, so a fixture replay misclassifies 26 held cells and 8 held operations as done (523/6 vs corrected 497/32; 13/2 vs 5/10 drawn). `obs:349-355`. | §2.7 |
| M10 | **Tail is lost by the adapter.** `lib/sda-api.ts:181-189` returns at `terminal` without `hasMore`; the client drains (`components/estate/live-run.tsx:163-165`). | 105 events (op.34 leg, op.35, scenario, `run.exited`) never reach non-draining consumers; the root's completion fact is missing. `obs:294-295`; baseline M7/R9. | §2.6 |
| M11 | **Graph fetch race.** `live-run.tsx:44-46` (12 × 250 ms ≈ 3 s) vs measured `graph.captured` at 2.20 s (hello) / 2.93 s (equity). | If the budget expires the view is silently unlit; no projection may be assumed. Baseline M6/G6. | baseline §2.4, §5.2 M6 |
| M12 | **Height/width coupling.** `geometry.js:410-438` one row per rank + `RANK_GAP_Y=62`; the declared 35-op column measures 720×4492. | Not a correctness break, but a readability item once M2/M3 are fixed (viewer scrolls today). `spec:849` readable zoom. | §5 P1 |

---

## 5. Phased plan

Each phase states where the work lives (data vs layout), the smallest change, and acceptance.
`P1` is the smallest increment that produces a correctly-shaped equity diagram.

### P0 — Declared projection authority (precondition; data, no drawing change)

- Replace `buildRunGraphView`'s count collapse with a typed projection rule. Declared home:
  estate `read-capability-circuit` (nearest declared membership) + `read-circuit-presentation`
  (`granularity.detailCellLimit`) per `lib/run-graph.ts:12-17`. Until that endpoint ships, a
  deterministic interim rule that the plan freezes: **projection = declared parent/containment
  membership; collapse is explicit focus/expansion, never a count**.
- Projection must publish: focus/context roles, drawn-node membership, drawn routes with full
  membership, explicit internal/out-of-scope/unknown results, and coverage counts (`obs:302-320`).
- Acceptance: `buildRunGraphView(limit)` is no longer the path used by the panel; a projection of
  the equity graph reports 36 nodes / 35 routes for the operation scope with 0 silent drops; the
  892 internal routes remain reported; tests cover membership and coverage.

### P1 — Operation-rank diagram (OA6; the smallest correctly-shaped equity diagram)

- Data: drawn set = scenario + the 35 operation composites (declared direct children of the
  scenario); routes = the 34 declared `sequence` chain edges + the `op.35 → scenario` `return`;
  operation material from `COMPOSITE_MATERIAL`/`MATERIAL_WORDS` (corrected lane: input 14,
  provider-port 14, decision 6, evidence 1).
- Layout: rank by declared order (L1). Do **not** let `MATERIAL_BAND` raise or reverse a declared
  sequence edge. Entry: `operation.1` is the chain head under the scenario frame (no invented
  edge); every operation continues to bind all its member testimony through `membership`.
- Measured expected shape (real `layoutCircuit`, uniform rank intent): 36 nodes, 35 edges,
  **1 back edge** (`op.35→scenario`), 36 distinct ranks, width 720, no non-descending chain edge.
  Current-behavior control: with `MATERIAL_BAND` ranking the same projection, 20 back edges,
  4 rows.
- Acceptance: shape equals the measured expected shape; materials match the corrected counts;
  529/529 testimony cells still bind; the 892 internal routes are reported as internal; hello
  stays 6 nodes / 5 edges / 11 transitions all done; a snapshot test asserts 1 back edge and a
  strictly increasing chain.

### P2 — Provider / physical realization (OA8)

- Data: expand the 14 provider operations: provider cell (socket) + its physical child (tabbed
  tile) as declared descendants; provider leg order provider→physical; the 14 physical→operation
  `return` edges close under the operation frame.
- Layout: operation container frame (header = operation material/label) wrapping its provider leg;
  descent provider→physical; the close merges under the frame (L4/L6); the 21 expression-only
  operations stay leaves for now.
- Acceptance: 14 legs draw provider→physical→close; provider/physical/port materials observed
  (provider-port 14, provider 14, physical→provider plate 14); the chain order of P1 is unchanged;
  `held` legs show held without tainting the operation's done state.

### P3 — Branches and declared alternatives (OA6/OA7)

- Data: 41 junction cells as fork glyphs; 82 selection edges as declared arms with
  `selectsVariant`; 7 recurrence self-loops.
- Layout: junction → shared rail → arms; the 28 observed `FALSE` arms carry state from edge
  testimony; the 41 `TRUE` + 7 recurrence arms draw as declared alternatives (ghost/dashed), never
  lit; 13 never-reached junctions draw planned; no decorative dot claims a junction (L3).
- Acceptance: 41 forks, 82 selection arms, 7 recurrence loops drawn; 28/28 observed selections
  light exactly one arm each; unwalked arms never light; no join/fan-out glyph fabricated;
  counts in the text outline match the drawing.

### P4 — Expression detail and explicit expansion (OA7)

- Data: the 768 declared expression leaves (437 observed) with declared operation roots; explicit
  focus/expansion/coverage replacing the limit.
- Layout: expanded operations wrap their expression children; single-child chains stay chains;
  labels show declared roots, not `· N cells`; the focus frame keeps boundary routes.
- Acceptance: expanding one operation adds its declared leaves and internal routes; collapsing
  reports them as internal with counts; the 892 internal routes are recoverable from the UI text;
  no truncation by count.

### P5 — Trail, states and drain (evidence)

- Data: raw payload fields in the durable fixture, including `outcomeClassification`; drain to
  `hasMore=false` in `lib/sda-api.ts`.
- Layout/viewer: the token advances one step per observed testimony (retain repeats, no `seenRef`
  compression; `obs:298-299`); `held` semantics unchanged; junction dots carry no state.
- Acceptance: fixture replay reproduces 497 done / 32 held raw cells, 5 done / 10 held drawn
  nodes, 43 corrected transitions, 0 unmatched; the adapter drains the 105-event tail (scenario
  and `run.exited` included); a repeated-visit fixture shows repeats in cursor order.

### P6 — Graph transport and race hardening

- `live-run.tsx:85-98`: graph fetch must tolerate the measured 2.2–2.9 s `graph.captured` lag
  (raise/adaptive budget or fetch the graph at first testimony), and a missing graph must be a
  visible error, never a silent unlit view.
- Acceptance: equity-style latency (≈3 s to capture) yields a bound graph; race test fails loudly;
  `graphError` path covered.

---

## 6. Acceptance (consolidated)

1. **Projection first:** no drawing is produced from a count collapse; every drawn node/route
   carries source membership, focus/context role and coverage counts; the `30`-cell limit is not
   the projection policy (`obs:218-220, 302-320`).
2. **Order:** the equity operation view is a serial column: 34 descending `sequence` routes, one
   `op.35 → scenario` return, `operation.1` as the head; no declared sequence edge is treated as a
   loop-back because of its material.
3. **Branch truth:** 28 observed junctions/selection edges draw and light from their own testimony;
   41 `TRUE` + 7 recurrence are declared and never lit; no fabricated joins. `selectsVariant` and
   policy are part of connector identity.
4. **Close-outs:** 35 operation composites close after their members; provider legs descend
   provider→physical and close under their operation; the scenario closes last from `run.exited`
   exit 0.
5. **Containers:** frames exist only for drawn containment; provider enclosure may be pre-order
   descent; a single-child chain is not a frame.
6. **Evidence:** repeats retained, cursor order preserved; held attempts never taint enclosing
   composites; decorative geometry has no state; provider evidence records are receipts.
7. **Coverage:** 873 cells / 920 routes are accounted for at every step (drawn, context, internal,
   or unresolved-with-reason); no observed id unbound.
8. **Controls:** hello regressions unchanged (6 cells/5 edges, 11 transitions, all done); compiled
   (no-run) and observed modes remain the same drawing; text outline matches the SVG entities.
9. **Drain:** the lab adapter and every lane consumer close on `hasMore=false`; the 105-event tail
   is in the durable fixture.
10. **Durable fixture:** a reviewed, sanitized fixture (graph digest + raw classification fields)
    lives in the repo test location; no test depends on `%TEMP%` (`obs:349-355`).

---

## 7. Non-goals

- Estate/domain/assembly projection (OA0–OA2): this run graph cannot supply it (`obs:45-46`).
- Overlays (cost, risk, SLO, provider health, …): separate property contracts (`obs:260-270`).
- Illustrative flow playback and authored teaching editions: separate modes (`spec:881-887`);
  this plan only aligns the observed-execution drawing.
- Changing the 15 materials, the grammar or the route families; adding new tokens for equity.
- Rendering unwalked `TRUE`/recurrence arms as executed; animating them; inferring iterations.
- Provider-bound/health state beyond testimony; evidence receipts becoming node states.
- Any change to execution, authority, bindings or proof state (`obs:209-210`).

---

## 8. Aligned flow sketch (branch + merge + return)

Declared mechanics; the fork/merge pair is the OA7 shape the vocabulary supports (no declared
join exists in the equity capture — it is drawn only when authority declares one). The equity
capture's real shape is the same skeleton with one serial chain, 14 provider legs, 28 walked
`FALSE` forks (41 `TRUE`/7 recurrence declared, ghosted) and the `op.35 → scenario` return.

```text
                        ┌──────────────────────────────┐  scenario frame (header)
                        │  SCENARIO · 831 members      │  (outcome capsule badge)
                        │  entry                       │
                        └──────────────┬───────────────┘
                                       │ op.1 (chain head, no incoming edge)
                                       ▼
                        operation.1  · input      (round-rect)
                                       │ sequence
                                       ▼
                        operation.2  · provider-port (socket)
                        ┌──────────────┴───────────────┐
                        │ provider cell (socket)       │   ← operation frame
                        │        │ descent             │
                        │        ▼                     │
                        │ physical cell (tabbed tile)  │
                        └──────────────┬───────────────┘
                                       │ return closes under the frame
                                       ▼
              operation.3 · input ──► [ fork ] ── TRUE arm  declared, never lit (ghost)
                                       │  │
                                       │  └─► [ merge ]  declared join (all/any/quorum)
                                       │         ▲
                                       │ FALSE   │ support/return arrivals
                                       ▼         │
                        operation.4 · decision ───┘      (diamond)
                                       │ sequence
                                       ▼
                               … 35 operations …
                                       │
                                       ▼
                        operation.35 · decision
                                       │ return (upward close = loop-back,
                                       │         routed outside/under the frame)
                                       └──────────────► scenario frame bottom

  key:  ──► sequence (event conduit)      ═► return (outcome conduit)
        walked selection arm carries its own testimony; unwalked arms stay planned
        junction dots only where a declared junction/close-out actually merges
```
