# Circuit mapping trace — events → materials → diagram flow (2026-09-23)

**Purpose:** Before any layout or renderer work, establish from the data alone what each observed event is, which declared element it belongs to, which material the platform currently gives it and why, which drawn element it lights, and in what order.
**Runs:** `resolve-equity-market-price-evidence` (1,079 events) and `say-hello-world` (26 events, the control).
**Code used:** the platform's own `buildRunGraphView` and material tables (`lib/run-graph.ts`, `components/circuit/scl-theme.ts`, working tree at `7ac170c`). Nothing is re-implemented.

## Files

| File | What it is |
| --- | --- |
| `equity-mapping-trace.jsonl`, `hello-mapping-trace.jsonl` | One row per event in cursor order: element (cell / edge / evidence record / lifecycle), graph altitude and kind, owning operation, declared root, **own material and what decided it**, drawn node and its material, edge kind and variant, drawn or internal, testified disposition, variant and classification |
| `equity-operations.json` | One row per declared operation: port, **declared binding**, material in the default view and when drawn alone, cells and junctions reached, the operation's own testified outcome, its provider leg |
| `*-mapping-summary.json` | Aggregates: altitude/kind pairs in the graph, material ← driver counts, dead table keys, default-view nodes, flow grammar, root outcome |
| `mapping-trace.mts` | The generator |

**Reproduce** from the `sfx-platform` root:

```text
node --import tsx docs/circuit-mapping-trace-2026-09-23/mapping-trace.mts <run.json> <outDir> <events.jsonl> [graph-source.json]
```

