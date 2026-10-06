# Lane 02: recorder runtime — placement, rolling window, sealing

Design-only lane for the semantic flight recorder (intent.md: rolling pre-trigger
evidence, declared triggers, post-trigger obligation, immutable recording to
sfx-identity). Read-only against source; one new file. Pins:
`run-evidence-plan/analysis/README.md` (sfx-platform `327a2c2`, SDA `7075bb6`).
Plan references are `../../run-evidence-implementation-plan.md` (revision 3).

## Scope

Where the recorder process runs, its state machine and bounds, the durable handoff
to the identity host's evidence store, failure/recovery, a local spike, and
`R2.*` work items. The recorder is the capture side of W2.3 (register / append
trace / complete / attach) extended with trigger-declared rolling windows. No SDA
change (D3/B14); S1–S3 are content-side and out of this lane's critical path.

## Current-state foundations

Circuit host (`sfx-platform`):
- One process owns pages, session, run proxy and observer:
  `live-circuit/dispatch-pair/observe-server.mjs`. Ring limit 2000 total, one
  global `ring`, in-memory `runs[]` windows keyed by run-start/run-end
  (`:50,:53,:216-226`); SSE replay from the ring (`:326-363`); event intake
  `POST /events` → `normalizeEvent` (`:75-88`) → `admit()` (`:202-238`).
- Admission is proxied and attributed in the same process:
  `live-circuit/circuit/run-api.mjs:75-87`; attribution is bounded memory
  (`identity-session.mjs:18-19,96-105`), lost on restart. Host policy
  `circuit-host.json:4-5` (630 s proxy timeout, 1 MiB body, 2000 attributions).
- Bridge maps SDA events and is lossy: `run.started→run-start`,
  `graph.captured→observation`, `run.exited→run-end`, all else
  `→observation(payload)`; **`run.admitted` (cursor 1) is dropped** and cursors,
  eventIds, evidenceRefs and record kinds never cross
  (`tools/live-circuit/api-host.mjs:31-36`, B13). POSTs are serialized with a 10 s
  timeout; a bridge failure exits the API process (`:17-25,:53-55`). Staging twin:
  `deploy/sda-kernel/api.mjs:12-40`.
- Local stack and retention: `tools/live-circuit/start-local.mjs:63-71` (observer
  8788 + SDA 8799, `SDA_RUN_EVENT_RETENTION=20000` at `:70`); staging gateway
  raises only event retention (`deploy/sda-kernel/gateway.mjs:107-108`).

SDA API (`scenario-driven-architecture`, reference only):
- Per-run `RunBuffer` holds full `RunEvent` objects (`buffer.ts:44,82-111`);
  `buffer.subscribe` delivers every event object in-process (`:109`); paging/SSE
  expose exact events, `latestCursor/retainedFrom/evictedCount/partial` (`:113-139`);
  eviction is oldest-first at `maxEvents` (`:102-108`); default 1000
  (`:32`, config default; staging/local 20000).
- `append` separates evidence members/kinds into an `evidenceRef` and keeps only
  key fields on the lane (`:87-100,156-175,181-190`). `/v1/evidence/{ref}` is 501
  (`server.ts:318-330`). Host holds no DB handle (B16).
- Sizes (E05): one Gemini run 2,630,798 B raw JSON / 59,587 B Brotli, 1,893
  records, one 615,092 B graph record; staging 3,794,311 B / 85,268 B.
  E03: `cursor=1894, evictedCount=0`; E04 has four exchange records (429/429/200/refusal).

## Placement decision

**Primary: circuit host observer process** — a recorder module inside
`observe-server.mjs` (proposed `live-circuit/dispatch-pair/recorder.mjs` +
`recorder-state.mjs`), fed on the ingest path at `admit()` with exact `RunEvent`
objects.

- Pre-trigger retention: admission (`run-api.mjs:75-87`) and event intake are in
  one process, so a per-run buffer can open at cursor 1 before any storage call.
  Candidate trigger-bearing fields (`status`, `disposition`, `outcomeVariant`,
  `httpStatus`, `admissionDisposition`) are already visible where events arrive.
- Per-run isolation: the 2000-record ring is global and cross-run; a recorder must
  never source pre-trigger evidence from it. Per-run buffers keyed by
  `apiRunId` (from `run.started`) are the isolation unit.
- W2.3: W2.3 must run in this process anyway (register from the validated session,
  append while executing, complete at run end; plan:707-714, lane-02 deep dive 1).
  The rolling window and the trace tail are the same in-memory store; sealing is a
  cursor-range mark over already-appended chunks, not a second copy.
