# Run evidence: implementation plan

Prepared 2026-10-06 for team review. Status: **draft, not started.**

## Contents

1. [Outcome](#1-outcome)
2. [Decisions for the team](#2-decisions-for-the-team)
3. [Baseline: what is true today](#3-baseline-what-is-true-today)
4. [Target design](#4-target-design)
5. [Phases and work items](#5-phases-and-work-items)
6. [Verification gates](#6-verification-gates)
7. [Security and privacy](#7-security-and-privacy)
8. [Risks](#8-risks)
9. [Open questions](#9-open-questions)
10. [Traceability](#10-traceability)

Appendices: [A. Evidence index](#appendix-a-evidence-index) ·
[B. How to reproduce the baseline](#appendix-b-how-to-reproduce-the-baseline)

**Basis.** Every claim in the baseline cites one of two kinds of source:

- a file and line in the repositories, which can be checked;
- a retained measurement under [`run-evidence-plan/evidence/`](run-evidence-plan/evidence/),
  indexed in Appendix A.

Statements about the future are labelled *proposed*. Estimates are left out on
purpose; the team sizes the work items.

**Related.** [Design E1](explorer-run-evidence-design.md) has the screens.
[Replay timing fidelity](replay-timing-fidelity.md) has the playback finding.

**How to review.** Answer the decisions in §2 first. They change the shape of
Phases 2–3. Then check the baseline in §3 against its sources.

---

## 1. Outcome

A signed-in user who runs a capability in the Capability Explorer can do three
things, without searching:

1. **Review the run when it ends.** The report shows:
   - the outcome and the output;
   - where the time went;
   - each provider called, with its time and status.
2. **Reopen any of their earlier runs and play it back.** This must work after
   reloads and restarts, and through a link.
3. **Click any operation or provider in the circuit and see its evidence.** That
   means:
   - what an operation received and returned;
   - what was sent to a provider and what came back;
   - how long each part took;
   - the full trace.

Evidence is **stored in the sfx-identity database and linked to the principal who
ran the capability**. That is the product owner's direction of 2026-10-06.

**Not in scope.**

- Sharing runs across principals beyond an explicit link (see decision D4).
- Production rollout beyond the staging slot.
- Changing how capabilities execute.

## 2. Decisions for the team

| # | Decision | Recommendation | Why (evidence) |
| --- | --- | --- | --- |
| D1 | Where evidence lives inside sfx-identity | A new `evidence` schema beside `identity`, with foreign keys to `identity.principal` and `identity.session` | `identity` holds exactly the login surface: 7 tables and 8 procedures (B13). A separate schema keeps that surface, and its generated DAL, small. |
| D2 | Which process writes and reads it | The identity host only. Other processes call it over loopback with their own service credentials. | The identity child is the only process given `SFX_IDENTITY_CONNECTION_STRING` (B13). The SDA API host "holds no database handle" (B14). |
| D3 | What is stored, by phase | Phase 2: the run record, the output and the lane trace. Phase 3: evidence content (provider exchanges, shapes, model responses). | Phase 2 needs no SDA change (B5, B12). Phase 3 needs the SDA evidence port (B5, B14). |
| D4 | Who can read a run | The runner, by default. Shared links resolve only for signed-in principals the runner grants. | Today any run is visible to whoever has the page (B1, B3). |
| D5 | Retention | One declared default (a value to choose), plus deletion on request. Expired content is purged by a scheduled procedure. | Content size is unknown until spike W0.4; trace size is measured (B12). |
| D6 | Inputs of private capabilities | Never stored, as declared per capability. `authenticate-ide-user` and `enroll-ide-user` inputs carry credentials. | The identity host keeps private bodies out of "generic run records" (cli-login README:80). The `deniedMembers` redaction is declared (B9). |
| D7 | Evidence for runs not started from the browser (CLI `sfx-api`, operator token) | Attribute them to the operator principal when there is one. Otherwise store them as unattributed and visible only to operators. | Login does not yet authorize user bearers for `/v1/runs` (identity-login.md:59). |

## 3. Baseline: what is true today

### Runs and identity

| # | Fact | Source |
| --- | --- | --- |
| B1 | Observe runs are attributed to the signed-in principal **only in circuit-host memory**. Each attribution holds runId, principalId, sessionId, admittedAt, capabilityId and namespaceId, bounded to 2,000. A restart loses them. `GET /api/circuit/v1/session/runs` returns the caller's attributions. | `live-circuit/circuit/identity-session.mjs:18-19,96-101,118-123`; `run-api.mjs:78`; `circuit-host.json:5` (`maximumAttributedRuns: 2000`) |
| B2 | The SDA API keeps runs in process memory: by default 200 runs (`SDA_RUN_RETENTION`) and 1,000 events per run (`SDA_RUN_EVENT_RETENTION`). The staging and local runs measured here kept all 1,893–1,894 events (`evictedCount: 0`), so both hosts are configured above the default. The values are not recorded (Q1). | `scenario-driven-architecture/services/sda-api/src/config.ts:49,51`; E03 `run`; staging `run.json` |
| B3 | The SDA API has no run-list route. It declares only `POST /v1/runs` and per-run reads (`/events`, `/events/stream`, `/graph`, `/output`, `/evidence`, plus `/v1/evidence/{ref}`). The platform proxy allows only per-run reads. | `services/sda-api/src/server.ts:57-111`; `live-circuit/circuit/run-api.mjs:21` |
| B4 | A run record does not include its input. The record keys are `runId, state, capability, createdAt, startedAt, endedAt, pid, exitCode, cursor, retainedFrom, evictedCount, partial, output`. | E03 `run` |

### Evidence

| # | Fact | Source |
| --- | --- | --- |
| B5 | The SDA API host receives each declared evidence record or member in full. It serializes and hashes it, then **discards the content** and keeps a reference: `{ref, digest, mediaType, size, producer}`. `GET /v1/evidence/{ref}` returns `501 EVIDENCE_PROVIDER_NOT_CONFIGURED`. | `services/sda-api/src/buffer.ts:82-100,181-190`; `server.ts:318-329`; E03 `resolveEvidenceResponse` |
| B6 | Evidence records per run. Gemini run (`request-capability-from-objective-v3`): 2 `provider-exchange-shape.v1` (252 B) and 2 `model-response-shape.v1` (205 B). Equity run (`resolve-equity-market-price-evidence`): 4 `provider-exchange-shape.v1` (396–406 B), one per HTTP exchange. | E03 `evidenceEvents`; E04 `evidenceEvents` |
| B7 | What a provider exchange records, as the kernel's own CLI observation renders it: provider, binding, endpoint, exchange disposition, stage, call count, transport, `redacted true`, HTTP status and duration. In the observed equity run the first two quote providers answered **HTTP 429**, the third 200, and the fourth was refused at endpoint admission. | E01 |
| B8 | Model requests declare an evidence policy that captures **hashes and metadata, not bodies**: `captureRequestHash`, `captureResponseHash`, `captureResolvedProvider`, `captureResolvedModel`, `captureTokenUsage` and `captureTiming`, all `true`. | `sfx-embody/sql/migrations/declare-agent-capability.sql:82-88` |
| B9 | The estate's telemetry authority declares the following. | E02; `extend-observation-telemetry-allowlist-dedupe.sql` (commit `494af5e`) |
| B10 | Before 2026-09-24 the estate declared five shapes and provider evidence fields, and the kernel emitted them. Change "G8" (`494af5e`) removed them so evidence never rides the lane, accepting that "API runs keep no evidence content until the evidence port lands." **The kernel can already emit operation payloads, request and response metadata, response bodies and model-response payloads.** The members are listed below. | `sfx-embody/sql/migrations/extend-observation-telemetry-shapes.sql:50` (commit `7b31091`); `scenario-driven-architecture/docs/sidefx-protocol-layer-execution-strategy-2026-09-24.md:42-46` |
| B11 | The kernel applies declared bounds to shapes. Each shape is clipped to `payloadByteBound` and has `deniedMembers` removed. Shapes are dropped first when an event exceeds `eventByteBudget`. All later shapes are suppressed once a run's lane bytes pass `invocationByteBudget`. | `scenario-driven-architecture/languages/typescript/src/kernel/bootstrap/command-carrier.mjs:309-312,355-376` |
| B12 | Operation values never reach the lane. The kernel computes `inputDigest` and `outcomeDigest` for each cell, but the declared allowlist (`observationFields`) excludes them. | `languages/typescript/runtimes/node/semantic-execution-graph/scheduler.js:561-567`; E02 `observationFields` |
| B13 | Evidence records for model calls are labelled `cellId: projected-capability-invocation`, not with the operation or provider they belong to. Equity exchange records carry their provider cell id. The platform's observer bridge forwards every API event as kind `observation`, which drops the record kind. | E03, E04 `evidenceEvents`; `tools/live-circuit/api-host.mjs:36` |

Details for B9, the telemetry authority:

- `providerEvidence: []`;
- no `shapes`;
- `deniedMembers`: 20 credential-bearing names (`authorization`, `x-api-key`,
  `x-goog-api-key`, `password`, `token`, `credentialReference` and others);
- `payloadByteBound` 4,096;
- `eventByteBudget` 65,536;
- `invocationByteBudget` 524,288.

Details for B10, what the pre-G8 declaration contained:

- `providerEvidence`: `reachedStage`, `exchangeCount`, `transportDisposition`,
  `redactionVerified`, `httpStatus`;
- `inputShape` and `outcomeShape`: `contractId`, `payload`, `payloadRef`;
- `requestShape`: method, host, path, query, headers, `bodyHash`, `byteLength`;
- `responseShape`: status, headers, `body`, `bodyRef`, `byteLength`, `bodyHash`,
  lineage, `providerProfileId`;
- `modelResponse`: `contractId`, `payload`, `payloadRef`, `providerProfileId`,
  lineage.

### Sizes and storage

| # | Fact | Source |
| --- | --- | --- |
| B14 | One run of `request-capability-from-objective-v3` has 1,893 lane records, including a 615 KB graph record. Its size is shown below. | E05 |
| B15 | sfx-identity is a SQL Server database with schema `identity`: 7 tables and 8 procedures. | See below. |
| B16 | The SDA API doctrine (sda-api-v1.authority.json): "Every heavy datum has exactly one home: the evidence storage provider, addressed by reference. V1 emits references only." "The host holds no database handle, no vault…" "No endpoint in this interface serves evidence content." | `scenario-driven-architecture/interfaces/sda-api/sda-api-v1.authority.json:66-68` |
| B17 | Replay draws provider time as travel along the wire. The provider is current in 8% of frames, while the HTTP exchange was 45–52% of each call. | [replay-timing-fidelity.md](replay-timing-fidelity.md) |

Details for B14, the measured trace size:

| Form | Size |
| --- | --- |
| SSE | 3.79 MB |
| API events JSON | 2.63 MB |
| gzip | 99–148 KB |
| Brotli | 60–85 KB |

Details for B15, the sfx-identity database:

- Keys are `uniqueidentifier`.
- Procedures own transactions and checks.
- Access goes through a CodeLightly-generated DAL (`SFX.Identity.DAL`), changed
  only by migration and regeneration, not hand edits.
- The connection setting goes only to the identity child process. The gateway
  strips it from every other process.
- Sources: `sfx-dal/identity/README.md`;
  `sfx-dal/identity/sql/migrations/001-login-identity.commit.sql:11-66`;
  `sfx-platform/deploy/sda-kernel/identity-login.md:44-57`.

**Reading the baseline together.**

- The kernel can produce the evidence (B10, B11).
- The API host sees it and throws it away (B5), because there is nowhere to put
  it (B16).
- The estate has switched production off until there is (B9, B10).
- The browser gets timing and status only (B12, B17).
- Run ownership exists only in memory (B1).

The plan supplies the missing home (sfx-identity), links it to the runner, and
then switches evidence production back on.

## 4. Target design

### 4.1 Data flow (proposed)

```
 Browser ── session cookie ──► Circuit host ──► SDA API host ──► Kernel ──► providers
                                 │   │  ▲          │   (machine token)
                                 │   │  │          │ lane events (unchanged; evidence never rides it)
                                 │   │  └──────────┘
                                 │   │
             (1) admission +     │   │ (2) lane trace chunks,         (3) evidence records
             principal (from     │   │     output, completion             (SDA "evidence port", Phase 3)
             validated session)  ▼   ▼                                       │
                          Identity host  ◄──────────────────────────────────┘
                          (only DB credential holder; per-caller service keys)
                                 │
                                 ▼
                     sfx-identity: identity.* (login, unchanged)
                                   evidence.* (new: run, trace, evidence objects, audit)
```

1. **Admission.**
   - When the circuit host admits an Observe, it records the run against the
     principal (`run-api.mjs:78` today writes only to memory).
   - The identity host takes the principal from the session cookie it validates.
     It does not trust a principal id passed by the caller.
2. **Trace.**
   - The circuit host already reads the run's events from the SDA API.
   - It appends them to the identity host in Brotli chunks *as they arrive*, so
     the API's event retention (B2) cannot evict them first.
   - At run end it stores the output and the completion counts.
3. **Evidence content (Phase 3).**
   - The SDA API host already holds each full evidence record at
     `buffer.ts:90-100` (B5).
   - With the requested evidence port, it delivers the record to the identity
     host over loopback with its own service key, instead of discarding it.
   - `GET /v1/evidence/{ref}` resolves through that port. The API host still
     holds no database handle (B16).

### 4.2 Data model in sfx-identity (proposed, migration `002-run-evidence`)

All tables live in schema `evidence`. Spikes W0.3–W0.5 confirm the columns and
sizes before installation.

| Table | Key | Columns (summary) | Notes |
| --- | --- | --- | --- |
| `evidence.run` | `run_id uniqueidentifier` (the SDA API `runId`) | See below. | One row per admitted run. |
| `evidence.run_trace_chunk` | `(run_id, chunk_ordinal)` | `first_cursor`, `last_cursor`, `record_count`, `encoding` (`br`), `content varbinary(max)`, `sha256 binary(32)` | B14 sizes a run at about 60–85 KB Brotli. |
| `evidence.evidence_object` | `ref nvarchar(256)` (`urn:sda-api:run-event:{runId}:{cursor}`) | See below. | Filled in Phase 3. `owner_cell_id` stays NULL until SDA request S2 lands. |
| `evidence.access_audit` | `audit_id bigint identity` | `run_id`, `principal_id`, `action` (`read_run`, `read_trace`, `read_evidence`, `delete`), `at` | Mirrors `identity.authentication_audit`. |

Columns of `evidence.run`:

- `principal_id`, a foreign key to `identity.principal`;
- `session_id`, a foreign key to `identity.session`, nullable;
- `capability_id`, `namespace_id`, `host`;
- `admitted_at`, `started_at`, `ended_at`;
- `exit_code`, `outcome_variant`;
- `input_json`, NULL for capabilities with private input (D6);
- `output_json`, `output_bytes`;
- `trace_records`, `trace_complete`;
- `retention_until`.

Columns of `evidence.evidence_object`:

- `run_id`, `cursor`, `kind`;
- `owner_cell_id`, `owner_cell_execution_id`;
- `digest binary(32)`, `size`, `media_type`;
- `content varbinary(max)`;
- `redaction_verified bit`, `created_at`.

Procedures follow the `identity` pattern: named, transactional, and checking
ownership themselves. They are:

- `evidence.record_run_admission`;
- `evidence.append_trace_chunk`;
- `evidence.complete_run`;
- `evidence.put_evidence_object`;
- `evidence.list_runs_for_principal`;
- `evidence.read_run_for_principal`;
- `evidence.read_trace_for_principal`;
- `evidence.read_evidence_for_principal`;
- `evidence.purge_expired`.

They return no rows for another principal's run, so a run's existence is not
leaked.

### 4.3 Explorer (from design E1)

- **Context column tabs: Run | Runs | Evidence.**
  - The Run tab becomes the report when a run ends.
  - Runs lists the principal's runs from `evidence.run`.
  - Clicking a circuit element opens Evidence.
- **Playback.** One bar for the whole invocation, the steps list, and the dot
  dwelling at the provider (B17).

## 5. Phases and work items

Repository owners follow the estate rules. SDA behaviour is changed by a
**request** to `scenario-driven-architecture`, never by editing it from here.
Capability meaning changes only through migration pairs in `sfx-embody`.

### Phase 0: decisions and spikes

| # | Work | Repo | Produces |
| --- | --- | --- | --- |
| W0.1 | Decide D1–D7 and record the answers in this file. | All | Decision log |
| W0.2 | Record the staging values of `SDA_RUN_RETENTION` and `SDA_RUN_EVENT_RETENTION`, without printing secrets. | sfx-platform (deploy) | E06 |
| W0.3 | **Content spike:** capture the full serialized record of one `provider-exchange-shape.v1` and one `model-response-shape.v1`, the content B5 discards. Run it in a local SDA worktree with a temporary sink at `buffer.ts:100`; it is not merged. This settles what B7 shows only as rendered text. | SDA (request owner) | E07 |
| W0.4 | **Shape emission spike:** a `sfx-embody` preflight migration that re-declares the pre-G8 `providerEvidence` and `shapes` (B10), run with `invoke-from-transaction.mjs` and ending in ROLLBACK. It invokes one equity run and one Gemini run. | sfx-embody | E08 |
| W0.5 | Read the sfx-identity database tier and its maximum size (`az sql db show`). Measure the write latency of one 85 KB `varbinary` insert from the identity host region. | sfx-dal / Azure | E09 |

W0.4 measures:

- the shape bytes per run;
- how many shapes `invocationByteBudget` suppresses (B11);
- whether model-response payloads appear.

**Exit criteria:** D1–D7 answered, and E06–E09 retained. The data model in §4.2 is
revised from E07 and E08.

### Phase 1: Explorer on today's data (sfx-platform only, no storage)

| # | Work | Acceptance |
| --- | --- | --- |
| W1.1 | Run report in the Run tab. | A1.1 |
| W1.2 | Playback bar, steps list and dwell model. | A1.2, A1.3 |
| W1.3 | Evidence tab: Time, Trace and Called. | A1.4 |
| W1.4 | Runs tab on the existing `GET /api/circuit/v1/session/runs` (B1), labelled as this server session's runs until Phase 2. | A1.5 |

W1.1 shows the outcome, `/output` as fields, the providers called (from operation
receipts) and where the time went (operation intervals plus delivery phases).

W1.2 covers:

- the whole invocation including delivery phases;
- provider segments, with the exchange interval taken from nested step receipts
  by time containment (B13 limits this to serial runs);
- hatched spans with no timed record;
- the dot dwelling at the callee
  ([replay-timing-fidelity.md](replay-timing-fidelity.md) steps 1 and 4).

### Phase 2: durable runs linked to the principal (no SDA change)

| # | Work | Repo |
| --- | --- | --- |
| W2.1 | Migration `002-run-evidence` (preflight with rollback, then commit). Run `tools/identity-database preflight` and `install`, then regenerate `SFX.Identity.DAL` with `regenerate.ps1`. Retain the preflight, install, idempotence and generation receipts, as for `001` (`sfx-dal/identity/verification/`). | sfx-dal |
| W2.2 | Identity host endpoints under `/evidence/v1/*` (see below). New service key in Key Vault plus a vault reference, with the same custody as `SFX_IDENTITY_SERVICE_KEY` (identity-login.md:55-65). Host tests in `providers/cli-login/host-tests`. | sfx-providers |
| W2.3 | Circuit host: replace the in-memory `attributeRun` as the source of truth with `record_run_admission`. Subscribe to the run's event stream and append Brotli chunks while the run executes, then complete with `/output`. A failed write never fails the run; it sets `trace_complete = 0` and raises a visible finding. | sfx-platform |
| W2.4 | Explorer: the Runs tab reads the durable list. `?run=<id>` loads the stored trace into Replay. | sfx-platform |
| W2.5 | Gateway: the `/evidence/v1/*` routes stay loopback-only. No public route is added to `identity-policy.json` unless D4 needs one. | sfx-platform (deploy) |

W2.2 covers these endpoints:

- admission;
- trace append;
- complete;
- list and read for the principal of a validated session.

### Phase 3: evidence content (SDA requests plus estate rows)

| # | Work | Owner |
| --- | --- | --- |
| S1 | **Request: SDA API evidence port.** When the host separates a record (`buffer.ts:90-100`), it delivers `{ref, digest, size, mediaType, kind, runId, cursor, content}` to a configured provider endpoint with a service credential. `GET /v1/evidence/{ref}` resolves through that provider. The host keeps no database handle (B16). | SDA (request, cross-language) |
| S2 | **Request: owner identity on evidence records.** Model-call records carry the owning operation's and provider's `cellExecutionId` instead of `projected-capability-invocation` (B13). | SDA kernel (request) |
| S3 | **Request: an evidence budget separate from the lane budgets** (see below). | SDA kernel (request) |
| W3.1 | Identity host: `POST /evidence/v1/objects` for S1, and principal-scoped reads. | sfx-providers |
| W3.2 | Re-declare `providerEvidence` and `shapes` as before G8 (B10), in a migration pair that may install **only after S1 is live**, so evidence still never rides the lane. Add the retention and per-capability input-disclosure declarations (D5, D6). | sfx-embody |
| W3.3 | Explorer: In and Out panels and Request and Response panels, plus a Download bundle. | sfx-platform |

S3 covers two limits:

- `payloadByteBound` (4,096) clips each shape;
- `invocationByteBudget` suppresses shapes after 512 KB of lane bytes (B11).

Both protect the lane. Evidence bound for the store needs its own declared limits.

### Phase 4: retention, access and operations

| # | Work |
| --- | --- |
| W4.1 | `evidence.purge_expired` on a schedule; deletion on request (D5). |
| W4.2 | Read audit (`evidence.access_audit`) and a principal-facing "who viewed this run" view, if D4 enables sharing. |
| W4.3 | Operating views: rows, bytes and runs per day; failed trace writes (`trace_complete = 0`). |

## 6. Verification gates

Every gate is a script with a retained receipt, as the existing staging gates are
(for example `deploy/sda-kernel/*-acceptance-*.json`).

| Gate | Measures | Pass when | Tool |
| --- | --- | --- | --- |
| A1.1 | Report against API | Every report field equals `/v1/runs/{id}` and `/output` for the same run | new `verify-run-report.mjs` |
| A1.2 | Replay clock | Wall time matches captured time within 50 ms at 1× and 0.1× | existing `tools/sfx-api/verify-circuit-replay.mjs` (today 1.2 ms and 18.5 ms) |
| A1.3 | Dwell truth | During each provider exchange interval the provider is the current component in **every** sampled frame. Today 32 of 406 frames visit it (B17). | tightened `verify-circuit-replay.mjs` (today's rule is "visited at least once") |
| A1.4 | Trace completeness in the panel | The receipts listed for an operation equal those time-contained in its interval in the capture | new `verify-evidence-panel.mjs` |
| A1.5 | Runs tab | Lists exactly the session's attributions | `verify-explorer.mjs` extension |
| A2.1 | Ownership | Each Observe creates one `evidence.run` row whose `principal_id` equals the session principal | DB check through identity host test endpoint, or a host test |
| A2.2 | Trace integrity | `trace_records` equals the API `latestCursor`; every chunk's SHA-256 verifies; decompressed records are byte-identical to `/events` | new `verify-run-evidence.mjs` |
| A2.3 | Replay from storage | Replaying the stored trace gives the same window duration (to the ms) and frame count as replaying the live capture | `verify-circuit-replay.mjs --source stored` |
| A2.4 | Isolation | A second principal gets 404 for list, read and trace of the first principal's run, with no timing or message difference | host tests and a live test |
| A2.5 | Durability | After a staging container restart, the list and replay still work | staging acceptance step |
| A2.6 | Cost on the run | Change in admission latency and in run wall time, with and without trace writes, over 10 runs each. The threshold is set from W0.5. | new measurement script |
| A3.1 | Evidence resolvable | 100% of the references listed at `/v1/runs/{id}/evidence` resolve, and `sha256(content)` equals `ref.digest` | `verify-run-evidence.mjs --content` |
| A3.2 | Owner attribution | Every evidence object's owner cell maps to a circuit node of the run's scene | same |
| A3.3 | Redaction | Zero declared `deniedMembers` names and zero credential-shaped values in any stored content or trace | scan in `verify-run-evidence.mjs`, as in the existing log scans of `verify-browser-session.mjs` |
| A3.4 | Lane unchanged | Observer SSE bytes per run before and after W3.2 differ only by key fields; evidence never rides the lane (B9) | before/after capture on the same input |
| A3.5 | The answer is visible | For the Gemini specimen, operations 04 and 10 show the model response payload; the equity specimen shows the HTTP status of all 4 exchanges | browser acceptance |

## 7. Security and privacy

- **Credentials.**
  - There are three callers of the identity host: the circuit host, the SDA API
    evidence port and the existing kernel callbacks.
  - Each gets its own service key, stored in Key Vault, exposed through a
    slot-specific vault reference, and never present in Git, receipts or logs.
  - Custody follows identity-login.md:55-65.
  - The gateway keeps stripping the identity settings from every process except
    the identity child.
- **Who is the runner.**
  - The principal always comes from a session the identity host validates
    itself (B1 uses `validateSession`).
  - A principal id supplied by a caller is never trusted.
- **What is never stored.**
  - Declared `deniedMembers` (B9) are removed by the kernel before emission and
    verified again by A3.3.
  - Inputs of capabilities declared private (D6) are not stored.
  - Login and enrollment bodies stay on their private transports
    (cli-login README:78-80).
- **Exposure.** A run's existence, contents and evidence are readable only by its
  principal (and by grantees, if D4 enables sharing). Every read is audited (W4.2).
- **Personal data.** Model prompts and responses can contain personal data. The
  retention default (D5) and deletion on request (W4.1) apply to them.

## 8. Risks

| # | Risk | Mitigation | Signal |
| --- | --- | --- | --- |
| R1 | Evidence writes load the database that login depends on | Separate schema; bounded, batched, asynchronous chunk writes; writes never block the run (W2.3); measure first (W0.5) | Login latency and DTU/vCore before and after Phase 2 |
| R2 | Events evicted from API memory before they are stored | Append while the run executes, not at the end (W2.3); W0.2 records the limits | `trace_complete = 0`, A2.2 |
| R3 | Content size grows without bound once shapes return | Evidence budgets (S3), retention (D5), sizes measured in W0.4 before W3.2 | Bytes per run (W4.3) |
| R4 | Wrong ownership attribution under parallel operations | Time containment is the interim method; S2 gives identity | A3.2 |
| R5 | SDA doctrine conflict ("no endpoint serves evidence content") | Content is served by the identity host via the platform, not by the SDA API, unless the SDA owners accept resolving `/v1/evidence/{ref}` through the port (S1) | SDA request review |
| R6 | Kernel and observer clocks differ (receipt lag of 0.4–1.3 s) | Store and replay kernel `startedAt`/`completedAt`; keep `receivedAt` only as delivery metadata | [replay-timing-fidelity.md](replay-timing-fidelity.md) |

## 9. Open questions

| # | Question | Resolved by |
| --- | --- | --- |
| Q1 | Staging values of `SDA_RUN_RETENTION` and `SDA_RUN_EVENT_RETENTION` | W0.2 |
| Q2 | Exact content of `provider-exchange-shape.v1` and `model-response-shape.v1` records, including whether a model-response record can carry the response text at all | W0.3 |
| Q3 | What `invocationByteBudget` suppresses on real runs. Run 849's lane payload (about 2.96 MB) is far above 512 KB, so shapes would be suppressed early in long runs. | W0.4 |
| Q4 | sfx-identity tier, maximum size and write latency | W0.5 |
| Q5 | Retention period and sharing model | D4, D5 |
| Q6 | Whether runs from the CLI and operator token are attributed, and to whom | D7 |

## 10. Traceability

| Design E1 slide | Phase and work | Gates |
| --- | --- | --- |
| 2 · What a run leaves behind today | §3 baseline | — |
| 3 · Run report | W1.1, then W2.3 (durable) | A1.1, A2.1 |
| 4 · Runs list and links | W1.4, then W2.4 | A1.5, A2.3–A2.5 |
| 5 · Playback | W1.2 | A1.2, A1.3 |
| 6 · Click an operation | W1.3, then W3.2 and W3.3 (In and Out) | A1.4, A3.1–A3.3 |
| 7 · Click a provider | W1.3, then S1, S2, W3.1–W3.3 | A3.1–A3.5 |
| 8 · What it takes | This plan | — |

## Appendix A. Evidence index

Retained in [`run-evidence-plan/evidence/`](run-evidence-plan/evidence/). The
SHA-256 values are in that folder's `README.md`.

| ID | What | How it was produced (2026-10-06) |
| --- | --- | --- |
| E01 | Kernel CLI observation of `resolve-equity-market-price-evidence` (AVGO, US) | `sfx capability observe resolve-equity-market-price-evidence --input @equity-input.json` (made real provider calls) |
| E02 | Declared telemetry authority | `sfx capability invoke read-observation-telemetry-authority --input {} --json` |
| E03 | Local Gemini run `29807fa4`: run record, output, evidence references, the 4 evidence events, event-kind counts, and the 501 from `GET /v1/evidence/{ref}` | Local SDA API on the installed kernel |
| E04 | Local equity run `52d5fe1e`: run record, output, references, 4 exchange events, 8 provider cell receipts with authorities from `/graph` | Same |
| E05 | Trace sizes, raw and compressed, for a local and a staging run | Node `zlib` |

Related retained evidence:

- the staging capture and timing log in
  [`replay-timing-fidelity/`](replay-timing-fidelity/), whose `capture.sse` SHA-256
  matches the staging artifact;
- the E1 deck and its sources in
  `sfx-providers/outputs/capability-estate/live-circuit-platform-explorer/E1/`.

## Appendix B. How to reproduce the baseline

From `sfx-embody`, with the installed kernel:

```
cmd /c "sfx capability invoke read-observation-telemetry-authority --input {} --json"
cmd /c "sfx capability observe resolve-equity-market-price-evidence --input @equity-input.json"
```

With the local stack (`tools/live-circuit/start-local.mjs`), admit a run with the
local API token, then read it:

```
POST /v1/runs                      {"object":"capability","operation":"observe","subject":"<capability>","input":{...}}
GET  /v1/runs/{id}                 run record (no input)
GET  /v1/runs/{id}/output          output
GET  /v1/runs/{id}/evidence        references {ref,digest,mediaType,size,producer}
GET  /v1/runs/{id}/events?after=N  events; evidence events carry evidenceRef and only key fields
GET  /v1/evidence/{ref}            501 EVIDENCE_PROVIDER_NOT_CONFIGURED
```

Each Gemini run makes two model calls. Each equity run makes up to four
market-data calls.
