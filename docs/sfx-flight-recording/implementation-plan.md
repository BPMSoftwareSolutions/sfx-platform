# Semantic flight recorder: implementation plan

Prepared 2026-10-06 for team review. Status: **draft, not started.**
**Revision 1 (2026-10-06): first flight-recorder revision; consolidates the six
lane documents. Adversarial review corrections C01–C24 applied.**

**How this plan relates.** [`intent.md`](intent.md) defines the capability (a
rolling pre-trigger evidence window around declared triggers, sealed to
`sfx-identity`) and [`research.md`](research.md) supplies the zero-implicit-authority
thesis. The six lane documents in [`analysis/`](analysis/) are read-only design:
they own trigger/window geometry (lane-01), recorder runtime (lane-02), storage
and ledger (lane-03), expected-vs-observed verification (lane-04), Explorer UX
(lane-05) and assurance/operations (lane-06). This plan consolidates and
reconciles them into one revised F-scheme on top of
[`../run-evidence-implementation-plan.md`](../run-evidence-implementation-plan.md)
(revision 3), reusing that plan's W/S work items, closed decision model and gates
instead of replanning them. Everything here is proposed; the lane documents are
designs, not installed fact. HEAD is `b9be6e8`; the uncommitted Phase 1 UI work
in the working tree (`run-context.js`, `run-evidence.mjs`,
`verify-run-evidence*.mjs`) is an integration point only — no F item needs it
complete; F5.1–F5.3 use its interfaces fixture-first (§8).

**How to review.**

1. Confirm the run-evidence decision model
   ([`../run-evidence-implementation-plan.md`](../run-evidence-implementation-plan.md) §2)
   is still closed (F0.1); flight recording adds producers and evidence, not
   trust semantics.
2. Answer the decisions in §3 (D11–D16, D-L1–D-L10) and the carried lane
   decisions (FQ11–FQ14). They change the shape of F2–F5.
3. Check the sequencing in §6.0 against the run-evidence 3-turn verdict; F3+
   work is not dated until S1–S3 land.
4. Check the baseline in §4 against its sources and the reconciled lane
   conflicts in §5.7.

The adversarial review of this draft is retained at
[`analysis/review-implementation-plan.md`](analysis/review-implementation-plan.md);
C01–C24 are applied (C02 adopts multiple triggers per recording).

**Contents.** 1 Outcome · 2 Inherited constraints · 3 Decisions · 4 Baseline ·
5 Target design · 6 Sequencing, phases and work items · 7 Verification gates ·
8 Honest limits · 9 Security and privacy · 10 Risks · 11 Open questions ·
A Lane index · B Run-evidence dependency map.

Citation shorthand: `lane-0N` = the six documents in `analysis/`; `plan` =
`../run-evidence-implementation-plan.md`; `A/README`, `A/decisions`, `A/gates`,
`A/synthesis` = [`run-evidence-plan/analysis/`](../run-evidence-plan/analysis/).

## 1. Outcome and not in scope

**Outcome (proposed).** The live circuit gains a semantic flight recorder:

- **Rolling pre-trigger window.** The recorder continuously retains enough
  ordered circuit state to satisfy each declared pre-trigger horizon. When a
  declared trigger fires it pins the preceding evidence and keeps recording
  until the post-trigger obligation closes (`intent.md:3-70`).
- **Declared triggers.** Triggers are declared estate data with a digest, not
  log strings or code: authority denial, operator-required, provider failure,
  provider switch, physical-effect denial, latency anomaly, experiment-scenario
  (`intent.md:179-217`; `lane-01:96-112`). A trigger is fact data and never a
  disposition (`lane-06:36-42`).
- **Causal neighborhood.** A sealed recording holds the identity → intent →
  inference → authority → trigger → disposition → recovery → outcome
  neighborhood, with before/after event and time geometry (`intent.md:357-380`).
- **Expected-vs-observed verification.** The observed trace is compared against
  an expected-trace descriptor derived from the declared estate, producing
  `SATISFIED | VIOLATED | NOT_OBSERVABLE | INCONCLUSIVE` recorded in
  `ledger.verification` — evidence, never promotion (`lane-04:29-75`).
- **Evidence microscope.** Eight Explorer views over recordings: trigger list,
  window timeline, causal lanes, expected-vs-observed pane, authority/effect
  overlays, dispositions/limitations, export bundle, sampling corpus
  (`lane-05:61-70`).

**Not in scope.** New trust semantics or claim kinds (D16); recorder as a
control loop or HOLD enforcement (D-L9); prover/checker, cross-language parity
and formal proof; cryptographic non-repudiation (hash-linked attribution only,
D14); multi-run/corridor recordings in v1; SDA changes beyond filed requests
S1–S3; 10k-execution corpus until retention and sizing exist; production rollout
beyond staging; any requirement that the in-flight Phase 1 UI complete (F5.1–F5.3
use its worktree interfaces and live-wire only when they land).

## 2. Inherited constraints

The run-evidence decision model is closed (`plan` §2) and inherited unchanged:

| Constraint | Enforcement |
| --- | --- |
| Trust is claim-scoped, never entity-global | T1/I1; dispositions keyed by claim and scope |
| Evidence classes stay distinct (identity, declaration, authority, observation, conformance, cross-verification, formal proof, admission) | T4/I4; closed vocabulary, declared prerequisites |
| Every elevation needs evidence; no numeric promotion or threshold | T2; rules check prerequisites, never `state >= N` |
| Producers attach; a declared evaluator checks; admission principals admit | `plan` §2.4; T6/T9 |
| Absence stays `NOT_OBSERVABLE`; it never supports | T7/I7 |
| History is append-only; retention removes bytes and leaves tombstones | T8/I8 |
| Conclusions replay from retained identity, authority, evidence, evaluator and rules | T10/I10 |

Flight recording **adds producers and evidence, not trust semantics**. The
recorder is a producer: it attaches recordings and scan results and never
decides a disposition or admits its own trigger set (`lane-06:88-92`). A
`recording` reuses C1/C2 attachment rules, D4 access, D5 retention, D6 privacy
and D10 admission. Where flight data is missing, the existing limitation and
`NOT_OBSERVABLE` discipline applies unchanged.

## 3. Decisions for the team (all proposed; owner column)

| # | Decision | Recommendation | Why | Lane support |
| --- | --- | --- | --- | --- |
| D11 | Trigger authority (PO) | Estate operator declares one migration pair; an admission principal activates via `ledger.admit`, recording the trigger-set digest, scope and conditions; widen/narrow/disable is a new admitted version, never an edit | A trigger decides what memory is pinned and what evidence will never exist; a default is not a grant | `lane-06:36-56`; `lane-01:82-94`; `plan` §3 D8/D10 |
| D12 | Sampling and budget (PO) | Sampling off by default (`mode=all`); rates, bytes/recording, recordings/day declared per trigger in the same AUTHORITY set; sampled-out runs record a limitation; authority-denied triggers never shed silently | A corpus proves the rate it was drawn at; sampling must not read as absence | `lane-06:68-71,143-155`; `lane-02:130-135` |
| D13 | Legal hold and export (PO) | Append-only hold disposition admitted by an admission principal; while held, expiry and deletion-on-request refuse and record the refusal; exports are manifest + digests + claims + access audit; hold access narrower than D4 | Liability regimes outlive product decisions; erasure and I8 conflict must stay visible | `lane-06:77-92,132-137` |
| D14 | Non-repudiation target (PO) | Hash-linked attribution now; signed export/TSA is a spike only; no "non-repudiation" wording until signing and custody exist | No signatures or timestamp authority today; a hash is integrity relative to a trusted writer | `lane-06:165-184`; `lane-05:117-119` |
| D15 | Recorder home and horizon (PO+team) | One recorder inside the circuit-host observer process; rolling horizon 250 events/30 s/2 MiB; pinned caps 10,000 events/15 min/16 MiB; global 64 MiB/64 runs; restart mid-run is `LOST` unless R2.8 lands | Admission, event intake and W2.3 share the process; per-run buffers isolate from the global ring; zero SDA change | `lane-02:53-96,137-150`; `lane-06:203-209` |
| D16 | Recording claim model (PO) | Attach the sealed recording as observation evidence to C1 now; conformance as `ledger.verification` scope `run-trace:<digest>`; C3 ("recording sealed for T/W/digests") reserved and declared only with a W0.6 rule if independent review is required | D9 closes the vocabulary to C1/C2 until Phase 4; C3 would add a claim kind without a rule | `lane-03:110-131`; `lane-06:64-66`; `plan` §3 D9 |
| D-L1 | Declaration home and ownership (team) | One pair owns the names: `flight-trigger-vocabulary.v1` + `flight-window-geometry.v1` + one AUTHORITY set; G6.1 fields merge in; T1.4/S3.4 cite its digest; host `recorder.json` is delivery only, digest-checked, fail-closed | Avoids three competing declarations; D8 estate authority; L0 drift | `lane-01:55-94,169-191`; `lane-02:233-234`; `lane-06:43-52` |
| D-L2 | Migration 003 vs 002b (team) | New `003-recording` for the five tables and eight procedures; fold only the `run_trace_chunk` column correction (first/last cursor, record count, first/last at) into 002b before its freeze; the 002a/002b split itself is pending (`A/decisions` b)2) and F2.1 waits on that decision | 003 keeps 002b's preflight and freeze stable; the column correction is required for window resolution; the split is not settled by this plan | `lane-03:94-106,224-229`; `lane-05:181-184`; `A/decisions` b)2 |
| D-L3 | Manifest permanence and home (team) | First-class `evidence.recording` tables store the sealed manifest digest; `recordings[]` stays the wire payload on complete; no recording-local blob | A view cannot seal stably, scope evidence objects, survive purge, or carry declared geometry; corpus paging needs indexed rows | `lane-03:36-68`; `lane-02:236-240`; `lane-05:181-184` |
| D-L4 | Versioning and disable (team) | Append-only; a changed predicate/geometry is a new trigger or profile version or `.v2` set; `enabled:false` is a versioned disable; new trigger kinds need a product-owner decision | Suppression must be visible; I8/I10; R8 | `lane-01:88-94`; `lane-06:50-56` |
| D-L5 | Clock policy (team) | Cursor is order; prefer kernel timestamps, else host `at`, else observer `receivedAt`; each bound records `clockDomain`; skew over 2 s marks the bound `APPROXIMATE`, never reorders | API `at` is host append time; 0.4–1.3 s skew observed; R6 | `lane-01:114-118,162-167`; `lane-03:233-234`; `plan` R6 |
| D-L6 | Window composition default (PO) | `COMPOSITE` + union; v1 default before {100 events, 30 s}, after {50 events, 60 s}; intersection and other numbers are per-trigger profiles | The intent asks for the causal neighborhood, not a sample; lane-02's 250/30 s/2 MiB is the retention envelope | `lane-01:75-80,119-128`; §5.7 |
| D-L7 | Episode model (team) | One recording per run per seal with independent `triggerRefs`; **multiple triggers per recording** (overlap model); overlapping windows union pinned ranges; duplicate detections idempotent per `(recording_id,trigger_kind,anchor_cursor)`, enforced by `UNIQUE(recording_id,trigger_kind,anchor_cursor)`; per-trigger recordings rejected | Bounds pinned bytes and manifest count; per-trigger attribution retained so one recording can justify several claims | `lane-01:158-161`; `lane-02:126-128` |
| D-L8 | Restart resume (team) | Accept `LOST` for v1; land R2.8 only if continuity is required; F2.5's resume rendezvous is optional on this decision; adopted `run-end`-without-`run-start` recordings mark `startUnobserved` | The identity host is the only cross-restart state; promising continuity without R2.8 would be false | `lane-02:75-77,190-194,242-243` |
| D-L9 | Observe-only vs control (PO) | Record-only; triggers and DIVERGES never pause or gate execution | Avoids an implicit control loop from evidence; lane-04 decision 6 | `lane-04:117`; `lane-01:222` |
| D-L10 | Disclosure at match (PO) | Pre-window obeys per-capability disclosure before sealing; content defaults to `DIGEST`; content-bearing sealing is refused without the F3.3 scan | Prompts and responses can carry personal data; A3.3 does not exist today | `lane-01:224`; `lane-06:101-115` |

