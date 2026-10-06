# Lane 04: expected vs observed — runtime verification against formally derived expectations

| | |
| --- | --- |
| Date | 2026-10-06 |
| Status | **Design lane, read-only.** One new file written; no repository, row, kernel or command changed |
| Inputs read | intent/research; run-evidence plan r3 + analysis README, lanes 03/05/06; sfx-embody readiness docs. Pinned commits per `docs/run-evidence-plan/analysis/README.md:23-34` |
| Citation keys | `plan` = `docs/run-evidence-implementation-plan.md`; `intent.md`/`research.md` = `docs/sfx-flight-recording/`; `lane-0N-*.md` = `docs/run-evidence-plan/analysis/`; `sfx-embody/...` repo-relative at the pinned commits |
| Scope | Answerability of the nine intent questions, expected-trace derivation, comparison operations and outcomes, producer/evaluator split, gates V4.x, work items V4.x |
| Non-goals | No new theorem language; no solver syntax in rows; no trust promotion; recorder capture itself is a separate (unwritten) lane |

## Scope

Runtime verification here means: compare the trace the system **observed** (recorder + `evidence.run_trace_chunk` + Phase 3 evidence objects) against the trace the declared estate **permits** (projection of existing declarations), and record the result in `ledger.verification` through the W2.4 evaluator. It is the "observed vs expected trace" loop of `sfx-flight-recording/intent.md:109-127,147-149` and the Verification row of `intent.md:273-280`. It adds no engine: the comparison is a declared evaluator rule family over an input bundle, exactly as W2.4 defines (`docs/run-evidence-implementation-plan.md:703`; `lane-05-estate.md:111-143`).

## Current-state foundations (file:line)

- **The nine questions:** `sfx-flight-recording/intent.md:129-149`. Instrument split Static/Formal/Runtime/Flight: `intent.md:394-410`. Zero-implicit-authority frame: `sfx-flight-recording/research.md:462-472,499-509`.
- **Closed model, states 0–8, outcome discipline:** plan `:121-180`; ten decisions `:184-195`; reliance/contradiction/invalidation `:206-219`. Verification outcomes `SATISFIED|VIOLATED|NOT_OBSERVABLE|INCONCLUSIVE`: plan `:492`. Invariants I2/I5/I6/I10: plan `:563-571`. Gates L4/L6/L7/L10: plan `:766,768,769,772`.
- **Evaluator:** W2.4 plan `:703`; recommended T-SQL declared-read, pure over `@input`, host persists verdict (`lane-05-estate.md:111-143`); D2: evaluator cannot read the ledger (`lane-03-identity-db.md:79-107`).
- **Ledger store:** `ledger.verification`, rules/prerequisites, vocabulary digest, tombstones (`lane-03-identity-db.md:53-77,179-212`); W2.1/W2.2 (plan `:700-701`).
- **FV0 today:** 8 `analysis.fv_*` readings + derive-capability-proof-obligations + receipts, no prover (`lane-05-estate.md:26-43`); `resolve-capability-proof-obligations` has no migration (`sfx-embody/docs/executable-verification-readiness.md:192-194`).
- **Readiness counts:** 922/919 of 972 scenario contracts, 869 schemas; 983/1,271 cell functions over 32 operators; 24 routes, coverage holds (`sfx-embody/sql/inspect/formal-verification-readiness/README.md:30-51`); 1/56 mechanic contracts; 0/738 formal invariants; 0/3,748 estate definitions use kernel pattern keys (`formal-verification-readiness.md:81-97`).
- **Genuine proofs vs overclaims:** only acyclicity, route coverage, `if`-totality; three `fv_` labels claim more than they prove (`formal-verification-turn-verification-2026-09-28.md:26-43`).
- **Kernel divergences:** C# installed kernel has no pattern-vector conformance (`formal-verification-readiness.md:58-59`); `e114d10` runtime does not gate on ADMITTED, REFUSED cannot terminate before the trailing invoke (`formal-verification-turn-verification-2026-09-28.md:169`).
- **Recorder inputs that already exist:** E03/E04 evidence events, `capture.sse`, staging run 849 (plan `:894-908`); lane events and budgets (`lane-06-sda.md:32-41`); shape producers and hardcoded nested cellId (`lane-06-sda.md:44-59`); evidence port design (`lane-06-sda.md:61-82`).
- **Vocabulary that does not exist:** HOLD, safe state, effect envelope — grep finds HOLD only in research (`sfx-embody/docs/research/sidefx-workflow-authority/plan.md:27`); no envelope declaration anywhere.

## The nine questions mapped

