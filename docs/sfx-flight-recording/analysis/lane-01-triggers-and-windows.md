# Lane 01: declared triggers and the window model

Design-only, 2026-10-06; one new file written, nothing else changed. Companion
lanes: lane-02 (recorder runtime), lane-03 (storage and ledger), lane-04
(expected vs observed), lane-06 (assurance). Pins:
`run-evidence-plan/analysis/README.md:23-34` (sfx-platform `327a2c2`, sfx-embody
`d9b1d3b`, SDA `7075bb6`, sfx-providers `86a3084`). `plan` =
`run-evidence-implementation-plan.md` r3 (cite §). This lane owns trigger
sources, vocabulary, window geometry and evaluation semantics.

## Scope

Per-tier trigger inventory; trigger vocabulary as D8 estate data (contracts +
one AUTHORITY set with digest, migration pair, versioning); window geometry
(before/after counts and time, composition, defaults, bounds, pre-trigger
horizon) and window lifecycle; deterministic detection and post-trigger closure,
overlapping triggers, clock skew (R6); declaration delivery (estate read vs
delivered config) and authoring; `T1.*` work items, verification, decisions,
risks.

## Current-state foundations

Tiers: **L** = SDA per-run lane (`GET /v1/runs/{id}/events`), observable by the
circuit host; **E** = full evidence record only (lane-separated; `GET
/v1/evidence/{ref}` is 501; needs W3.2 + S1 + S3); **M** = kernel/host memory;
**X1** = declared in the estate, absent from the live observe circuit; **X2** =
does not exist anywhere.

| Signal | Kind / field | Where it lives (pinned) | Tier |
| --- | --- | --- | --- |
| Run lifecycle | `run.admitted`, `run.started`, `run.exited` (`exitCode`, `signal`, `timedOut`, `durationMs`, `failure`), `graph.captured` (`canonicalGraphDigest`) | `supervisor.ts:77-82,137,207-210,236-242`; bridge drops admitted/kind/cursor (`api-host.mjs:31-36`) | L (admitted API-only) |
| Run failure / gaps | `RUN_TIMEOUT`, `RUN_SPAWN_FAILED`, `RUN_FAILED`, output overflow; `retainedFrom`/`evictedCount`/`partial`/`gap` | `supervisor.ts:150-160,164-171,221-234`; `buffer.ts:102-139`; `types.ts:48-53` | L (run record) |
| Delivery phases / timing | `delivery-phase` started/completed/failed; `durationMilliseconds` + projected `durationMillisecondsId` (`latency-ms`) | `command-carrier.mjs:410-423,349-353`; `observation.ts:1-24`; `E02` | L |
| Cell/edge testimony | `disposition`, `admissionDisposition`, `outcomeVariant`, `semanticAddress`, `cellAltitude`, `providerProfileId`, `failureCode`/`failureMessage`, `startedAt`/`completedAt` | `E02 observationFields`; node `scheduler.js:560-578`; csharp `SemanticExecutionGraphScheduler.cs:343,434,509,1411` | L |
| Contract/authority admission | `admit()` boolean; reflected only as `rejected` + `INPUT_REJECTED`/`OUTCOME_REJECTED`, or edge `admissionDisposition` `admitted`/`buffered`/`cancelled` | `scheduler.js:257,343`; csharp `:518,591,775` | L (decision M) |
| Provider exchange (effect) | `provider-exchange-shape.v1` `disposition` in completed/retained-non-success/rejected-endpoint/rejected-credential/transport-failed/cancelled/oversized-response-rejected; owner `cellId`/`cellExecutionId` | csharp `GovernedEffectPorts.cs:236-380`; `E03:77-147`; `E04:89-160`; `authority.json:38-58` | L (`disposition`); E (`providerEvidence`: `reachedStage`,`exchangeCount`,`transportDisposition`,`redactionVerified`,`httpStatus`) |
| Evidence-record-only kinds | `model-response-shape.v1`; `execution-failure-testimony.v1`; `lineageId`/`effectLineage`/endpoint facts; `cell:physical:*` | `GovernedEffectPorts.cs:539-578`; `GraphObservationFailures.cs:15,46`; `E01:8,13,18,23`; `capture.sse` seq 339 | L (failure testimony, physical cell); E (model response, lineage) |
| HOLD / operator-required | `held:5`, `skipped:6` declared; no live emitter (node dispositions are completed/rejected/failed/cancelled) | `E02 valueDictionaries`; `extend-observation-telemetry-value-ids.sql:65` | X1 |
| Provider / model switch | fallback chain (3 providers, 429→200, one endpoint refusal); authoring `switch-scenario-author-model-after-declared-failure` / `TERMINAL_HOLD` | `E01:5-24`; `sql/inspect/terminal-and-registry-truth/README.md:67`; B13 owner gap | L as separate exchanges; X1 as a switch event |
| Retry exhaustion | no automatic retry ("does not automatically follow redirects or retry"); nearest `RUN_TIMEOUT`, `RECURRENCE_BOUND_EXCEEDED` | `redesign-topologies.md:159`; `scheduler.js:547-548` | X2 |
| Trust-state transition | dispositions over claims; not built | `plan` §2.2/§5.2; `lane-05-estate.md:10-20` | X2 |
| Scenario/outcome identity | run `object`/`operation`/`subject`; `scenarioId`,`stepId`,`outcomeVariant`,`outcomeContractId`; output `contractId`+`disposition`; graph digest | `E03:3-32`; `E04:3-45`; B4 | L |
| Bound authority / cell digests | no run-bound authority digest retained; `inputDigest`/`outcomeDigest` in kernel only | B20; `scheduler.js:564-567`; excluded by `E02` (B12) | M / X2 |