Carried lane decisions (C17): lane-02 #4 bridge envelope shape and pinned
wire-contract version (FQ11; F1.3 precondition), lane-01 #9 W0.2/E06
horizon-vs-retention (FQ12), lane-04 #5 HOLD/safe-state/envelope declarations
(FQ13), lane-05 #6/#9 OPEN-recording UI and A/B scope (FQ14).

## 4. Baseline

Short; details live in the cited documents, not re-derived here.

| Fact | Source |
| --- | --- |
| One circuit-host process owns pages, sessions, run proxy and observer; a 2,000-record global ring and in-memory per-run windows; SSE replays from the ring | `lane-02:19-35`; `A/README` |
| The observer bridge is lossy: `run.admitted` (cursor 1) is dropped and cursor/eventId/evidenceRef/kind never cross; A2.2 is blocked until enrichment | `lane-02:29-35`; `A/decisions` correction 7 |
| W2.3 already plans register, Brotli append, complete and C1 attach; outage must not change execution outcome | `lane-02:15,158-180`; `plan` §6 W2.3 |
| The identity host is the only DB credential holder; `002` does not exist and the CodeLightly DAL generator is external | `lane-03:17-33`; `A/decisions` external 1 |
| Meaning is authored as estate rows through the migration-pair lifecycle (dry-run, preflight-from-transaction, commit, install, verify); W0.6 is pending | `lane-06:20-32`; `plan` §6 W0.6 |
| The Explorer has Run/Runs/Evidence context tabs, a playback bar and `?run=` replay; W1.1–W1.4 are partially built in the worktree at `b9be6e8` | `lane-05:25-41` |
| Kernel budgets clip shapes (4,096 B payload, 65,536 B event, 524,288 B invocation); the 524,288 B `invocationByteBudget` latches `shapesSuppressed` (model records at cursor 556+; E05/B11), so run-evidence S3 must land before W3.2 content; one graph record is 615 KB; a 10k corpus ≈ 26.3 GB raw / ~0.6–0.85 GB Brotli / ~47 h | `lane-01:49-51`; `lane-02:49-51,152-156`; `A/decisions` correction 10 |
| `SDA_RUN_RETENTION` is unset (default 200 runs; `SDA_RUN_EVENT_RETENTION=20000`); a run evicted past 200 bounds backfill and corpus reads | `A/decisions` correction 5; `lane-01:49-51`; `lane-02:36-38` |
| References are post-kernel-filter records (E03 refs 252/205 B), not full content; the kernel strips undeclared shapes/`providerEvidence` before the host receives them; W0.3 must be sequenced after W0.4 re-declaration | `A/decisions` corrections 3, 17; `plan` B5 |
| `invoke-from-transaction.mjs` returns `[]` and surfaces no observations; W0.4/E08 needs a temporary SDA worktree probe | `A/decisions` correction 4; `invocation-boot.mjs:246-251` |
| The identity host has one service key today and serves only `/auth`; per-caller keys, Key Vault (3–7 calendar-day lead, order day 1) and TLS widening to `/ledger/v1` + `/evidence/v1` are new W2.2/W2.6 work | `A/decisions` correction 14, c)3; `lane-06:25-27,85-86` |
| Run GETs are public through the proxy today; owner-scoped reads and identical 404s do not exist and are new W2.3/W2.6 + F2.3 work | `A/decisions` correction 13 |
| No recording, trigger, window or corpus concept exists; `GET /v1/evidence/{ref}` is 501; HOLD is declared (`held:5`) with no live emitter | `lane-01:23-43`; `lane-02:46-48`; `lane-03:17-34` |

## 5. Target design

### 5.1 Declared triggers and window geometry (lane-01)

- **Declaration shape (proposed).** One `sfx-embody` migration pair declares
  `flight-trigger-vocabulary.v1` (operators, source-kind registry, triggers with
  deterministic match predicates) and `flight-window-geometry.v1` (profiles with
  before/after event+time, anchor, clock, bounds, sampling), plus one AUTHORITY
  set under `sidefx:authorities`. The install commit records
  `definition_digest`; every sealed recording stores `declaration_digest` and
  every triggerRef stores `{triggerId,triggerVersion,detectionDigest}` so a later
  declaration never rewrites a sealed window (`lane-01:55-94`).
- **Vocabulary v1 (proposed).** Active on today's lane data: `authority-denied`
  (contract admission reflected as `rejected` + `INPUT_REJECTED`/`OUTCOME_REJECTED`),
  `provider-failure`, `provider-switch` (derived ordered pair),
  `physical-effect-denied`, `latency-anomaly` (declared threshold),
  `experiment-scenario`. Declared-inert until emitters exist: `operator-required`
  (no live HOLD emitter), `trust-state-transition` (needs W2.1/W2.2),
  `retry-exhaustion` (no retry to exhaust) (`lane-01:96-112,227-236`).
- **Geometry.** Anchor `(cursor0, observedAt0)`; before start is the union
  (earliest) of event and time bounds, floor cursor 1; after end is the latest of
  the symmetric bounds unless run end or obligation timeout closes it earlier;
  intersection is a declared alternative. Defaults before {100 events, 30 s} /
  after {50 events, 60 s} per the intent; bounds `maxWindowEvents` 10,000,
  `maxWindowMilliseconds` 900,000, `maxWindowBytes` 16 MiB. **Profile-vs-envelope
  validation (C12).** Every profile's before bound must be ≤ the rolling
  envelope (250 events/30 s/2 MiB, lane-02); a declaration exceeding it is
  refused, and if a resolved window still exceeds retained bytes the range gaps
  and the recording seals `complete:false` + `NOT_OBSERVABLE`. A dropped range
  always records `windowGaps[]` and yields `complete:false` + `NOT_OBSERVABLE`
  (`lane-01:114-139`; `lane-02:141`).
- **Lifecycle.** `OPEN → ROLLING → PINNED → SEALING → SEALED`, side states
  `DISCARDED`, `ABORTED`, `LOST`; closure requires the after count and after
  time (optionally a terminal predicate); run end/timeout seals with
  `truncatedBy` + limitation; no silent seal (`lane-01:131-134,154-157`).
- **Evaluation.** Detection is pure, synchronous and re-evaluable; identical
  events + declaration digest yield the same `detectionDigest`; only declared
  fields and the declared kind registry are readable; a match records the fields
  used. No numeric trust, score or promotion (`lane-01:141-167`).
- **Delivery.** The circuit host reads the committed declaration through a
  declared read with a TTL cache; an uncommitted declaration is invisible; the
  delivered `recorder.json` carries a closed reference copy plus digest and is
  never the meaning; digest mismatch refuses activation and records
  `NOT_VERIFIED` (`lane-01:169-191`).

### 5.2 Recorder runtime (lane-02)

