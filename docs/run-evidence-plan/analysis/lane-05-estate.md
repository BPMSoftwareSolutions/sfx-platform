# Lane 05: estate declarations (sfx-embody) — W0.4, W0.6, W2.4, W3.2, W4.4

Read-only recon + deep dive, 2026-10-06. Repo: sfx-embody `d9b1d3b`, with
read-only references to scenario-driven-architecture and sfx-platform.
Scope: [plan](../../run-evidence-implementation-plan.md) §3 D8/D9, §5.4, §6
W0.4, W0.6, W2.4, W3.2, W4.4, §4 B9–B12, B18–B25, §7 L0/L4.

## Current state

- The plan is draft/not started. For W0.6/W2.4/W3.2/W4.4 there are **no**
  trust/ledger rows, migrations or rule fixtures yet.
- Trust vocabulary is absent from the estate: `sql/` has no
  `trust_state|claim_kind|evidence_class` definitions (only an unrelated
  `evidence_classes` affordance column, e.g.
  `sql/migrations/affordance-projection.sql:33`).
- Telemetry live generation is O4 signal IDs (`089f889`,
  `extend-observation-telemetry-signal-ids.commit.sql`): `providerEvidence: []`,
  **no `shapes`** — retained in
  `sfx-platform/docs/run-evidence-plan/evidence/E02-telemetry-authority.json`
  (plus `valueDictionaries`/`signalDictionaries` from O3 `e600a3c`).
- Pre-G8 declaration bytes survive:
  `sql/migrations/extend-observation-telemetry-shapes.sql:50` (providerEvidence
  list + 5 shapes, commit `7b31091`); removal in
  `extend-observation-telemetry-allowlist-dedupe.sql:63,74,153-170` (commit
  `494af5e`, installed definition digest `37afde35…`).
- **FV0 infrastructure already exists** (commit `132fb77`): 8 `analysis.fv_*`
  readings (`sql/migrations/declare-fv0-readings.{sql,commit.sql}`), derived
  obligations (`declare-derive-capability-proof-obligations.{sql,commit.sql}`),
  proof receipts (`record-proof-receipt-procedure.{sql,commit.sql}`, 13 equity
  receipts under `sidefx:proof-receipts`), `governed-formal-verification`
  (`declare-governed-formal-verification-capability.{sql,commit.sql}`, `ea3f9ab`).
  But **no prover/checker/certificate**: `resolve-capability-proof-obligations`
  has no migration (`docs/executable-verification-readiness.md:192-194`;
  `sql/inspect/terminal-and-registry-truth/README.md:102` shows it as a scaffold
  row). `fv_witnesses` overclaims; honest corrections in
  `docs/formal-verification-turn-verification-2026-09-28.md:26-43` (relabel pair
  `6631d4e` authored, "NOT installed" per its message; a later FV turn may have
  installed it).
- Baseline numbers confirmed: 922/919 scenario contracts, 983/1,271 cell
  functions, 24 routes/5 scenarios
  (`sql/inspect/formal-verification-readiness/README.md:30-49,56-63`;
  `docs/formal-verification-readiness.md:83-97`).

## Declaration / migration pipeline

- Prime rule: meaning authored in the estate DB; capability meaning changes only
  by `.sql` rows (`AGENTS.md:25-30`).
- Lifecycle: author one idempotent migration in `sql/migrations/`, own
  `BEGIN TRANSACTION`, drop guard triggers, end `ROLLBACK`; dry-run with
  `run-migration.mjs`; preflight uncommitted invoke with
  `invoke-from-transaction.mjs`; flip to `COMMIT` twin and install; verify via
  `sfx capability invoke`; commit (`AGENTS.md:66-90`, `sql/README.md:42-89`).
- Every DB change is a **migration pair** (rollback preflight + commit twin),
  keys discovered from rows, verification inside the transaction
  (`AGENTS.md:189-192`).
- Runners: `scenario-driven-architecture/languages/typescript/src/kernel/bootstrap/run-migration.mjs:7-23`
  (one connection, no outer transaction);
  `invoke-from-transaction.mjs:14-18,70-75` (splits at last `ROLLBACK`, applies
  batches uncommitted in `beforePin`), `:80-141` (pinned read session,
  readAuthority + invocation), `:133-140` (experiment applied uncommitted).
- Digests: `model.semantic_object_definition.definition_digest` +
  `source.content_object.content_digest`; `model.declare_capability_document`
  computes `document_digest` and is the idempotence gate
  (`declare-json-authoring-surface.sql:81-126`, return shape `:120-125`).
  Install commits record digests (e.g. `494af5e`, `e600a3c`).