Lane rules: evidence members `providerEvidence,inputShape,outcomeShape,
requestShape,responseShape,modelResponse` and record kinds
`provider-exchange-shape.v1`,`model-response-shape.v1` are separated into refs;
record kinds keep only the 12 declared key fields (`authority.json:38-58`).
Budget suppression can drop shapes before the lane/record forms
(`command-carrier.mjs:355-376`; S3/Q3). The gateway raises only event retention
(`gateway.mjs:107`); run retention default 200 (`config.ts:49,51`).

## Proposed design

### Declaration shape (D8 pattern)

One `sfx-embody` migration pair declares two contracts and one AUTHORITY set
(precedent `declare-consumer-execution-embodiment-plan.sql:279-281`;
`lane-05-estate.md:75-95`):

```json
// contract flight-trigger-vocabulary.v1
{ "contractId":"flight-trigger-vocabulary.v1","version":1,
  "operators":["equals","in","exists","not-exists","sequence","threshold-gte","threshold-lte"],
  "sourceKinds":{ "lane":["cell-execution-testimony.v1","edge-execution-testimony.v1","provider-exchange-shape.v1",
      "execution-failure-testimony.v1","delivery-phase","run.started","run.exited","graph.captured"],
    "lane-prefixed":["observation/cell-execution-testimony.v1","observation/edge-execution-testimony.v1"],
    "ledger":["ledger.disposition.changed"] },
  "triggers":[{ "triggerId":"authority-denied","triggerVersion":1,"family":"authority","tier":"lane",
      "match":{"all":[{"field":"disposition","in":["rejected"]},
                      {"field":"outcomeVariant","in":["INPUT_REJECTED","OUTCOME_REJECTED"]}]},
      "windowProfileId":"authority-failure.v1",
      "postObligation":{"closeOn":["followEvents","followMs","runEnd"],"terminalPredicate":{"runState":"terminal"}} }] }

// contract flight-window-geometry.v1
{ "windowProfileId":"authority-failure.v1","geometry":"COMPOSITE","composition":"union",
  "before":{"events":100,"milliseconds":30000},"after":{"events":50,"milliseconds":60000},
  "anchor":"every-match","clock":{"order":"cursor","windowClock":"kernel","maximumSkewMilliseconds":2000},
  "bounds":{"maxWindowEvents":10000,"maxWindowMilliseconds":900000,"maxWindowBytes":16777216},
  "sampling":{"mode":"all"} }

// AUTHORITY set; definition_digest is the declaration digest:
// model.put_semantic_definition 'AUTHORITY', N'sidefx:authorities', N'flight-recorder-declaration.v1', @document
```

The set document holds `{contracts, triggers[], windowProfiles[], defaults,
recorderPolicy:{horizon, sealOn:"run-terminal-and-all-obligations-closed"},
samplingPolicy}`. The install commit records `definition_digest`; every sealed
recording stores `declaration_digest` and every triggerRef stores
`{triggerId,triggerVersion,detectionDigest}`, so a later declaration never
rewrites a sealed window (I8/I10). Versioning is append-only: a changed
predicate/geometry is a new trigger or profile version or a new `.v2` set, never
an edit; `enabled:false` is a versioned disable; new trigger kinds need a
product-owner decision (R8; `plan` §3 D8/D9).