- **Placement.** One component: a recorder module inside the circuit-host
  observer process (`recorder.mjs` + `recorder-state.mjs` proposed), fed on the
  ingest path with exact `RunEvent` objects and per-run buffers keyed by
  `apiRunId`. The global 2,000-record ring is never a pre-trigger source. SDA
  API and kernel placements are rejected (D3 zero SDA change, no DB handle, no
  principal) (`lane-02:53-96`).
- **Rolling and pinning.** Every admitted raw event is appended with
  `{cursor, at, kind, bytes}`; the horizon retains until all three bounds are
  satisfied, then drops oldest and increments `windowGaps[]`. A match appends
  `triggerRef`; any open obligation pins the buffer; more matches merge into the
  pinned interval set; obligations close on follow events, follow time, run end,
  or a 300 s timeout (`lane-02:99-135`; `lane-01:141-161`).
- **Sealing.** At terminal run and all obligations closed, flush chunks, seal
  `[firstCursor,lastCursor]` and freeze the `flight-recording.v1` manifest:
  record count, chunk SHA-256 list, gaps, complete, limitations, sealedAt,
  digest. Re-sealing or rewriting is refused; a late trigger opens `index+1`
  (`lane-02:119-135`).
- **Bounds.** Rolling 250 events/30 s/2 MiB per run; pinned 10,000/15 min/16 MiB;
  global 64 MiB/64 runs with oldest unpinned eviction; outbox 32 MiB with
  store-and-forward; a single 615 KB graph record is one event and is never
  clipped (A2.2) (`lane-02:137-150`).
- **Durable interface (reuses W2.3).** Register at admission from the validated
  session (body never carries `principalId`); append Brotli chunks with
  `windowRef`, idempotent per `(runId, chunkIndex)`, 256 KiB raw target;
  complete with `recordings[]`; attach the sealed manifest to C1. The recorder
  adds rules, refs, the rolling store, manifests, sampling and the requirement
  that `run.admitted` joins the trace (`lane-02:158-180`).
- **Failure.** Lag over 1,000 events/2 s raises `RECORDER_LAG` and never blocks
  the bridge; missed triggers are backfilled from `/v1/runs/{id}/events`;
  restart mid-run is `LOST` (or resume via R2.8); outage keeps execution outcome
  and reconciles gaps idempotently; incomplete windows seal with explicit
  limitations, never as complete (`lane-02:182-200`).

### 5.3 Recording object model (lane-03)

- **First-class, not a view.** A recording is a sealed, ordered membership
  manifest over `run_trace_chunk` and `evidence_object`; it stores no bytes. A
  view cannot seal with a stable digest, scope objects, survive purge or carry
  declared geometry (`lane-03:36-68`).
- **Tables (proposed `003`).** `evidence.recording` (state
  `OPEN|SEALED|ABORTED`, `window_rule_digest`, `capture_policy_digest`,
  `manifest_digest`, seal columns null iff OPEN); `recording_window` (1:1
  geometry, resolved bounds, precision, snapping loss); `recording_trigger`
  (declared kind FK, anchor, `detection_json` + digest; multiple triggers per
  recording with `UNIQUE(recording_id, trigger_kind, anchor_cursor)` making
  duplicate detections idempotent); `recording_member` (ordinal, one home FK,
  copied content digest, record ordinals inside a chunk); `recording_grant` (D4);
  plus the `access_audit` extension and the tombstone rule. `manifest_digest` = SHA-256 over canonical
  NDJSON in ordinal order with a declared canonicalization version
  (`lane-03:47-68`).
- **Procedures.** `open_recording`, `record_trigger`, `seal_recording` (single
  guarded OPEN→SEALED transition, idempotent on request digest,
  `EVIDENCE_WINDOW_UNSATISFIED` until closure), `abort_recording`,
  `read_recording_for_principal`, `read_recordings_for_run`,
  `grant/revoke_recording_access`, and the amended `purge_content` (refuses
  while an OPEN recording references the content) (`lane-03:70-94`).
- **Claims.** v1 attaches the sealed recording as observation evidence to the
  run's C1 claim (`content_ref='recording:<id>'`, digest = manifest digest,
  polarity `SUPPORTS`); conformance is a `ledger.verification` with
  `scope='run-trace:<digest>'` and outcome `SATISFIED|VIOLATED|NOT_OBSERVABLE`.
  C3 and a `recording` subject kind are reserved under D16 (`lane-03:108-131`).
- **Immutability, retention, replay.** Rows insert-once with `DENY UPDATE,DELETE`
  to the runtime role and the one guarded seal transition; purge removes bytes
  and appends tombstones while rows and digests remain; replay re-derives the
  selection from retained digests and member rows, and purged content reports
  `NOT_OBSERVABLE` (`lane-03:133-152`).

### 5.4 Expected-vs-observed runtime verification (lane-04)

- **Expected descriptor.** A canonical serialized descriptor — run/capability
  version, graph digest, estate model, semantics/rule-set ids, transitions,
  routes, contract faces, cell functions, authority refs with digests, declared
  bounds, `unobservable[]` — stored as a content object with its digest. It is
  not a proof and contains no solver syntax (`lane-04:43-53`).
- **Nine questions mapped.** Q1 and Q3 (declared transitions; undeclared
  transitions) are partially decidable today (graph digest + 24-route coverage;
  membership only after the kernel-cell→estate-node join, F4.6). Q2 (authorized
  route) is `NOT_OBSERVABLE`: the route oracle exists, but the trigger vocabulary
  and retained per-run authority digests do not (B20). Q4–Q9 (authority change,
  effect envelope, operator-required, HOLD stop, safe state, evidence route) are
  `NOT_OBSERVABLE` until the corresponding declarations and retained per-run
  authority digests exist (`lane-04:29-41`).
- **Comparison operations and outcomes (proposed v1).** `membership`,
  `precondition_route`, `authority_stability`, `envelope`, `operator_rule`,
  `post_trigger_quiescence`, `terminal_state`, `evidence_route`,
  `completeness`. Mapping: CONFORMS→`SATISFIED`, DIVERGES→`VIOLATED`,
  `NOT_OBSERVABLE`, `INCONCLUSIVE`; results are scoped evidence, never a
  disposition or numeric promotion; DIVERGES keeps a refutation and/or
  limitation and is record-only (`lane-04:55-75`).
- **Producers.** `derive-expected-trace-descriptor.v1` in sfx-embody produces
  the descriptor; the recorder/W2.3 trace produces the observed side; the W2.4
  evaluator rule family `trace-conformance.v1` performs the comparison; the
  identity host persists `ledger.verification` and evidence links. The evaluator
  never writes dispositions (`lane-04:77-84`).

### 5.5 Evidence microscope UX (lane-05)

| View | Surface | Honest basis |
| --- | --- | --- |
| V1 Recording/trigger list | Run tab + `#recording-window` | `evidence.recording` via F2.3; before that, candidate recordings styled "derived, not declared, not sealed" |
| V2 Window timeline + trigger marker | extends `#invocation-timeline` | Resolved window, precision/snapping loss, phase spans, record-density buckets, retention census |
| V3 Causal neighborhood lanes | main column under V2 | One-pass classifier over records (identity, intent, inference, authority, trigger, disposition, recovery, outcome, other); `other` never dropped; intent stays `NOT_OBSERVABLE` (B4), authority is timing-only (B20), inference content withheld (B5/B13) (`lane-05:65`) |
| V4 Expected vs observed | `#expected-observed` | Declared deck vs `joinFlow` findings; F4 outcomes later |
| V5 Authority/envelope overlays | circuit canvas mode | Declared authority + receipt basis; undeclared shows `NOT_DECLARED` |
| V6 Dispositions and limitations | Evidence tab | Claim/scope/basis/limitations/history; fixture mode until W2.5/F2.3 |
| V7 Export bundle | Download action | `sfx-flight-recording-export.v1` manifest with per-record SHA-256; "browser capture; no ledger disposition" |
| V8 Sampling corpus | Runs mode + `#corpus` | Paged/filtered recordings and aggregates; sampling rate and sampled-out counts as limitations |

Rules: `?run=` remains the only run identity (extended with `rec`, `trigger`,
`from/to`, `cmp`, `corpus`); missing/partial windows show requested vs retained
counts and hatching, never clamping; `NOT_OBSERVABLE` is first-class amber, never
red/green; clock skew names the anchored clock and never subtracts unrelated
clocks; ambiguous parallel runs hold and show candidate owners only; no blanket
trust badges; DOM lists cap at 200 rows with virtualization; corpus never
renders a 10k-row client array (`lane-05:72-128`). The live recording list lands
as F5.1 wiring; lane-03 S3.5 is not duplicated (`lane-05:91-93,227-228`).

### 5.6 Assurance, governance and operations (lane-06)

- **Authority.** Estate declares; admission principal activates with the
  trigger-set digest in `ledger.admit`; disable/widen is a new admitted version;
  the recorder never admits its own trigger set (D11; `lane-06:43-56`).
- **Access.** Runner-only by default (D4); identical 404 for non-owners and
  non-grantees is **new work** (run GETs are public through the proxy today;
  owner-scoped reads land with W2.3/W2.6 + F2.3); export narrower than read and
  audited. **Keys and TLS.** One service key and `/auth`-only TLS exist today;
  per-caller service keys in Key Vault (3–7 calendar-day lead, order day 1) and
  TLS widening to both `/ledger/v1` and `/evidence/v1` are new W2.2/W2.6 work;
  principals always resolve from a host-validated session (`lane-06:74-92`;
  `A/decisions` corrections 13, 14).