- A2.2 byte fidelity: the observer can persist the raw envelope before
  normalization; JSON round-trip is lossless.
- Zero SDA changes: enrichment is in platform-owned wrappers only
  (`tools/live-circuit/api-host.mjs`, `deploy/sda-kernel/api.mjs`).
- Restart: circuit host and SDA share one container restart boundary (lane-02),
  so no placement avoids mid-run loss; the identity host is the only cross-restart
  state.

Rejected:
- **SDA API** (`buffer.ts`): exact per-run stream and `subscribe` are ideal, but
  D3 requires zero SDA change in Phase 2, the host holds no DB handle and must not
  serve/store content (B16), it knows no session/principal, and recorder config
  (triggers) is platform/estate-side. Revisit only if S1's port makes the host a
  natural fan-out point (Phase 3+, still not persistence).
- **Kernel**: cross-language (csharp/node/python), lane events are filtered,
  clipped and budget-suppressed (`command-carrier.mjs:309-312`; S3/Q3), no
  principal, would require SDA requests per language. Wrong altitude.

**Fallback: same process, recorder as a follower of `GET /v1/runs/{id}/events`**
(lane-02 option b). Start following at cursor 1 when `run-api.mjs` attributes the
run; poll with `after=<cursor>`, 250–500 ms, using `latestCursor/retainedFrom` for
gap accounting. Needs no bridge change, costs a second event consumer and poll
latency, and re-reading after an observer restart is possible while SDA is alive.
The primary is strictly better on bytes and latency; the fallback is the
de-risked path if bridge enrichment slips.

## Recorder design

### State machine (per run)

`OPEN → ROLLING → PINNED → SEALING → SEALED`; side states `DISCARDED`
(never-triggered, sampling-only) and `LOST` (restart/no recovery).

- **ROLLING**: every admitted raw event is appended to the run buffer with
  `{cursor, at, kind, bytes}`. The pre-trigger horizon applies per trigger-class
  window: default `precedeEvents=250`, `precedeMs=30000`, `precedeBytes=2 MiB`,
  union semantics (retain until all three are satisfied, then drop oldest).
  Dropped events increment `windowGaps[]` with `{fromCursor,toCursor,count}` —
  never silently.
- **Trigger detection**: synchronous on ingest, before append/eviction, against
  declared rules in host data (proposed `live-circuit/circuit/recorder.json`,
  `contractId: flight-recorder.v1`). A rule is `{id, match:{kind?, fields:[...]},
  window:{precedeEvents, precedeMs, followEvents, followMs, obligationTimeoutMs},
  sampling?}`. A match appends `triggerRef:{ruleId,matchedCursor,matchedAt,eventKind}`.
- **PINNED**: any open trigger obligation pins the buffer; more matches merge into
  the pinned interval set. An obligation closes on the first of: `followEvents`
  reached, `followMs` elapsed, run-end, or `obligationTimeoutMs` (default 300 s,
  for hangs). `run-end`/timeout closes with `truncatedBy` visible.
- **SEALING/SEALED**: when the run is terminal and all obligations closed, flush
  remaining chunks, seal `[firstCursor,lastCursor]` and freeze the manifest
  (`flight-recording.v1`): `{recordingId, runId, index, triggerRefs[], windowSpec,
  firstCursor, lastCursor, recordCount, chunks[{chunkIndex,sha256,firstCursor,
  lastCursor}], gaps[], complete, limitations[], sealedAt, digest}`. Re-sealing or
  rewriting a sealed recording is refused; a late trigger on a still-open run
  creates `index+1` (append-only).
- **Multiple/overlapping triggers**: one recording per run per seal; overlapping
  windows share the same pinned bytes; triggerRefs keep per-trigger attribution so
  one recording can justify several claims.
- **Never-triggered runs**: W2.3 already appends the full trace; the recorder
  marks no recording (`DISCARDED`) unless `sampling.mode=all|rate(n)`, in which
  case a window covering `[1,latestCursor]` is sealed as a sampled recording.
  Sampling changes only which windows are *sealed*; it does not change trace bytes.
- **Immutability**: chunks are content-addressed; the manifest digest and
  `sealedAt` are recorded; corrections are new recordings plus limitations, never
  edits (I8/T8).

### Bounds and resources (proposed defaults)