### Trigger vocabulary v1 (minimum)

| triggerId | Deterministic match over declared fields | Tier today | New emission? |
| --- | --- | --- | --- |
| `authority-denied` | `disposition=rejected` + `outcomeVariant in {INPUT_REJECTED,OUTCOME_REJECTED}` | lane | none; exact admission decision is M (B12) |
| `operator-required` | `disposition=held`, or a declared operator-gate event | X1 | yes (HOLD has no live emitter) |
| `trust-state-transition` | identity-host `ledger.disposition.changed` | X2 | yes; identity-host feed, inert until W2.1/W2.2 |
| `provider-failure` | `provider-exchange-shape.v1` `disposition!=completed` | lane | none; `reachedStage`/`httpStatus` = E until W3.2+S1+S3 |
| `provider-switch` | ordered pair in one scenario/operation: earlier non-completed, later completed with a different `providerProfileId` | lane (derived) | none; nested model owner needs S2 (B13) |
| `physical-effect-denied` | `disposition in {rejected-endpoint,rejected-credential}` | lane (`E01:23`; `E04:148-153`; `capture.sse` seq 336) | none for disposition; envelope/stage = E/S3 |
| `retry-exhaustion` | declared `sequence` of N non-completed exchanges of one provider, or `run.exited.failure.code=RUN_TIMEOUT` | X2 as retry; timeout on lane | yes for a true retry semantic; else declare-inert |
| `latency-anomaly` | `durationMilliseconds` `threshold-gte` a declared per-address value | lane | none; anomaly is declared, never learned |
| `experiment-scenario` | run identity match (capability/namespace/subject, optional graph digest and `outcomeVariant`) | lane | none; sampling declares rate |

`E02` makes `operator-required` declaration-ready; the live kernel never emits
`held`, so v1 marks it inert or files the SDA request. Never declare `lane` tier
for `httpStatus`/`transportDisposition`: those ride the full record only.

### Window geometry

- Anchor `(cursor0, observedAt0)` of the match; testimony/delivery carry kernel
  `observedAt` (csharp `KernelObservation.cs:306-308`), while API `at` is host
  append time (`buffer.ts:86`) and observer frames add `receivedAt` (R6).
- Before start = **union** (earliest of `cursor0-before.events` and the first
  event at/after `observedAt0-before.ms`), floor cursor 1; **intersection**
  (latest bound) is a declared alternative. After end = latest of the symmetric
  bounds, unless run end or obligation timeout closes it earlier. Union is the
  default because the intent asks for the causal neighbourhood, not a sample.
- Defaults `before {100 events, 30 s}` / `after {50 events, 60 s}`
  (intent.md:41-68). Horizon = max over enabled profiles of each before bound and
  must fit lane-02's rolling budget (250 events / 30 s / 2 MiB,
  `lane-02:137-150`); `after` is bounded by the 630 s proxy timeout
  (`circuit-host.json:4`) and lane retention.
- Pre-trigger horizon: retained continuously; a drop records `windowGaps[]`
  (never silently) and yields `complete:false` + `NOT_OBSERVABLE` for the range.
- Lifecycle (lane-02 names): `OPEN → ROLLING → PINNED → SEALING → SEALED`, plus
  `DISCARDED`, `ABORTED`, `LOST`. PINNED = a trigger matched and pre-trigger
  bytes are pinned; SEALING = run terminal and all obligations closed (or closed
  by run end/timeout with `truncatedBy`); SEALED = manifest digest frozen.
- Metadata: `{recordingId,runId,index,declarationDigest,windowProfileId,geometry,
  composition,resolved{fromCursor,toCursor,fromAt,toAt,clockDomain},triggerRefs[],
  obligations[{triggerRef,closedBy,closedAt}],gaps[],limitations[],complete,sealedAt,
  manifestDigest}`; aligns with lane-03 `evidence.recording_window` /
  `recording_trigger` (`window_rule_digest`,`detection_digest`,`anchor_cursor`,`anchor_at`).

### Evaluation semantics

- Detection is pure and synchronous over declared fields of the ordered per-run
  stream, evaluated on ingest before eviction (lane-02) and re-evaluable for
  backfill. Same events + declaration digest yield the same `detectionDigest`. No
  numeric trust, score or promotion; a trigger is fact data, never a disposition.
- Only declared fields are readable (`E02 observationFields` + key-preservation
  list); an undeclared reference refuses declaration load. Kind matching uses the
  declared source-kind registry, including the `observation/` prefix seen in
  E03/E04 but absent from the pinned SDA source (installed-kernel build
  difference) — never a hardcoded string.