- Composition rule: SDA changes are **requests**, never edits from sfx-embody;
  capability-meaning changes are sfx-embody migrations.

## W0.6 — declare trust vocabulary + evaluator rule set v1

- Deliverable per plan: one migration pair declaring state identifiers 0–8,
  evidence classes, C1/C2, rule set v1 (prerequisites, identity manifests,
  independence, contradictions, invalidation, replay); no numeric promotion. It
  also seeds the future ledger vocabulary tables with the declaration digest.
- Recommended shape: **contracts + one AUTHORITY semantic set**, not per-state
  contracts and not a read capability for the vocabulary itself:
  - `model.declare_contract` for `trust-vocabulary.v1` (states 0–8, evidence
    classes, claim kinds C1/C2) and `trust-evaluation-rules.v1`; precedent
    `declare-consumer-execution-embodiment-plan.sql:279-281`
    (`registered-projection-authority-set.v1`).
  - `model.put_semantic_definition 'AUTHORITY', N'sidefx:authorities', ...`
    carrying the vocabulary and rule set (prerequisites, identity manifests,
    contradiction/invalidation/replay requirements); digest =
    `definition_digest` (the estate digest convention).
  - Add a declared-read capability only for the *evaluator* (W2.4), not for the
    vocabulary; the rule digest is the rule document's
    `document_digest`/`definition_digest`.
- Declarable now without Q7: states 0–5 prerequisites (identity/declaration/
  authority/observation/conformance), C1/C2 identity manifests,
  contradiction/invalidation/replay rules, scope/limitation requirements,
  admission prerequisites (state 8). Keep state 6 `CROSS_VERIFIED` present but
  **unsatisfiable** (no agreed independence prerequisites): declare the state and
  a rule whose prerequisite is "declared independence policy required", make
  `SATISFIED` unreachable, and add an L4 refusal fixture. States 7–8 rules may
  declare scope/assumption/admission requirements; do not claim formal proof.
- Fixtures:
  - Estate: declaration self-test/assertions and digest readback in the pair
    (pattern `extend-observation-telemetry-allowlist-dedupe.sql:101-178`);
    rule-input fixtures (accepted/refused bases) as `model.fixture` rows via
    `model.add_example` (`sql/schema/authoring-procedures.sql:749-801`) or the
    fixture-twin pattern (`declare-request-capability-fixture-twin.{sql,commit.sql}`);
    an L4 rule-matrix fixture document (state × evidence-class × scope); L0 drift
    artifact (retained vocabulary JSON + digest).
  - sfx-dal: procedure/constraint fixtures for I1–I10 that only exist in
    `ledger.*` — L2 decision-idempotence, L3 attach-digest refusal, L5 proof
    scope/assumptions constraints, L6 self-testimony/role, L7 NOT_OBSERVABLE,
    L8 append-only/purge tombstones, L9 admit-only, L10 replay. Follow the
    verification receipts pattern in `sfx-dal/identity/verification/*.json`.
- L10 replay is meaningless until W2.1 exists; keep those fixtures in sfx-dal.

## W2.4 — evaluator recommendation

- **Recommend T-SQL declared-read statement capability v1** (contracts + root
  scenario + `invoke-port` on a declared-read port), not an SDA mechanic: rule
  evaluation is set/logic checks over an input bundle; precedents are the
  telemetry authority (`declare-observation-telemetry-authority.sql:50-99`) and
  `derive-capability-proof-obligations` (`declare-derive-capability-proof-obligations.sql:1-28`).
  Escalate to an SDA mechanic only if a solver is needed (W4.4), because "a
  prover is a platform mechanic ... cross-language request."
- **Critical constraint**: the evaluator statement runs in the estate DB and
  cannot read the `sfx-identity` ledger (D2). It must be **pure over `@input`**:
  the identity host supplies the subject manifest, claim statement+digest, scope,
  evidence rows (class, polarity, producer, subject_digest, content refs),
  authority refs, requested target state and rule-set id; it returns the verdict;
  the identity host persists `ledger.verification`.
- C1 prerequisites to evaluate: identity (run manifest: run ID, attributable
  capability, canonical graph digest, executor digest; missing → pending/
  limitations, not a verdict); declaration (claim kind C1, canonical statement +
  `statement_digest`); authority (authority refs and definition digests);
  observation (trace/output evidence with producer lineage, subject-digest
  match, completeness; `NOT_OBSERVABLE` never supports).