| Scope | Default | On saturation |
| --- | --- | --- |
| Rolling window / run | 250 events, 30 s, 2 MiB | drop oldest, append `windowGaps[]` |
| Pinned window / run | 10,000 events, 15 min, 16 MiB | stop capture, seal `complete:false`, `RESOURCE_SATURATION` limitation |
| Global recorder | 64 MiB, 64 active runs | evict oldest **unpinned** run buffer; new pins fail closed with the limitation above |
| Outbox (store-and-forward) | 32 MiB | stop appending new chunks; gap the range; visible unconfirmed |
| Single event | no clipping (A2.2) | events up to 16 MiB accepted; count as one |

The 615 KB graph record dominates a window, so byte caps are per-run, not
per-event, and an oversize single event is admitted and counted as one. The
observer's 2000-record ring is unchanged and unused by the recorder; its budget is
a UI concern (`observe-server.mjs:50,216-217`).

**10,000-execution sampling corpus cost** (E05 rates): ~26.3 GB raw JSON, ~0.6 GB
Brotli at 59.6 KB/run (~0.85 GB at the staging 85 KB rate), ~100k chunk rows at
256 KiB raw chunks, plus manifests; wall time ~47 h at 17 s/run. Manifests add
kilobytes, not copies, because they reference trace chunk indexes. W0.5 sizes the
varbinary store; W5.1 retention is mandatory before corpus work.

### Durable interface (identity host, reuses W2.3)

- **Register** (user bearer, synchronous in `run-api.mjs:75-87`):
  `POST /evidence/v1/runs {runId, capabilityId, namespaceId, admittedAt}` —
  binds the recorder buffer to a principal; body never carries `principalId`.
- **Append** (service key): `POST /evidence/v1/runs/{runId}/trace`
  `{chunkIndex, firstCursor, lastCursor, recordCount, sha256, brotli,
  windowRef?}`; idempotent per `(runId, chunkIndex)`; bounded retry with backoff;
  256 KiB raw chunk target.
- **Complete**: `POST /evidence/v1/runs/{runId}/complete` `{state, terminal,
  latestCursor, recordCount, output, gaps[], recordings[]}`; `recordings[]` is the
  recorder's addition. Do not infer terminal state; read `/v1/runs/{id}`.
- **Assert/attach** (service key): W2.3 C1 flow unchanged; the sealed manifest is
  attached as observation evidence to C1 (scope = window rows), preserving W2.3's
  idempotency and pending-identity rules.

W2.3 already covers: registration from the validated session, continuous Brotli
chunk append while executing, output capture, completion, C1 assert/attach,
gaps/incomplete capture, bounded retry and reconciliation. The recorder adds:
trigger rules and refs, the pre-trigger rolling store and pinning, sealed-window
manifests, sampling policy, `windowRef` on chunks, and the requirement that
`run.admitted` (cursor 1) is part of the trace (currently dropped,
`api-host.mjs:31`) so `trace_records = latestCursor` holds (A2.2).

## Failure and recovery

- **Lag**: ingest is synchronous append + pointer work; compression/flush is
  async. Backlog > 1,000 events or > 2 s triggers `RECORDER_LAG`; the bridge POST
  is never blocked by storage.
- **Missed triggers**: evaluation happens before eviction, so a trigger cannot be
  dropped while the process lives. If the process is down, backfill from
  `/v1/runs/{id}/events` (retention 20,000) and re-evaluate; if the match is inside
  a retention gap, mark `triggerCoverage: PARTIAL` + `NOT_OBSERVABLE`.
- **Restart mid-run**: in-memory buffers are lost. Resume only if the identity host
  can list open registered runs (needs a W2.2 read; see decisions); otherwise the
  recording is `LOST` and existing chunks stay valid. A `run-end` without
  `run-start` creates an adopted recording with `startUnobserved: true`.
- **Storage outage (A2.8)**: execution outcome unchanged; UI reports persistence
  unconfirmed; outbox retains chunks up to 32 MiB; on recovery flush oldest-first
  idempotently and reconcile `latestStoredCursor` vs SDA cursor, backfilling when
  events remain retained, else recording `TRACE_GAP`.
- **Incomplete windows**: always sealed with `complete:false`, explicit
  `limitations[]` and gaps; never synthesized as complete (I7).

## Work items