| # | Question (intent) | Data/declaration needed | Engine | Status today |
| --- | --- | --- | --- | --- |
| 1 | Was every observed transition declared? | Observed transition keys (testimony cellId/cellExecutionId/edgeId) + declared transition set + a declared kernel-cell→estate-node join. Join absent; B12 excludes input/outcome digests | Trace comparison: membership | Partially decidable (graph digest + route coverage); membership only after the join |
| 2 | Was the trigger preceded by an authorized route? | Recorder trigger declaration + pre-window; route oracle exists (24 routes, coverage holds); authority read is timed but digest not retained (B20) | Trace comparison: ordered subsequence; `analysis.fv_route_variant_coverage` as route oracle | NOT_OBSERVABLE until trigger vocabulary and authority digests exist |
| 3 | Did an undeclared transition occur? | Same as 1 | Membership complement; divergence becomes REFUTES | Same as 1; live interpreter divergence `e114d10` is a real candidate |
| 4 | Did authority change during the window? | Per-run/per-phase authority-ref digests in the observed trace + window; ledger already models authority_ref/definition_digest | Digest-stability check; `fv_*` readings do not see runs | NOT_OBSERVABLE: run record keeps no bound-authority digest |
| 5 | Did the provider exceed its effect envelope? | A declared effect envelope per capability/provider + observed C2 exchange facts (B7/E01: status, endpoint, redaction, duration). No envelope exists | Envelope membership over C2 evidence; rule-qualified handling of self-testimony (I6) | NOT_OBSERVABLE; declare the envelope first |
| 6 | Was operator intervention required? | Recorder trigger class (`operator-required`) + declared rule mapping conditions → required; operator principal exists | Evaluator rule over observed events | NOT_OBSERVABLE; "required" is a declaration, not inference |
| 7 | Did execution stop when HOLD occurred? | Declared HOLD disposition + post-trigger window. Kernel has no pause; `stopWhen` is pre-dispatch; cancellation → `cancelled` (`executable-verification-readiness.md:149-151`) | Post-trigger quiescence: no dispatch/effect record after HOLD | NOT_OBSERVABLE; HOLD undeclared |
| 8 | Did the circuit reach its required safe state? | Declared safe-state predicate per trigger/scenario (expressible as a contract/variant predicate; no new language) | Terminal-state check over post-window | NOT_OBSERVABLE; safe state undeclared |
| 9 | Did evidence return through the expected route? | S1 evidence port live + W3.1 receiver + declared disclosure policy; today `GET /v1/evidence/{ref}` is 501 (B5) | Reference-resolution + digest match (A3.1/A3.2) + ledger verification | NOT_OBSERVABLE today; answerable in Phase 3 |

## Expected-trace derivation

An expected trace is a **canonical serialized descriptor**, not a proof and not a theorem:

`{runRef, capabilityVersion, canonicalGraphDigest, estateModel, semanticsVersion, ruleSetId, transitions[], routes[], contractFaces[], cellFunctions[], authorityRefs[{semanticAddress,definitionDigest}], bounds{payload,event,invocation}, unobservable[]}` — stored as a content object with its digest; no solver syntax in rows (`lane-05-estate.md:244-267`).

- **Declared sources today:** scenario input/outcome contracts (922/919 of 972; 869 schemas, 26-keyword fragment); cell functions (983/1,271; 1,112 transformations; 32 operators); route variant coverage on all 24 routes; transition schema v2 `semanticProgress` (SDA, `formal-verification-readiness.md:32-42`); execution-pattern vectors/expectations (23/11 types/5) in SDA; blueprint progress classification (503 edges).
- **Derivable now:** transition membership; route totality/exclusivity; contract faces; expression trees and `if`-totality; selected-definition digests; declared telemetry bounds (4,096 / 65,536 / 524,288; B9).
- **Derived obligations:** 14 per capability, computed not stored; FV0 is derive-only; receipts under `sidefx:proof-receipts` (`executable-verification-readiness.md:169-194`). W4.4 adds route-exclusivity/coverage obligation export (`lane-05-estate.md:202-223`).
- **Must stay NOT_OBSERVABLE:** total expression semantics; 55/56 unresolved mechanic contracts; 0 formal invariants (681 id-only conditions); provider assume/guarantee; effect envelope; HOLD/safe state; the estate↔pattern mapping (compiler-decided, `formal-verification-readiness.md:161-170`); installed C# interpreter conformance; cross-language parity.
- **Rules:** derive only from declared rows; never substitute local configuration for a missing identity (`lane-05-estate.md:264-267`); if a descriptor element is not derivable, list it in `unobservable[]` rather than inventing it.

## Comparison operations and outcomes

Operations v1 (deterministic set/sequence algebra over serialized records; no solver):