- The inputs are machine-local. `run.json` is the raw run capture (all pages, with `outcomeClassification`, plus the run graph); `events.jsonl` is the normalized capture. Both are in `%TEMP%\opencode\baseline\`.
- `graph-source.json` is the capability's declared graph source, read-only: `SELECT graph_source FROM analysis.capability_graph_source(N'<capabilityId>', 0, NULL)` inside a transaction ending in `ROLLBACK`.
- All 1,079 equity cursors came from the raw pages; none had to be filled from the normalized file.

## 1. What the declared capability is (graph source)

- **Scenario boundary:**
  - Input `live-equity-price-request` (`live-equity-price-request.v1`)
  - Event `equity-market-price-evidence-requested` (authority `resolve-equity-market-price-evidence.v1`)
  - Outcome `equity-market-price-evidence` (`equity-market-price-evidence.v1`, terminal)
- **35 operations = 7 provider routes × 5 declared steps**, each step an `invoke-port`:

| Step | Declared port binding | Count |
| --- | --- | ---: |
| build binding request | `sda-authority-transformation-port.v1` | 7 |
| bind provider credential | `sda-external-credential-reference-binding-port.v1` | 7 |
| build exchange request | `sda-authority-transformation-port.v1` | 7 |
| observe exchange | `sda-governed-http-exchange-port.v1` | 7 |
| normalize (route 1) / select route (routes 2–7) | `sda-authority-transformation-port.v1` | 7 |

The routes, in order: equity, fallback, finance15, finance15bodyproof, gemini, gemini-live, gemini-live-2.

## 2. What happened (testimony, per route)

| Route | Operations | Credential | Exchange | Route result |
| --- | --- | --- | --- | --- |
| equity | 1–5 | BOUND | `retained-non-success` (failure) | `EQUITY_MARKET_PRICE_PROVIDER_UNAVAILABLE` (failure) |
| fallback | 6–10 | BOUND | `retained-non-success` (failure) | `EQUITY_MARKET_PRICE_PROVIDER_UNAVAILABLE` (failure) |
| finance15 | 11–15 | BOUND | `completed` (success) | **`EQUITY_MARKET_PRICE_EVIDENCE_RESOLVED`** (success) |
| finance15bodyproof | 16–20 | `CREDENTIAL_NOT_AVAILABLE` (failure) | `rejected-endpoint` (failure) | RESOLVED (carried) |
| gemini | 21–25 | `CREDENTIAL_NOT_AVAILABLE` | `rejected-endpoint` | RESOLVED (carried) |
| gemini-live | 26–30 | `CREDENTIAL_NOT_AVAILABLE` | `rejected-endpoint` | RESOLVED (carried) |
| gemini-live-2 | 31–35 | `CREDENTIAL_NOT_AVAILABLE` | `rejected-endpoint` | RESOLVED (carried) |

- **Root (cursor 1072):** `completed`, `EQUITY_MARKET_PRICE_EVIDENCE_RESOLVED`, classification `success`.
- **The chain has no short-circuit.** Routes 4–7 execute after route 3 resolves; their select steps carry the resolved evidence forward.

## 3. Flow sequence (cursor order)

**Testimony:** 529 cell and 528 edge, 0 unbound. Cells and edges strictly alternate.

| Step pattern | Count |
| --- | ---: |
| `mechanic -sequence-> mechanic` | 450 |
| `mechanic -return-> mechanic` (expression body closes into its operation) | 21 |
| `provider -sequence-> physical` | 14 |
| `physical -return-> mechanic` (provider leg closes into its operation) | 14 |
| `mechanic -selection[FALSE]-> mechanic` (junction arm walked) | 28 |
| `mechanic -return-> scenario` (op.35 closes the scenario) | 1 |

- Operations run strictly one after another, op.1 through op.35, with 0 interleaved.
- Each operation's own testimony comes after its members.
- A port operation's leg runs provider → physical → return → operation.

## 4. Current mapping: data → material (what decides each material)

**The circuit record carries only five altitude/kind pairs:** `mechanic|mechanic` 803, `mechanic|junction` 41, `provider|provider` 14, `physical|physical` 14, `scenario|scenario` 1.

**13 of the 17 entries in `CELL_MATERIAL` can never match:** `mechanic|input`, `mechanic|event`, `mechanic|outcome`, `mechanic|authority`, `mechanic|validation`, `mechanic|evidence`, `mechanic|human-approval`, `mechanic|decision`, `mechanic|branch`, `mechanic|fan-out`, `mechanic|convergence`, `mechanic|rejection`, `mechanic|termination`. The compiler emits no such kinds.

**Observed cells (equity), material ← driver:**

| Material | Driver | Cells |
| --- | --- | ---: |
| input | name word-stem **`request`** (`build-…-request` operations) | 329 |
| input | composite member-altitude rule | 14 |
| evidence | name word-stem **`evidence`** (`normalize-equity-price-evidence`) | 66 |
| decision | name word-stem **`select`** (`select-…-route`) | 43 |
| decision | composite member-altitude rule | 6 |
| branch | junction route kinds | 28 |
| provider-port | declared `provider\|provider` | 14 |
| provider-port | composite member-altitude rule (port operation with a provider and physical member) | 14 |
| provider | declared `physical\|physical` | 14 |
| outcome | declared `scenario\|scenario` | 1 |

**Hello-world:** all 5 mechanic cells fall to the generic `event` plate; the root is `outcome`.

**The default drawn view (equity):** 15 nodes, which are 14 `provider-port` (one per port operation) and 1 `outcome` (the scenario root).
- All 21 transformation operations (build, normalize, select) are inside the root node and never drawn.
- 500 of 528 walked edges are internal; 28 are drawn.
- The drawn node that lights changes 29 times across 529 cell testimonies.

## 5. Mismatches between the data and the drawing

1. **The capability's Input and Event are never drawn.** The only `input` material goes to 343 cells whose operation *name* contains `request` (outbound request builders). The declared Input, `live-equity-price-request.v1`, appears nowhere, and neither does the Event.
2. **Mechanic meaning is guessed from names.** Every mechanic material except `branch` comes from word stems or the composite rule. The declared port binding that says what each operation is never reaches the circuit record.
3. **The credential binding and the HTTP exchange look the same.** Both are `provider-port`, although the graph source binds them to different mechanics (`sda-external-credential-reference-binding-port.v1` and `sda-governed-http-exchange-port.v1`).
4. **The orchestration is invisible.** The 7-route structure, the 7 select decisions and the success on route 3 are all inside the root. The drawing shows 14 identical sockets around an outcome capsule.
5. **Outcomes aren't carried to the drawing.** The per-route results in §2 (the failed exchanges, the carried RESOLVED, the root's RESOLVED variant) exist in testimony, but no drawn element shows a variant.

## 6. What the circuit record lacks, and where it exists

| Needed for the mapping | Where it is declared | In the circuit record (`execution-graph-captured.v1`)? |
| --- | --- | --- |
| Scenario Input / Event / Outcome identities and contracts | graph source `scenarios[].input/event/outcome` | Contracts only as port `contractId`s; no input/event/outcome roles |
| Operation → declared port binding (`platformCapabilityId`) | graph source `interfaceAuthority.portBindings` | **No.** The record's projection drops `execution.configuration.binding`. |
| Operation → port id | graph source `operations[].portId` | Only indirectly, as the root of `semanticAddress` |
| Transformation id | port binding `configuration.transformationId` | No |
| Junction arm variant | graph edges `selectsVariant` | Yes |
| Outcome variant and classification | testimony | Yes (lane), not in the drawing |

## 7. What this implies (for decision, not yet done)

A mapping built from declared data needs the operation's declared binding and the scenario's Input/Event/Outcome roles alongside the cells. There are two ways to get them:

- the circuit record carries each operation's `platformCapabilityId` and the scenario's boundary roles (a kernel change, owed in Node, Python and C#); or
- a declared read serves them per capability (`read-capability-circuit` / graph source).

With them, the material map could be declared per mechanic identity instead of guessed from names:
- transformation → execution step
- credential binding → provider port
- governed HTTP exchange → provider port with a bound provider and a physical effect
- junction → branch
- scenario → Input / Event / Outcome

Which way to go, and where that mapping is declared, is the owner's decision.