- Sketch I/O: input `{ruleSetId, targetState, claim:{kind,statement,statementDigest,scope},
  subject:{kind,canonicalRef,digest,manifest}, authorityRefs[], evidence:[{class,
  producerSubjectId,subjectDigest,digest,polarity,observedAt}], replay:{retainedRefs[]}}`;
  output `{outcome:SATISFIED|VIOLATED|NOT_OBSERVABLE|INCONCLUSIVE, ruleSetId,
  ruleDigest, prerequisitesChecked, contradictions[], limitations[],
  invalidationConditions[], inputsDigest}`; identical retries idempotent; no
  numeric comparison.
- Digest recording: statement capability's `document_digest` (declare time) is
  `evaluator_subject_id`; rule-set `definition_digest` is `rule_digest`; both are
  returned in the verdict and stored by `ledger.record_verification` (W2.1). Add
  assertions in the pair that read the digest back from
  `analysis.v_selected_semantic_definition`.

## W3.2 — re-declare telemetry shapes; retention/input disclosure

- Current live O4 has `providerEvidence: []` and no `shapes`. Delta to restore:
  - `objectFields.providerEvidence` → `["reachedStage","exchangeCount",
    "transportDisposition","redactionVerified","httpStatus"]`;
  - `objectFields.shapes` → exact object at
    `extend-observation-telemetry-shapes.sql:50` (identical list also at
    `extend-observation-failure-testimony.sql:57`).
  - Contract needs **no change**: O4's contract keeps `shapes` optional and
    `providerEvidence` an array
    (`extend-observation-telemetry-signal-ids.commit.sql:96`); keep
    `occurrenceId` dropped and preserve O3/O4 dictionaries/projections.
  - One pair, e.g. `restore-observation-telemetry-shapes.{sql,commit.sql}`, with
    the dedupe pair's assertion/replay structure adapted to assert the restored
    members.
- D5/D6 declaration surface: no existing retention/input-disclosure declaration
  or writer. Design: one extra pair declaring contract + AUTHORITY set
  `evidence-disclosure-policy.v1` under `sidefx:authorities` with
  `{defaultRetention, replayPeriod, capabilities:{<id>:{inputDisclosure:"NONE"|"DIGEST"|"FULL"}}}`;
  nearest private-capability binding precedent is
  `bind-authenticate-ide-user-private-host.{sql,commit.sql}` and its
  credential-reference pattern. The identity host reads it through a declared
  read (add a view/read only if enforcement requires one; do not add a new table
  kind).

### W0.4 measurement gap (deep dive)

- Confirmed: `invoke-from-transaction.mjs:100-107,116-117` calls
  `invokeDeclaredCapabilityInSession` with no `onObservation`;
  `invocation-boot.mjs:165-166` collects raw observations and `:246-251` returns
  `observations: []`. The declared-telemetry filter is only wired on the CLI
  path (`entry.mjs:335-349`, using `createObservationFilter` from
  `command-carrier.mjs:256`); the preflight never applies it.
- Minimal SDA probe (temporary, uncommitted): in
  `languages/typescript/src/kernel/bootstrap/invoke-from-transaction.mjs` add an
  env-gated sink (precedent `SFX_PREFLIGHT_PHYSICAL_TRACE`, `:42-56`), e.g.
  `SFX_PREFLIGHT_OBSERVATIONS=<file>`; change `invocation-boot.mjs:247` from
  `observations: []` to `observations`; and in the preflight copy
  `execution.outcome.observations` into its result, then apply
  `createObservationFilter` offline against the experiment's own declared
  authority (self-test pattern
  `extend-observation-telemetry-allowlist-dedupe.sql:130-151`). Export filtered
  JSONL + per-shape byte totals.
- Local workaround, no SDA request needed: use a clean SDA worktree
  (`C:\lab\repos\sda-wt-f0` or `sda-wt-f1`) with the edit above, uncommitted and
  unmerged; exact precedent of W0.3. Record E08 and the diff. File the durable
  SDA request separately but do not wait for it.
- **Additional correction**: an uncommitted re-declaration is invisible to the
  installed kernel, so "preflight + invoke" cannot combine. W0.4's working path
  is a temporary SDA worktree sink plus a **committed-then-rolled-back** estate
  pair, then two invocations (one equity, one Gemini), then rollback; compare
  model-response payloads, request/response bodies, and how many evidence records
  arrive key-only per run — this answers Q2+Q3 together.
- Recommended W0.4 path: preflight pair `restore-shapes-experiment.sql` (copy of
  O4 declaration + pre-G8 objectFields) → invoke via the worktree sink → offline
  filter → retain E08 → rollback. Do not commit shapes.

## W4.4 — first proof obligations

