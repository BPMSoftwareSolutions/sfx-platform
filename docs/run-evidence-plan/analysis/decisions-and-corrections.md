# Synthesis: decision register, blockers and verified plan corrections

Produced 2026-10-06 by synthesis lane. Sources: the six lane documents in this
folder and [the plan](../../run-evidence-implementation-plan.md).

Turns (parallel lanes per round): **T1** = Phase 0 freeze+spikes + Phase 1
Explorer; **T2** = Phase 2 ledger core/durable C1; **T3** = Phase 3 content/C2 +
first producers + staging gates. "Latest" = last point to resolve to keep 3 turns
viable; T1c = T1 close, T2s = T2 start, T3s = T3 start. Owners: PO = product
owner, SDA = scenario-driven-architecture, IDH = identity host, DAL = sfx-dal,
EST = estate/migrations, PLT = platform, OPS = Azure/Key Vault.

## a) Product-owner decisions (ranked)

| # | Blocker (what / why it blocks) | Decision & owner | Latest | Cheap workaround if it slips |
| --- | --- | --- | --- | --- |
| 1 | **D1 ledger location** — two new schemas beside `identity`; shapes 002 DDL, retention split, R1 move option | Confirm two schemas (PO+DAL) | T1c (draft), T2s | Ship ledger-only 002; defer `evidence` schema to 003 |
| 2 | **D2 process + caller identity** — identity host only, loopback, per-caller keys; blocks W2.2/W2.6/A2.4 and key registry | Confirm; one service key today (PO+PLT) | T1c design | Dev-only shared key over loopback; staging blocked |
| 3 | **D8 vocabulary location** — estate migration pair + sfx-identity reference copy + L0 digest; blocks W0.6, 002 seeding | Confirm estate-authored (PO+EST) | T1c | Seed reference copy by hand; defer L0 drift check |
| 4 | **D9 first claim kinds** — C1+C2; blocks evaluator scope/rules v1 | Confirm C1+C2 (PO) | T1c | C1 only; C2 behind Phase 3 |
| 5 | **D3 phase storage** — Phase 2 run/trace/output; Phase 3 content/C2; blocks 002 columns and capture scope | Confirm plan split (PO) | T2s | Phase 2 = run/trace/output only; no content stored |
| 6 | **D6 private inputs** — never store authenticate/enroll bodies; blocks capture + A3.3 | Confirm never-store (PO) | T2s | Hardcode never-store for the two capability ids |
| 7 | **D10 admission principals** — separate from runners/evaluators; blocks I9 + admission table | Name principals; estate operator to start (PO) | T2s | Seed estate operator as sole principal |
| 8 | **D4 read/share** — runner-only default, grant links; blocks A2.4/W2.6 authz | Confirm runner-only now (PO) | T2s | 404 for non-owners; sharing off |
| 9 | **D7 CLI/operator attribution** — blocks A2.1, run-list completeness | Confirm operator-else-unattributed (PO) | T2s | Mark unattributed, operator-visible only |
| 10 | **D5 retention** — default value + deletion-on-request; blocks purge/sizing | Pick value (PO) | T2s | No purge in T2; keep bytes; measure; set later |
| 11 | **Q5 retention period + sharing** — same columns as D4/D5 | Decide with D4/D5 | T2s | 90d content, tombstones forever, runner-only |
| 12 | **Q7 material independence** — blocks state-6 rules; second producer alone insufficient | Define or defer (PO) | T2s | Keep CROSS_VERIFIED unavailable (plan default) |

## b) Engineering decisions not yet in the plan (ranked)

