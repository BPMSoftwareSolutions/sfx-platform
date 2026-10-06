# Open items across the repositories

Recorded 2026-10-06 from two reviews of the run-evidence and resident-kernel work.
It records what each repository needs to address next.

Update 2026-10-06: X1 closed by `3275616` and accepted workflow run
`37513029598`. X2 closed: DAL `24fee68`, `8461695` and Linux restore lock
`bcaae40` are pushed. X3 closed: provider commits through `a020024` are pushed.
The identity transport's staging rollout is being delivered through the staging
workflow with a complete-capture readback gate after a confirmed restart.
The original observations below remain historical; unrelated X9 files remain
with their owner.

**State this document describes.**

| Repository | Commit | Push state |
| --- | --- | --- |
| sfx-platform | `16048a2` | pushed |
| sfx-embody | `18475d4` | pushed |
| scenario-driven-architecture (SDA) | `01a33a7` | pushed |
| sfx-dal | `8461695` | **local only, 2 ahead** |
| sfx-providers | `a020024` | **local only, 3 ahead** |

Staging is serving release `composite-4c728d2771d4-37460818508-1`. The two
releases after it were rejected and rolled back.

Each item has an ID, the repository that owns it, the evidence, the fix, and a
condition that shows it is done. Close an item by meeting its done-when and
noting the commit here.

## Order of work

| # | Priority | Repo | Item | Done when |
| --- | --- | --- | --- | --- |
| X1 | **Blocking** | sfx-platform | Staging acceptance reads runs without the session cookie | A staging release passes every acceptance step |
| X2 | High | sfx-dal | Identity migrations are live, but their source is not pushed | `main...origin/main` shows no commits ahead |
| X3 | High | sfx-providers | Identity host evidence code is not pushed | Same |
| X4 | High | sfx-embody | A test authority row was left in the live estate | The row is removed by a declared writer |
| X5 | High | sfx-embody | The resident migration is not idempotent | Its preflight replays cleanly |
| X6 | High | SDA | The C# resident kernel ignores a failed identity revert | C# exits on teardown failure, with a test |
| X7 | Medium | sfx-embody | The equity acceptance pin was relaxed without a receipt | Receipts and a stated condition for each path digest |
| X8 | Medium | sfx-platform | The resident transport's tests are not committed; a wrong error code on kernel exit | The harness is committed and the code corrected |
| X9 | Medium | sfx-dal | 27 uncommitted files from a separate DAL regeneration | Committed or discarded by their owner |
| X10 | Low | sfx-platform | Commit records that misdescribe their content | Accepted as corrected by this document |
| X11 | Low | sfx-platform | Stale kernel digest in the run-evidence plan | Plan updated |
| X12 | Low | sfx-platform | The observer bridge drops the event kind | Evidence records keep their kind |
| X13 | Low | SDA | JVM crash logs in the repository root | Deleted |

X1 comes first. Until it is fixed, every push to sfx-platform `main` that touches
`live-circuit/**`, `deploy/**` or `tools/**` deploys a release that is then
rejected. The rejected image serves staging until the rollback job finishes.

---

## X1 · Staging acceptance reads runs without the session cookie (sfx-platform) — blocking

**Evidence.**

- Releases 37498796760 (`63dd71b`) and 37506870735 (`16048a2`) both fail the step
  "Real sign-in, live Observe, sign-out and captured replay".
- The retained `browser/failed.json` reads: "Real Observe must complete
  successfully".
- The retained `browser/run.json` reads:
  `{"disposition":"SIGN_IN_REQUIRED","error":"Sign in to read your runs."}`.
- Both releases were rolled back. In the second, the rejected image served
  staging for several minutes before the rollback job ran.

**Cause.**

- `02f6d3f` made every run read require a signed-in session
  (`live-circuit/circuit/run-api.mjs`, the `GET` branch under
  `requireSession`). That is the intended "runner only" default (plan D4).
- `tools/live-circuit/verify-browser-session.mjs:123-124` still fetches
  `/api/circuit/v1/runs/{id}` and `/output` without a cookie. The script already
  holds the session cookie and sends it at `:59-62` and `:161`.

**Fix.** Send the signed-in session cookie on those two reads. Keep the sign-in
rule.

**Done when.**