- There is **no** certificate/checker infrastructure: no prover/checker code in
  the SDA kernel; no `resolve-capability-proof-obligations` migration; FV0 is
  derive-only; Q8 open. What exists: 8 `analysis.fv_*` readings,
  `derive-capability-proof-obligations`, and `record_proof_receipt` writing
  AUTHORITY receipts under `sidefx:proof-receipts`;
  `model.proof_obligation_fixture` is empty.
- Prepare now (estate, no Q8): route-exclusivity/coverage obligations are
  already computable (`analysis.fv_route_variant_coverage`,
  `declare-fv0-readings.sql:16-17`; formal-verification-readiness README `:63`);
  add an export mapping each route obligation to a serialized statement +
  scope/assumptions, and a certificate-agnostic receipt schema (`obligationRef,
  proverId/digest, checkerId/digest, result, certificateRef/digest, scope,
  assumptions`) recorded as a semantic definition (content store) via the
  existing receipt pattern. Do not put solver syntax in rows.
- Waits for Q8: prover/checker selection, certificate format, the
  `resolve-capability-proof-obligation` provider (cross-language request), and
  `ledger.proof_result` persistence (W2.1). Until then dispositions stay
  `NOT_FORMALLY_OBSERVABLE`/`PROVIDER_ASSUMPTION_REQUIRED`; genuine structural
  proofs are only acyclicity, route coverage, `if` totality
  (`formal-verification-turn-verification-2026-09-28.md:34-43`).

## Effort and 3-turn allocation

- Engineer-days (single experienced engineer, estate-only):
  W0.4 worktree probe 0.5–1.5 (SDA request text +0.5, not implementation);
  W0.6 2–4; W2.4 2–3; W3.2 shapes 0.5–1 + disclosure 1–2 + A3.4 0.5;
  W4.4 prep 1.5–3, prover integration 3–10 (external).
- Hard dependencies: W2.4 ← W0.6 rule set + W2.1 ledger; W3.2 ← S1 live +
  W0.4/E08 + S3; W4.4 complete ← Q8 + W2.1 `proof_result`; L0 drift check ←
  W0.6 digest + identity reference copy; W0.4 ← nothing (provider keys only).
- 3-turn allocation: **Turn 1** — W0.4 worktree probe/E08 + W0.6 pair + estate
  rule fixtures (parallel with S1/S3 requests). **Turn 2** — W2.4 pair +
  evaluator fixtures + digest readback; W4.4 obligation-export/receipt-schema
  prep; if S1 landed, W3.2 shapes pair + A3.4. **Turn 3** — W3.2
  disclosure/retention pair; W4.4 prover adapter if Q8 answered; dal-side
  ledger stream and platform-side `verify-trust-ledger.mjs` proceed
  independently throughout.

## Plan corrections from this lane

1. W0.4 as written is not executable: no observation sink in the preflight and
   the filter lives only on the CLI path. Name the temporary SDA worktree probe
   in the plan.
2. W0.6 says vocabulary "as rows"; the estate convention is contracts +
   AUTHORITY semantic definitions, and the sfx-identity "closed reference copy"
   has no estate-DB transport — L0 drift needs a retained artifact or declared
   read.
3. W3.2 "as before G8" must be built from the **O4 live generation**, preserving
   value/signal dictionaries and contract amendments; plan B9 details predate
   O3/O4.
4. The evaluator cannot read the ledger in-process (D2); it must be pure over
   the identity host's supplied bundle — the plan does not state this interface.
5. Certificate/proof vocabulary must avoid prover syntax and forbidden artifact
   vocabulary; store certificates as semantic content/receipts.
6. `sda-embodiment-plan-port.v1` has 0 registered platform rows while 59
   bindings use it (`sql/inspect/review-coverage-truth/README.md:139-143`) —
   new declared-read capabilities inherit the known registration gap.
7. L0/L10 gate tooling (`verify-trust-ledger.mjs`) does not exist in
   sfx-platform; no E06–E09 evidence yet.
8. W0.6 must explicitly encode "state 6 unavailable" and the L4 refusal; Q7
   remains a product-owner decision, not inferred from repeated producers.
9. The `OBSERVED` worked example (§5.4) requires executor identity from
   run-attributable evidence; the local selection `d0fe2b83…` is not evidence —
   evaluator rules must keep it pending rather than substituting local config.

## Confidence

High in sfx-embody/SDA file facts (read directly). Medium on live installed
state: FV0/`relabel-fv0` install status is documented but not DB-verified.
Open: whether W0.6 vocabulary is one AUTHORITY set vs several contracts; whether
rule evaluation is T-SQL or an SDA mechanic; whether W3.2 retention/disclosure
gets a new writer; whether `relabel-fv0` corrections are installed before W4.4;
Q7 blocks state-6 rules.