| # | Blocker | Decision & owner | Latest | Cheap workaround |
| --- | --- | --- | --- | --- |
| 1 | **W0.4 probe mechanism** — `invoke-from-transaction.mjs` surfaces no observations (`invocation-boot.mjs:246-251` returns `[]`) | Temporary SDA worktree probe; preflight only for declarations (SDA+EST) | T1c | Run E08 from SDA worktree; fs preflight skipped |
| 2 | **002 split** — 19 tables + missing rule/tombstone/vocab-digest rows | Split ledger/vocab (002a) + evidence content (002b) (DAL+IDH) | T2s | Ledger-only 002; content schema 003 |
| 3 | **Admission-principal table** — I9 role check impossible via single D2 connection | Mandatory table + proc guard (IDH) | T2s | Seed operator row; guard inside `ledger.admit` |
| 4 | **Bridge envelope** — `api-host.mjs:36` drops cursor/eventId/evidenceRef/kind; A2.2/A3.2 unverifiable | Enriched envelope (PLT) | T2s | Raw API event pass-through + metadata sidecar |
| 5 | **Caller keys** — one service key today; per-caller registry + KV provisioning | Registry design + provisioning order (IDH+OPS) | T2s | Dev fallback key; staging deferred |
| 6 | **W2.3 identity-manifest timing** — graph digest arrives at run end; executor digest absent; local selection is not evidence | Pending material + limitation; no I3 attach (IDH+PLT) | T2s | Store pending; C1 limited to OBSERVED with limitations |
| 7 | **S1 resolution** — SDA evidence port vs platform-mediated content (R5 doctrine conflict) | Pick push-at-separation + platform read (SDA+PLT) | T3s | Defer C2/A3.x; ship C1 + W4.1/W4.5 |
| 8 | **Producer reachability** — loopback-only vs CLI/CI/estate Phase 4 producers | Operator import route or in-estate capability (PLT+EST) | T3s | Operator import with machine token |
| 9 | **W4.2 profile pin** — installed 29-entry profile (U5.5/U6, `a63e3ccc…`) yields 6 refuse + 1 warn; zero only on the 22-dim pre-U1 slice | Pin profile or restate claim (PO+EST) | T3s | Record VIOLATED with limitations |
| 10 | **W4.3 restore vs regenerate** — emitters deleted to `sda-legacy` 2026-09-20; estate `embodiments/` removed | Decide (SDA+EST) | T3s | Record NOT_OBSERVABLE |
| 11 | **A2.6 threshold basis** — one W0.5 insert vs 1,893 records / 2.63 MB events / 99–148 KB gzip; chunking policy unspecified | Declare chunk size/count in 002; measure batched writes | T2s | Provisional local receipt; adjust threshold later |

## c) External dependencies

| # | Dependency | Needed for | Latest | Workaround |
| --- | --- | --- | --- | --- |
| 1 | **CodeLightly DAL generator** not in workspace; ~160–200 generated files | W2.1 regen | T2s | Keep 002 in branch; regen when checkout lands |
| 2 | **Azure SQL access/tier** + W0.5 85 KB insert latency | A2.6 threshold | T2s | Synthetic measurement; adjust threshold later |
| 3 | **Key Vault provisioning** 3–7 calendar days | W2.2 per-caller keys | Order T1 day 1 | Dev file secret |
| 4 | **SDA author bandwidth** ~1–2 wk (single author serializes SDA+estate) | S1/S2/S3, W4.3 | Fire T1 day 1 | Pre-staged fork patches; T3 partial |
| 5 | **Staging access + container restart** | A2.5, L0–L10 acceptance | T2s | Local stack; staging gates deferred |
| 6 | **Estate migration bandwidth** (W0.6, W3.2, W4.5 same operator) | vocabulary + re-declaration + admission | Fire T1 | Batch into one migration pair |

## Plan corrections (claim → reality → source → edit)

| # | Claim in plan | Reality | Source | Plan edit |
| --- | --- | --- | --- | --- |
| 1 | §5.2 ledger ≈12 tables | 19 tables; I2/I4/I8/L0 need rule table set, tombstone table, vocabulary-digest row | §5.2 vs I2/I4/I8/L0 | Add `ledger.rule(+prerequisites)`, `evidence.tombstone`, declaration-digest row |
| 2 | B22 topology zero violations | 29-entry profile: 6 refuse + 1 warn; only provider slice clean; zero was pre-U1 22-dim | U5.5/U6 `a63e3ccc` | Restate B22/W4.2 with profile + digest |
| 3 | B5 host receives each record in full | Kernel filter strips undeclared shapes/providerEvidence first; E03 refs 252/205 B | kernel filter; E03 | Qualify "full" as post-filter in B5/W0.3/§5.4 |
| 4 | W0.4 preflight measures observations | `invoke-from-transaction.mjs` returns `[]`, no observations | `invocation-boot.mjs:246-251` | W0.4 via temporary SDA worktree probe |
| 5 | W0.2 records staging retention values | `SDA_RUN_RETENTION` unset (default 200); `SDA_RUN_EVENT_RETENTION=20000` hardcoded | platform launch paths | W0.2 documents config; risk of >200-run eviction |
| 6 | W2.3 assembles immutable manifest at admission | Graph digest arrives later; executor digest absent; assembly run-end/pending; §5.4 agrees | §5.4 vs W2.3 | Reword W2.3; A2.1 accepts pending |
| 7 | A2.2 passes from observer frames | `api-host.mjs:36` drops cursor/eventId/evidenceRef/kind | platform code | Fold bridge enrichment into W2.3 |
| 8 | W4.3 parity probe runnable | Emitters deleted to `sda-legacy` 2026-09-20; estate `embodiments/` removed | git history | Add restore-vs-regenerate decision |
| 9 | S2 is an id swap | Node/python lack shape-emission mechanism entirely | lane 06 | Split S2; scope 2–4 wk parity; CROSS_VERIFIED stays open |
| 10 | A3.5 feasible after W3.2 | 512 KB `invocationByteBudget` latches `shapesSuppressed`; run lane 2.63 MB; model records at cursor 556+ suppressed | B11/E05 | Make S3 a prerequisite of W3.2/A3.5 |
| 11 | W2.1 regenerates DAL | Generator not in workspace; ~160–200 files | workspace | Add checkout + regen window |
| 12 | I9 = procedure check plus role | Impossible with D2 single connection | I9/D2 | Admission-principal table mandatory |
| 13 | A2.4 owner-scoped reads | Run GETs public through proxy today | platform proxy | Scope run GETs in W2.3/W2.6 |
| 14 | D2/W2.6 caller identity | One service key today; registry+KV 3–7 d | deploy config | W2.2 key registry; KV ordered T1 |
| 15 | W2.6 loopback-only | Conflicts with CLI/CI Phase 4 producers | §5.1/W2.6 | Operator import route or in-estate capabilities |
| 16 | A2.6 threshold from one W0.5 insert | 1,893 records / 2.63 MB events / 99–148 KB gzip; chunking policy unspecified | B14/E05/W0.5 | Declare chunk size/count in 002; measure batched writes |
| 17 | W0.3 alone answers Q2 | Spike captures post-filter records; Q2 needs W0.4 re-declaration first | correction 3; W0.3/W0.4 | Merge/sequence W0.3 after W0.4 shape re-declaration |

