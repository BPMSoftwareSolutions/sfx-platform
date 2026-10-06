# Lane 06: assurance, privacy, governance and operations envelope

Design-only, 2026-10-06. Scope: the semantic flight recorder described in
[`../intent.md`](../intent.md) and [`../research.md`](../research.md), stacked on
[the run-evidence plan](../../run-evidence-implementation-plan.md) and its
[analysis](../../run-evidence-plan/analysis/README.md). Repository roots are
`C:\lab\repos\<name>`; citations are repo-relative at the pinned commits in
`run-evidence-plan/analysis/README.md:28-34`. No repository was changed.

## Scope

1. Who may declare triggers and windows, and how declarations are admitted.
2. Access, separation of duties, privacy/redaction, retention/replay/purge.
3. The operations and cost envelope (horizon memory, bytes, sampling, alerts).
4. An honest NIST chain and reference-monitor mapping, labels included.
5. Work items `G6.*`, decisions and risks; capture mechanics live elsewhere.

## Current-state foundations

| Fact | Source |
| --- | --- |
| No trigger, window, horizon, sampling or recording concept exists in any repo; §2 of the plan freezes claims, not triggers. | plan §2:121-239; `../intent.md:37-70` |
| Meaning is authored as rows in the estate DB; capability meaning changes only by migration pair: author, dry-run, preflight-from-transaction, flip ROLLBACK→COMMIT, install, verify, commit. | `sfx-embody/AGENTS.md:25-30,79-90` |
| The identity host is the only holder of the identity connection string; the gateway captures, strips and injects it per child. | `sfx-platform/deploy/sda-kernel/gateway.mjs:13-17,87-103`; `sfx-platform/deploy/sda-kernel/identity-login.md:44-65` |
| The host runs on loopback 8793; service key is a 64-hex fixed-time-compared bearer; enrollment uses a separate operator token. | `sfx-providers/providers/cli-login/host/LoginApplication.cs:25-27,114-121`; `EnrollmentApplication.cs:32-37,117-122` |
| TLS guard currently applies only to `/auth/v1`; global 4 KiB body cap. | `LoginApplication.cs:21,45-50`; lane-04:201-207 |
| The identity DB has no `ledger`/`evidence` schemas and no append-only pattern; 002 does not exist. | lane-03:10-16,95 |
| Runtime/enrollment are separate DB roles; runtime is denied all DML on `identity` and all `provision_principal_credential`. | `sfx-dal/identity/sql/migrations/001-login-identity.commit.sql:336-348` |
| Kernel removes declared `deniedMembers` and clips shapes; budget 512 KB `invocationByteBudget`, 4,096 B payload, 65,536 B event. | `scenario-driven-architecture/languages/typescript/src/kernel/bootstrap/command-carrier.mjs:309-312,355-376`; plan B9/B11 |
| Store-side redaction scan does not exist; only kernel redaction does; gate A3.3 is unimplemented. | lane-04:81-83; plan A3.3:793 |
| Run attribution is circuit-host memory only (bounded 2,000); SDA keeps 200 runs / 20,000 events. | plan B1/B2; `gateway.mjs:107`; `services/sda-api/src/config.ts:49,51` |
| Authority digests are not retained per run; cross-language parity is open; no proof obligation is discharged; admission lives in git history. | plan B20/B23/B24/B25 |

## Governance and authority

**Thesis.** A trigger is declared data (`../intent.md:37-70`), but a trigger
definition is not configuration: it decides what memory is pinned, what content
is retained, who may rely on it, and what evidence will not exist. Under zero
implicit authority (`../research.md:466-471`; the effect question at `:105-149`)
the recorder, its triggers, windows, sampling and redaction posture hold no
authority by convention: a named principal must grant each; a default is not a grant.

- **Who declares.** The estate operator, through an `sfx-embody` migration pair
  in the W0.6 shape: a `flight-trigger.v1` contract plus one AUTHORITY set under
  `sidefx:authorities`; sfx-identity holds a reference copy and L0 drift check.
  No trigger may be added by editing host config or code.
- **Admission.** Enabling a trigger set is state 8: `ledger.admit`, called by an
  admission principal (D10, plan §3:254), recording the trigger-set digest, scope
  and conditions. Disable, widen or narrow is a new version admitted again —
  never an in-place edit (I8). The estate migration lifecycle's commit-twin
  install remains the admission of record for the declaration itself
  (`AGENTS.md:87-90`; plan B25).
