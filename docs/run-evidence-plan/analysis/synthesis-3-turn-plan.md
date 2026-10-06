# Synthesis: 3-turn multi-lane execution plan

Produced 2026-10-06 by synthesis lane. Sources: the six lane documents in this
folder and [the plan](../../run-evidence-implementation-plan.md).

Assumptions: a turn is ~5 working days of lane work plus 1–2 days gate/sync
overhead; a lane is one engineer or one agent session. Calendar ≈ 19–21 working
days (~4 weeks). Phase 0 exit requires product-owner sign-off, which is missing
today.

## 1. Lane x turn matrix

| Lane | Turn 1 | Turn 2 | Turn 3 |
| --- | --- | --- | --- |
| **platform-ui** | W1.1 Run report (2–3d); W1.4 Runs tab (1–1.5d, existing session/runs) | W1.2 playback bar/steps/dwell (3–4d); start W1.3 Time/Trace/Called (HTTP status/op values absent today — hatching only) | finish W1.3; W2.5 fixture build (durable list, `?run=`, disposition UI) against W2.2 stubs; real wiring only if W2.2 real calls land (dep: W2.2, then S1/S2/W3.1) |
| **platform-host** | W0.2 retention values → E06 (0.5d); W2.3 design: synchronous register in run-api.mjs w/ browser bearer, retry/reconciliation, circuit-host service key; W2.6 loopback-only omission + public assertion | W2.3 register + Brotli trace append skeleton vs W2.2 stub (dep: key, W2.2 contract) | W2.3 end-to-end (dep: 002a installed + W2.2 real); S1 platform session-guarded content route (1d) when S1 live |
| **identity-db** | Author 002a DDL: 17 tables + 8+ procs (no W0.6 dep); de-hardcode 001 in Program.cs/regenerate.ps1/Config.json/inspect-schema.sql; **place external CodeLightly regen request day 1** | 002a vocabulary/admission seeds from W0.6 digest; 002a preflight+rollback receipt (dep: W0.6); author 002b evidence (5 tables, 4 procs) | 002b preflight; 002a install + idempotence receipts **only if regen returns** (hand-edit DAL forbidden); L0 drift table |
| **identity-host** | Middleware: TLS prefixes, per-route body caps, caller-key registry, separate semaphores, 404/409 (dep: KV keys day 1) | W2.2 `/ledger/v1/*` + `/evidence/v1/*` endpoints (6–9d) + host tests (3–5d, spills) | finish W2.2 tests; real-call integration (dep: 002a installed); W3.1 `POST /evidence/v1/objects` (dep: S1) |
| **estate** | W0.4 shape-emission spike via temp SDA worktree probe + committed-then-rolled-back estate pair (0.5–1.5d); W0.6 vocabulary + rule set v1 + digest (2–4d; state 6 `CROSS_VERIFIED` withheld pending Q7) | W2.4 evaluator v1 as T-SQL declared-read pure over input (2–3d, dep: W0.6) | W3.2 pre-G8 `providerEvidence`/`shapes` restore + D5/D6 declarations — **only after S1 live** (dep: S1; S3 must land with it) |
| **sda-requests** (single author) | Day 1: W0.3 content spike (0.5–1d); submit S1 evidence-port request (2–4d; lead 3–6 cal days) | S1 lands/live; S2 owner cellExecutionId (1–2d, csharp-first) | S3 evidence budget (1–2d, csharp-first) **must land with W3.2**; S1 resolver handoff |
| **verification/gates** | New `verify-run-report.mjs` (A1.1), `verify-evidence-panel.mjs` (A1.4), `verify-explorer.mjs` ext (A1.5); tighten A1.2/A1.3 | `verify-trust-ledger.mjs` L0 drift (dep: W0.6); A2.1/A2.2/A2.3/A2.8 fixtures | A2.4 cross-principal 404 (2–4d); A2.6 latency (dep: W0.5); A2.7 C1→OBSERVED fixture; A3.1–A3.3 partial |
| **provisioning/azure** (0.5 FTE) | **Day 1: per-caller KV secrets + role map** (circuit host, SDA port, evaluator; 3–7 cal-day lead); W0.5 tier/latency on Azure → E09 (needs `az` access) | finish keys/registry; support W2.2 host tests | standby; producer keys for Phase 4 (not consumed) |

## 2. Turn gates

- **Turn 1 entry:** W0.1 sign-off that §2 is closed; D1–D10 recorded (at minimum
  D1, D2, D4–D6, D8–D10); Q7 answered or state-6 explicitly withheld; E07/E08/E09
  owners named; key + DAL regen requests placed.
  **Exit:** E06–E09 retained; W0.6 digest + rule fixtures; 002a authored; Phase 1
  W1.1/W1.4 code complete; A1.1/A1.4/A1.5 scripts drafted; S1 accepted with a date.
