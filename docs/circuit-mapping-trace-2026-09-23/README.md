# Circuit mapping trace — events → declared materials → diagram flow (2026-09-23)

**Purpose:** Before any layout or renderer work, establish from the data alone what each observed event is, which declared element it belongs to, which material the declared presentation policy gives it, which drawn element it lights, and in what order.
**Runs:** `resolve-equity-market-price-evidence` (1,079 events) and `say-hello-world` (26 events, the control).
**Code used:** the platform's own `buildRunGraphView` (`lib/run-graph.ts`) and the declared `circuit-presentation.v1` policy (`read-circuit-presentation`, committed as `tests/fixtures/circuit/circuit-presentation-policy.json`). The captures were re-captured on the host-invariant U3 kernel (SDA `e398cd5`, installed kernel `3224b653…`) and carry each cell's declared `execution.authorityId` (SDA `1322d1f`) verbatim; for a capture that predates it the generator joins the declared identity back from the declared-bindings fixture derived by `derive-declared-bindings.mjs`. Nothing is re-implemented.

## Files

| File | What it is |
| --- | --- |
| `equity-mapping-trace.jsonl`, `hello-mapping-trace.jsonl` | One row per event in cursor order: element (cell / edge / evidence record / lifecycle), graph altitude and kind, **declared `authorityId`**, owning operation, own material and whether the policy declared it, drawn node and its material, edge kind and variant, drawn or internal, testified disposition, variant and classification. The scenario row also carries its three declared boundary roles. |
| `equity-operations.json` | One row per declared operation: port, declared binding, declared `operation:<platformCapabilityId>` authority, material in the declared view and when drawn alone, cells and junctions reached, the operation's own testified outcome, its provider leg |
| `*-mapping-summary.json` | Aggregates: policy identity, declared bindings provenance, altitude/kind pairs, material ← driver counts, unresolved authorities, boundary roles, default-view nodes, drawn-node changes, flow grammar, edge drawing, root outcome |
| `mapping-trace.mts` | The generator |
| `derive-declared-bindings.mjs` | Derives the declared-bindings fixture (scenario boundary, operation bindings, expression pointer → operator) from the declared graph source; configuration is stripped |

**Reproduce** from the `sfx-platform` root:

```text
node --import tsx docs/circuit-mapping-trace-2026-09-23/mapping-trace.mts <run.json> <outDir> [events.jsonl] [declared-bindings.json]
```

- `run.json` is the raw run capture (all pages, with `outcomeClassification`, plus the run graph). The durable captures are in `tests/fixtures/circuit/`.
- `declared-bindings.json` defaults to `tests/fixtures/circuit/<subject>-declared-bindings.json`; the machine-local graph source itself is never committed.
- The generator writes `mapping-trace.jsonl`, `mapping-summary.json` and (with bindings) `operations.json`; the committed targets carry the run prefix.
- All 1,079 equity cursors come from the raw pages; none is filled from a normalized file.

## 1. What the declared capability is (graph source)

- **Scenario boundary:**
  - Input `live-equity-price-request` (`live-equity-price-request.v1`)
  - Event `equity-market-price-evidence-requested` (execution authority `resolve-equity-market-price-evidence.v1`)
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

## 4. Declared grain (phase 3 acceptance, equity)

`read-circuit-presentation` declares `granularity.node: "operation"`; the view groups every expression, binding, field and selection cell into its nearest enclosing operation along the `parentCellId` chain.

- **The default view draws 39 nodes:** 1 scenario + its Input, Event and Outcome boundary roles + 35 operations.
  - The Input role is `live-equity-price-request.v1`; the Event role is the scenario cell's `authorityId` (`resolve-equity-market-price-evidence.v1`); the Outcome role is `equity-market-price-evidence.v1`.
  - All 35 operations are drawn; all 7 selection operations are drawn, with their 28 walked junction arms internal to exactly one operation.
- **Drawn edges:** 528 walked edges — 35 drawn (34 between operations and 1 closing the scenario), 493 internal to one drawn operation, 0 unbound.
- **The lit node changes 36 times across the 529 cell testimonies:** once per operation op.1 → op.35, then the scenario root at cursor 1072.
- Comparison with the retired count collapse: 15 nodes (14 provider-port sockets + the root), 28 drawn edges, and all 35 operations invisible inside the root. The counts were the platform's, never the estate's.

## 5. Declared materials (phase 2 acceptance)

The policy maps are exact-key: `materials.boundary` (input/event/outcome), `materials.byAuthority` (72 authorities), `materials.byEdgeKind` (7 kinds). No fallback between maps and no substring or word-stem matching.

**Equity (529 cells), material ← driver:**

| Material | Driver | Cells |
| --- | --- | ---: |
| event | declared `byAuthority` (transformation, provider, physical, mechanic and expression authorities) | 458 |
| provider-port | declared `byAuthority` (credential bindings and provider cells) | 21 |
| provider | declared `byAuthority` (the governed HTTP exchange and its physical cells) | 21 |
| branch | declared `byAuthority` (`junction:boolean-selection.v1`) | 28 |
| outcome | declared `materials.boundary.outcome` (the scenario cell) | 1 |

- **0 word-stem assignments and 0 composite-rule assignments** (was 329 input, 66 evidence, 43 decision, 14 input, 6 decision, 28 provider-port by rule, 14 provider-port by rule, 14 branch, 14 provider, 1 outcome before the policy was read).
- **The credential binding and the governed HTTP exchange now get different materials:** `operation:sda-external-credential-reference-binding-port.v1` → `provider-port`; `operation:sda-governed-http-exchange-port.v1` → `provider`.
- **Hello-world is unchanged in shape (6 nodes) and now declared:** its five mechanic cells and the scenario resolve through `byAuthority`/`boundary` — the generic event plate is gone unless the policy declares `event` (it declares it for `operation:sda-authority-transformation-port.v1` and the expression mechanics).
- Every cell is either `declared` or `UNRESOLVED`; the captures resolve 529/529 (equity) and 6/6 (hello).

## 6. What the record lacked, and how it is carried now

| Needed for the mapping | Where it is declared | In the record |
| --- | --- | --- |
| Scenario Input / Event / Outcome identities and contracts | graph source `scenarios[].input/event/outcome` | Input and Outcome as port `contractId`s; Event as the cell's `authorityId` (phase 1) |
| Operation → declared binding (`platformCapabilityId`) | graph source `interfaceAuthority.portBindings` | `authorityId` `operation:<platformCapabilityId>` (phase 1) |
| Transformation identity (`transformationId`) | port binding `configuration.transformationId` | Expression cells' `authorityId` `mechanic:<op>.v1`; the binding's transformation id is the expression address root |
| Operation membership (cell → its operation) | the record's `parentCellId` chain; the grain is declared by `read-circuit-presentation` | Yes (as parent chain), drawn at the declared operation grain (phase 3) |
| Declared operation order | graph source `operations[]` order; the record's `sequence` edges | Yes (edges) |
| Junction arm variant | graph edges `selectsVariant` | Yes; distinct in the drawn edge key (phase 5) |
| Outcome variant and classification | declared per capability; carried in testimony | Testimony lane, yes; declared variants on the outcome port (phase 1) |
| Material per declared identity | `circuit-presentation.v1` `materials.*` | Read, published and rendered by exact key (phase 2) |
| Grain | `circuit-presentation.v1` `granularity.node: "operation"` | Read and drawn (phase 3) |