- **Declaration contents.** Trigger predicate over declared event kinds
  (`../intent.md:183-199`), before/after event and time geometry
  (`../intent.md:57-68`), sampling rate and seed policy, capture scope
  (shapes/fields), disclosure class per capability (lane-05:160-168), budgets
  (horizon bytes, bytes/recording, recordings/day), owner and permitted scopes,
  retention class.
- **Why authority-bearing.** (1) It captures the causal neighbourhood, including
  pre-trigger human intent and bystander content, before any failure is proven
  (`../intent.md:357-380`). (2) The horizon consumes circuit memory and can affect
  latency (plan R1). (3) It determines which evidence classes can later support a
  disposition (T2/T4, plan §2.2:153-180). (4) It is itself an effect on data subjects.
- **Recording claims.** A sealed recording needs a claim kind (proposed C3,
  "recording sealed for trigger T, window W, digests D") or an evidence package
  attached to C1/C2. Multi-run circuit windows cross today's per-run C1/C2; new
  decision D16.
- **Sampling is authority.** A sampled corpus must not be readable as complete.
  Each trigger declares its rate; each include/exclude decision records its
  deterministic basis and digest; sampled-out executions surface as limitations,
  never as absence of events.

## Access and separation of duties

- **Default.** Runner-only (D4, plan §3:248). Grant links resolve only for
  signed-in grantees; every non-owner read, list, trace and claims request returns
  an identical 404 (A2.4:786; W2.6:705). Public read only if D4 says so.
- **Read/extract/export.** Read: runner plus grantees. Export is narrower:
  runner, or an admitted governance role (D13), with an `evidence.access_audit`
  row (W5.2:750) and a digest manifest. Operators see only their own runs
  (D7:251); legal hold is not a read grant.
- **Keys and posture.** Per-caller service keys in Key Vault, roles from a static
  host map, never request JSON (lane-04:180-197); admission gets its own key
  (D10; `EnrollmentApplication.cs:32-37`). Routes stay loopback-only behind the
  gateway (W2.6); the TLS guard prefix must widen to `/ledger/v1` and
  `/evidence/v1` (lane-04:201-207). Principals always resolve from a session the
  host validates itself (plan §8:811-813).
- **Roles.** Producers attach; the evaluator decides verification; only admission
  principals write state 8; no role rewrites history (I6/I8/I9, plan §5.3:567-571;
  §8:806-810). The recorder is a producer: it attaches recordings and scan results
  and never decides a disposition or admits its own trigger set; activation is an
  admission-principal action (G6.2).

## Privacy and redaction

- **Never in a recording.** Credential-shaped values and the 20 `deniedMembers`
  names (plan B9); login/enrollment bodies (D6:250); private inputs; session
  bearers; connection strings and vault references; other principals' content;
  content beyond the declared disclosure class.
- **Personal data is expected.** Prompts and responses can contain personal data
  (plan §8:821-822), and model input/output is what a trigger wants to capture.
  Full capture therefore defaults to `DIGEST`, not `FULL`: per-capability
  `NONE|DIGEST|FULL` declaration (lane-05:160-168); `FULL` is admitted and scoped.
- **Verification before sealing.** Pipeline: kernel redaction
  (`command-carrier.mjs:355-376`) → host-side A3.3 scan (absent today,
  lane-04:81-83) → disclosure filter → scan digest → seal. A failed or missing
  scan refuses the seal, records `NOT_VERIFIED` and leaves `trace_complete=0`; it
  never seals optimistically. `redactionVerified` (W3.2) must be true before seal.
- **Horizon memory.** The pre-trigger ring buffer holds plaintext temporarily;
  bound its bytes and lifetime, strip denied members on ingest, scrub on window
  close and never write it to logs or disk before sealing.
- **Erasure.** D5 deletion-on-request removes bytes; digests and ledger history
  remain (I8). Erasure cannot rewrite history; that tension is a declared
  limitation, subject to legal hold (D13). Purges record tombstones so a deleted
  recording is visibly deleted, not absent.

## Retention, replay and purge

- **Defaults.** 90 d content, tombstones forever, deletion on request
  (`decisions-and-corrections.md:112`; D5:249). Content expiry is a controlled
  procedure, never a direct DELETE; the proposed `evidence.tombstone` carries
  content digest, removed bytes, reason and rule digest (lane-03:202-212).