- **Privacy and redaction.** Never stored: credential-shaped values and the 20
  `deniedMembers`, login/enrollment bodies, private inputs, other principals'
  content, content beyond the declared disclosure class. Content defaults to
  `DIGEST`; pipeline kernel redaction → store-side A3.3 scan (absent today) →
  disclosure filter → scan digest → seal; a failed or missing scan refuses the
  seal and records `NOT_VERIFIED`; the horizon holds plaintext in bounded memory
  only, stripped of denied members, never logged or written to disk before
  sealing (`lane-06:94-115`).
- **Retention and hold.** 90-day content, tombstones forever, deletion on
  request; expiry is a controlled procedure, never a direct DELETE; legal hold
  outranks deletion and refusal is recorded; replay reports `NOT_OBSERVABLE`
  after purge with missing refs (`lane-06:117-137`; `A/decisions:112`).
- **Cost.** Horizon memory ≈ bytes × concurrency (2 MiB × 8 runs ≈ 16 MiB) with
  615 KB graph spikes; 10k recordings ≈ 850 MB per campaign; 10k/day at 85 KB
  over 90 days ≈ 76 GB before indexes; post-W3.2 content bytes are unmeasured and
  W0.4's preflight cannot observe today (`invoke-from-transaction.mjs` returns
  `[]`; E08 needs a temporary SDA worktree probe); Azure SQL tier and write
  latency are unmeasured (W0.5); R1 may force a schema move (`lane-06:139-163`;
  `A/decisions` correction 4).
- **Non-repudiation honesty.** Identity PARTIAL, authorization DESIGNED,
  execution DESIGNED-NOT-BUILT, auditability DESIGNED, verification/formal
  assurance ASPIRATIONAL; attribution is hash-linked, not signatures, and the
  writer can be compelled. Reference-monitor status: mediation PARTIAL,
  non-bypassability NOT SUPPORTED, tamper resistance DESIGNED (application roles
  only, DBAs can change rows), small enough NOT SUPPORTED (`lane-06:165-184`).

### 5.7 Reconciled lane conflicts

| Conflict | Resolution | Why |
| --- | --- | --- |
| Recorder placement: lane-02 "circuit host observer" vs lane-03 S3.2 "circuit-host recorder" vs lane-06 G6.3 | One component and one work-item set: R2.1+R2.2+G6.3-horizon → F1.3 (horizon/matcher/bridge); R2.3+S3.2+G6.3-seal → F2.2 (durable open/seal) | They name the same process; splitting them would duplicate state ownership. Admission, event intake and W2.3 already share the circuit host; SDA/kernel placements stay rejected |
| Horizon numbers: lane-02 250 events/30 s/2 MiB vs lane-01 composite 100 before/50 after/30 s/60 s | Recommended v1 default = lane-01 `COMPOSITE` profile before {100, 30 s}, after {50, 60 s}; lane-02's 250/30 s/2 MiB is the **rolling retention envelope**, which must cover the profile's before bound; other figures are per-trigger profiles with declared bounds | The two numbers describe different objects (budget vs selection); the window asks for the causal neighborhood, the envelope protects memory |
| Storage migration: new 003 vs fold into 002b | New `003-recording` (D-L2); only the `run_trace_chunk` column correction folds into 002b before its freeze | 003 keeps 002b's preflight and freeze stable; the correction is needed either way for window resolution |
| Claim model: lane-03 no C3/C4 now vs lane-06 proposed C3 | Attach-as-evidence now (D16): recording attaches to C1 as observation, conformance as a `ledger.verification` scope; C3 reserved and only declared with a W0.6-compliant rule | D9 closes the vocabulary; a trigger occurrence is not a disposition; independent review can reopen C3 |
| Trigger declaration home: lane-01 estate authority + delivery vs lane-02 host `recorder.json` fallback | Estate authority with digest-bearing delivery (D-L1); host config is a delivery envelope only and a digest mismatch fails closed | Zero implicit authority: host config cannot author meaning; the fallback would make drift invisible |
| Manifest home: lane-02 `evidence_object` + `recordings[]` vs lane-03 first-class tables | First-class `evidence.recording` tables (D-L3); `recordings[]` stays the complete-call wire payload | Sealed digest stability, evidence-object scope, purge semantics and corpus paging need indexed rows |

## 6. Sequencing, phases and work items

Sizes are lane-derived rough estimates; the team sizes the work. Every item
names its run-evidence W/S dependencies. `S1–S3` below are the run-evidence
**SDA requests**, not lane-03's `S3.x` storage items.

### 6.0 Sequencing against the run-evidence 3 turns (C01)

The run-evidence analysis fixes the horizon (`A/README:54-61`;
`A/synthesis:50-76`): T1 = Phase 0 freeze/spikes + Phase 1 Explorer; T2 = Phase 2
ledger core, gated by the external CodeLightly DAL regen; T3 = Phase 3 content/C2;
Phase 4/5 do not fit. The F scheme maps onto that horizon; **no F3+ work is dated
until S1–S3 land**, and every deferred gate files a dated receipt
(`deferred-<gate>.json`; `A/gates:29-31`).

| Flight phase | Run-evidence horizon | Entry condition | Deferral |
| --- | --- | --- | --- |
| F0+F1 (fixture-first) | inside/near T1 (Phase 0/1) | W0.1 sign-off; E03/E04/`capture.sse` fixtures; local gates only | FR1.10 re-scoped to the spike trace until W2.3/W2.2 or the frozen stub lands (C11) |
| F2 (durable recordings) | post-T2 critical path: external CodeLightly DAL regen → 002a install → W2.2 real → W2.3 e2e; KV keys 3–7 calendar-day lead (order T1 day 1); W2.1–W2.3 | W0.6 digest frozen; 002 split, admission table and bridge envelope decided; DAL checkout + KV keys (or dev fallback); W0.5 waived or measured | A2.4/A2.5-staging/A2.6-final and staging FR2.4/FR4.5 receipts; first re-check at T3 exit |
| F3 (content/provider triggers) | post-T3 (analysis: Phase 3 ≈25–40% by T3) | S1 live; S3 must land with W3.2; W0.3 sequenced after W0.4 re-declaration | dated deferral receipts; first re-check when S1–S3 land (provisional T3 exit ≈ 2026-11-03) |
| F4 (expected-vs-observed) | post-T3; Phase 4 entry needs staging L0–L10 + per-producer fixtures | W2.4 evaluator and W0.6 rules local; Q8 status recorded | F4.7 filed deferred (first re-check at Phase 4 entry) |
| F5 (microscope/corpus/ops) | post-T3; W5.1–W5.3 are not delivered in 3 turns | F5.9 corpus read contract; W5.1 retention for corpus | F5.7 filed deferred (first re-check at Phase 4 entry) |

Phase-exit gate **FR0.3** enforces this: a phase may pass only with its
run-evidence entry conditions green or dated deferral receipts, and phase-exit
claims cite non-stub receipts only. Per-phase effort totals and the capacity
comparison are at the end of §6.

### F0. Freeze decisions and recorder spike (fixture-driven)

| ID | Work | Repo | Produces | Deps (W/S + lane) | Rough size |
| --- | --- | --- | --- | --- | --- |
| F0.1 | Record D11–D16 and the lane decisions in this file; PO sign-off that the run-evidence §2 model still closes | docs | Decision log (this revision) | `plan` W0.1; `A/decisions` | 0.5 d |
| F0.2 | Fixture-driven recorder spike: replay E03/E04/`capture.sse` through a prototype matcher/roller; validate horizon, pin union, saturation gaps, sampling-only markers | sfx-platform | Spike receipt; confirmed semantics for F1 | No W/S dependency by design; lane-01, lane-02; fixtures E03/E04/`capture.sse` | 1–2 d |

**F0 total: 1.5–2.5 d.**

### F1. Declared trigger vocabulary and recorder core on today's stack (no identity dependency)

| ID | Work | Repo | Produces | Deps (W/S + lane) | Rough size |
| --- | --- | --- | --- | --- | --- |
| F1.1 | One declaration pair: `flight-trigger-vocabulary.v1` + `flight-window-geometry.v1` + AUTHORITY set with G6.1 fields; fixtures; digest readback | sfx-embody | Declared vocabulary, window profiles, digest | `plan` W0.6 conventions (D8); lane-01 T1.1; lane-06 G6.1; lane-03 S3.4 merged | 3–5 d |
| F1.2 | Digest-bearing declaration delivery + reader (R2.4 as loader); pure matcher with detection digests (T1.2); window resolution and obligation closure (T1.3) | sfx-platform | `recorder.json` delivery contract, matcher, window resolver | F1.1; lane-01 T1.2/T1.3; lane-02 R2.4; `plan` W2.3 envelope for the live path | 4–6 d |
| F1.3 | Recorder core: state machine, rolling/pin/seal candidate, trigger evaluation; profile-vs-envelope validation (C12); exact-event bridge enrichment incl. `run.admitted` | sfx-platform | `recorder.mjs`, `recorder-state.mjs`, enriched `api-host.mjs`/`api.mjs` | F1.2; lane-02 R2.1/R2.2; lane-06 G6.3 horizon part; `plan` W2.3 schema freeze note; **pinned bridge wire-contract version + lane-02 #4 envelope-shape decision (FQ11)** | 4–6 d |
| F1.4 | Backfill re-evaluation over `/v1/runs/{id}/events` with retention gaps → `PARTIAL`/`NOT_OBSERVABLE`; retention-feasibility check against `SDA_RUN_RETENTION`/E06 (>200-run eviction) | sfx-platform | Backfill path + retention check + receipts | F1.2; lane-01 T1.7; `plan` W2.3; **`plan` W0.2/E06** | 1–2 d |
| F1.5 | Local verification: `verify-flight-trigger.mjs` (T-1..T-7), drift check, fixture receipts; FR1.10 runs against the spike-local trace | sfx-platform | Gate receipts FR1.x | No W/S dependency for the spike-local trace (fixture/local); the `verify-run-evidence.mjs` (A2.2) slice is deferred until W2.3/W2.2 or the frozen stub (C11); F1.1–F1.4; lane-01 T1.6; lane-02 R2.5/R2.6 local slices | 4–6 d |

