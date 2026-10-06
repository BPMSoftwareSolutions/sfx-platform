# Adversarial review: sfx-flight-recording implementation plan (draft revision 1)

Reviewer: adversarial review lane. Date: 2026-10-06. Scope: `docs/sfx-flight-recording/implementation-plan.md`
(600 lines, self-labelled revision 1) against the six lane documents (`analysis/lane-01..06`) and the
verified ground truth: `docs/run-evidence-plan/analysis/README.md`, `decisions-and-corrections.md`,
`gates-and-evidence-map.md`, `synthesis-3-turn-plan.md`, and `docs/run-evidence-implementation-plan.md` r3.
Read-only: this file is the only write.

## Verdict

**Not fit to stand as revision 1 for review until the two blockers and the major corrections below land.**
The draft is structurally strong: §8 states topology VIOLATED (6 refuse + 1 warn under the 29-entry
profile, not zero), parity open (8/112/5), no prover/checker and 0/738 formal invariants, hash-linked
attribution rather than signatures; §5.7 reconciles the six lane conflicts; traceability covers every
T1.x/R2.x/S3.x/V4.x/U5.x/G6.x and T-1..T-7, V4.0–V4.5, U5.1–U5.8 gates; and no W/S item is replanned.
But it omits five verified corrections that change scope and effort (SDA_RUN_RETENTION/W0.2; the 512 KB
invocationByteBudget latch and S3; post-filter evidence references; one-service-key / `/auth`-only host;
`invoke-from-transaction.mjs` and W0.4), states one verification status contrary to lane-04 (Q2), contains
an internal schema/gate contradiction (`recording_trigger UNIQUE(recording_id)` vs the overlap model), and
nowhere maps F0–F5 to the 3-turn verdict that Phase 4/5 do not fit. Fixed, it is reviewable.

## Numbered corrections

