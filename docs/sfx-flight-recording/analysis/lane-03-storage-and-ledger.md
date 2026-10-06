# Lane 03: flight-recording storage and ledger integration

Produced 2026-10-06. Read-only design lane; the only file written. Pinned: sfx-platform
`327a2c2`, sfx-dal `6883c75`, sfx-providers `86a3084`. Ground rules: [README](../run-evidence-plan/analysis/README.md),
[decisions-and-corrections](../run-evidence-plan/analysis/decisions-and-corrections.md);
plan [run-evidence-implementation-plan.md](../../run-evidence-implementation-plan.md)
§2, §3 D1/D2/D4/D5/D8/D10, §5.2–§5.3, §6 W2.1–W2.3; concept [intent.md](intent.md), [research.md](research.md).

## Scope

Design the recording as data in sfx-identity: first-class object vs view over W2.3 chunks; tables/keys/digests/content refs; 002a/002b or new 003
migration; DAL procedures; claims under the closed vocabulary; immutability/retention/replay (I8/I10); access/endpoints; work items, verification,
decisions, risks. Out of scope: implementation; SDA changes (requests only); estate vocabulary authoring.

## Current-state foundations (file:line)

- **No recording concept exists.** Search found no `recording`, `trigger`,
  `window_trigger`, `seal_recording` or `open_recording` table, route or
  procedure; `002` does not exist (lane-03:10-12).
- **Login foundation**: `identity` is 7 tables / 8 procedures on the 001 twin
  pattern; procedures own transactions and enforce `DENY` + ownership chaining
  (`sfx-dal/identity/sql/migrations/001-login-identity.commit.sql:10-67,68-334,
  336-348,349-354`; `sfx-dal/identity/README.md:17-32`).
- **Trace substrate (W2.3, proposed)**: chunks appended during execution via
  `POST /evidence/v1/runs/{id}/trace` (lane-02:108-140). The 2,000-record observer
  ring and the bridge dropping `cursor/eventId/evidenceRef/kind` must change
  first (`observe-server.mjs:50`; `api-host.mjs:31-36`; lane-02:232-257; decisions-and-corrections:67).
- **Attribution**: in-memory only (`identity-session.mjs:18-19,96-107`;
  `run-api.mjs:75-91`); proxy GETs are public, so D4 runner scoping is new work
  (lane-02:100-104).
- **Proposed store**: `evidence.run`, `run_trace_chunk`, `evidence_object`,
  `access_audit` (plan:548-554); tombstone lane-03:202-212; 002a/002b split
  lane-03:214-229, decisions-and-corrections:35.
- **Rolling horizon**: W2.3 already appends the whole trace, so intent.md:70's pre-trigger capture is a selection, not a ring.

## Recording object model (recommendation: first-class, not a view)

**Recommend first-class `evidence.recording`.** A view over W2.3 chunks plus
trigger rows cannot be (a) sealed with a stable digest — reconciliation appends
gap chunks (lane-02:98-99); (b) scoped to evidence objects as well as chunks;
(c) retained as membership for I8/I10 replay after purge; (d) declared data with
trigger/window geometry (intent.md:37-70). Recordings store **no bytes**: members
FK-reference the one home for each datum (B16, plan:340). A recording is a
sealed, ordered membership manifest over `run_trace_chunk` and
`evidence_object`.

Tables (new `003`; 002b alternative under Work items):