**F1 total: 16–25 d** (near-term, T1).

### F2. Durable recordings (entry: post-T2 critical path — external CodeLightly DAL regen, KV keys 3–7 d, W0.6 digest frozen, W2.1–W2.3 in place; see §6.0)

| ID | Work | Repo | Produces | Deps (W/S + lane) | Rough size |
| --- | --- | --- | --- | --- | --- |
| F2.1 | `003-recording`: five tables, eight procedures, grants/checks, tombstone/purge amendment; fold the `run_trace_chunk` column correction into 002b before freeze | sfx-dal | Migration pair + preflight/install/idempotence receipts | `plan` W2.1 (002b); `plan` W0.6; lane-03 S3.1; lane-03 column correction; **002a/002b split decision (`A/decisions` b)2, pending)** | 3–5 d |
| F2.2 | Durable recorder streaming: chunk append with `windowRef`, outbox/retry, `recordings[]` on complete, open/seal/abort calls, C1 attach | sfx-platform | Durable open/seal path | F2.1; F1.3; **F2.3 or the pinned swap-safe stub contract (`A/gates` §3; lane-03 critical path S3.1→S3.3→S3.2)**; `plan` W2.2/W2.3; lane-02 R2.3; lane-03 S3.2; lane-06 G6.3 seal part; **circuit-host/evaluator service-key registration (W2.2 registry; KV order day 1)** | 5–8 d |
| F2.3 | Identity-host recording routes and DAL binding; host tests (owner/grantee 404s, limits) | sfx-providers | `POST /evidence/v1/recordings`, seal/abort, reads, grants | F2.1 (regen); `plan` W2.2; **`plan` W2.3/W2.6 owner-scoped run GETs (public through the proxy today; correction 13)**; service-key registration; lane-03 S3.3 | 2–3 d |
| F2.4 | Vocabulary seed/FK in 002a and window/detection columns; declaration-digest readback route | sfx-dal + sfx-providers | Seeded vocabulary, digest readback | F1.1; F2.1; `plan` W2.1; lane-01 T1.4 | 1–2 d |
| F2.5 | Health/limits counters (`RECORDER_LAG`, saturation, unconfirmed persistence) and resume rendezvous (list open registered runs; **optional per D-L8** — land R2.8 only if continuity is required); resume/backfill re-reads `/events` only while retained | sfx-platform + sfx-providers | Observability + optional resume | F2.2; `plan` W2.2/W2.3; `plan` W0.2/E06 retention bound; lane-02 R2.7/R2.8 | 1.5–2.5 d |
| F2.6 | Durable verification: `verify-recording.mjs` membership/replay/tombstone plus staging byte-fidelity and restart slices | sfx-platform | Gate receipts FR2.x | F2.1–F2.3; `plan` W2.2; lane-03 S3.6; lane-02 R2.6 | 4–5 d |
| F2.7 | Trigger-set subject/claim, version pinning and admit guard through `ledger.admit` | sfx-dal (+ route via F2.3) | Admission of a declared trigger set | `plan` W2.1; `plan` D10; F1.1; lane-06 G6.2 | 2–3 d |

**F2 total: 18.5–28.5 d** (post-T2 critical path; staging gates deferred).

### F3. Content and provider triggers (post-T3; entry: S1 live; W3.1; W3.2 with run-evidence S3; W0.3 after W0.4 re-declaration; no F3 dates until S1–S3 land)

| ID | Work | Repo | Produces | Deps (W/S + lane) | Rough size |
| --- | --- | --- | --- | --- | --- |
| F3.1 | Activate content triggers (`provider-failure`, `provider-switch`, `physical-effect-denied`) over re-declared shapes; readable stage/status fields | sfx-platform + sfx-embody | Content trigger matches on live data | `plan` S1/S3 + W3.1/W3.2; **W0.3 after W0.4 re-declaration**; F2.2; lane-01 T1.5 | 2–3 d |
| F3.2 | HOLD/operator-required emitter and exact authority-admission outcome request (csharp-first) | sfx-embody (request) → SDA | Filed request; emitter when accepted (gate FR3.5) | `plan` S2 (owner identity); `plan` W3.2; lane-01 T1.5 | req 0.5–1 d; SDA 2–5 d |
| F3.3 | Store-side redaction scan (A3.3), disclosure enforcement, seal refusal + scan digest | sfx-providers + sfx-platform | Gate that content never seals unscanned | F2.2; `plan` S3/W3.1/W3.2 (512 KB latch); lane-06 G6.4 | 3–5 d |
| F3.4 | Provider-switch attribution using real owner `cellExecutionId` | SDA request + sfx-platform | Corrected nested model attribution | `plan` S2; F3.1; lane-04 B13 risk | owner swap 1–2 d; node/python parity 2–4 wk separate |

**F3 total: 6.5–11 d platform + SDA request time** (F3.2 req 0.5–1 d + SDA 2–5 d; F3.4 owner swap 1–2 d; parity 2–4 wk separate). Post-T3.

### F4. Expected-vs-observed verification (post-T3 / Phase 4 entry; entry: W2.4 evaluator and W0.6 rules; Q8 status recorded)

| ID | Work | Repo | Produces | Deps (W/S + lane) | Rough size |
| --- | --- | --- | --- | --- | --- |
| F4.1 | `trace-expectation.v1` contract + `derive-expected-trace-descriptor` pair; requirements spec for HOLD, safe state, effect envelope | sfx-embody | Descriptor schema + digest; declaration requirements | `plan` W0.6/W2.4; F1.1; lane-04 V4.1/V4.5 | 2–4 d |
| F4.2 | `trace-conformance.v1` evaluator rule family and fixtures | sfx-embody | Comparison rules | `plan` W2.4/W2.1; F4.1; lane-04 V4.2 | 2–4 d |
| F4.3 | Comparison fixtures from E03/E04/`capture.sse`; L7/L10 receipts | sfx-embody + sfx-dal | Fixtures + receipts | F4.2; `plan` W2.1; F2.2; lane-04 V4.3 | 2–4 d |
| F4.4 | `verify-trace-conformance.mjs` gate (local + `--staging`) | sfx-platform | Gate receipts FR4.x | F4.2/F4.3; `plan` W2.2; lane-04 V4.4 | 2–3 d |
| F4.5 | Recorder integration: observed window → comparison → ledger; end-to-end staging replay | sfx-platform + sfx-embody | One triggered run's conformance conclusion | F4.4; F2.2; `plan` S1 + S3/W3.2 (shape budget) + W2.1/W2.2; lane-04 V4.6 | 3–5 d |
| F4.6 | Declared kernel-cellId ↔ estate-node join (observable mapping); honest label `source-cited` | SDA request + sfx-embody | Join declaration | SDA request; no W/S dependency; lane-04 V4.7 | 3–5 d, SDA lead |
| F4.7 | **Post-3-turn (Phase 4).** Link expectation provenance to W4.4 proof obligations (proof-backed vs presence-checked); deferral receipt filed, first re-check at Phase 4 entry | sfx-embody | Provenance field + fixtures | `plan` W4.4; Q8; lane-04 V4.8 | 1–2 d (excluded from near-term total) |

**F4 total: 14–25 d** near-term (F4.6 is SDA-led); **F4.7 (1–2 d) deferred post-3-turn and excluded.**

### F5. Microscope at scale, sampling corpus and operations (post-T3; entry: W2.5/W3.3; F5.9 corpus read contract; W5.1 retention for corpus)

| ID | Work | Repo | Produces | Deps (W/S + lane) | Rough size |
| --- | --- | --- | --- | --- | --- |
| F5.1 | Window model + timeline + causal lanes; live recording list wiring (absorbs lane-03 S3.5) | sfx-platform | `recording-model.mjs`, `recording-window.js`, lanes | W1.2 (in flight, `b9be6e8`; interface-only in the fixture-first slice — live wiring gated on its completion); capture fixtures; F2.3 for live; lane-05 U5.1/U5.2; lane-03 S3.5 | 4–6 d |
| F5.2 | Recording list, Run tab and `?run=&rec=` deep links | sfx-platform | V1 list + deep link round-trip | F5.1; W1.1/W1.4 (in flight; interface-only as above); F2.3; lane-05 U5.3 | 1–2 d |
| F5.3 | Expected-vs-observed pane (`#expected-observed`) | sfx-platform | Structural pane + F4 outcomes | F5.1; W1.3 (in flight; interface-only as above); F4.2; lane-05 U5.4 | 2–3 d |
| F5.4 | Authority/envelope overlay modes and dispositions/limitations panel | sfx-platform | V5, V6; stale/historical banner; no global badge | F5.1; F1.1/F4.1 for envelope; `plan` W2.5/W2.2; F2.3; lane-05 U5.5/U5.6 | 4.5–6.5 d |
| F5.5 | Export bundle (`sfx-flight-recording-export.v1`) and sampling corpus view | sfx-platform | V7, V8 | F5.1; F2.3; **F5.9 corpus read contract**; `plan` W5.1; lane-05 U5.7/U5.8 | 5.5–8 d |
| F5.6 | Microscope gates and honesty/volume pass | sfx-platform | FR5.1–FR5.8 receipts; labels, holds, virtualization, aria | No W/S dependency beyond the UI surfaces above; lane-05 U5.9/U5.10 | 5–8 d |
| F5.7 | **Post-3-turn (Phase 4+; W5.x is not delivered in 3 turns).** Governance operations: grants/owner-only reads/export/legal hold, purge/tombstone procedures, operating views and alerts; deferral receipt filed, first re-check at Phase 4 entry | sfx-providers + sfx-dal + sfx-platform | G6.5/G6.6/G6.7 | `plan` W2.2/W2.6/W5.1/W5.2/W5.3; F2.1; lane-06 | 10–16 d (excluded from near-term total) |
| F5.8 | Non-repudiation spike: export signing/TSA options, cost, exact claim wording | sfx-platform | D14 input + wording | No W/S dependency; D14; lane-06 G6.8 | 1–2 d |
| F5.9 | **Corpus read contract (named work item; C-missing).** Paged/filtered recordings + aggregate read (`read_recordings_page`, sampling fields), ownership per FQ6 | sfx-providers + sfx-dal | Contract + route or procedure + fixtures | F2.3; F2.1; `plan` W2.2; **prerequisite to F5.5** | 2–3 d |

