# Capability Explorer: run evidence, design E1

Recorded 2026-10-06. Status: **for review.** No code has changed.

The design covers three things:

- reviewing a run when it ends;
- reopening and playing back earlier runs;
- getting the evidence of anything in the circuit by clicking it.

The deck is eight editable slides:
`sfx-providers/outputs/capability-estate/live-circuit-platform-explorer/E1/run-evidence-E1.pptx`.
Beside it are:

- slide renders, exported through PowerPoint;
- the generator;
- the sources every number is read from;
- the scene pages;
- `SHA256SUMS`.

| Artifact | SHA-256 |
| --- | --- |
| `run-evidence-E1.pptx` | `277c3cba257e185d64019f84d247071d884a2b0a5e05c26c0a0f05cd7a2577ac` |
| `render/slide-03.png` (run report) | `1feac89b1b946ef9a10c8d04191039991459c9291c7bc548203c4a528e4e372c` |
| `render/slide-06.png` (click an operation) | `0d1a87eb63af92fb0d60d5df710afbd2b8d7618537b460353cb1b0e72e668c20` |
| `render/slide-07.png` (click a provider) | `73c33a47484f08ebe5ea70352e7ee1a483d8a46e994104d60a12dbc06d77f733` |

**Specimen.** Most slides use the staging run of
`request-capability-from-objective-v3`: objective "What is Broadcom's current
market price?", 2026-10-06 04:57 UTC, 16.8 s, outcome `ADMITTED`. It is the same
run as [replay-timing-fidelity.md](replay-timing-fidelity.md). Two local runs
supplied the evidence records:

- local re-run `29807fa4` of the same capability;
- local run `52d5fe1e` of `resolve-equity-market-price-evidence`.

**What is real.** Every value on the slides comes from those runs. Evidence the
platform does not capture today is a dashed amber "not captured today" box with
nothing invented inside it. The playhead position on slide 5 is a chosen moment,
not a recorded event.

## Are provider responses captured?

No. Today a run leaves this behind:

| Evidence | Today | Where it lives |
| --- | --- | --- |
| Operation timing, status, outcome | Captured | Event stream to the browser. The observer keeps 2,000 records, about one large run. |
| Operation result (the value) | Not captured | Stays in the kernel. The kernel computes `inputDigest`/`outcomeDigest` for each cell, but neither reaches the stream. |
| Provider request and response | Not readable | See below. |
| Final output | Captured | API `/output`, up to 1 MB, in API memory for the last 200 runs. A restart loses it. |
| Run input | Not returned | Only in the browser tab that submitted it. |
| Run history | None | No list route and no run link. The page keeps up to 20 runs it saw. |

Provider requests and responses:

- Each Gemini call leaves two records:
  - a `provider-exchange-shape.v1` record (252 B);
  - a `model-response-shape.v1` record (205 B).
- Each HTTP exchange in the equity run left one `provider-exchange-shape.v1`
  record.
- The SDA API moves every such record off the event stream to a reference, by
  design (`laneEvidenceSeparation`). `GET /v1/evidence/{ref}` returns
  `501 EVIDENCE_PROVIDER_NOT_CONFIGURED`.
- The Gemini records are labelled `projected-capability-invocation`, not with the
  provider or operation they belong to.
- The observer bridge drops their kind. That is why the staging capture shows
  them as unlabelled records.

## The slides

1. **Cover.** Three promises:
   - the run report opens by itself;
   - one list, one click;
   - click anything in the circuit to see its evidence.
2. **What a run leaves behind today.** The table above. It shows the inspector as
   it is (raw JSON in collapsed panels) and follows one Gemini answer from the
   call to a 501.
3. **Run report.** When the run ends, the Run tab shows:
   - the outcome and duration;
   - Asked and Answered;
   - the providers called, with time and status;
   - where the time went, biggest first (82% of this run was three provider
     calls);
   - Replay, Copy link and Download evidence.
4. **Open any earlier run.** A Runs tab, newest first, with a This capability / All
   switch. One click loads a run in Replay, and `…&run=<id>` links to it.
5. **Play it back.** One bar for the whole invocation, to scale:
   - provider calls in violet, with the provider's own exchange bright;
   - time with no record hatched.

   Beside it are step and speed controls and a steps list. The dot waits at the
   provider.
6. **Click an operation.** The Evidence tab shows:
   - In and out (not captured today);
   - its time split by what happened inside;
   - the provider it called;
   - its trace (318 receipts) to open or download.
7. **Click a provider.** The Evidence tab shows:
   - the exchange time (3.1 s of the operation's 6.8 s);
   - Request and Response (not captured today).

   When a capability tries more than one provider, every exchange is listed in
   order.
8. **What it takes.** The changes below, and the order to ship them in.

## Changes and owners

| # | Change | Owner | Unlocks |
| --- | --- | --- | --- |
| 1 | Run report, steps list, playback bar and Evidence tab (time, trace, called) from today's data | sfx-platform | Slides 3, 5, 6 without values |
| 2 | Dot dwells at the provider; time with no record is hatched; kernel setup and finish appear on the bar | sfx-platform | Slide 5 ([replay timing](replay-timing-fidelity.md) steps 1 and 4) |
| 3 | Run index: list runs per capability, keep each run's input, survive restarts, open a run by link | SDA API (request) | Slide 4 |
| 4 | Evidence store: `/v1/evidence/{ref}` resolves | SDA API (request) | Slide 7 request and response |
| 5 | Evidence records name the operation and provider they belong to | SDA kernel (request) | Placing evidence on the circuit |
| 6 | Declare what is kept: which results and exchanges, redaction, size and how long | sfx-embody (rows) | Slide 6 in and out; safe disclosure |

Suggested order:

- **Now:** 1 and 2, which need no new data.
- **Next:** 3.
- **Then:** 4, 5 and 6 together. That is when provider responses and operation
  results appear behind the same clicks.

## Decisions for review

- **The context column becomes three tabs: Run, Runs and Evidence.** Clicking a
  circuit element switches to Evidence. When a run ends, the Run tab turns into
  the report.
- **The suggested order above.**
- **Disclosure comes first.** Provider answers and operation values can hold
  personal or secret data. Change 6 must be declared before any response is shown.