| Table | Key columns |
| --- | --- |
| `evidence.recording` | `recording_id uniqueidentifier PK`, `run_id NOT NULL FK evidence.run`, `state varchar(12) CHECK IN ('OPEN','SEALED','ABORTED')`, `opened_at`, `sealed_at NULL`, `sealed_by NULL FK identity.principal`, `window_rule_digest binary(32) NOT NULL`, `capture_policy_digest binary(32) NOT NULL`, `member_count int`, `content_byte_count bigint`, `manifest_digest binary(32) NULL`, `CHECK` seal columns null iff OPEN |
| `evidence.recording_window` (1:1) | `recording_id PK FK`, `window_kind CHECK IN ('EVENT','TIME','COMPOSITE')`, `before_events/before_ms/after_events/after_ms int NULL`, `anchor_cursor bigint`, `anchor_at datetimeoffset(7)`, resolved `window_from_cursor/window_to_cursor/window_from_at/window_to_at NULL`, `precision CHECK IN ('RECORD','CHUNK')`, `snapping_loss int NULL` |
| `evidence.recording_trigger` | `trigger_id uniqueidentifier PK`, `recording_id NOT NULL FK`, `trigger_kind varchar(48) NOT NULL` FK to declared vocabulary, `anchor_cursor bigint`, `anchor_at`, `detection_json nvarchar(max) CHECK(ISJSON=1)`, `detection_digest binary(32)`, `observed_evidence_id NULL FK ledger.evidence`, `detected_by FK identity.principal`, `recorded_at`; `UNIQUE(recording_id)` in v1 |
| `evidence.recording_member` | `recording_id FK`, `ordinal int`, `content_kind CHECK IN ('TRACE_CHUNK','EVIDENCE_OBJECT')`, `trace_chunk_id NULL FK`, `evidence_object_id NULL FK`, `content_digest binary(32) NOT NULL`, `from_ordinal/to_ordinal int NULL` (record ordinals inside a chunk; NULL = whole), `first_cursor/last_cursor bigint NULL`, `first_at/last_at NULL`, `added_at`; `PK(recording_id,ordinal)`, `UNIQUE(recording_id,content_kind,trace_chunk_id,evidence_object_id,from_ordinal,to_ordinal)`, `CHECK` exactly one home FK non-null |
| `evidence.recording_grant` (D4) | `grant_id bigint IDENTITY PK`, `recording_id FK`, `principal_id FK identity.principal`, `granted_by FK`, `granted_at`, `expires_at NULL`, `revoked_at NULL`, `UNIQUE(recording_id,principal_id)` |
| `evidence.access_audit` (002b, extended) | add `recording_id NULL FK`, `action varchar(24)`, `principal_id NOT NULL`, `occurred_at` |
| `evidence.tombstone` (lane-03:202-212) | unchanged targets run/chunk/object; purging recording content tombstones the member's home |

Digests. Per-member `content_digest` copies the home digest. `manifest_digest` =
SHA-256 over canonical NDJSON in ordinal order: `{window_rule_digest, trigger
detection_digest, capture_policy_digest, [content_kind, home id, content_digest,
from_ordinal, to_ordinal, first_cursor, last_cursor]}`, with a declared
canonicalization/digest version (plan:510-512); trigger and window digests pin
the rule state used (I10).

Content references. `recording_member` is the only reference layer;
`ledger.evidence.content_ref` points at `recording:<recording_id>` and
`ledger.evidence.digest` carries the manifest digest. No recording-local blob.

Procedures (DAL names; generated typed repositories after regeneration):

1. `record_trigger(@recording_id, @trigger_kind, @anchor_cursor, @anchor_at,
   @detection_digest, @detected_by)` — additional trigger into an OPEN
   recording; refuses unknown kinds and sealed recordings.
2. `open_recording(@run_id, @trigger_kind, @anchor_cursor, @anchor_at,
   @window_rule_digest, @capture_policy_digest, @detected_by)` → `recording_id`;
   inserts header, window and first trigger atomically; pins stored pre-trigger
   chunks; refuses unregistered runs.
3. `seal_recording(@recording_id, @sealed_by, @request_digest)` →
   `manifest_digest`; resolves bounds, inserts members from `run_trace_chunk`
   within the window, computes the digest, and performs the single guarded
   OPEN→SEALED transition; idempotent on `@request_digest`;
   `EVIDENCE_WINDOW_UNSATISFIED` until the after-obligation closes.
4. `abort_recording(@recording_id, @reason)` — OPEN→ABORTED when the run ends
   before the after-window closes; never usable as evidence.
5. `read_recording_for_principal(@recording_id, @principal_id)` and
   `read_recordings_for_run(@run_id, @principal_id)` — owner or active grantee,
   else throw; append `access_audit`; return metadata, not bytes.
6. `grant_recording_access(...)` / `revoke_recording_access(...)`.
7. `purge_content(...)` (002b) — amended: refuse `EVIDENCE_RECORDING_OPEN` while
   an OPEN recording references the content; sealed recordings purge with
   tombstone and retained digests.

Migration additions, exactly:

- **002a**: no DDL change; the W0.6 seed grows with trigger-kind vocabulary and
  window geometries; the run-trace rule comes with conformance (lane-03:181-201).
- **002b**: `evidence.run_trace_chunk` must add `first_cursor`, `last_cursor`,
  `record_count`, `first_at`, `last_at` — without them windows cannot be
  resolved without decompressing everything (correction to plan:552).
  `evidence.run` adds `output_digest binary(32)` (or registers output as an
  object); `evidence.access_audit` gains the columns above.
- **003 `recording`** (recommended over folding into 002b): the five tables, the
  eight procedures, roles/grants, count/FK assertions, rollback twin, contract
  checks. Fold into 002b only if it is still unauthored at the W2.3 chunk-schema
  freeze; 003 keeps 002b's preflight and freeze stable (lane-03:214-229).

## Claims and dispositions

**Recommend: no new claim kinds now (no C3/C4).** D9 closes the vocabulary to
C1/C2 until Phase 4 (plan:253,278-286; R8/L0). Recordings are evidence.