| ID | Plan location | Problem | Required correction | Severity | Proving source |
| --- | --- | --- | --- | --- | --- |
| C01 | Whole plan; entry lines 344, 356, 365, 377 | No link between F0–F5 and the 3-turn analysis (T1 Phase 0/1; T2 Phase 2 ~50–60%; T3 Phase 3 ~25–40%; Phase 4/5 0%; W5.x, W4.4, A3.5 do not fit) | Add a sequencing section: F0/F1 fixture-first ≈ T1; F2 blocked on external CodeLightly DAL regen + KV keys + W2.1–W2.3; F3/F4/F5 explicitly post-T3/Phase 4+ with dated deferral receipts; no F3+ dates until S1–S3 land | blocker | A/README:54-61; synthesis-3-turn:50-76; decisions c)1-6; A/gates:13-31 |
| C02 | §5.3 tables (line 206) vs §6.7/FR1.5 (line 431) and D-L7 (line 101) | `recording_trigger ... unique per recording in v1` contradicts the adopted overlap model: "two triggers in one run merge into one recording with both refs" | Pick one and make schema/gate agree: multiple triggers per recording (replace `UNIQUE(recording_id)` with `UNIQUE(recording_id,trigger_kind,anchor_cursor)`) or per-trigger recordings (then D-L7/FR1.5 change) | blocker | lane-03:53 vs lane-01:211 and lane-02:126-128 |
| C03 | §4 baseline (110-119); Appendix B (579-593) | Verified correction 5 absent: `SDA_RUN_RETENTION` unset (default 200 runs; 20,000 events); W0.2/E06 nowhere; F1.4 backfill and F2.5 resume assume retained `/events` | Add the fact, the W0.2/E06 dependency, and the >200-run eviction risk for backfill/corpus | major | decisions correction 5; lane-01:49-51; lane-02:36-38 |
| C04 | §4 (118); F3.1/F3.3 (360-362), F4.5 (373) | Baseline says budgets "clip shapes"; the 524,288 B `invocationByteBudget` latches `shapesSuppressed` (model records at cursor 556+; E05), so content needs S3 before W3.2; F3.3/F4.5/F5.5 carry no S3 dep | State the latch; add run-evidence S3 to F3.3/F4.5 (W3.2 alone is incomplete); keep S3 in F3.1 | major | decisions correction 10; plan B11/E05 |
| C05 | §4; §5.4 Q5/Q9 (241); F3.x | Verified correction 3 absent: references are post-kernel-filter E03 records (252/205 B), not full content; "full record" phrasing overstates availability | Add the correction; qualify content availability; sequence W0.3 after W0.4 re-declaration | major | decisions corrections 3, 17; plan B5:303 |
| C06 | §4; §5.6 (283-286); §9 | Baseline omits that the identity host has one service key today and serves only `/auth`; per-caller keys, Key Vault (3–7 d lead) and TLS widening are new W2.2/W2.6 work | Record current state and provisioning dependency (order day 1) in baseline, FR-R8 and Appendix B | major | decisions correction 14, c)3; lane-06:25-27 |
| C07 | §4; §5.6; FR2.4/F2.3 (350, 440) | Verified correction 13 absent: run GETs are public through the proxy; owner-scoped reads/identical 404s do not exist and are new W2.3/W2.6+F2.3 work | Add baseline fact; cite the correction so FR2.4 scope and effort are not understated | major | decisions correction 13 |
| C08 | §4; Appendix B; F3/F5 deps | Verified correction 4 absent: `invoke-from-transaction.mjs` returns `[]`, no observations; W0.4/E08 needs a temporary SDA worktree probe; W0.4 appears only in §8 cost prose | Add the correction; add W0.4/E08 to Appendix B and to content-trigger/cost deps | major | decisions correction 4; `invocation-boot.mjs:246-251` |
| C09 | §5.4 (237-242) | Says Q1–Q3 are "partially decidable today"; lane-04 places Q2 at NOT_OBSERVABLE until trigger vocabulary and retained authority digests exist | Split: Q1/Q3 partial; Q2 NOT_OBSERVABLE (route oracle exists, pre-window authority digests absent, B20) | major | lane-04:33-36; plan B20 |
| C10 | §6 F2.2 (349) | Missing dependency on F2.3 (S3.3 routes) or the run-evidence stub contract; lane-03 critical path is S3.1→S3.3→S3.2 | Add F2.3 or the pinned stub contract (swap-safe, A/gates §3) to F2.2 deps | major | lane-03:188-189; A/gates:55-79 |
| C11 | §6 F1.5 (342); §7 FR1.10 (436) | F1.5 claims "No W/S dependency (fixture/local)" but FR1.10 uses `verify-run-evidence.mjs` (A2.2 tool requiring W2.1–W2.3 or the frozen stub) | Re-scope FR1.10 to the recorder spike's local trace or mark it deferred until W2.3/stub | major | A/gates:44,55-79; run-evidence plan A2.2:784 |
| C12 | §5.1 geometry (140-147); D-L6/§5.7 (100, 315) | Profile bounds (`maxWindowEvents` 10,000) exceed the rolling envelope (250 events); no rule for a before-bound larger than the envelope | Declare validation: profile before bounds ≤ envelope, else the range gaps with `complete:false` + NOT_OBSERVABLE; add to F1.3/FR1.3 | major | lane-01:124-128 vs lane-02:141 |
| C13 | §6 F4.7 (375), F5.7 (387); §8 | F4.7 depends on W4.4 and F5.7 on W5.1–W5.3; the 3-turn analysis says Phase 4/5 do not fit and W5.x is not delivered | Mark F4.7/F5.7 post-3-turn with deferral receipts; exclude their effort from near-term totals | major | synthesis-3-turn:64-76; A/gates:26-27 |
| C14 | §6 sizes (329-388); §8 | No effort roll-up or capacity statement; merged items sit below lane sums (F1.5 3–5 d vs T1.6+R2.5+R2.6 ≈ 4–6; F2.6 3–4 vs S3.6+R2.6 ≈ 4–5); F total ≈ 90–150 eng-days | Add per-phase totals against the 26–38 verification eng-days/lane capacity; correct undercounted merges | major | A/gates:97-110; lane T1/R2/S3/V4/U5/G6 sums |
| C15 | D-L8 (102) vs F2.5 (352) | D-L8 accepts LOST for v1 and defers R2.8; F2.5 lists resume rendezvous as a deliverable | Mark R2.8/F2.5 rendezvous optional per D-L8, or reverse D-L8 with rationale | minor | draft D-L8/F2.5; lane-02:190-194,242-243 |
| C16 | D-L2 (96); F2.1 (348); Appendix B | Treats the 002a/002b split as settled ("fold ... into 002b before its freeze"); the split itself is an undecided engineering decision | Note the split is pending (decisions b)2); make F2.1 depend on that decision | minor | decisions b)2; lane-03:104-106 |
| C17 | §11 (545-558); §3 | Lane decisions not carried: lane-02 #4 bridge envelope shape; lane-01 #9 W0.2/E06 horizon-vs-retention; lane-04 #5 HOLD/safe-state/envelope declarations; lane-05 #6/#9 OPEN-recording UI and A/B scope | Add decision/open-question rows with owners and latest dates | minor | lane-01:225; lane-02:240-246; lane-04:112-118; lane-05:181-202 |
| C18 | FR-R8 (540); Appendix B | Staging access (3–7 day lead; staging gates deferred per ground truth) is absent from the dependency and risk lists | Add staging access to FR-R8/Appendix B and the deferral handling for FR2.4/FR4.5 | minor | decisions c)5; A/gates:26-27 |
| C19 | §5.6 (286); §9 | TLS guard widening listed only for `/evidence/v1` though conformance reads ledger routes | Align with lane-06 (both prefixes) or state `/ledger/v1` is W2.2's responsibility | minor | lane-06:85-86 |
| C20 | §5.5 V2/V3 (258-267) | Honest-basis column omits lane-05 limits: intent NOT_OBSERVABLE (B4), authority timing-only (B20), inference content withheld (B5/B13) | Add those limits to the V3 basis text | minor | lane-05:65 |
| C21 | §1 (19-21, 62) vs F5.1–F5.3 (381-383) | §1/§8 say no F item depends on the in-flight Phase 1 UI, but F5.1–F5.3 list W1.x "(in flight, b9be6e8)" deps | Clarify: fixture-first slice needs W1.x interfaces; live wiring gated on their completion | minor | draft §1/§8 vs F5.1-F5.3; lane-05:210-213 |
| C22 | §7 FR5.2/FR5.3 (457-458) | Drops lane-05 sub-assertions: U5.2 "sum equals trace_records"; U5.3 step/band selection seek | Restore the dropped assertions | minor | lane-05:152-153 |
| C23 | §8 (480) | "the overclaimed `fv_*` labels are not consumed" names no labels | Name `fv_expression_semantics`, `fv_witnesses`, `fv_contract_satisfiability` | minor | lane-04:125 |
| C24 | §5.7 first row (314) | "R2.1/R2.3/S3.2/G6.3 fold together" conflicts with the traceability split (R2.1→F1.3, R2.3→F2.2) | Rephrase: R2.1+R2.2+G6.3-horizon→F1.3; R2.3+S3.2+G6.3-seal→F2.2 | minor | draft §6.7; lane-02/lane-03 |