**F5 total: 23–35.5 d** near-term; **F5.7 (10–16 d) deferred post-3-turn and excluded.**

**Effort roll-up and capacity (C14).** Near-term F0–F2 ≈ 36–56 eng-days; F3
≈ 6.5–11 platform days plus SDA time; F4 ≈ 14–25 days; F5 ≈ 23–35.5 days
(F5.9 included). Total F scheme ≈ 90–150 eng-days. The run-evidence verification
lane is 26–38 eng-days across T1–T3 (two engineers for 3×5-day turns; one
engineer ≈ 6 turns; `A/gates:97-110`) — this scheme is roughly 2–4× that
capacity — so only F0/F1 are near-term; F2 rides the post-T2 external critical
path and F3+ are post-T3 by construction.

### 6.7 Traceability: every lane ID to the F scheme

| Lane | Mapping |
| --- | --- |
| lane-01 (T1.x) | T1.1→F1.1; T1.2→F1.2; T1.3→F1.2; T1.4→F2.4; T1.5→F3.1+F3.2; T1.6→F1.5; T1.7→F1.4 |
| lane-02 (R2.x) | R2.1→F1.3 (prototype F0.2); R2.2→F1.3; R2.3→F2.2; R2.4→F1.2; R2.5→F0.2; R2.6→F1.5+F2.6; R2.7→F2.5; R2.8→F2.5 |
| lane-03 (S3.x) | S3.1→F2.1; S3.2→F2.2; S3.3→F2.3; S3.4→F1.1; S3.5→F5.1; S3.6→F2.6 |
| lane-04 (V4.x) | V4.1→F4.1; V4.2→F4.2; V4.3→F4.3; V4.4→F4.4; V4.5→F4.1; V4.6→F4.5; V4.7→F4.6; V4.8→F4.7 |
| lane-05 (U5.x) | U5.1→F5.1; U5.2→F5.1; U5.3→F5.2; U5.4→F5.3; U5.5→F5.4; U5.6→F5.4; U5.7→F5.5; U5.8→F5.5; U5.9→F5.6; U5.10→F5.6 |
| lane-06 (G6.x) | G6.1→F1.1; G6.2→F2.7; G6.3→F1.3+F2.2; G6.4→F3.3; G6.5→F5.7; G6.6→F5.7; G6.7→F5.7; G6.8→F5.8 |

Merged to avoid duplication: T1.1+G6.1+S3.4 = F1.1 (one declaration pair);
R2.1+R2.2+G6.3-horizon = F1.3; R2.3+S3.2+G6.3-seal = F2.2; S3.5 = F5.1 live
slice. Nothing in the six lane documents is left unmapped.

## 7. Verification gates

Gate IDs are new (`FRn.m`); the source column names the lane gate or check they
normalize. Every gate produces a retained receipt with gate, tool + digest,
commit, host, inputs + digests, measurements, threshold, verdict and timestamps.

Receipt conventions (from `A/gates` §3–4):