- *v1 attachment*: attach the sealed recording as **observation** evidence to
  the run's C1 claim: `content_ref='recording:<id>'`, `digest=manifest_digest`,
  `subject_digest=<run identity manifest digest>`, `observed_at=sealed_at`,
  polarity `SUPPORTS`. I3 holds: the subject is the run, and the recording digest
  lives in `digest`/`content_ref`, not `subject_digest`. The trigger occurrence
  is recorded fact data, not a disposition target; a trigger never elevates
  trust by itself (T2/T6 analogy).
- *Trace conformance (the C4 alternative)*: a `ledger.verification` with
  `evidence_class='conformance'`, `scope='run-trace:<recording digest>'`,
  `rule_digest=<declared rule>`, input evidence = member digests, outcome
  `SATISFIED|VIOLATED|NOT_OBSERVABLE`; it supports a `CONFORMANT` disposition
  over the existing conformance claim once that claim and rule are declared with
  W4.1–W4.2. Properties (intent.md:129-149): every observed transition declared,
  authority evaluated before effect, HOLD honored, safe state reached, evidence
  route expected. Missing/purged records give `NOT_OBSERVABLE` + limitation (I7).
- Subject kinds: v1 uses `run`; conformance uses the capability-version claim.
  A `recording` subject kind and **deferred C3** ("trigger T of kind K fired in
  run R at cursor C; window W sealed with digest D") belong to the next D8
  vocabulary declaration, only if recordings must be independently reviewable.

## Immutability, retention and replay

- **Rows**: `DENY UPDATE,DELETE ON SCHEMA::evidence` to the runtime role, writes
  only through procedures (mirrors 001:338-348). Header/window/trigger/member
  rows are insert-once; the only update is the guarded OPEN→SEALED/ABORTED
  transition, setting seal columns once and refused to roles; seals are retryable.
- **Bytes**: chunks are append-only; reconciliation appends new indices, never
  edits stored ones; per-chunk SHA-256 and per-member `content_digest` are fixed
  at seal. Concretely: no role rewrites rows, no procedure edits a sealed member,
  and bytes cannot change without failing a digest check.
- **Purge/tombstones** (I8): `purge_content` removes only bytes and appends
  `evidence.tombstone` (`content_digest`, `removed_bytes`, reason);
  recording/member rows and digests remain; OPEN recordings pin their content.
  D5 default: 90-day content, permanent tombstones (decisions-and-corrections:112).
- **Replay** (I10): re-derive selection from retained trigger/window/capture
  digests plus member rows; verify each `content_digest` against its home and
  recompute `manifest_digest`; replay conformance against the pinned rule digest.
  Purged content yields `NOT_OBSERVABLE` with missing refs; a changed rule digest
  reports divergence, never a silent re-evaluation. A hash alone is not replayable
  evidence (plan:576-579).

## Access and endpoints

- **Reads**: owner = `evidence.run.principal_id`; grantees via `recording_grant`;
  otherwise identical 404 (A2.4, plan:786). Every read appends `access_audit`.
- **Writes/auth**: the circuit host evaluates declared triggers and calls the
  identity host over loopback with a service key (`circuit-host` for
  record/open/seal; `evaluator` for reads); the principal is server-derived,
  never body-supplied (plan:811-812; lane-04:180-197). Routes stay loopback-only
  (W2.6); a D4 browser read needs exactly one session-authorized gateway route
  (lane-02:186-198).
- **Identity-host routes (loopback)**: `POST /evidence/v1/recordings` (open),
  `POST .../{id}/seal`, `POST .../{id}/abort`, `GET /evidence/v1/recordings?run=`,
  `GET .../{id}`, `GET .../{id}/trace` (bounded), `POST .../{id}/grants`; all
  extend the W2.2 table (lane-04:243-269).
- **Microscope UI needs**: recording list; trigger marker and pre/post shading on
  the playback bar; member/manifest detail; stored-trace replay; conformance
  disposition with limitations; download bundle (W3.3). The Explorer reaches
  these through the circuit host proxy (`/api/circuit/v1/runs/{runId}/recordings`)
  with the existing cookie + caller-key pattern (`run-api.mjs:30-34,75-81`).

## Work items

Prefix `S3` per this lane's brief; the plan already uses S1–S3 for SDA requests
(plan:720-722), so renumber if adopted.

| ID | Repo | Produces | Depends on | Size |
| --- | --- | --- | --- | --- |
| S3.1 | sfx-dal | `003-recording` twins, 5 tables, 8 procedures, grants/checks, tombstone/purge amendment; preflight/install/idempotence receipts | W2.1 (002b frozen), W0.6 | 3–5 d |
| S3.2 | sfx-platform | Circuit-host recorder: declared trigger evaluation (no execution impact), open/seal with bounded retry and reconciliation | W2.3 (enriched envelope), S3.3 stubbed | 3–4 d |
| S3.3 | sfx-providers | Identity-host recording routes, DAL binding after regeneration, host tests (owner/grantee 404s, limits) | W2.2, S3.1 regen | 2–3 d |
| S3.4 | sfx-embody | Estate declaration: trigger kinds, window geometries, run-trace rule + digest | W0.6 extension | 1–2 d |
| S3.5 | sfx-platform | Microscope UI: trigger marker/shading, member list, conformance limitations, stored-trace replay | W2.5, S3.3 | 3–4 d |
| S3.6 | sfx-platform | `verify-recording.mjs` + fixtures + receipts; extend `verify-trust-ledger.mjs` L8/L10 and A2.4 | S3.1–S3.3 | 2–3 d |

Total ~14–21 eng-days on top of W2.1–W2.3. Critical path: W2.3 envelope → S3.1 →
S3.3 → S3.2/S3.5.

## Verification

- **DAL checks** (preflight, rolled back): seal digest equality and idempotence;
  member insert after seal refused; unknown trigger kind refused; purge refused
  while OPEN, tombstone + `NOT_OBSERVABLE` after seal purge.
- **Gates**: `verify-recording.mjs` — membership equals the declared window
  (precision/snapping recorded), each member digest matches its home, recomputed
  manifest equals stored, replay after purge reports `NOT_OBSERVABLE` (L8/L10),
  second-principal identical 404 (A2.4); `verify-run-evidence.mjs` stays the
  A2.2 chunk-digest gate and `verify-recording-panel.mjs` the UI check.
- **Receipts**: sfx-dal `identity/verification/` preflight/install/idempotence and
  permission-denial JSON; a staging receipt of one real triggered run end-to-end
  (seal → C1 evidence → scoped conformance + limitations) and one purge drill.

## Decisions needed

1. **D-S3.1 scope**: v1 = one run (recommended); multi-run/corridor recordings (intent.md:203-217) deferred.
2. **D-S3.2 claims**: no C3/C4 in v1; attach as observation to C1, conformance
   as a verification scope; declare C3 only with a W0.6-compliant rule.
3. **D-S3.3 detection**: circuit host evaluates declared triggers (W2.3);
   kernel-declared triggers are a later SDA request.
4. **D-S3.4 precision**: record-ordinal membership inside chunks; chunk snapping
   with recorded loss; bounds in 002b (correction 16).
5. **D-S3.5 vocabulary**: trigger kinds/window geometry declared in the estate
   (W0.6 extension or W0.7) with a reference copy and L0 drift check.
6. **D-S3.6 retention**: sealed recordings follow D5 eligibility; legal hold?;
   lifting an OPEN pin: no (recommended).
7. **D-S3.7 migration**: new 003 vs fold into 002b if unauthored.
8. **D-S3.8 privacy**: trace metadata only; private inputs never-stored (D6);
   A3.3 scan still required.

## Risks and corrections

- **Plan §5.2 correction (002b)**: `run_trace_chunk` lacks `first/last cursor`,
  `record_count` and `first/last_at`; windows cannot be resolved or replayed from
  bounds alone. Add them before the W2.3 freeze.
- **Intent correction**: W2.3 already appends the whole trace, so pre-trigger
  capture is selection at open, not a ring; a ring is only needed if capture
  becomes conditional or triggers fire outside runs.
- **Sequencing**: trigger detection depends on the enriched bridge envelope
  (`api-host.mjs:31-36` drops cursor/kind/evidenceRef today); S3.2 cannot land
  first (decisions-and-corrections:67).
- **Clocks (R6)**: time windows mix kernel and observer timestamps with 0.4–1.3 s
  skew; record each bound's clock source and prefer kernel timestamps.
- **State machine vs I8**: L8 fails if seal becomes a general UPDATE grant;
  document the one guarded transition and test all other DML paths are denied.
- **Shared-content purge**: one chunk may serve several recordings/claims;
  deletion must tombstone and mark every referencing conclusion `NOT_OBSERVABLE`.
- **Scale**: recordings add headers/members, not bytes; seal cost scales with
  chunk count; measure via A2.6/W0.5 before broad trigger sets.
- **Naming**: lane `evidence.*` vs plan `ledger.evidence` stays confusing; keep the documented mapping.

## Confidence

High on current state and 001/002/tooling facts (read directly, pinned commits).
Medium on the object-model fit: the shape sits inside a not-yet-built 002b, and
W2.3's frozen schema, the bridge envelope and the W0.6 vocabulary remain open.
Medium on effort ranges.