| ID | Repo | Produces | Deps | Size |
| --- | --- | --- | --- | --- |
| R2.1 Recorder core | sfx-platform | `recorder.mjs` + state machine, rolling/pin/seal, trigger eval; unit fixtures | — | M (2–3 d) |
| R2.2 Exact-event bridge | sfx-platform | Enriched `api-host.mjs`/`api.mjs` envelope incl. `run.admitted`; observer raw retention without breaking UI/SSE | W2.3 schema freeze | S–M (1–1.5 d) |
| R2.3 Durable streaming | sfx-platform | Chunk append with `windowRef`, outbox/retry, `recordings[]` in complete, attach manifest to C1 | W2.1 002b, W2.2 endpoints | M–L (3–5 d) |
| R2.4 Trigger declaration | sfx-platform | `recorder.json` contract + validation; names align later with W0.6 | — | S (0.5 d) |
| R2.5 Local spike | sfx-platform | Fixture replay (E03/E04/capture.sse) + one `start-local.mjs` run; receipt | R2.1 | S–M (1–2 d) |
| R2.6 Window verification | sfx-platform | `verify-recorder-window.mjs`: manifests, byte fidelity, gaps, overlap | R2.2, R2.3 | M (2 d) |
| R2.7 Health/limits | sfx-platform | Lag/saturation counters; unconfirmed-persistence indicator | R2.1, W2.3 UI | S (1 d) |
| R2.8 Resume rendezvous | sfx-providers | W2.2 add: list open registered runs for recorder restart | W2.2 | S–M |

S1–S3 do not gate R2.*; they gate C2 content (Phase 3). `run.admitted` and
bridge enrichment must land with W2.3's stored-record schema freeze (turn A).

## Verification

- Unit fixtures (R2.1): horizon coverage, pin union, overlapping triggers,
  run-end/timeout truncation, saturation gaps, sampling-only, late trigger.
- A2.2 via R2.6: decompressed chunks byte-identical to `/v1/runs/{id}/events`
  records; `trace_records = latestCursor`; chunk SHA-256 verifies.
- A2.8 harness: stub identity returns 503; assert run outcome unchanged,
  unconfirmed reported, gaps reconciled on recovery, no invented completion.
- Restart tests: observer-only kill (resume path) vs container restart (`LOST`).
- Load: replay E03/E04 ×100 through `POST /events`; assert memory ≤ global bound
  and `RECORDER_LAG` clean.
- Local receipt from R2.5; staging A2.2/A2.8 acceptance receipts before W2.3 exits.

## Decisions needed

1. Trigger declaration home: host `recorder.json` in Phase 2 with W0.6 alignment
   later, or an estate declaration first (D8)? Recommend host config now.
2. Horizon composition semantics: union (recommended) vs count/time whichever
   first; and default horizon values.
3. Recording manifest home in 002b: new `evidence.recording` vs manifest stored as
   `evidence.evidence_object` + `recordings[]` accepted by complete. Recommend the
   latter to avoid a sixth table; must be frozen in W2.1.
4. Exact bridge envelope shape and who derives UI kinds (`sda-event` plus derived
   fields vs raw field added to existing records).
5. Restart resume: W2.2 open-run list (R2.8) or accept `LOST` for Phase 2.
6. Sampling corpus policy and retention: `all` vs rate; retention period before any
   10k-run work.
7. Whether a trigger/sealed window becomes a new claim kind later or stays
   evidence under C1 in Phase 2 (recommend the latter).

## Risks and corrections

- **Correction to lane-02/plan wording**: `admit()` is not the fidelity point;
  `normalizeEvent` (`observe-server.mjs:75-88`) already discards `kind` for
  unknown shapes and the bridge drops `run.admitted`. Store the exact `RunEvent`
  before/around normalization and stop dropping cursor 1, or A2.2 cannot pass.
- A single graph record is 615 KB (E05); a per-event clip would break A2.2 — bounds
  must be per-run with oversize single-event admission.
- The 2000-record observer ring cannot back a pre-trigger window; using it would
  make horizon coverage depend on unrelated traffic.
- Circuit host and SDA share a restart boundary; mid-run continuity needs the
  identity-host rendezvous (R2.8) and must not be promised before it exists.
- Corpus storage is dominated by W2.3 full traces (26 GB raw/10k), not by windows;
  retention (W5.1) must precede corpus generation.
- Storage-outage drops must gap, not discard, intervals: dropping chunks silently
  would launder incompleteness (I7).
- Trigger vocabulary declared in host config is not yet estate authority (D8/L0
  drift); record it as a known Phase 2 limitation.

## Confidence

High on current-state placement, bridge loss, ring, retention and plan gates
(files read directly at pinned commits). Medium on numeric bounds and corpus cost
(two E05 samples, no live sizing). Medium on the identity-host interface until
W2.1's 002b schema and W2.2 contracts freeze.