- **Turn 2 entry:** W0.6 digest frozen; E08 shape-byte measurements available
  (feed W3.2 bounds); S1 request in progress; DAL regen date acknowledged.
  **Exit:** 002a preflight receipt; W2.2 endpoints pass host tests vs fixtures;
  W2.4 fixtures pass; S1 live; W1.2/W1.3 code complete; A1.1–A1.5 pass; L0 script
  green on preflight DB.
- **Turn 3 entry:** S1 live; 002a installed or regen date slipped (branch below);
  W2.2 real-call smoke OK; W0.5 threshold fixed for A2.6.
  **Exit:** W2.3 e2e one attributed run survives restart (A2.1/A2.5/A2.7);
  A2.2/A2.4/A2.6 pass; S3+W3.2 installed together with A3.4 before/after capture;
  A3.1–A3.3 partial; Phase 1 fully staging-accepted.

## 3. Critical path (working days)

Day 0 W0.1 → T1 W0.6 (d1–4) → T2 002a seeds+preflight (d6–10) → **external DAL
regen (lead unknown; 1–2 wks)** → T3 install + W2.2 real (d11–15) → W2.3 e2e
(4–7d, spans T2–T3) → A2.5 restart. **Ends ~d19–21 with an early regen slot;
d25–30+ without one.** Parallel chain: S1 day 1 → live d5–10 → S3+W3.2 d12–17 →
A3.4/A3.5 d17–21. Everything else has slack.

## 4. Verdict

- **Phase 0: ~90%** — W0.6 ships with state 6 unavailable (Q7 open); W0.5
  external if `az` is not granted.
- **Phase 1: ~85–100%** — W1.1–W1.4 full, but W1.3 shows only Time/Trace/Called +
  hatching until Phase 3 content exists.
- **Phase 2: ~50–60%** — code + DDL authored/preflighted; end-to-end durable run,
  A2.5, A2.7, and L0–L10 on a real DB hinge on the external DAL regen. L-gates
  can pass only in CI on preflight, not staging-verified.
- **Phase 3: ~25–40%** — S1+W3.1 done; S3/W3.2 land at the buzzer; A3.5
  end-to-end unverifiable; W3.3 (5–8d) fixture-only.
- **Phase 4/5: 0%** — entry gate (staging L0–L10 + per-producer fixtures)
  impossible.

**Cannot finish in 3 turns:** staging-verified L0–L10 and Phase 4 entry; A2.5
restart check and A2.7 replay without committed 002 + regenerated DAL; A3.5
browser acceptance; W3.3 real; W4.1 (35-code catalog undeclared), W4.2 (B22:
record `VIOLATED` — 6+1 topology violations under the 29-entry profile, not
zero), W4.3 (parity open; node/python parity is a separate stalled 2–4-week
effort), W4.4 (no prover/certificate infra, Q8), W4.5; W5.1–W5.3.

**Recommended "3-turn done":** Phase 0 closed with E06–E09 + W0.6 digest; Phase 1
staging-accepted (A1.1–A1.5); 002a preflighted and DAL regenerated; one
attributed run survives restart with C1 `OBSERVED` and L10 replay
(A2.1/A2.5/A2.7); A2.2/A2.4/A2.6 pass; S1 live with S3+W3.2 installed and A3.4
lane-neutrality proven. Everything else explicitly deferred to Turn 4; if the
DAL generator does not return, W2.3/W2.5 real paths are Turn 4 by definition.

## 5. Lanes and bottlenecks

Run **7 active lanes** (provisioning at 0.5 FTE) in Turns 1–2; 6 in Turn 3
(estate/SDA converge for W3.2+S3).

1. **Product owner** (W0.1, D1–D10, Q7) — blocks all commits; any delay shifts
   the whole plan.
2. **SDA request author** — single-threaded queue W0.3→S1→S2→S3 (3–6 cal days
   lead each, realistic 1–2 wks); S3 must meet W3.2 or A3.5 fails.
3. **External CodeLightly DAL generator** — not in workspace; silently gates
   W2.2 real, A2.5/A2.7, Phase 4 entry. Place the request day 1.
4. **Estate migration author** — W0.4/W0.6/W2.4/W3.2 serialized; W3.2 can only
   install after S1.
5. **Azure access owner** (W0.5) and **Key Vault provisioner** (3–7 cal-day lead;
   start day 1).

## 6. One-screen lead summary

Three parallel rounds ≈ 4 calendar weeks buy you: a closed decision model, the
Explorer report/playback/evidence UI on today's data, ledger + run-evidence
schemas authored and preflighted, identity-host endpoints with per-caller keys,
the declared evaluator, and S1 live with shapes re-enabled under separate
evidence budgets. The one thing that decides whether Turn 3 shows a durable,
replayable run — or just fixture-green code — is the external DAL regeneration;
request it day 1 and treat "install + regenerate" as its own gate. Do not let
Phase 4 language ("conformance", "cross-verified", zero-violation topology) into
any receipt: B22 shows topology violations today, parity is open, and no prover
exists. Definition of 3-turn done: Phase 1 accepted, one run survives restart
with its C1 disposition replayed, A2.2/A2.4/A2.6/A3.4 proven; everything else is
Turn 4.