## Correct as written (do not regress)

- §8 honest limits: topology VIOLATED 6+1 under the 29-entry profile; parity 8/112/5; no prover/checker, 0/738 invariants; non-repudiation = hash-linked attribution; HOLD/safe-state/envelope undeclared; capture incomplete by construction; SDA single-author lead times; no numeric trust.
- Recorder placement resolution (one component inside the circuit-host observer; SDA/kernel placements rejected) and the F1.3/F2.2 fold.
- Manifest home (first-class `evidence.recording` with sealed digest; no recording-local blob) and 003-over-002b with the `run_trace_chunk` cursor-column correction.
- D11–D14/D16 cautions: admission-principal activation, closed C1/C2 vocabulary, no C3 without a W0.6 rule, no "non-repudiation" wording before signing.
- Observer-bridge loss facts (`run.admitted`, cursor/eventId/evidenceRef/kind) and A2.2 blocked until enrichment; backfill gaps → PARTIAL/NOT_OBSERVABLE.
- Privacy controls: never-store list; redaction → A3.3 scan (absent until F3.3) → disclosure → scan digest → seal; failed scan refuses the seal; horizon plaintext bounded and unpersisted; legal-hold vs erasure tension; sampling-bias labels; cost controls.
- Access defaults: runner-only, identical 404, export narrower than read, every read/export audited.
- No replanning of W/S items; Appendix B dependency discipline with dated deferrals; gate/receipt conventions (`FR/`, `R/`, `D/`) and stub-lineage rule.
- Traceability: all lane IDs and gates mapped; every F item has a lane origin; lane conflicts reconciled in §5.7.
- Fixture-first F0.2/F1.5 and the "proposed, not started" framing throughout.

## Missing work items or gates to add

- W0.2/E06 recording plus a backfill retention-feasibility check in F1.4 (C03).
- Pinned bridge wire-contract version and the lane-02 #4 envelope-shape decision as a precondition for F1.3 (C10/C17).
- Profile-vs-envelope bound validation in FR1.3 (C12).
- Recorder service-key registration (circuit-host/evaluator keys) in F2.2/F2.3 or FR2.4.
- Horizon scrub/denied-member-strip witness (lane-06:109-111); no gate currently covers post-close scrub.
- Gate for the SDA HOLD/authority-admission emitter if F3.2's request is accepted (FR1.7 only covers the inert state).
- A phase-exit gate/section tying F2–F5 to the run-evidence T2/T3/Phase 4 entry (C01).
- Corpus read contract as a named work item/dependency before F5.5 (currently "new paged corpus endpoint" unnamed).

Revision 1 may proceed to review once C01–C14 are resolved; C15–C24 should be folded into the same revision.