- The script passes against the local stack before pushing.
- The next staging release passes all deploy steps, and `finish` records the
  accepted release.

## X2 · Identity migrations are live, but their source is not pushed (sfx-dal) — high

**Evidence.**

- `24fee68` (migration `002-run-evidence`) and `8461695` (migration
  `003-trust-authority`) exist only locally.
- Both are installed on the `sfx-identity` database: install receipts
  `identity/verification/run-evidence-install.json` (2026-10-06T15:26:21Z) and
  `trust-authority-install.json` (16:39:40Z).
- If this machine is lost, origin cannot reproduce the live schema.

**Fix.** Push both commits. Check X9 first: `identity/packages.lock.json` is
modified in the working tree, so decide whether the identity build needs it
before pushing.

**Done when.** `git status -sb` shows `main...origin/main` with nothing ahead.

## X3 · Identity host evidence code is not pushed (sfx-providers) — high

**Evidence.** These commits exist only locally:

- `52fb1ff`: owner-scoped run evidence transport;
- `76303ae`: trust authority through the private identity API;
- `a020024`: documentation.

They serve the X2 schema. The staging identity binary does not contain them.

**Fix.** Push the commits. Packaging and deploying the identity binary is
run-evidence plan work (§ "Remaining delivery order"), not part of this item.

**Done when.** `main` is in sync with origin.

## X4 · A test authority row was left in the live estate (sfx-embody) — high

**Evidence.**

- `declare-resident-reuse-and-revertible-identity.sql:189` (`.commit.sql:191`)
  mints `AUTHORITY r4:reuse-proof / r4-reuse-key-probe.v1` (`{"probe":true}`)
  to prove that the reuse read changes on a mint.
- Installing the commit twin persisted that row.
- The `18475d4` message says `model.retire_semantic_object_definition` refuses it
  with `RETIRE_SELECTED`, and that no installed writer removes an AUTHORITY object.
- AGENTS.md repair discipline requires a missing writer to be recorded in an
  inspect set. `sql/inspect/resident-session-reuse/` has only the proof query, and
  no README recording that the writer is missing.

**Fix.**

1. Record the missing removal writer in `sql/inspect/resident-session-reuse/`,
   with a count query for the probe row.
2. Declare the writer in its own migration pair.
3. Remove the row through that writer.

**Done when.** The inspect query counts zero probe rows, and the writer is
installed through a migration pair with its preflight receipt.

## X5 · The resident migration is not idempotent (sfx-embody) — high

**Evidence.**

- Replaying the preflight `declare-resident-reuse-and-revertible-identity.sql`
  on 2026-10-06 failed with `RESIDENT_REUSE_STATEMENT_BLIND_TO_MINT`. The check
  is at `:194`, and the transaction rolled back.
- The probe already exists (X4), so minting it again changes nothing and the
  "key changes on mint" check fails.
- The file's own header (`:46`) says it is idempotent.
- The installed state can no longer be re-verified with its own preflight.

**Fix.**

- Run the mint proof under `SAVE TRANSACTION` and roll back to the savepoint
  after the check, so verification never persists a row.
- Apply the change to both twins, so a replay re-proves without writing.
- General rule: no verification inside a committing migration may leave a row
  behind.

**Done when.** The preflight replays to `MIGRATION ROLLBACK COMPLETE` on the
installed estate, and running the commit twin again leaves the estate unchanged.

## X6 · The C# resident kernel ignores a failed identity revert (SDA) — high

**Evidence.**

- `languages/csharp/src/ScenarioKernel/bootstrap/ResidentDelivery.cs:126-129`
  wraps `lease.CompleteAsync` in `catch { }`. That call covers the
  `REVERT WITH COOKIE` and the rollback.
- A failed revert or rollback is therefore swallowed. The envelope is reported as
  a success, and the next envelope reuses the same connection.
- Node and Python treat a failed revert as fatal and exit, so the host reconnects:
  `resident-delivery.mjs:92` and `resident-read-session.mjs:175`; `entry.py:742`.
- No C# test throws from `RevertAsync`.
- C# is the staging kernel, so this applies as soon as resident delivery is
  enabled there.

**Fix (SDA; from the estate this is a request, per sfx-embody AGENTS.md).**