- **Replay period.** Required material must remain available for the declared
  I10 replay period (plan §5.3:571-579). A hash alone is not replayable: after
  purge, replay reports `NOT_OBSERVABLE` with the missing references (R11:838).
  A recording's replay period may exceed the default content horizon only if its
  trigger set declares it and admission accepted it.
- **Survives purge.** Subject/claim rows, evidence links, trigger-set digests,
  sampling decisions, verification/disposition rows, limitations, lineage,
  tombstones, access audit, and the export manifests. Does not survive: trace
  chunk bytes and evidence objects.
- **Legal hold and export.** Liabilities forces (`../research.md:234-284`: EU
  product liability, AI-Act logging/traceability) need retention that outlives
  product decisions. A hold is an append-only governance disposition admitted by
  an admission principal; while held, expiry and deletion-on-request are refused
  and the refusal is recorded. Export packages (manifest + digests + claims +
  access audit) are the format legal requests should name (D13).

## Operations and cost

- **Volume model.** Per run: trace ≈ 60-85 KB Brotli (2.63 MB raw), evidence
  objects small today (252-406 B/exchange, B6) but unmeasured once W3.2 restores
  bodies — W0.4/E08 is the sizing input. Worked sampling case: 10,000 recordings
  × 85 KB ≈ 850 MB per campaign; 10,000/day at 85 KB across a 90 d horizon ≈
  76 GB before indexes and evidence objects. Azure SQL tier, max size and write
  latency are unmeasured (W0.5; no harness, lane-03:119-129); R1 may force
  `ledger`/`evidence` into their own database.
- **Horizon memory.** Recorder retains raw records per active run: bytes ≈
  horizon × concurrency (2 MB × 8 runs ≈ 16 MB); 615 KB graph records and the
  65,536 B event budget are the spikes. Cap horizon bytes, truncate oversize
  records with a recorded gap, and seal open recordings `NOT_OBSERVABLE` on restart.
- **Sampling controls.** Per trigger: rate, max bytes/recording,
  max recordings/day, min post-window closure; global recorder budget; declared
  shedding order (shapes first, per B11; authority-denied triggers never shed
  silently). Every shed/refusal is a limitation.
- **Operating views** (extends W5.3): trigger rate per trigger, recordings/day,
  capture failures (`trace_complete=0`), recorder lag, horizon evictions,
  sampled-out counts, bytes/day and days-to-limit, held recordings, purge runs
  and tombstone counts, claims by state, limitations by kind.
- **Alerts.** Recorder lag beyond threshold; trigger matched but not sealed;
  capture-failure rate; redaction-scan failure (blocking); storage growth vs
  budget; purge or hold-refusal failure. All alerts link to the recording or its
  tombstone, not to raw content.

## Non-repudiation mapping (honest status)

| Concern (`../intent.md:240-280`) | SideFX artifact | Status today | Label |
| --- | --- | --- | --- |
| Identity — who participated | `ledger.subject` + run manifest | graph digest retained; executor digest absent; local selection is not evidence (§5.4) | PARTIAL — run identity, not attributable executor |
| Authorization — what was permitted | `claim_authority` → `authority_ref` | run record keeps no bound authority digests (B20) | DESIGNED — not retained today |
| Least privilege — capability/provider | capability version, provider exchanges, endpoint refusals (E01) | observed, never recorded as a disposition | PARTIAL |
| Execution — what happened | Brotli trace chunks + SHA-256, append-only I8 | 002/W2.3 not started | DESIGNED, NOT BUILT |
| Effect authority — what may change | none | no effect-envelope model; runs are the only effect | ASPIRATIONAL |
| Auditability — reconstruct | `ledger`/`evidence` + tombstones + access audit | unbuilt | DESIGNED, NOT BUILT |
| Non-repudiation — attribution | digests, lineage, per-caller keys | no signatures, no timestamp authority, writer can be compelled | NOT SUPPORTED as cryptographic non-repudiation; hash-linked attribution only |
| Verification — reality obeys authority | observed vs expected trace | parity open; 0/738 conditions formal (B23/B24) | ASPIRATIONAL |
| Formal assurance — invariants hold | obligations + certificates | no prover/checker (Q8) | ASPIRATIONAL |

| Reference-monitor property (`../intent.md:282`) | Status today | Label |
| --- | --- | --- |
| Mediation | identity host is the planned sole writer (D2); other emitters (kernel lane, API memory) remain | PARTIAL |
| Non-bypassability | nothing proves all content reaches the recorder; logs and memory paths exist | NOT SUPPORTED |
| Tamper resistance | DENY UPDATE/DELETE + ownership chaining (I8/L8), but no pattern exists in sfx-dal yet; DBAs can change rows | DESIGNED (application roles only) |
| Small enough to analyze | closed vocabulary, but 19+ tables, external rule sets, generated DAL | NOT SUPPORTED |