1. `membership` — observed transition ∈ declared transition/edge set (Q1, Q3);
2. `precondition_route` — declared predecessor set/order present in the pre-window (Q2);
3. `authority_stability` — authority-ref digests equal across the window (Q4);
4. `envelope` — observed C2/provider facts ⊆ declared envelope (Q5);
5. `operator_rule` — declared rule over observed operator events (Q6);
6. `post_trigger_quiescence` — no dispatch/effect records after the HOLD trigger (Q7);
7. `terminal_state` — post-window terminal records satisfy the safe-state predicate (Q8);
8. `evidence_route` — references resolve by the declared route, `sha256(content)=ref.digest` (Q9);
9. `completeness` — required refs (identity manifest, descriptor, rule set, trace ranges) present, else missing-input.

Outcome vocabulary maps 1:1 to `ledger.verification` (plan `:492`): **CONFORMS→SATISFIED, DIVERGES→VIOLATED, NOT_OBSERVABLE→NOT_OBSERVABLE, INCONCLUSIVE→INCONCLUSIVE**.

- CONFORMS is scoped evidence only — a candidate for state 5 per claim; it never writes a disposition and never promotes numerically (T2/T9; plan `:186-194,563-571`).
- DIVERGES records refuting evidence (`claim_evidence.polarity=REFUTES`) and/or a limitation; append-only; supersede/contradict per §2.4 (I7/I8; plan `:206-219,568-569`). It is never a numeric trust promotion.
- NOT_OBSERVABLE = material absent; never supports (I7). INCONCLUSIVE = data present but the comparison cannot decide (missing join, partial window) — kept distinct from absent evidence.
- Divergence becomes a **limitation** when the expectation is missing/unavailable and a **refutation** when observed contradicts declared law. With no prover (Q8 open) no result may be phrased as formal proof.
- Results are per claim/scope: C1 (run outcome), C2 (provider exchange), and separate claims for route/authority/envelope; scopes do not merge (plan `:167-180`).

## Producers and ledger integration

- **Split (W2.4 pattern):** producers attach; the evaluator checks; only admission principals admit (plan `:208-211,806-810`).
- **Expected-trace producer:** declared-read capability `derive-expected-trace-descriptor.v1` in sfx-embody (precedents `derive-capability-proof-obligations`, governed-detection readings); returns descriptor + digest.
- **Observed-trace producer:** the recorder lane + W2.3 trace chunks (`evidence.run_trace_chunk`, SHA-256) + Phase 3 `evidence.evidence_object` via S1/W3.1; producer = run manifest / recorder digest.
- **Comparison producer:** evaluator rule family `trace-conformance.v1` inside W2.4; pure over `@input` (descriptor ref, observed evidence rows, rule-set id); the identity host persists `ledger.verification` and evidence links.
- **Identity/digests recorded:** descriptor `definition_digest`; rule-set `definition_digest` as `rule_digest`; evaluator statement `document_digest` as `evaluator_subject_id`; observed chunk SHA-256; `inputsDigest`; outcomes/limitations carried into `basis`. Dispositions remain `ledger.decide_disposition` (never the evaluator).
- **Trust ladder:** results can justify scoped OBSERVED/CONFORMANT evidence. They cannot establish CROSS_VERIFIED (parity open, B23), FORMALLY_VERIFIED (no prover, 0 invariants), or ADMITTED (governance only). This is the lane's contribution to the ladder, gated by A2.7/L4/L10.

## Gates

| ID | Passes when | Receipts/fixtures | Boundary |
| --- | --- | --- | --- |
| V4.0 | Descriptor derivation is deterministic and digest-exact for the fixture-backed twin (2/2 contract satisfiability; `executable-verification-readiness.md:251-265`) and the anchor; unobservable list explicit; no solver syntax | descriptor JSON + digest readback | Local |
| V4.1 | Comparison reproduced twice with identical outcome on E03 (2 exchange + 2 model-response), E04 (4 exchanges) and pinned `capture.sse` run 849 | E03/E04, capture.sse, comparison output digests | Local |
| V4.2 | Planted divergence (undeclared transition; post-HOLD dispatch; authority-digest change) yields DIVERGES with cursor, refuting link and limitation; no disposition promotion | planted fixtures | Local |
| V4.3 | Missing descriptor / identity digest / trace range yields NOT_OBSERVABLE + limitation; replay reports missing refs | missing-input fixtures | Local |
| V4.4 | Identical retained basis replays to the same outcome; purged fixture yields NOT_OBSERVABLE (L10) | replay receipts | Local |
| V4.5 | Live estate descriptor + recorder trace + ledger.verification, replayable after restart; evidence route resolves or is a visible limitation (A2.5/A3.1) | staging receipts | Staging only |