- A teardown failure (revert or rollback) disposes the session, writes the
  failure line and exits with code 4, matching Node and Python.
- Add a `DatabaseResidentSessionTests` or `ResidentDeliveryTests` case where
  `RevertAsync` throws.
- Add the same case to the shared cross-language corpus, which the resident
  request's exit criteria list as not yet claimed.

**Done when.** The new C# test passes, and the three languages give the same exit
code and failure line for a revert failure.

## X7 · The equity acceptance pin was relaxed without a receipt (sfx-embody) — medium

**Evidence.**

- `18475d4` changed `config/kernel-acceptance-suite.v1.json`. The equity
  `resolved-live` path digest changed from `equals acdb735b…` to `one-of
  [acdb735b…, 7bc7e389…]`, through
  `update-kernel-acceptance-suite-equity-path.{sql,commit.sql}`.
- The stated cause is "after the resident session-policy installation".
- A CLI observation from about 09:00 the same day, before that install at 13:51,
  already took the rate-limit fallback path. Two quote providers answered HTTP
  429 (`sfx-platform/docs/run-evidence-plan/evidence/E01-equity-cli-observation.txt`).
- No receipt containing `7bc7e389…` is committed. It appears only in the suite
  and its migration.

**Fix.**

- Retain an acceptance receipt for each digest, with its exchange outcomes.
- State which provider outcomes produce which path.
- Pin each digest to its condition, rather than accepting either one
  unconditionally.

**Done when.** Each digest in the pin has a committed receipt and a stated
condition.

## X8 · Resident transport tests are not committed; wrong error code on kernel exit (sfx-platform) — medium

**Evidence.**

- `16048a2` and the SDA resident request's exit criteria cite "9 fake-kernel
  cases". Only `live-circuit/circuit/live-store.mjs` changed, and no harness is in
  the repository.
- In `live-store.mjs:79`, a kernel that exits during a request fails it with
  `CIRCUIT_READER_INVALID_JSON` instead of `INSTALLED_KERNEL_UNAVAILABLE`.

**Fix.**

- Commit the harness, for example `live-circuit/circuit/verify-resident-transport.mjs`.
- Map process exit to `INSTALLED_KERNEL_UNAVAILABLE`, with a case for it.

**Done when.** The harness runs in the repository and covers the exit case.

## X9 · 27 uncommitted files from a separate DAL regeneration (sfx-dal) — medium

**Evidence.** The working tree has modified `Functions/` repositories and models,
`SFX.DAL.Config.json`, `catalog-manifest.v1.json` and
`identity/packages.lock.json`. It has untracked
`Procedures/{Interfaces,Repositories}/IAnalysis*`
(`FvExtractExecutionAuthority`, `ReadAltitudeTopology`,
`ReadCapabilityAltitudeTopology`, `ReadCapabilityDetails`,
`ReadKernelCanonicalGraph`). These belong to another unit of work, not the
identity commits.

**Fix.** The owner commits them with a generation receipt or discards them.
Stage explicit paths only.

**Done when.** `git status` is clean.

## X10 · Commit records that misdescribe their content (sfx-platform) — low

Pushed history is not rewritten. This table is the correction record.

| Commit | Message says | Actually contains |
| --- | --- | --- |
| `327a2c2` | A link to a local Windows path; "revision 3" of the plan | The plan revision, **plus** other work's pending files: `README.md`, `docs/architecture.md`, `docs/circuit-event-material-baseline-2026-09-23.md`, `docs/home-page-design.md`, `docs/website-design-spec.md`, and six scripts under `scripts/` (`flow-debug*.ts`, `flow-inspect*.ts`, `flow-members-local.ts`, `shape2-live-proof.mts`) |
| `63dd71b` | The C1 evaluator review summary (32 fixtures, DAL, private API) | 11 files, 3,179 lines of `docs/sfx-flight-recording/` analysis and plan |

**Action.** The owners of the swept files confirm whether those changes were
ready.

**Done when.** Confirmed, or follow-up commits revert what wasn't ready.

## X11 · Stale kernel digest in the run-evidence plan (sfx-platform) — low

**Evidence.**

- `docs/run-evidence-implementation-plan.md:425` (baseline B18) and `:635` (the
  worked example) cite the executor digest `d0fe2b83…`.