- `sequence{N,withinEvents,withinMs}` and declared `threshold` with unit; a match
  records the fields used in `detection_json` so replay re-derives the same result.
- Post obligation closes when the after count **and** after time are satisfied,
  optionally gated by a terminal predicate; run end/timeout closes with
  `truncatedBy` + limitation; an open obligation keeps the recording OPEN (no
  silent seal).
- Overlap: one recording per run per seal (lane-02/03) with independent
  `triggerRefs`; overlapping windows union their pinned ranges; duplicate
  detections are idempotent per `(runId,triggerId,anchorCursor)`. Sampling changes
  which recordings seal, never trigger eligibility, and sampled-out runs record a
  limitation (`lane-06:143-155`).
- Clocks (R6): cursor is the order; prefer kernel `observedAt`/`startedAt`/
  `completedAt`, else host `at`, else observer `receivedAt`. Each bound records
  `clockDomain` and `observedSkewMs`; skew over `maximumSkewMilliseconds` marks
  the bound `APPROXIMATE` with a limitation rather than reordering; `COMPOSITE`
  under mixed domains requires that flag.

### Delivery and authoring

- Authority is the estate DB. The circuit host reads the declaration like its
  circuits: a `readers` entry (`circuit-host.json:15-19`) naming a declared read
  (e.g. `read-flight-recorder-declaration`), run through the installed delivery
  with `--stdin-envelope` and cached with a TTL
  (`live-store.mjs:27-95,96-100`); E02 (`read-observation-telemetry-authority`)
  is the same shape. Uncommitted declarations are invisible to the installed
  kernel (`lane-05:192-197`), so only the committed generation is read.
- Delivered fallback: `recorder.json` (lane-02 R2.4) carries a closed reference
  copy plus `declarationDigest`; the identity host seeds vocabulary tables from
  the same digest (D8, L0). Host config is a delivery envelope, never the meaning.
- Authoring: one pair `declare-flight-recorder-declaration.{sql,commit.sql}`:
  drop guard triggers, `BEGIN TRANSACTION`, declare contracts,
  `put_semantic_definition 'AUTHORITY'`, seed fixtures, assert digest readback
  (`extend-observation-telemetry-allowlist-dedupe.sql:101-178`), `ROLLBACK`;
  dry-run `run-migration.mjs`, preflight `invoke-from-transaction.mjs`, flip
  `COMMIT`, install, `sfx capability invoke read-flight-recorder-declaration
  --input {} --json`, commit (`AGENTS.md:79-90`).
- Drift (L0-style): `verify-flight-recorder.mjs` compares the estate
  `definition_digest`, the circuit-host copy digest, the identity-host seeded
  digest and each recording's `declaration_digest`; mismatch refuses activation
  and records `NOT_VERIFIED`, never a stale fallback.

## Work items

| ID | Repo | Produces | Deps | Size |
| --- | --- | --- | --- | --- |
| T1.1 | sfx-embody | `flight-trigger-vocabulary.v1` + `flight-window-geometry.v1` contracts, AUTHORITY set, fixtures, digest readback, one migration pair | W0.6 conventions (D8); reconcile names with G6.1/S3.4/V4.1 | 2–3 d |
| T1.2 | sfx-platform | Declaration reader in `circuit-host.json` + reference-copy loader; pure matcher + detection digests; kind-registry validation | T1.1, W2.3 envelope (cursor/kind), R2.1 | 2–3 d |
| T1.3 | sfx-platform | Window resolution + obligation closure (composition, clocks, overlap merge, seal inputs) | T1.2, R2.1/R2.3 | 2–3 d |
| T1.4 | sfx-dal + sfx-providers | Vocabulary seed/FK in 002a and window/detection columns in 003; declaration-digest readback route | W2.1; lane-03 S3.1/S3.3; T1.1 | 1–2 d |
| T1.5 | sfx-embody (request) → SDA | HOLD/operator-required emission; exact authority-admission outcome; provider stage/status decision | S1/S3 (provider facts), S2 (owner), W3.2 | req 0.5–1 d; SDA 2–5 d csharp-first |
| T1.6 | sfx-platform | `verify-flight-trigger.mjs` (T-1..T-7) + drift check + receipts | T1.1–T1.4 | 2–3 d |
| T1.7 | sfx-platform | Backfill re-evaluation over `/v1/runs/{id}/events` with retention gaps → `PARTIAL`/`NOT_OBSERVABLE` | T1.2, W2.3 | 1–2 d |