## Go/no-go before each turn

- **T1 (start now):** GO if §2 sign-off or provisional recorded, repo owners
  named, and external requests fired day 1 (CodeLightly, Key Vault, Azure, SDA
  S1–S3, staging); W0.4 probe mechanism agreed; D8/D9 drafting. NO-GO ⇒ T1 =
  Phase 1 only; Q2/Q3 deferred, Phase 3 unsized.
- **T2:** GO if D1–D7/D10 + Q5/Q7 decided or defaults accepted in writing; W0.6
  digest recorded; 002 design reviewed with rule/tombstone/digest tables; 002
  split, admission table, bridge envelope decided; CodeLightly checkout + KV keys
  (or dev fallback) available; W0.5 waived or measured. NO-GO ⇒ 002 preflight
  fails: T2 = Phase 1 polish + pending-manifest spike only.
- **T3:** GO if L0–L10 fixtures pass locally; A2.1–A2.8 pass locally/staging; S1
  live or fork build; S2/S3 accepted (or C2 dropped); Q8 answered or W4.4
  dropped. NO-GO ⇒ T3 = W4.1/W4.2/W4.5 + C1 polish; A3.x deferred.

## Top 5 risks to finishing in 3 turns

| # | Risk | Mitigation | Signal to watch |
| --- | --- | --- | --- |
| 1 | SDA turnaround (1–2 wk, one author) stalls S1–S3/T3 | Requests day 1; pre-staged fork patches; C1-only T3 fallback | SDA review scheduled within T1 |
| 2 | Provisioning cascade (CodeLightly + KV 3–7 d + Azure) blocks W2.1/W2.2 | Order T1 day 1; dev fallbacks; 002 branch | Checkout + vault keys by T1 close |
| 3 | Decision latency (D1–D10/Q7) freezes 002/W0.6 | Defaults register; T1c deadline; one decision owner | Decision log complete at T1 close |
| 4 | Evidence mechanics (probe, bridge drops, attribution, missing executor digest) make A2.2/A3.5 unverifiable | Decide probe/bridge/attribution T1; record NOT_VERIFIED honestly | Dry-run A2.2 shows cursors before T2 close |
| 5 | Corrections inflate scope (19 tables, new tables, ~200-file regen) + Phase 4 sprawl | Split 002; one producer per turn; defer W4.4 | Migration/rule-fixture review at T2 start |

## Product-owner decision agenda (defaults if silent)

| ID | Question | Default if no answer |
| --- | --- | --- |
| D1 | Ledger schemas? | Two schemas: `ledger`, `evidence` |
| D2 | Writer/reader process? | Identity host only, loopback, per-caller keys |
| D3 | Phase storage? | Plan split: C1→Phase 2, content/C2→Phase 3 |
| D4 | Run read/share? | Runner-only; links later |
| D5 | Retention default? | 90 d content, tombstones forever, purge at W5.1 |
| D6 | Private inputs? | Never store authenticate/enroll bodies |
| D7 | CLI/operator attribution? | Operator if attributable, else unattributed/operator-only |
| D8 | Vocabulary location? | Estate migration pair + reference copy + L0 drift |
| D9 | First claim kinds? | C1 + C2 only |
| D10 | Who admits? | Estate operator only |
| Q5 | Retention + sharing? | Follows D4/D5 defaults |
| Q7 | Material independence? | CROSS_VERIFIED stays unavailable |
| Q8 | Prover/checker? | Defer W4.4 out of T3 |