## Work items

| ID | Repo | Produces | Deps | Size |
| --- | --- | --- | --- | --- |
| G6.1 | sfx-embody | `flight-trigger.v1` contract + AUTHORITY set (predicates, windows, sampling, disclosure, budgets), digest, fixtures | W0.6 conventions (lane-05:75-95); D8; D12 | 2-4 d |
| G6.2 | sfx-dal | Trigger-set subject/claim, version pinning, admit guard through `ledger.admit` | W2.1; lane-03 admission table:151-177; D10/D16 | 2-3 d |
| G6.3 | sfx-platform | Circuit-host horizon ring buffer, trigger matcher, pinned window, seal orchestration, memory bounds | W2.3; W0.4 sizes; S1/W3.2 for shapes; D15 | 5-7 d |
| G6.4 | sfx-providers + sfx-platform | Store-side redaction scan (A3.3), disclosure enforcement, seal refusal + scan digest | G6.3; D6; B9; lane-04:81-83 | 3-5 d |
| G6.5 | sfx-platform + sfx-providers | Grant links, owner-only reads/export, export manifest + `access_audit`, legal-hold API | W2.2; W2.6; W5.2:750; D4/D13 | 4-6 d |
| G6.6 | sfx-dal | `evidence.tombstone`, purge/hold procedures, replay-period enforcement | W5.1:749; W2.1; lane-03:202-212; D5/D13 | 3-5 d |
| G6.7 | sfx-platform | Operating views + alerts; sampling/budget controls; capacity reports | W5.3:751; G6.3/G6.4; D12 | 3-5 d |
| G6.8 | sfx-platform | Non-repudiation spike: export signing/TSA options, cost, honest claim wording | D14 | 1-2 d |

Sequencing: G6.1/G6.2 with W0.6; G6.3 after W2.3; G6.4 with W2.2; G6.5/G6.6 with W5.x.

## Decisions needed

- **New:** D11 trigger authority (estate declares, admission activates; reuse D10
  principals), D12 sampling/budget authority (rates, caps, sampling of
  authority-denied triggers), D13 legal hold/export (who holds, exports, hold
  outranks D5), D14 non-repudiation target (hash-only vs signed exports/TSA),
  D15 recorder home and horizon (circuit-host memory vs SDA; bounds; restart
  semantics), D16 recording claim model (new C3 vs C1/C2 evidence package;
  multi-run windows).
- **Confirm existing:** D2 (identity host, per-caller keys), D4 (runner-only),
  D5 (90 d content, tombstones forever), D6 (never-store private bodies), D7
  (operator attribution), Q5 (retention + sharing), Q7 (independence for
  cross-verified recordings).

## Risks and corrections

- **Cost/scalability (high).** Horizon memory × concurrency, 615 KB spikes,
  10k-recording campaigns and Azure SQL write latency are unmeasured; R1 login
  contention is real. Mitigate with declared budgets, compression, sampling and
  the D1 schema-move option.
- **Misuse/surveillance (high).** A pre-trigger window captures before any
  proven fault; operator/incident access and exports are the leak points. Hold
  access narrower than D4, audit every read/export, and never grant a broad
  operator role by default.
- **Evidentiary suppression (medium).** Trigger sets can be quietly narrowed or
  sampling raised. Versioned, admitted trigger declarations and sampled-out
  limitations make suppression visible, not impossible.
- **Sampling bias (medium).** A 10k corpus proves the rate it was drawn at, not
  all executions; label every corpus analysis with its sampling declaration.
- **Corrections.** "Immutable recording" overclaims: hashes give integrity
  relative to a trusted writer, not non-repudiation. A3.3 does not exist, so
  sealing depends on G6.4. Trigger/window/sampling appear nowhere in the plan; the
  recorder is a new producer class. Full content depends on S1/W3.2, and horizon
  loss on restart is a real `NOT_OBSERVABLE` path.

## Confidence

High on current-state facts and constraints (read directly). Medium on volume
projections and effort: content bytes after W3.2, Azure SQL limits and recorder
overhead are unmeasured (W0.4/W0.5). The non-repudiation labels are deliberately
conservative and should be re-rated only when G6.4 and G6.8 land.