## Verification

- **T-1 Declaration integrity:** digest readback equals the install receipt; drift mismatch fails closed.
- **T-2 Detection determinism:** fixtures E03/E04/`capture.sse` seq 336/E01 match declared triggers; two runs give the same `detectionDigest`; unknown kind/field refuses load.
- **T-3 Geometry:** EVENT/TIME/COMPOSITE, union vs intersection, cursor-1 floor, run-end truncation; resolved bounds equal declared rules; dropped ranges always in `gaps[]`.
- **T-4 Closure:** closure requires count **and** time; run end/timeout seals `complete:false` with limitations; no seal without closure.
- **T-5 Overlap:** two triggers in one run merge into one recording with both triggerRefs, union pinned range, replay dedupe.
- **T-6 Clocks:** mixed domains never reorder; skew over tolerance marks `APPROXIMATE`; the window still resolves.
- **T-7 Inert triggers:** `operator-required`, `trust-state-transition`, `retry-exhaustion` never match current lane data; they surface as `NOT_OBSERVABLE`, not false positives.

## Decisions needed

1. **Ownership of the declaration pair:** one T1 pair vs extending W0.6/G6.1/S3.4 (recommend T1.1 owns it; others cite its digest); contract names reconciled to one id.
2. **Composition default:** union (recommended) vs intersection; default profile numbers.
3. **Episode model:** one recording per run per seal (lane-02/03; recommended) vs per-trigger recordings.
4. **Clock policy:** kernel-preferred with declared tolerance; who stores `receivedAt` (bridge change).
5. **Emission scope:** which triggers are v1-active (lane-derivable) vs declared-inert; file the HOLD/authority-admission request now?
6. **Observe-only vs control:** triggers record only (recommended, lane-04 decision 6) or enforce HOLD.
7. **Sampling:** declared authority (G6.1/D12); confirm off by default in v1.
8. **Disclosure at match time:** pre-window obeys per-capability disclosure (W3.2/G6.4) before sealing (recommend yes).
9. **Horizon vs retention:** confirm W0.2/E06 values bound the window byte caps.

## Risks and corrections

- **Correction:** `authority-denied` is not an emitted event; the live forms are contract admission reflected as `rejected`/`INPUT_REJECTED`/`OUTCOME_REJECTED` (B12) and effect-endpoint `rejected-endpoint`/`rejected-credential`. Declare predicates on those.
- **Correction:** `operator-required`/HOLD is vocabulary only (`held:5`, E02); no live kernel path emits it. Declaring it active would manufacture absence.
- **Correction:** retry exhaustion has no retry to exhaust (`redesign-topologies.md:159`); nearest real signals are run timeout and scenario route fallback.
- **Correction:** provider stage/status (`httpStatus`,`transportDisposition`,`reachedStage`) are evidence members removed from the lane (`authority.json:55-58`; E03/E04 keep `disposition` only); those triggers stay E until W3.2, which must follow S1 live and S3 (Q3).
- **Correction:** S2 owner identity is needed before `provider-switch`/C2 can attribute a nested model exchange; today it is `projected-capability-invocation` (B13).
- **Correction:** `RunEvent.at` is host append time (`buffer.ts:86`), not kernel time; anchoring time windows on it embeds observer/scheduler jitter.
- **Correction:** the observer bridge drops kind/cursor/eventId/evidenceRef and `run.admitted` (`api-host.mjs:31-36`); a trigger engine on that path must retain the exact pre-normalization event (lane-02:250-257).
- **Correction:** E03/E04 kinds carry an `observation/` prefix absent from the pinned SDA source; match via the declared kind registry, not literals.
- **Risk:** declarations can be quietly narrowed or disabled; versioned, admitted declarations plus sampled-out limitations make it visible (lane-06). Overlapping triggers can multiply pinned bytes; one episode per run bounds it, but seal cost scales with chunk count (lane-03).
- **Risk:** field-shaped triggers on E-only fields declared too early would create false `NOT_OBSERVABLE` noise; mark tier in the declaration and refuse `lane` tier for E-only fields.

## Confidence

High on the signal inventory and file facts (read directly at the pinned commits;
E02/E03/E04 read in full). Medium on the declaration schema and default geometry
(proposed; W0.6/W2.1 shapes open) and on which triggers are practical for v1.
Open: declaration ownership between host config (R2.4) and estate (G6.1/S3.4),
the HOLD emission request, and whether the installed kernel emits the
`observation/`-prefixed kinds deliberately.