## Work items (ID/repo/produces/deps/size)

| ID | Repo | Produces | Deps | Size |
| --- | --- | --- | --- | --- |
| V4.1 | sfx-embody | `trace-expectation.v1` contract + AUTHORITY set + `derive-expected-trace-descriptor` pair; descriptor schema and digest | W0.6; recorder trigger vocabulary for trigger-scoped parts | S–M |
| V4.2 | sfx-embody | `trace-conformance.v1` rule family + evaluator fixtures | W2.4, W0.6, W2.1 | M |
| V4.3 | sfx-embody + sfx-dal | Comparison fixtures from E03/E04/capture.sse; L7/L10 receipts | V4.1, V4.2, W2.1 | M |
| V4.4 | sfx-platform | `verify-trace-conformance.mjs` gate (V4.0–V4.4 local; `--staging` flag) | V4.2, V4.3, W2.2 | M |
| V4.5 | sfx-embody | Requirements spec: trigger classes, HOLD disposition, safe-state predicate, effect envelope (declaration only) | recorder lane | S–M |
| V4.6 | sfx-platform | Recorder-lane integration: observed window → comparison → ledger; end-to-end V4.5 | recorder lane, S1, W2.1/W2.2 | M–L |
| V4.7 | SDA request + sfx-embody | Declared kernel-cellId ↔ estate-node join (observable mapping) | SDA, estate-to-pattern-mapping lane; labels source-cited, not PROVEN | M |
| V4.8 | sfx-embody | Link expectation provenance to W4.4 obligations (proof-backed vs presence-checked descriptors) | W4.4, Q8 | S |

## Decisions needed

1. **Descriptor home:** declared capability + per-run stored descriptor (recommended) vs evaluation-time derivation only.
2. **Trigger vocabulary ownership:** recorder lane declares triggers; this lane owns the trigger→precondition rules (recommended, in W0.6 rule-set extension).
3. **Join authority:** who declares the kernel-cell→estate-node mapping, and the honest label (`source-cited`, `formal-verification-turn-verification-2026-09-28.md:14-21`).
4. **Evaluator placement:** T-SQL pure-over-input (recommended) vs an SDA mechanic; a solver is out of scope.
5. **New declaration kinds:** do HOLD, safe state and effect envelope enter scope as declarations (product-owner decision, Q7-style)?
6. **DIVERGES consequence:** record-only vs triggering operator/HOLD; avoids an implicit control loop.
7. **Outcome mapping:** fix the 1:1 mapping to ledger outcomes; confirm INCONCLUSIVE's meaning with the W2.1 contract.

## Risks and corrections

- **Parity is open** (8/112/5; plan `:376`). One runtime's comparison must never be presented as cross-language conformance.
- **Topology violated:** 1 cyclic capability remains; route `semanticProgress` is a mechanical function of topology, not evidence (`formal-verification-turn-verification-2026-09-28.md:19-21`); blueprint review tests shape/reference integrity only (plan `:395-396`).
- **No prover:** FV0 is derive-only; expectations are not proofs. Only acyclicity, route coverage and `if`-totality are genuine today.
- **Do not consume overclaimed labels:** `fv_expression_semantics`, `fv_witnesses`, `fv_contract_satisfiability` (`formal-verification-turn-verification-2026-09-28.md:26-43`).
- **Installed-kernel divergence** (`e114d10`) may legitimately produce DIVERGES; that is the finding, not a matcher defect.
- **Questions 6–8 cannot be inferred** while HOLD/safe-state/effect-envelope vocabulary is absent; mark NOT_OBSERVABLE and record limitations.
- **Attribution breaks:** nested invocation hardcodes `projected-capability-invocation`, observer bridge drops record kinds (B13; `lane-06-sda.md:53-57`); comparison must not guess owners.
- **Registration gap:** `sda-embodiment-plan-port.v1` has 0 registered rows while 59 bindings use it (`lane-05-estate.md:258-262`).
- **Overclaims to avoid:** "expected trace" ≠ "proved trace"; CONFORMS ≠ admission; INCONCLUSIVE ≠ NOT_OBSERVABLE; a comparison result is evidence for evaluation, never a numeric promotion.
- **Dependency risk:** the recorder lane is unwritten; V4.5/V4.6 dates are not real until its trigger/window/HOLD declarations are specified.

## Confidence

High on all read file/line facts and count citations. Medium on the evaluator's exact input contract and the descriptor schema (proposed, depends on W0.6/W2.4 shapes). Open: join mechanism, trigger vocabulary ownership, safe-state/envelope scope, and whether recorder capture provides event-level authority digests. This document changes nothing and commits nothing.