- `FR/` = `docs/sfx-flight-recording/evidence/<gate>-<yyyymmdd>.json` (local and
  harness; lane-05's convention extended).
- `R/` = `deploy/run-evidence/<gate>-acceptance-<yyyymmdd>.json` (staging).
- `D/` = `sfx-dal/identity/verification/` (the `001` convention).
- Stub-era receipts pin `{contract_version, fixture digests, subject digests,
  rule_digest, stub:true}`; real-endpoint swaps re-run identical fixtures and
  emit a superseding receipt via lineage — stub receipts are never edited.
- Every deferred gate files `deferred-<gate>.json` with reason, owning lane and
  first re-check date.

| Gate | Passes when | Producing tool | Receipt | Local / staging | Source |
| --- | --- | --- | --- | --- | --- |
| FR0.1 | D11–D16 and lane decisions recorded; run-evidence §2 re-confirmed closed | review of this file | decision log in this revision | local | `plan` W0.1 |
| FR0.2 | Fixture replay resolves identical bounds and detection digests twice; horizon coverage, pin union, saturation gaps visible | prototype `verify-recorder-window.mjs` | `FR/FR0.2-<date>.json` | local | lane-02 R2.5 |
| FR0.3 | **Phase-exit (C01).** F2 passes only with the run-evidence T2 entry conditions; F3/F4/F5 only with T3/Phase 4 entry (S1–S3, staging L0–L10, per-producer fixtures) or dated deferral receipts; phase-exit claims cite non-stub receipts only | review of receipts + `deferred-<gate>.json` | this file + `R/deferred-*.json` | local | `A/gates:21-31`; `A/synthesis:79-92` |
| FR1.1 | Declaration digest readback equals the install receipt; drift mismatch fails closed | `verify-flight-trigger.mjs` | `FR/` | local | T-1 |
| FR1.2 | E03/E04/`capture.sse` seq 336/E01 match declared triggers; two runs give the same `detectionDigest`; unknown kind/field refuses load | same | `FR/` | local | T-2 |
| FR1.3 | EVENT/TIME/COMPOSITE, union vs intersection, cursor-1 floor, run-end truncation; resolved bounds equal declared rules; profile before bound ≤ rolling envelope or the range gaps with `complete:false` + `NOT_OBSERVABLE`; dropped ranges always in `gaps[]` | same | `FR/` | local | T-3; C12 |
| FR1.4 | Closure requires count and time; run end/timeout seals `complete:false` with limitations; no seal without closure | same | `FR/` | local | T-4 |
| FR1.5 | Two distinct triggers in one run merge into one recording with both refs and union pinned range; a duplicate detection of the same `(recording_id,trigger_kind,anchor_cursor)` is a no-op; per-trigger recordings are refused | same | `FR/` | local | T-5; C02 |
| FR1.6 | Mixed clock domains never reorder; skew over tolerance marks `APPROXIMATE`; the window still resolves | same | `FR/` | local | T-6 |
| FR1.7 | `operator-required`, `trust-state-transition`, `retry-exhaustion` surface as `NOT_OBSERVABLE`, never false positives | same | `FR/` | local | T-7 |
| FR1.8 | Recorder unit/load: E03/E04 replay ×100, memory ≤ global bound, `RECORDER_LAG` clean | fixture harness | `FR/` | local | R2.1/R2.5 |
| FR1.9 | Backfill over `/events` inside retention gaps yields `PARTIAL`/`NOT_OBSERVABLE` | `verify-flight-trigger.mjs` | `FR/` | local | T1.7 |
| FR1.10 | Recorder-spike trace fidelity: bound cursor equals the fixture `latestCursor`; every spike chunk SHA-256 verifies. **Re-scoped (C11):** the `verify-run-evidence.mjs` A2.2 slice is deferred until W2.3/W2.2 or the frozen stub lands | spike harness; A2.2 slice deferred | `FR/` | local | R2.6/A2.2; `A/gates` §3 |
| FR1.11 | **Horizon hygiene (C-missing).** Denied members stripped on ingest; horizon plaintext bounded, scrubbed at window close, never logged or persisted before seal | fixture harness + memory witness | `FR/` | local | `lane-06:109-111` |
| FR2.1 | DAL preflight: seal digest equality and idempotence; member insert after seal refused; unknown trigger kind refused; purge refused while OPEN | `003` preflight, rollback | `D/003-recording-*.json` | local | S3.1 |
| FR2.2 | Membership equals the declared window; recomputed manifest equals stored; purge leaves tombstone + `NOT_OBSERVABLE` | `verify-recording.mjs` | `FR/` then `R/` | local, then staging | S3.6 |
| FR2.3 | `trace_records` equals API latest cursor; decompressed chunks byte-identical to `/events`; SHA-256 verifies | `verify-recording.mjs` | `FR/`, `R/` | local, then staging | R2.6/A2.2 |
| FR2.4 | Second principal gets identical 404 for list, read, trace and claims (new scope: run GETs are public today); recorder calls carry registered circuit-host/evaluator service keys | host tests + live test | `R/` | staging (deferred receipt until staging access lands) | S3.3/A2.4; `A/decisions` correction 13 |
| FR2.5 | Observer-only kill resumes or records `LOST`; container restart never invents continuity | restart harness | `FR/` | local (staging deferred) | R2.8 |
| FR2.6 | Storage 503 leaves execution outcome unchanged; gaps reconcile on recovery; no invented completion | fault harness | `FR/` | local | R2.6/A2.8 |
| FR2.7 | Only an admission principal activates a trigger set; version pinned; prior versions remain readable | procedure/host fixtures | `FR/` | local | G6.2 |
| FR2.8 | Estate digest equals host copy, seeded digest and each recording `declaration_digest` | drift check | `FR/` | local | T-1/L0 |
| FR3.1 | Zero denied members and zero credential-shaped values in stored content and traces | A3.3 scan | `FR/` | local | G6.4/A3.3 |
| FR3.2 | Content triggers match the E07/E08 fixtures; stage/status facts readable | `verify-flight-trigger.mjs --content` | `FR/` | local | T1.5 |
| FR3.3 | Provider-switch attribution uses the real owner `cellExecutionId`, not the projected id | fixtures + live | `FR/` | local, staging after S2 | S2/B13 |
| FR3.4 | A failed or missing redaction/disclosure scan refuses the seal and records `NOT_VERIFIED` | seal-refusal fixtures | `FR/` | local | G6.4 |
| FR3.5 | **HOLD/authority-admission emitter (C-missing, tied to F3.2).** `operator-required` matches only when the live SDA emitter exists; otherwise `NOT_OBSERVABLE`; the exact admission-outcome request's stage/status is readable | `verify-flight-trigger.mjs --hold` + SDA request receipt | `FR/` | local, staging after S2 | F3.2/FR1.7; lane-01 T1.5 |
| FR4.0 | Descriptor derivation deterministic and digest-exact for the twin and anchor; unobservable list explicit; no solver syntax | `verify-trace-conformance.mjs` | `FR/` | local | V4.0 |
| FR4.1 | Comparison reproduced twice with identical outcome on E03, E04 and `capture.sse` run 849 | same | `FR/` | local | V4.1 |
| FR4.2 | Planted divergence (undeclared transition, post-HOLD dispatch, authority-digest change) yields DIVERGES with cursor, refuting link and limitation; no promotion | same | `FR/` | local | V4.2 |
| FR4.3 | Missing descriptor/identity/trace range yields `NOT_OBSERVABLE` + limitation | same | `FR/` | local | V4.3 |
| FR4.4 | Identical retained basis replays to the same outcome; purged fixture yields `NOT_OBSERVABLE` | same | `FR/` | local | V4.4 |
| FR4.5 | Live descriptor + recorder trace + `ledger.verification` replayable after restart; route resolves or is a visible limitation | staging acceptance | `R/` | staging only (deferred receipt; first re-check at Phase 4 entry) | V4.5 |
| FR4.6 | Join labels are `source-cited`, never `PROVEN`; unmapped cells stay unobservable | descriptor fixtures | `FR/` | local | V4.7 |
| FR5.1 | Window bounds equal a manual slice; trigger marker cursor/timestamp exact; retention/snapping limits shown | `verify-recording-model.mjs` | `FR/` | local | U5.1 |
| FR5.2 | Stage partition covers every fixture record exactly once with the stage counts summing to `trace_records`; `other` and `NOT_OBSERVABLE` visible | same | `FR/` | local | U5.2 |
| FR5.3 | Run list ↔ recordings ↔ `?run=&rec=` deep link round-trips; step/band selection seeks and selects; ambiguous capture held | `verify-run-evidence-browser.mjs` extension | `FR/` | local | U5.3 |
| FR5.4 | Expected set equals declared deck; observed equals `joinFlow`; compare disabled when ambiguous | `verify-expected-observed.mjs` | `FR/` | local | U5.4 |
| FR5.5 | Every authority/envelope state cites a receipt basis; undeclared shows `NOT_DECLARED` | browser gate extension | `FR/` | local | U5.5 |
| FR5.6 | Dispositions render claim/scope/basis/limitations; stale banner; no entity-global badge | `verify-dispositions-panel.mjs` | `FR/` | local | U5.6 |
| FR5.7 | Manifest digests recompute over exported NDJSON; limitations present; no ledger claim in the bundle | `verify-recording-model.mjs` | `FR/` | local | U5.7 |
| FR5.8 | Corpus page ≤ page size; filters from declaration; sampled-out counts; A/B excludes ambiguous | `verify-corpus-view.mjs` | `FR/` | local | U5.8 |
| FR5.9 | Hold refuses expiry/deletion and records refusal; purge leaves tombstones; every read/export audited; ops alerts link to recording/tombstone, not raw content | governance fixtures + W5.3 views | `FR/` then `R/` | local, staging later | G6.5/G6.6/G6.7 |
| FR5.10 | Export/UI wording is "hash-linked attribution; no signatures"; signing stays a spike | wording review + spike receipt | `FR/` | local | G6.8 |

## 8. Honest limits: what this plan does not claim

- **Parity is open.** Cross-language testimony differs (8/112/5 on the resolved
  branch). One runtime's comparison is never cross-language conformance, and
  `CROSS_VERIFIED` stays unavailable until Q7 defines independence
  (`lane-04:121`; `plan` B23).
- **Topology is violated.** One cyclic capability remains; the installed
  29-entry profile yields 6 refuse + 1 warn (zero only on the pre-U1 22-dim
  slice), so no receipt may claim zero topology violations
  (`A/decisions` correction 2; `lane-04:122`).
- **No prover or checker.** FV0 is derive-only; expectations are not proofs;
  0/738 formal invariants exist. Only acyclicity, route coverage and `if`-totality
  are genuine today; the overclaimed `fv_expression_semantics`, `fv_witnesses`
  and `fv_contract_satisfiability` labels are not consumed
  (`lane-04:123-125`; `plan` B24/Q8).
- **Non-repudiation is hash-linked attribution, not signatures.** No signing, no
  timestamp authority, writer can be compelled; exports and UI must carry the
  D14 label until G6.8 and signing land (`lane-06:175`).
- **HOLD, safe state and effect envelope are not declared.** Questions 6–8 stay
  `NOT_OBSERVABLE`; v1 marks `operator-required`, `trust-state-transition` and
  `retry-exhaustion` inert rather than inventing absence (`lane-04:127`;
  `lane-01:227-236`).
- **Capture is incomplete by construction.** The bridge drops fields until R2.2;
  references are post-kernel-filter records (E03 refs 252/205 B), not full
  content; windows can gap; restart can lose horizon; replayed windows report
  `NOT_OBSERVABLE` after purge. No completeness claim survives a recorded gap
  (`lane-02:182-200`; `lane-06:230-234`; `A/decisions` correction 3).
- **Run retention bounds backfill and corpus.** `SDA_RUN_RETENTION` is unset
  (default 200 runs); a run evicted past it cannot be backfilled or included in a
  corpus (W0.2/E06 records the values; FR1.9 reports `PARTIAL`/`NOT_OBSERVABLE`)
  (`A/decisions` correction 5; `lane-02:36-38`).
- **Cost is unmeasured.** Corpus size, Azure SQL tier, write latency and
  post-W3.2 content bytes are unmeasured (W0.4/W0.5); the W0.4 preflight cannot
  observe today (`invoke-from-transaction.mjs` returns `[]`; E08 needs a
  temporary SDA worktree probe); 10k corpora are not promised until retention
  (W5.1) exists (`lane-06:139-147,217-220`; `A/decisions` correction 4).
- **External gates are real.** S1–S3, S2 attribution, the HOLD emitter and the
  cellId join are requests to a single SDA author (1–2 weeks each, csharp-first);
  the external CodeLightly DAL regen gates F2 install, Key Vault takes 3–7
  calendar days and staging access 3–7 days; F3+ dates are not real until they
  land (`A/synthesis:83-90`; `A/decisions` c)1–c)6).
- **The recording is not a legal instrument.** An export is a manifest of
  hashes and claims; legal hold and erasure are declared tensions, not resolved
  ones (`lane-06:132-137`).
- **No numeric trust.** Triggers and DIVERGES never promote or gate execution;
  the recorder never writes a disposition (D-L9; `plan` T2/T9).
- **The in-flight Phase 1 UI is an interface, not a dependency.** F5's
  fixture-first slice (F5.1–F5.3) builds on the worktree W1.x interfaces; live
  wiring is gated on their completion, and nothing requires them to be complete
  at `b9be6e8`.

## 9. Security and privacy summary

- **Credentials.** One service key and `/auth`-only TLS exist today; per-caller
  keys in Key Vault (order day 1; 3–7 d lead), loopback routes and TLS widening
  to both `/ledger/v1` and `/evidence/v1` are new W2.2/W2.6 work; principals
  always from a host-validated session, never from request JSON
  (`lane-06:77-92`; `A/decisions` correction 14).
- **Access.** Runner-only by default; identical 404 for non-owners is new work
  (run GETs are public through the proxy today; owner scope lands with
  W2.3/W2.6 + F2.3); export narrower than read; every read, export and hold
  refusal audited (`lane-06:74-92`; `A/decisions` correction 13; D4/W5.2).
- **Never stored.** Denied members and credential-shaped values, login/enrollment
  bodies, private inputs, session bearers, connection strings, other principals'
  content, content beyond the disclosure class (`lane-06:96-103`; D6).
- **Redaction before sealing.** Kernel redaction → A3.3 store scan (absent until
  F3.3) → disclosure filter → scan digest → seal; failed scan refuses the seal
  (`lane-06:104-108`).
- **Horizon memory.** Plaintext only, bounded, stripped of denied members,
  scrubbed at window close, never logged or persisted before sealing
  (`lane-06:109-111`).
