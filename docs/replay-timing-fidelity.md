# Replay timing fidelity: what moves the flow dot

Recorded 2026-10-06. Status: **finding, with a proposed strategy.** No code has
changed yet.

**Evidence.** A real, signed-in staging Observe of
`request-capability-from-objective-v3`, with Gemini model providers (run
`sfx-observer:511e8fd553a566b7035f0f81:849`). It was retained by staging release
run 37415691113 as `browser/capture.sse`, `browser/scene.json` and
`replay/receipt.json`. The capture was replayed through `deck-trace.js` and
`traversal.js` as of `4c728d2`. Operation names inside the provider attempt come
from the estate's rows: scenario `execute-projected-model-provider-attempt`,
`model.execution_operation` ordinals 0–9.

**The log reviewed** is retained in
[`replay-timing-fidelity/`](replay-timing-fidelity/):

- **[`timing-log.md`](replay-timing-fidelity/timing-log.md)** is the readable
  digest. It covers:
  - the invocation and delivery phases;
  - every operation, with its replay position;
  - each provider call's nested steps, including spans with no timed receipt;
  - what the browser's dot showed at 1×.
- `receipts.csv` has one row per record in the run.
- `dot.csv` has the browser's replay samples.
- `capture.sse` is the original capture. Its SHA-256,
  `9d7b44b88d0b2e64a469cd3e70fb7dd77df40576c67a6262033bf7e681156e6c`, matches the staging artifact.

`build-timing-log.mjs` regenerates the digest and the CSVs from the capture.

## What drives the dot

**Replay.** The clock is honest; the shape inside an operation is not.

- `PlaybackClock` advances the captured position by wall time × rate. The
  staging verifier measured 14,057.4 ms captured and 14,058.6 ms played at 1×.
  At 0.1× it measured 140,592.8 ms against 140,574.3 ms expected.
- Each operation lasts exactly its own receipt's `startedAt` → `completedAt`, so
  the time the dot spends inside each operation is real.
- Handoffs between operations use the captured gaps (11.8 ms in total). The
  scenario window has no time without an active segment.
- Inside an operation there is one timing piece. The dot moves at **constant
  speed along the drawn path**: lane, port, provider, then back. The
  provider-dwell piece (`pieces()` with a `dwell`) is used only when a
  provider-altitude child receipt joins the operation. This run has 0 such cells
  and 0 such receipts, so the dot never dwells anywhere.

**Live.** Live mode is driven by receipts, not by the clock.

- When a call is admitted, the dot is placed at the provider at once. It waits
  there until the operation's own return receipt arrives.
- Other moves are 120 ms schematic transitions.
- Receipts reach the browser late: median 386 ms, p90 896 ms, max 1,328 ms after
  `completedAt`. The lag peaks after operations that emit many expression
  receipts. Operation 3's completion arrived 1.1 s late, so live mode shows
  operation 4 starting 1.1 s late.

## Where replay fills in

| # | Operation | Captured | What actually happened (nested receipts, offset in the operation) | What the dot does |
| --- | --- | --- | --- | --- |
| 4 | select-capability-model-port → `provider:google/gemini-select` | 6,769 ms | 0–2,149 no receipt of any kind · 2,149–3,127 protocol projection, request body, credential binding, HTTP preparation · **3,127–6,193 `observe-http-port` (3,066 ms, the Gemini exchange)** · 6,193–6,742 normalisation and finalisation | Crawls out along the request wire and reaches Gemini at 3,384 ms. It leaves at once and crawls back, so it is already on its way back for the 2.8 s while Gemini was still working. |
| 7 | invoke-database-capability-port → `provider:ScenarioKernel.NodePlatform` | 2,321 ms | No nested receipt: the Node platform reports nothing of its own. | Reaches the provider at 1,160 ms, then returns. The shape is invented. |
| 10 | summarize-results-model-port → `provider:google/gemini-summary` | 4,725 ms | 0–1,286 no receipt · **1,708–4,179 `observe-http-port` (2,471 ms)** · 4,203–4,719 normalisation and finalisation | Reaches Gemini at 2,363 ms. It leaves 1.8 s before the response arrived. |

