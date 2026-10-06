# Synthesis: gate and evidence map for the 3 turns

Produced 2026-10-06 by synthesis lane. Sources: the six lane documents in this
folder and [the plan](../../run-evidence-implementation-plan.md) §7.

**Turns.** T1 = Phase 1 exit (Explorer on today's data), T2 = Phase 2 exit
(ledger core, no SDA change), T3 = Phase 3 exit (evidence content + C2).
Receipt shorthands: `R/<gate>` = `deploy/run-evidence/<gate>-acceptance-<yyyymmdd>.json`
(schema mirrors `deploy/sda-kernel/*-acceptance-*.json`); `E/` =
`docs/run-evidence-plan/evidence/`; `D/` = `sfx-dal/identity/verification/`
(convention of `001`).

**Verdict.** Full staging Phase 2/3 exits are **not defensible by T3**
(CodeLightly/DAL regeneration, staging + Key Vault 3–7d lead, SDA serialization
1–2wk csharp-first, W0.5 Azure). Defensible T3 "done" = T1 fully green; T2 green
as a **local ledger-contract exit** (real migration if DAL unblocks, else frozen
stub + procedure fixtures, with 002 receipts explicitly blocked); T3 green as a
**content-harness exit** against S1/W3.1 or a stub store. Staging-class gates
carry named deferrals.

## 1. Smallest defensible gate subset per boundary

| Boundary | Must pass by then | Deferred past T3 (justification) |
| --- | --- | --- |
| Phase 1 exit (T1) | A1.1, A1.2, A1.3, A1.4, A1.5 + E06 (W0.2) + W0.6 digest recorded | W0.3–W0.5/E07–E09 (external SDA worktree, Azure; no Phase-1 dependency); W0.6 slips at most to early T2, else L0/L4/L10 slip with it |
| Phase 2 exit (T2) | A2.1, A2.2, A2.3, A2.5-local (local-stack restart), A2.7, A2.8-local; L0, L1, L2, L3, L4, L7, L8, L10 for implemented C1 rules; L5/L6/L9 as "target state unavailable → refused" fixtures | A2.4 (no sharing surface in release; owner-scoped read endpoints land W2.5/W5.2, 2–4d); A2.5-staging (3–7d staging access; local restart proves contract); A2.6-final (needs W0.5 threshold; provisional local receipt only); A2.8 staging-mode; full L5 proof matrix (needs W4.4/Q8); full L6 matrix (Q7 independence open; CROSS_VERIFIED unavailable); L9 real admission (needs W4.5) |
| Phase 3 exit (T3) | A3.1, A3.2, A3.3, A3.4 on the S2/S3 path; A3.5 if W3.2 lands with/before S3 and the browser module is available | A3.5-browser (fallback: A3.1/A3.3 vs stub store; re-run as first T4 gate); all A4.n (Phase 4 entry requires staging L0–L10); W4.3 parity probe (B23 open; must land as `VIOLATED`/`NOT_OBSERVABLE` first); W5.x ops; E07–E09 if SDA/Azure lanes miss |

Deferral rule: every deferred gate commits a `deferred` receipt (`gate`,
`reason`, `owning lane`, `first re-check date`) so "done" is auditable, never
silent.

## 2. Gates first passing T1–T3

| Gate | Producing script or test | Receipt | Key deps | Local or staging |
| --- | --- | --- | --- | --- |
| A1.1 | new `tools/live-circuit/verify-run-report.mjs` | `R/A1.1` | today's `/v1/runs/{id}` + `/output`, W1.1 | local |
| A1.2 | existing `tools/sfx-api/verify-circuit-replay.mjs` | `R/A1.2` | release capture (accepted 10.8/10.5 ms) | local re-run, staging capture retained |
| A1.3 | tightened `verify-circuit-replay.mjs` (today 32/406 frames) | `R/A1.3` | W1.2 dwell model | local |
| A1.4 | new `tools/live-circuit/verify-evidence-panel.mjs` | `R/A1.4` | W1.3, `capture.sse` | local |
| A1.5 | `verify-explorer.mjs` extension | `R/A1.5` | W1.4, `GET /session/runs` | local |
| E06/W0.2 | env read, no secrets printed | `E/E06-run-retention.json` | staging config | staging-read |
| W0.6 | sfx-embody migration pair + rule fixtures | `E/vocabulary-declaration-<digest>.json` | estate lane | local |
| A2.1+A2.2 | new `tools/live-circuit/verify-run-evidence.mjs` | `R/A2.1`, `R/A2.2` | W2.3+W2.2+W2.1, or frozen stub | local, then staging replay |
| A2.3 | `verify-circuit-replay.mjs --source stored` | `R/A2.3` | W2.3/W2.5 stored trace | local |
| A2.5-local | local-stack restart test (`tools/live-circuit/start-local.mjs`) | `R/A2.5-local` | W2.1+W2.2 | local |
| A2.6 | new `verify-run-latency.mjs` | `R/A2.6-provisional` | W2.3 writes; W0.5 threshold | local (final: staging/Azure) |
| A2.7 | new `verify-trust-ledger.mjs` (C1 fixture → OBSERVED + replay) | `R/A2.7` | W0.6+W2.1+W2.2+W2.4 | local |
| A2.8 | fault-injection harness (store 503/kill, recovery) | `R/A2.8-local` | W2.3 | local |
| L0–L10 | `verify-trust-ledger.mjs` + procedure/host fixtures | `D/L0..L10-<date>.json` (+ `002` install receipts) | L0/L4/L10: W0.6+W2.1; L2/L3/L5–L9: W2.1/W2.2 | local |
| A3.1–A3.3 | `verify-run-evidence.mjs --content/--owners/--denied-scan` | `R/A3.1`, `R/A3.2`, `R/A3.3` | S1+W3.1 (or seeded stub store) | local |
| A3.4 | SSE before/after same-input capture | `R/A3.4` | W3.2+S3 | local |
| A3.5 | browser acceptance (`SFX_BROWSER_TEST_MODULE`) + ledger query | `R/A3.5` | S2/S3+W3.2+browser lane | staging |

## 3. Turn-1 stubs and swap-safe assertions

- **Identity host** (`/ledger/v1/*`, `/evidence/v1/*`): loopback stub behind
  `SFX_RUN_EVIDENCE_STUB=1`, same routes/schemas as W2.2. Assert:
  `subject.digest` NOT NULL and exact-match on attach (I3 → 409); `claim_kind`
  closed to C1/C2; polarity/outcome enums; append-only (no update/delete routes;
  refutation retained, I8); `NOT_OBSERVABLE` never counts as SUPPORTS (I7);
  `admit` by non-admission principal → 403 (I9); retry idempotent, same
  disposition id, no new elevation (I2). Commit the wire schema as
  `contract_version`.
- **Evaluator (W2.4)**: deterministic table-driven rule-set-v1 stub returning
  `SATISFIED|VIOLATED|NOT_OBSERVABLE|INCONCLUSIVE`. Assert: missing
  identity/outcome → `NOT_OBSERVABLE` + limitation; newer support never erases
  contradiction; no numeric state comparison. Persist `evaluator_subject_id`,
  definition digest, `rule_digest` on every verification.
- **Evidence content**: seed store from E03/E04 records and E05 traces;
  `--source stored` fixture from `capture.sse`. Assert `sha256(content)==ref.digest`,
  owner cell maps to a scene node, zero `deniedMembers`/credential-shaped values,
  unknown ref → 404 (never the pre-S1 501).
- **Swap-safety rule**: every receipt pins `{contract_version, fixture digests,
  subject digests, evaluator definition digest, rule_digest, stub:true}`.
  Real-endpoint swaps re-run identical fixtures and emit a **superseding receipt
  via lineage** (I8) — stub receipts are never edited or deleted. Gate verdicts
  compute only from pinned inputs, never stub internals; phase-exit claims cite
  non-stub receipts only.

## 4. Receipt inventory to commit

- **T1**: `R/A1.1`–`R/A1.5` (one file per gate; fields: gate, tool+digest,
  commit, host, inputs+digests, measurements, threshold, verdict, timestamps);
  `E/E06-run-retention.json`; `E/vocabulary-declaration-<digest>.json` + rule
  fixtures; `deploy/run-evidence/stub-identity-contract-v1.json` + stub self-test
  receipt.
- **T2**: `D/002-trust-ledger-{preflight,install,idempotence,generation}.json` or
  a single `002-blocked-<reason>.json`; `D/L0..L10-<date>.json` + replay
  fixtures; `R/A2.1`, `R/A2.2`, `R/A2.3`, `R/A2.5-local`, `R/A2.6-provisional`,
  `R/A2.7`, `R/A2.8-local`; stub→real supersession receipts.
- **T3**: `E/E07-content-spike.json`, `E/E08-shape-spike.json`,
  `E/E09-identity-tiers.json` (only if lanes land); `R/A3.1`–`R/A3.5`; S1/S2/S3
  request acceptance notes + W3.2 preflight/rollback receipt.
- **All turns**: `R/deferred-<gate>.json` for each item in §1's deferred column.

## 5. Verification-lane capacity

- **T1 ≈ 6.5–8 eng-days** (A1.1 1.5; A1.2/1.3 1.5–2; A1.4 1–1.5; A1.5 0.5–1;
  W0.2 0.5; contract schema + stub skeleton 1–1.5).
- **T2 ≈ 15–23 eng-days** (L-gates + verifier 4–6; post-install L1–L9 fixtures
  3–5; A2.1+A2.2 3–5; A2.3 1; A2.6 1.5–2; A2.7 0.5–1; A2.8 1–2; stub
  implementation 1–2).
- **T3 ≈ 4.5–7 eng-days** (A3.1–A3.3 2–3; A3.4 1; A3.5 1–2; S-lane support
  0.5–1).
- **Total ≈ 26–38 eng-days** → two engineers for 3 × 5-day turns; one engineer
  stretches to ~6 turns.
- **One-person cut order**: A2.4 → A2.6-final (blocked anyway) → L1–L9 breadth to
  smoke (L2/L3/L7/L8 only; full matrix Phase 4) → A2.8-local → A3.5-browser.
  Never cut A1.1–A1.5, A2.1/A2.2/A2.7, or L0/L3/L8/L10.

## 6. Definition of done per turn

**T1 (Phase 1 exit, local):**

| Gate | Pass bar |
| --- | --- |
| A1.1 | report fields equal `/v1/runs/{id}` + `/output` for the Gemini and equity runs |
| A1.2/A1.3 | wall time within 50 ms at 1×/0.1×; provider current in 100% of sampled frames per exchange interval (today 32/406) |
| A1.4/A1.5 | panel receipts set == time-contained set; Runs tab == session attributions exactly |
| E06/W0.6 | retention receipt retained; vocabulary digest recorded or owner+date deferral filed |
| Stubs | contract v1 + I3/I7/I8/I9 self-test committed; T2 unblocked |

**T2 (Phase 2 exit, local ledger contract):** one admitted Observe → one C1 claim
→ `OBSERVED` fixture that L10 replays; §5.4 incomplete example stays pending with
visible limitations; `trace_records == latestCursor`, every chunk SHA-256
verifies, decompressed == `/events`; stored replay == source replay; local
restart preserves list/replay/dispositions; outage leaves execution outcome
unchanged and reconciles; L0–L4/L7/L8/L10 green for implemented rules and
L5/L6/L9 refusal fixtures green; `002` receipts or DAL block documented;
A2.4/A2.5-staging/A2.6-final deferred receipts filed.

**T3 (Phase 3 exit, content harness):** 100% evidence refs resolve and digests
match; owner cells map to scene nodes; zero `deniedMembers`/credential-shaped
values; SSE byte delta only by key fields; Gemini ops 04/10 and equity 4 exchange
statuses visible; C2 receives only rule-justified conclusions (provider testimony
alone yields no verification/admission); otherwise A3.1/A3.3 stub-store receipts
+ A3.5 filed as first T4 gate.