- **Erasure vs history.** Content leaves; digests, claims, tombstones and audit
  remain; legal hold outranks deletion (I8/D5/D13).
- **No new trust semantics.** Flight adds producers and evidence; I1–I10 apply
  unchanged.

## 10. Risks

| # | Risk | Mitigation | Signal |
| --- | --- | --- | --- |
| FR-R1 | Cost/scalability: horizon memory × concurrency, 615 KB spikes, 10k corpora, Azure SQL write latency unmeasured | Declared budgets, compression, sampling, W0.4/W0.5 measurement, D1 schema-move option | bytes/day, days-to-limit, A2.6 |
| FR-R2 | Misuse/surveillance: pre-trigger windows capture before any fault; exports are the leak point | Hold access narrower than D4; audit every read/export; no default operator role | access audit, hold drill |
| FR-R3 | Evidentiary suppression: trigger sets quietly narrowed or sampling raised | Versioned admitted declarations, L0 drift, sampled-out limitations | drift mismatch, sampled-out counts |
| FR-R4 | Sampling bias: a corpus proves only the rate it was drawn at | Render the sampling declaration on every corpus view | corpus labels, FR5.8 |
| FR-R5 | Trigger overclaim from bridge loss: derived triggers labelled as declared | R2.2/F1.3 lands with W2.3; partial coverage shown `NOT_OBSERVABLE` | A2.2, FR1.10 |
| FR-R6 | Clock skew/time-window misread | Event-count default; anchored clock per bound; never subtract unrelated clocks | FR1.6 |
| FR-R7 | Attribution under parallel runs tempts unsound ownership | Hold and show candidates; `NOT_VERIFIED` containment | R4 fixtures, FR5.2/U5.2 |
| FR-R8 | External gates: CodeLightly DAL regen, Key Vault, Azure, staging access (3–7 d lead), SDA single author | Order on day 1; stub contracts swap-safe; defer receipts with dates; FR2.4/FR4.5 staging deferred | `A/decisions` externals c)1–c)6 |
| FR-R9 | Vocabulary sprawl: ad-hoc triggers or claim kinds | Closed declaration pair (F1.1), D-L4 versioning, D16 | L0/FR2.8 |
| FR-R10 | Purged content presented as replayable | Replay period declared; `NOT_OBSERVABLE` after purge | FR4.4, FR2.2 |
| FR-R11 | Recorder overhead affects execution | Async flush, bounded outbox, never block the bridge; measure | `RECORDER_LAG`, A2.6 |
| FR-R12 | Backfill/corpus bounded by run retention (`SDA_RUN_RETENTION` default 200) | Re-evaluate before eviction; W0.2/E06 recorded; gaps → `PARTIAL`/`NOT_OBSERVABLE` | E06 values, FR1.9, eviction counts |

## 11. Open questions

| # | Question | Resolved by |
| --- | --- | --- |
| FQ1 | Confirm D11–D16 and the lane decisions; who owns the trigger-set admission principal | PO; F0.1 |
| FQ2 | Does the installed kernel emit the `observation/`-prefixed kinds deliberately? | SDA; F1.2 kind registry |
| FQ3 | File the HOLD/operator-required and exact authority-admission requests now? | PO + SDA; F3.2 |
| FQ4 | Post-W3.2 content bytes, Azure SQL tier and write latency | W0.4/W0.5; F2 bounds |
| FQ5 | Sampling rate policy for the first corpus, and its retention period | PO; D12; W5.1 |
| FQ6 | Corpus read contract ownership (S3.3 extension vs new W2.2 route) | team; F5.9 (before F5.5) |
| FQ7 | Q7 material independence (still open in the run-evidence plan) | PO; D11 rules |
| FQ8 | Prover/checker selection for W4.4; F4.7 stays a link until then | `plan` Q8 |
| FQ9 | Legal hold semantics: who may hold, for how long, how release is recorded | PO; D13 |
| FQ10 | Export signing target (if any) and its cost | D14; F5.8 |
| FQ11 | Bridge envelope shape and pinned wire-contract version (lane-02 #4) | PLT; pinned before F1.3 (T1 close) |
| FQ12 | W0.2/E06 horizon-vs-retention: do the recorded values bound the window byte caps (lane-01 #9)? | PO+PLT; T1 close |
| FQ13 | HOLD, safe state and effect envelope enter scope as declarations (lane-04 #5) | PO; T3 start (decides F4.1) |
| FQ14 | OPEN-recording UI display and A/B compare scope (lane-05 #6/#9) | PO+UI; before F5 |

## Appendix A. Lane document index

| Document | Owns |
| --- | --- |
| [`intent.md`](intent.md) | Product intent: rolling window, declared triggers, causal neighborhood, verification loop |
| [`research.md`](research.md) | Zero-implicit-authority thesis; capability/effect authority framing |
| [`analysis/lane-01-triggers-and-windows.md`](analysis/lane-01-triggers-and-windows.md) | Trigger inventory, vocabulary, window geometry, declaration delivery |
| [`analysis/lane-02-recorder-runtime.md`](analysis/lane-02-recorder-runtime.md) | Placement, state machine, bounds, durable interface, failure recovery |
| [`analysis/lane-03-storage-and-ledger.md`](analysis/lane-03-storage-and-ledger.md) | Recording tables/procedures, claims, immutability, retention, replay |
| [`analysis/lane-04-expected-vs-observed.md`](analysis/lane-04-expected-vs-observed.md) | Expected descriptor, nine questions, comparison ops, producers, V4 gates |
| [`analysis/lane-05-evidence-microscope-ux.md`](analysis/lane-05-evidence-microscope-ux.md) | Eight Explorer views, integration, honesty/volume, U5 gates |
| [`analysis/lane-06-assurance-and-operations.md`](analysis/lane-06-assurance-and-operations.md) | Authority, access, privacy, retention/hold, cost, non-repudiation honesty |
| [`analysis/review-implementation-plan.md`](analysis/review-implementation-plan.md) | Adversarial review; corrections C01–C24 applied in this revision |
| [`../run-evidence-implementation-plan.md`](../run-evidence-implementation-plan.md) | Authority for W/S items, decision model, gates and receipts |
| [`../run-evidence-plan/analysis/README.md`](../run-evidence-plan/analysis/README.md) | Reconnaissance method, pinned commits, retained evidence E01–E05 |

## Appendix B. Dependency map on the run-evidence plan

The recorder reuses, never replans, these items and gates:

| Run-evidence item | Used by | Note |
| --- | --- | --- |
| W0.1, §2 decision model | F0.1, all | Closed; flight adds no new states or claim kinds |
| W0.2 retention values → E06 | F1.4, F2.5, F5.5 | `SDA_RUN_RETENTION` default 200; >200-run eviction bounds backfill and corpus |
| W0.3 content spike; W0.4 shape re-declaration → E08 | F3.1, F3.3, F4.5 | W0.3 after W0.4; `invoke-from-transaction.mjs` returns `[]`, so E08 needs a temporary SDA worktree probe; sizes post-W3.2 content |
| W0.6 declaration conventions | F1.1, F2.4, F4.1/F4.2 | Extends the same migration pair; flight vocabulary cites its digest |
| W2.1 `002` schemas + DAL regen | F2.1, F2.4, F2.7 | 002b freeze gains the trace-chunk cursor columns; `003-recording` is separate; external CodeLightly checkout (~160–200 files) gates install (`A/decisions` c)1) |
| W2.2 identity-host endpoints/keys | F2.2–F2.5, F2.7, F3.3, F4.5, F5.7, F5.9 | Recording routes extend the same host and key registry; one `/auth` key today, KV 3–7 d lead, TLS both prefixes |
| W2.3 circuit host register/append/complete/attach | F1.3, F2.2, F4.5 | The recorder is W2.3's capture side; bridge enrichment lands with its schema freeze; pinned wire-contract version is an F1.3 precondition; owner-scoped run GETs are new work |
| W2.6 loopback/keys/TLS; staging access (3–7 d lead) | F2.3, F5.7; FR2.4/FR4.5 | Per-caller keys and TLS widening both prefixes are new work; staging gates deferred per `A/gates:26-27` |
| W2.4 evaluator rule set v1 | F4.2, F4.5 | `trace-conformance.v1` is a rule family in the same evaluator |
| W2.5 Explorer dispositions; W3.3 content panels | F5.3–F5.5 | Microscope views extend these surfaces |
| S1 evidence port; W3.1 receiver | F3.1, F4.5 | Live content facts and evidence-route answers |
| S2 owner identity | F3.2, F3.4 | Nested model attribution and HOLD owner facts |
| S3 evidence budget; W3.2 shape re-declaration | F3.1, F3.3, F4.5 | Content triggers cannot activate before the budget and scan exist; the 512 KB `invocationByteBudget` latches `shapesSuppressed` (A/decisions correction 10) |
| W4.4 proof obligations | F4.7 | Expectation provenance links to obligations; no prover claimed; post-3-turn |
| W5.1 retention; W5.2 access audit; W5.3 operating views | F5.5, F5.7, F5.9 | Corpus and governance operations inherit these; F5.7 post-3-turn |
| Gates A2.2/A2.4/A2.8, L0, L7/L10 | FR2.x, FR4.x, FR2.8 | Flight gates reuse the same tools and receipts where they exist |

No flight item may exit a phase unless the named W/S dependency has landed or a
dated deferral receipt exists (the `A/gates` §1 deferral rule). The run-evidence
plan is not modified by this document; this plan is revision 1, proposed, and
the six lane documents remain its design basis.