- **How long the provider is shown.** The verifier's own receipt counts how many
  sampled frames show each provider as the current component during its owning
  operation: gemini-select 32 of 406 (8%), NodePlatform 12 of 140, gemini-summary
  25 of 282. The real HTTP exchange was 45–52% of those operations. The verifier
  only requires the provider to be visited at least once
  (`verify-circuit-replay.mjs`, "transport location is schematic").
- **Speed.** Speed tracks operation duration, which is real. Operation 1 crosses
  its lane in 32 ms; operation 4 crawls at about 120 px/s. Inside a call, though,
  where the dot is depends on wire length, not on evidence.
- **Time outside the window.** Replay starts at the first operation. The 2,474 ms
  before it and the 304 ms after the return are not played.
  - The capture times the last 852 ms before the window as delivery phases
    (`readExecutionDelivery`, `readAuthority`, `executeDeclaredGraph`).
  - The first 1,622 ms after `run-start` has no captured phase at all.

## Why the replay doesn't use the evidence today

The capture already holds the truth. Operations 4 and 10 each contain 318 timed
cell receipts (14 steps, 5 scenario returns and 299 expression cells) plus 315
edges. Three gaps keep the client from using them:

1. **Not in the graph.** The nested provider-attempt cells are absent from
   `execution-graph-captured.v1`, which has 327 cells, all from the root
   scenario. There is no declared geometry to place them on.
2. **Linked by sequence, not by containment.** A nested receipt's
   `parentCellExecutionId` names its sequence predecessor or itself, never the
   owning operation (`…operation.4:1`). They can be attributed to operation 4
   only because their times fall inside its interval. That breaks as soon as
   operations run in parallel.
3. **The exchange isn't declared.** Nothing in the deck says which nested step
   is the provider exchange. The client cannot name `observe-http-port` itself,
   because runtime code never names an identity.

## Proposed strategy

The principle: **the dot is where the evidence says the work was. Moves between
places are short and marked as schematic. Time with no evidence is shown as
unknown, not as motion.**

1. **Dwell, not crawl (platform; no new data).**
   - For a call segment, use a short schematic transit, for example
     min(150 ms, 10% of the interval). Then dwell at the callee for the rest of
     the operation's captured time, then transit back.
   - All of that time really is spent inside the call, at the operation's
     altitude. Label the dwell "inside call: provider time not separately
     captured" until (2) lands.
   - Apply the same rule to operation 7.
   - Tighten the verifier: the provider must be current throughout the dwell,
     not merely visited once.
2. **Declare the exchange (estate).**
   - The circuit reader declares, per call lane, which nested steps make up
     preparation, exchange and normalisation, derived from the provider
     binding's composition rows.
   - The client then splits the dwell: preparation at the port, the exchange at
     the provider, normalisation at the port. Unreceipted time, such as 2,149 ms
     in operation 4, shows as a visible "no receipt" hold.
3. **Attribute by identity (SDA request).**
   - Nested testimony should carry the owning invocation (the invoking cell
     execution), so attribution doesn't depend on time containment.
   - The captured graph should include the nested graph, or a reference to it.
   - Separately, trace where the 0.4–1.3 s live delivery lag comes from: kernel
     flush or observer relay.
   - One hint: the untimed `projected-capability-invocation` observations reach
     the browser within about 10 ms of the HTTP step they follow, while cell
     receipts lag. That points at how testimony is emitted rather than at the
     relay. The receive time and the execution times come from different
     processes, so this is an indication, not a measurement.
4. **Play the whole invocation (platform).**
   - Show the pre-window and post-window delivery phases as a hold at the
     capability boundary, labelled from the captured `delivery-phase`
     observations.
   - Replay length then matches what the user waited through live (16.8 s, not
     14.1 s).

Order: 1 and 4 can ship now. Step 2 is one estate migration pair. Step 3 goes to
`scenario-driven-architecture` as a request.