- The estate selected `7da5be06…` in `507dd13` and then `8af42093…` in `18475d4`.
- The baseline is labelled pre-implementation, but the worked example is read as
  current.

**Fix.** Note the currently selected executor, and say which run each digest
belongs to.

**Done when.** The plan names its digests by date.

## X12 · The observer bridge drops the event kind (sfx-platform) — low

**Evidence.**

- `tools/live-circuit/api-host.mjs:36`, and the local-stack bridge, publish every
  API event as `kind: 'observation'` with the payload only.
- Evidence records (`provider-exchange-shape.v1`, `model-response-shape.v1`)
  therefore reach the observer unlabelled, and the timing log had to infer them
  (`docs/replay-timing-fidelity.md`).

**Fix.** Forward the API event kind in the observer record.

**Done when.** A captured run shows evidence records with their kind.

## X13 · JVM crash logs in the repository root (SDA) — low

**Evidence.** Untracked `hs_err_pid36376.log` and `replay_pid36376.log`
(2026-10-06 13:20) are from a crash of the VS Code Red Hat Java extension. The
environment section holds only `JAVA_HOME`, `PATH`, `USERNAME`, `OS`,
`PROCESSOR_IDENTIFIER`, `TMP` and `TEMP`.

**Fix.** Delete both files.

**Done when.** They are gone. Never commit them.

---

## Programs in flight (tracked elsewhere)

| Program | Where | Open |
| --- | --- | --- |
| Run evidence and trust ledger | `sfx-platform/docs/run-evidence-implementation-plan.md` | See below. |
| SDA run evidence request | `sfx-embody/docs/request-sda-run-evidence.md` | S0–S3: attributable executor identity, an evidence port in place of discard, owner identity on evidence records, separate evidence budgets |
| Resident kernel delivery | `scenario-driven-architecture/docs/request-resident-kernel-delivery.md` | See below. |
| Replay timing fidelity | `sfx-platform/docs/replay-timing-fidelity.md` | The whole-invocation bar landed in `02f6d3f`. Provider dwell remains unavailable where child receipts do not identify the exchange (needs S2). |
| Explorer run evidence design | `sfx-platform/docs/explorer-run-evidence-design.md` | The In and Out and Request and Response panels wait on S1 and the re-declared shapes |
| Owed estate violation | `sfx-embody/AGENTS.md` (dependency law) | The migration lifecycle still runs from an SDA checkout |
| Deferred by the product owner | — | Legacy deck routes and the observer root page; Explorer summary cards, the operation scene key and specialized presentations |

Open work in the run-evidence plan:

- the claim ledger (`004-trust-ledger`);
- authenticated producers;
- evaluator integration with a persisted basis;
- historical replay;
- retention tombstones;
- staging caller credentials and identity binary rollout;
- then SDA S1–S3.

Open exit criteria of the resident kernel request:

- the staging fixed cost per envelope below 0.3 s, measured;
- a shared cross-language resident corpus;
- a live host run on staging;
- a governed kernel release into the platform image. The release policy refuses
  kernel changes by design today.

## Working agreements

These follow from the items above.

1. **After pushing, verify the push and the deploy.** After any sfx-platform push
   that touches `live-circuit/**`, `deploy/**` or `tools/**`, check
   `gh run list --workflow staging.yml` and report the actual result. A summary
   is not evidence (X1).
2. **Run the staging browser acceptance locally first.** Do this before pushing
   changes to `run-api.mjs`, `identity-session.mjs` or the evidence store (X1).
3. **Push a live install's source in the same turn.** A database install,
   whether the estate or sfx-identity, and its source commits are pushed together
   (X2, X3).
4. **Committing verification must not persist rows.** Use a savepoint and roll
   back to it inside the migration. A committed install leaves only the declared
   change (X4, X5).
5. **Language parity covers failure paths.** A fatal condition in one kernel is
   fatal in all three, with a test in each (X6).
6. **Acceptance pins change only with a receipt and a cause.** The receipt is
   retained, and the cause is backed by evidence (X7).
7. **Commit the tests you cite.** A test cited in a commit message or an exit
   criterion is committed in the same change (X8).
8. **Stage explicit paths.** Never sweep other work's pending files into a
   commit. Messages describe the commit's own content, with no chat summaries or
   local paths (X9, X10).
