# Run evidence and the trust ledger: implementation plan

Prepared 2026-10-06 for team review. Status: **draft, not started.**

**Revision 3 (2026-10-06): claim-scoped trust integrated into delivery.**

- The decision model is closed first (§2).
- sfx-identity becomes the Engineering Lab's trust ledger: it remembers why each
  trust claim is justified.
- Run evidence (revision 1) is the ledger's first source of evidence.
- The supplied Engineering Lab proposal is incorporated as ten planning
  constraints, mapped to invariants, work items and verification gates. Its
  conceptual ladder supplies vocabulary, not a numeric trust score.
- Rule prerequisites, independence, invalidation and replay limits are explicit.
  The schemas and service changes below remain proposed; no ledger, rule set or
  proof producer is claimed to be installed by this document.

## Contents

1. [Outcome](#1-outcome)
2. [The decision model (closed)](#2-the-decision-model-closed)
3. [Decisions for the team](#3-decisions-for-the-team)
4. [Baseline: what is true today](#4-baseline-what-is-true-today)
5. [Target design](#5-target-design)
6. [Phases and work items](#6-phases-and-work-items)
7. [Verification gates](#7-verification-gates)
8. [Security and privacy](#8-security-and-privacy)
9. [Risks](#9-risks)
10. [Open questions](#10-open-questions)
11. [Traceability](#11-traceability)

Appendices: [A. Evidence index](#appendix-a-evidence-index) ·
[B. How to reproduce the baseline](#appendix-b-how-to-reproduce-the-baseline)

**Basis.** Every claim in the baseline cites one of two kinds of source:

- a file and line in the repositories, which can be checked;
- a retained measurement under [`run-evidence-plan/evidence/`](run-evidence-plan/evidence/),
  indexed in Appendix A.

Statements about the future are labelled *proposed*. Estimates are left out on
purpose; the team sizes the work items.

**Design reference.** The user-designated designs are the eight-slide
[run-evidence-E1.pptx](C:/lab/repos/sfx-providers/outputs/capability-estate/live-circuit-platform-explorer/E1/run-evidence-E1.pptx),
documented in [Design E1](explorer-run-evidence-design.md). Verified SHA-256:
`277c3cba257e185d64019f84d247071d884a2b0a5e05c26c0a0f05cd7a2577ac`.
E1 governs composition and interaction: preserve the existing circuit, the Run /
Runs / Evidence context tabs, the report, playback and click-to-evidence flow.
The trust ledger adds attributable claim details within those views. Its
disposition presentation still needs an E1 design extension; it is not shown
in the current deck. The deck's review annotations are not application panels.
The deck remains unchanged and marked for review; this plan does not imply
that it is implemented. Its baseline statements are dated design evidence;
§4 and the gates below govern current data availability and implementation
ownership. [Replay timing fidelity](replay-timing-fidelity.md) records the
playback finding.

**How to review.**

1. Confirm that the decision model in §2 is closed. It is the frame for
   everything after it.
2. Answer the decisions in §3. They change the shape of Phases 2–4.
3. Check the baseline in §4 against its sources.

---

## 1. Outcome

**First: sfx-identity remembers why every trust claim is justified.**

- Every reliance the Engineering Lab places on something is recorded in
  sfx-identity as a disposition over one specific claim. That something can be a
  capability, an executor, a provider, a model, an agent or a run.
- Each disposition records:
  - the exact identity of the subject;
  - the authority the claim traces to;
  - the evidence for it and against it;
  - the verification and proof performed;
  - its limitations;
  - its lineage.
- It can be replayed.

**Second: a signed-in user sees the evidence of a run without searching.**

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
   - the full trace;
   - the claim's current trust disposition and its limitations.

Runs are the ledger's first evidence producer. Evidence is linked to the
principal who ran the capability. That is the product owner's direction of
2026-10-06.

**Not in scope.**

- New Engineering Lab functionality beyond the ledger and the producers named in
  Phase 4.
- Any architecture concept that §2 does not already decide.
- Trust in an entity as a whole: it does not exist in this model (T1).
- Sharing runs across principals beyond an explicit link (D4).
- Production rollout beyond the staging slot.
- Changing capability execution semantics or treating an AI proposal as
  admitted authority. This plan records and evaluates evidence of execution.

## 2. The decision model (closed)

This section freezes the decision model before more Engineering Lab functionality
is added. It is the product owner's model of 2026-10-06. Changing it is a
decision for the product owner, not part of this plan.

> **Trust is not a boolean property of an artifact. Trust is an evidence-backed
> disposition over a specific claim.**

There is no `isTrusted`. The narrowest defensible statement is the only kind the
ledger records:

> *this* agent, model, provider or capability is trusted to make *this claim* or
> perform *this bounded responsibility*, under *these conditions*, because *this
> evidence* supports it.

### 2.1 The questions every disposition answers

| Question | Where the ledger records the answer (§5.2) |
| --- | --- |
| What are we trusting? | `claim` and its `subject` |
| Why are we trusting it? | `disposition.basis`: the evidence ids and the rule that decided |
| Who or what asserted it? | `claim.asserted_by` (a subject or a principal) |
| Under which authority? | `claim_authority` → `authority_ref` (semantic address and definition digest) |
| What evidence supports or refutes it? | `claim_evidence` with polarity `SUPPORTS`, `REFUTES` or `NOT_OBSERVABLE` |
| What verification was performed? | `verification` (evaluator identity and digest, rule digest, outcome) |
| What assumptions remain? | `proof_result.assumptions` and `limitation` of kind `ASSUMPTION` |
| What was not verified? | `limitation` of kinds `NOT_VERIFIED`, `OUT_OF_SCOPE` and `NOT_OBSERVABLE` |
| When was it verified? | `verification.performed_at`, `disposition.decided_at` |
| Against which exact identity or digest? | `subject.digest`; every evidence row names the subject digest it applies to |
| What would invalidate the conclusion? | `disposition.invalidated_by` (declared conditions, such as a new subject digest, a refuting evidence class or a rule change) |

### 2.2 The trust states

| # | State | Meaning | Evidence class that can establish it |
| --- | --- | --- | --- |
| 0 | `UNTRUSTED` | Exists; no relevant claim is established | — |
| 1 | `IDENTIFIED` | Exact subject identity: digest, version and provenance known | identity |
| 2 | `DECLARED` | The subject makes an explicit machine-readable claim | declaration |
| 3 | `AUTHORITY_BOUND` | The claim traces to an admitted governing authority | authority |
| 4 | `OBSERVED` | Actual behaviour or state has been independently observed | observation |
| 5 | `CONFORMANT` | The observation satisfies the declared structural and behavioural obligations | conformance |
| 6 | `CROSS_VERIFIED` | The claim survives materially independent embodiment, provider or runtime checks | cross-verification |
| 7 | `FORMALLY_VERIFIED` | The applicable mathematical proof obligations have been discharged | formal proof |
| 8 | `ADMITTED` | Governance accepts the evidence package for the declared scope | admission |

**The states are not strictly cumulative.**

- A disposition is held per claim and per scope.
- Formal verification always has a scope. Graph reachability can be proven while
  an external HTTP provider has only observational evidence.
- The ledger keeps those as separate claims with separate dispositions. It never
  merges them into one "verified".
- The numbers are vocabulary identifiers and display order only. No evaluator
  uses `MAX(trust_state)`, a threshold such as `state >= 5`, or an automatic
  promotion through all states. Several scoped conclusions may coexist.
- Each versioned rule declares the prerequisites for its target state. The
  table names the characteristic evidence class; one record of that class is
  not by itself sufficient. Admission records a permitted reliance and its
  conditions; it does not imply formal proof or independent observation.

### 2.3 The ten decisions

| # | Decision | Enforced as (§5.3) | Gate (§7) |
| --- | --- | --- | --- |
| T1 | Trust is claim-scoped, never entity-global. | I1: every trust assessment is keyed by claim and scope; no entity-wide trust flag | L1 |
| T2 | Every trust elevation requires evidence. | I2: a newly justified reliance must satisfy the target rule's evidence prerequisites; numeric state order is never a rule | L2 |
| T3 | Identity and exact version or digest come before evidence is attached. | I3: evidence attaches only to a claim whose subject has a non-null digest equal to the evidence's subject digest | L3 |
| T4 | Authority, observation, conformance, cross-verification and formal proof stay distinct evidence classes. | I4: closed evidence classes and declared prerequisite rules for each scoped conclusion (§2.2) | L4 |
| T5 | Formal proof always records scope and assumptions. | I5: `proof_result.scope` and `assumptions` are required | L5 |
| T6 | External or provider testimony cannot admit itself as truth. | I6: testimony retains its producer; conformance and verification need rule-qualified independent evaluation, and admission needs separate governance authority | L6 |
| T7 | Absence of evidence stays `NOT_OBSERVABLE`: not success, and not necessarily failure. | I7: `NOT_OBSERVABLE` is an outcome and a polarity; it never counts as support | L7 |
| T8 | Contradictory evidence is kept, never overwritten by newer favourable evidence. | I8: evidence and its links are append-only; retention removes content bytes only, leaving a tombstone | L8 |
| T9 | Admission is a governance disposition over evidence; it is not proof. | I9: `ADMITTED` is written only by the admission procedure for an admission principal, and leaves proof results untouched | L9 |
| T10 | Every conclusion can be replayed from its identity, authority, evidence, evaluator or prover, and versioned rules. | I10: retain the complete decision basis and versioned dependencies; report replay unavailable if required material is missing or purged | L10 |

The zero-trust order these decisions impose:

1. identity before reliance;
2. authority before execution;
3. evidence before belief;
4. conformance before admission;
5. proof where proof is possible;
6. explicit uncertainty where it is not.

### 2.4 Reliance, contradiction and invalidation

A disposition answers whether a named responsibility may rely on a specific
claim under recorded conditions. Producers assert and attach; a declared
evaluator checks; an authorized governance principal admits. A provider, model
or agent cannot bypass those roles by labelling its own output "verified".

Rules examine both supporting and refuting evidence for the exact subject,
claim and scope. New favourable evidence does not erase a contradiction or
restore reliance merely because it is newer. A changed subject digest, revoked
authority, unmet assumption or relevant refutation triggers re-evaluation.
Append an invalidation or superseding decision with its reason and basis; keep
the earlier conclusion available as historical evidence. Unaffected scopes
remain separate. These are validity changes, not additional trust states.

Formal obligations are derived from existing declared authority: scenario
transition systems, contract predicates and execution-graph transitions. No
new theorem language is part of this work. A proof records which obligations
were discharged, under which assumptions, and which external behaviour it
does not establish.

**Where the premises already stand in the repositories.**

- "Candidates may be proposed probabilistically, but grounding requires canonical
  identity, admitted authority, relationships, and evidence"
  (`scenario-driven-architecture/docs/kernel-architecture-achieved.md:153`).
- Governed Recursive Capability Improvement keeps "independent authority over
  what becomes durable" (`scenario-driven-architecture/docs/sidefx-equals-rsi.md:337`).
- Proof obligations are "deterministically derived" from declared authority. The
  scenario is a transition system, and contracts are predicates
  (`sfx-embody/docs/sidefx-formal-verification.md:1,5,65`).

A document titled "System 2 Software Engineering", cited in the product owner's
note, is not in these repositories. It is not used as a source here.

## 3. Decisions for the team

| # | Decision | Recommendation | Why (evidence) |
| --- | --- | --- | --- |
| D1 | Where the ledger lives inside sfx-identity | Two new schemas beside `identity`: `ledger` (claims, evidence links, verifications, proofs, dispositions) and `evidence` (run records and content bytes). Foreign keys go to `identity.principal` and `identity.session`. | `identity` holds exactly the login surface: 7 tables and 8 procedures (B15). Keeping facts apart from heavy content lets retention remove bytes without touching the ledger (T8). |
| D2 | Which process writes and reads it | The identity host only. Every caller uses its own service credential over loopback. | The identity child is the only process given `SFX_IDENTITY_CONNECTION_STRING` (B15). The SDA API host "holds no database handle" (B16). |
| D3 | What is stored, by phase | See below. | Phase 2 needs no SDA change (B5, B14). Phase 3 needs the SDA evidence port (B5, B16). |
| D4 | Who can read a run and its claims | The runner, by default. Shared links resolve only for signed-in principals the runner grants. | Today any run is visible to whoever has the page (B1, B3). |
| D5 | Retention | One declared default (a value to choose) and deletion on request. Expiry removes content bytes and keeps the ledger rows with their digests (T8). | Content size is unknown until W0.4; trace size is measured (B14). |
| D6 | Inputs of private capabilities | Never stored, as declared per capability. `authenticate-ide-user` and `enroll-ide-user` inputs carry credentials. | The identity host keeps private bodies out of "generic run records" (cli-login README:80). The `deniedMembers` redaction is declared (B9). |
| D7 | Runs not started from the browser (CLI `sfx-api`, operator token) | Attribute them to the operator principal when there is one; otherwise mark them unattributed and visible only to operators. | Login does not yet authorize user bearers for `/v1/runs` (identity-login.md:59). |
| D8 | Where the trust vocabulary and evaluation rules are declared | See below. | Meaning is authored in the estate database (`sfx-embody/AGENTS.md`, prime rule). T10 needs rules that are versioned by digest. |
| D9 | The first claim kinds | Two only, until Phase 4: **C1** run outcome and **C2** provider exchange (see below). | They are the claims Phases 2–3 produce evidence for (B6, B7, B21). Starting closed avoids vocabulary sprawl (R8). |
| D10 | Who may admit (state 8) | Named admission principals, separate from runners and evaluators. Start with the estate operator. | T9. The estate's admission today is the operator's migration commit (B25). |

Details for D3:

- **Phase 2:** the run subject, claim C1, the run record, the output and the lane
  trace.
- **Phase 3:** evidence content (provider exchanges, shapes, model responses) and
  claim C2.
- **Phase 4:** verifications, proofs and admissions from existing producers.

Details for D8:

- The trust states, evidence classes, claim kinds and evaluation rules are
  declared in the estate as rows, through an `sfx-embody` migration pair.
- sfx-identity holds a closed reference copy for its constraints, with the
  declaration's digest, plus a drift check (gate L0).
- The evaluator is a declared capability. Its executor and definition digests are
  stored with every verification.
- Rules include required evidence classes, authority and independence checks,
  scope, assumptions, contradiction handling and invalidation conditions.
  `CROSS_VERIFIED` remains unavailable until Q7 defines a testable independence
  policy. A second producer ID or repeated invocation alone does not establish
  material independence.

Details for D9, the two claim kinds:

- **C1, run outcome.** "Run R of capability C, graph digest G, executor digest K,
  returned outcome variant V." Assert this when terminal evidence is available,
  not when the run is admitted. Missing identity or outcome fields are reported
  as limitations; a local configuration is never substituted for a remote run's
  executor identity.
- **C2, provider exchange.** "Provider P answered exchange X of run R with status S
  in t ms."

## 4. Baseline: what is true today

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
| B9 | The estate's telemetry authority declares the values listed below. | E02; `extend-observation-telemetry-allowlist-dedupe.sql` (commit `494af5e`) |
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
| B16 | The SDA API doctrine: "Every heavy datum has exactly one home: the evidence storage provider, addressed by reference. V1 emits references only." "The host holds no database handle, no vault…" "No endpoint in this interface serves evidence content." | `scenario-driven-architecture/interfaces/sda-api/sda-api-v1.authority.json:66-68` |
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

### The trust ladder today

Each rung has producers today. None of their results is recorded as a disposition
over a claim.

| # | Rung | What exists | What is missing | Source |
| --- | --- | --- | --- | --- |
| B18 | 1 `IDENTIFIED` | See below. | No record joins these digests into one subject identity | See below. |
| B19 | 2 `DECLARED` | 972 living scenario versions are linked. 922 have an input contract and 919 an outcome contract. All 869 contract schemas resolve. | Operations carry no data-flow or contract keys | `sfx-embody/sql/inspect/formal-verification-readiness/README.md:30-49` |
| B20 | 3 `AUTHORITY_BOUND` | Every run reads its authority in a timed `readAuthority` delivery phase (staging run 849: 136 ms). The kernel interprets only database-selected authority. | The run's record does not keep which authority definitions (by digest) it bound | [timing log](replay-timing-fidelity/timing-log.md); `kernel-architecture-achieved.md:153` |
| B21 | 4 `OBSERVED` | Kernel-timestamped cell and edge testimony for every operation (B12, B14); provider exchange records (B6, B7) | It is held only in memory (B1, B2). The provider records are produced by the providers' own execution (T6). | B1–B14 |
| B22 | 5 `CONFORMANT` | See below. | Results live in decks, receipts and inspect output, not as dispositions | See below. |
| B23 | 6 `CROSS_VERIFIED` | Projected-body testimony across the three language targets is compared by an SDA probe. Parity is **open**: the observed cell sets differ, 8 / 112 / 5 on the resolved branch. | Parity; a record of independence | `sfx-embody/docs/sda-change-request-projected-testimony.md:3,12` |
| B24 | 7 `FORMALLY_VERIFIED` | **No obligation has been discharged.** See below for what can be derived today. | See below. | `formal-verification-readiness/README.md:30-49` |
| B25 | 8 `ADMITTED` | Estate changes are admitted when a preflighted migration's commit twin is installed and verified. The kernel executable is admitted by install manifest and digest. | Admission is recorded in git history and receipts, not as a governance disposition over an evidence package | `sfx-embody/AGENTS.md:44,75-90,145` |

Details for B18, identity:

- The executor is selected by digest:
  `KernelEntry.exe` under `kernel\d0fe2b83…`.
- Each run's graph carries a `canonicalGraphDigest` (staging run 849:
  `sha256:95a4c90d…`).
- Scene pages carry `svgDigest`.
- Evidence references carry a SHA-256 (B5).
- Sources: `sfx-embody/sfx.config.json`;
  [`capture.sse`](replay-timing-fidelity/capture.sse) seq 855; B5.

Details for B22, conformance:

- The blueprint review emits 35 finding codes. All of them test the shape and
  reference integrity of one declaration graph; none tests the five living
  conditions.
- Topology conformance passes with zero violations for `authenticate-ide-user`.
- Sources: `sfx-embody/sql/inspect/review-coverage-truth/README.md:25`;
  `sfx-providers/providers/cli-login/README.md:26-27`.

Details for B24, what can be derived for formal proof today:

- **Derivable:**
  - scenario predicates (922 of 972 scenario versions);
  - cell functions (983 of 1,271 ports bind declared transformations over 32
    operators);
  - route exclusivity and coverage (24 routes; coverage holds).
- **Not derivable:**
  - mechanic contracts: 1 of 56 named contract ids resolves;
  - invariants: 0 of 738 observable conditions is formal.

**Reading the baseline together.**

- The kernel can produce the evidence (B10, B11).
- The API host sees it and throws it away (B5), because there is nowhere to put
  it (B16).
- The estate has switched production off until there is (B9, B10).
- The browser gets timing and status only (B12, B17).
- Run ownership exists only in memory (B1).
- Sources relevant to the trust states exist as scattered declarations, receipts
  and inspect outputs (B18–B25). They are not yet joined in this ledger. In
  particular, cross-language parity is open and no formal obligation is
  recorded here as discharged; the existence of a producer does not establish
  its corresponding trust state.

The plan:

- supplies the missing home (sfx-identity);
- links it to the runner;
- records trust as dispositions over claims;
- then switches evidence production back on.

## 5. Target design

### 5.1 Data flow (proposed)

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
                                 │              ▲
                                 │              │ (4) verifications, proofs, admissions
                                 ▼              │     (Phase 4 producers; evaluator is a declared capability)
                     sfx-identity: identity.*  (login, unchanged)
                                   ledger.*    (subjects, claims, evidence links, verifications,
                                                proofs, limitations, dispositions, lineage)
                                   evidence.*  (run records, trace chunks, evidence content)
```

1. **Run admission.**
   - When the circuit host admits an Observe, it records the run and its known
     identity against the principal. Today `run-api.mjs:78` writes only to
     memory. This operational admission is distinct from the ledger's
     governance disposition `ADMITTED`; it asserts no future outcome.
   - The identity host takes the principal from the session it validates itself.
2. **Trace.**
   - The circuit host appends the run's events in Brotli chunks *as they arrive*,
     so the API's retention (B2) cannot evict them first.
   - At run end it stores the output.
   - Assert C1 once terminal evidence and the required identities are present;
     the trace and output become its observation evidence. Incomplete runs stay
     visibly incomplete rather than receiving an invented terminal claim.
3. **Evidence content (Phase 3).**
   - The SDA API host already holds each full evidence record at
     `buffer.ts:90-100` (B5).
   - The requested evidence port delivers the record to the identity host instead
     of discarding it. The API host still holds no database handle (B16).
4. **Producers (Phase 4).** These write verifications, proof results and
   admissions:
   - conformance checks;
   - the cross-language parity probe;
   - provers of the derivable obligations;
   - the estate's admission step.

### 5.2 The ledger (proposed, migration `002-trust-ledger`)

Spikes W0.3–W0.5 and the vocabulary declaration (W0.6) confirm the columns
before installation.

| Table | Holds | Key columns |
| --- | --- | --- |
| `ledger.subject` | The thing a claim is about | See below. |
| `ledger.claim` | What is asserted | `claim_id`, `subject_id`, `claim_kind` (C1, C2, …), `statement` (canonical JSON), `statement_digest`, `scope`, `asserted_by`, `asserted_at` |
| `ledger.authority_ref`, `ledger.claim_authority` | What gives the claim meaning | `semantic_address`, `definition_digest`, `kind` (estate declaration, governance policy) |
| `ledger.evidence`, `ledger.claim_evidence` | What supports or refutes it | See below. |
| `ledger.verification` | What evaluation was performed | `claim_id`, `scope`, `evaluator_subject_id` (identity and digest), `rule_digest`, input evidence ids and digests, authority refs, `independence_basis`, `outcome` (`SATISFIED`, `VIOLATED`, `NOT_OBSERVABLE`, `INCONCLUSIVE`), `performed_at` |
| `ledger.proof_obligation` | What must hold mathematically | `claim_id`, `derived_from` (`authority_ref`), `obligation_class` (predicate, completeness, exclusivity, admission, safety, termination), `statement` |
| `ledger.proof_result` | What was proven | `obligation_id` and statement digest, `prover_subject_id` and digest, rule digest, input evidence ids and digests, `result` (`PROVEN`, `REFUTED`, `UNKNOWN`, `TIMEOUT`), required `scope` and explicit `assumptions`, certificate ref and digest, checker identity/digest and outcome, `performed_at` |
| `ledger.limitation` | What remains unknown or out of scope | `claim_id` or `disposition_id`, `kind` (`NOT_VERIFIED`, `ASSUMPTION`, `OUT_OF_SCOPE`, `NOT_OBSERVABLE`), `statement` |
| `ledger.disposition` | What may be relied upon | See below. |
| `ledger.lineage` | How we got here | `from_id`, `to_id`, `relation` (`derived_from`, `supersedes`, `contradicts`, `produced_by`) |
| `ledger.trust_state`, `ledger.evidence_class`, `ledger.claim_kind` | The closed vocabulary | Seeded from the estate declaration with its digest (D8) |

Key columns of `ledger.subject`:

- `subject_id`;
- `subject_kind` (capability version, scenario version, executor, provider
  binding, model, agent, run);
- `canonical_ref`;
- `digest` (required);
- `version`;
- `provenance`.

The digest identifies a canonical, immutable identity manifest with a declared
digest algorithm and canonicalization version. A run manifest includes its
run ID and attributable capability, graph and executor identities; a graph
digest alone does not identify an invocation. New versions create new subjects
with lineage. Evidence awaiting a required identity can be retained as pending
run material but cannot support a disposition until attachment passes I3.

Key columns of `ledger.evidence` and `ledger.claim_evidence`:

- `evidence_class`;
- `producer_subject_id`;
- `subject_digest`;
- `content_ref`, which points to `evidence.*`;
- `digest`, `observed_at`;
- the link `polarity`: `SUPPORTS`, `REFUTES` or `NOT_OBSERVABLE`.

Key columns of `ledger.disposition`:

- `claim_id`, `scope`, `trust_state` (identifier 0–8, not a score);
- `basis` (supporting and refuting evidence ids/digests, verification/proof ids,
  authority refs and retained input-manifest digest), `rule_digest`;
- `decided_by` (evaluator or admission principal);
- permitted reliance and conditions, including unresolved limitations;
- invalidation conditions and append-only invalidation decisions, `supersedes`;
- `decided_at`.

Procedures follow the `identity` pattern: named, transactional, and checking
their own invariants. For example:

- `ledger.identify_subject`;
- `ledger.assert_claim`;
- `ledger.attach_evidence`;
- `ledger.record_verification`;
- `ledger.record_proof_result`;
- `ledger.decide_disposition`;
- `ledger.admit`;
- `ledger.read_claims_for_principal`.

The run content store stays as revision 1 designed it, in schema `evidence`:

- `evidence.run`: the principal, session, capability, times, outcome, input
  (NULL when private, D6), output and trace counts;
- `evidence.run_trace_chunk`: Brotli chunks with SHA-256;
- `evidence.evidence_object`: content by reference, with owner cell;
- `evidence.access_audit`.

`ledger.evidence.content_ref` points into these tables.

### 5.3 Invariants (how §2.3 is enforced)

| # | Invariant | Mechanism |
| --- | --- | --- |
| I1 | Trust assessments exist only as dispositions keyed by claim and scope; vocabulary tables define names, not entity assessments | Schema, procedure and response-contract review (L1) |
| I2 | `decide_disposition` requires the declared target rule's complete evidence basis for every new reliance. It evaluates contradictions and limitations and records what changed. Replaying an identical decision is idempotent, not a new elevation. | Procedure check; target-rule prerequisites, not numeric comparison |
| I3 | `attach_evidence` refuses when the claim's subject digest is NULL or differs from the evidence's `subject_digest` | Procedure check; `digest` is NOT NULL |
| I4 | `evidence_class` is a foreign key to the closed vocabulary; versioned prerequisites are enforced for each claim kind, scope and target state | Foreign key plus procedure; no inferred state hierarchy |
| I5 | `proof_result.scope` is non-empty and `assumptions` is explicitly supplied; an empty list means none declared, while NULL means unknown and is refused | Check constraints and certificate/checker verification |
| I6 | Self-produced testimony cannot establish conformance, cross-verification, formal verification or admission by itself. Independent evaluation must meet the declared rule, with producer lineage and shared dependencies recorded; governance remains separate. | Procedure and role checks; differing IDs alone are insufficient |
| I7 | `NOT_OBSERVABLE` outcomes and links remain in the recorded decision basis as limitations; they never count as supporting evidence | Procedure check |
| I8 | Subject versions, claims, authority refs, evidence/links, verifications, proof obligations/results, limitations, dispositions and lineage are append-only. No application role can rewrite their history. Retention purges only permitted content bytes and appends a digest-bearing tombstone. | Grants plus procedures; explicit invalidation and supersession |
| I9 | Only `ledger.admit`, called with an admission principal (D10), writes state 8. It records the evidence package (ids and digest) and scope. It never writes proof tables. | Procedure check plus role |
| I10 | Each conclusion retains exact subject, claim/scope, authority, input evidence, evaluator/prover/checker and rule identities/digests, configuration, timestamps and limitations. Deterministic decisions replay from that basis; governance records replay their authorization and prerequisites, not a human choice. | Required references plus replay gate (L10) |

Decision replay re-evaluates retained evidence; it does not re-execute a live
provider or require a nondeterministic model to repeat its answer. Proof replay
checks a retained certificate with its pinned checker where supported, rather
than requiring a solver to rediscover a proof within the same timeout. Required
material must remain available for the declared replay period. After a purge,
the history and digests remain, but replay reports `NOT_OBSERVABLE` with the
missing references. A hash alone is not replayable evidence (D5, L10).

### 5.4 Worked example: staging run 849 (retained facts and proposed evaluation)

**Candidate subject.** `run 1d59905f-68ec-46de-81fe-6fa14b6c0d91`, kind `run`.
The retained material supplies:

- the canonical graph digest `sha256:95a4c90d0eb20cc412f015165b135d37bf7451af2044a306b6f955a231e9f26f`;
- the capability `request-capability-from-objective-v3`.

The staging executor identity must be established from evidence attributable to
this run. The local selection `d0fe2b83…` is not that evidence. Until the
identity manifest is complete, store the material as pending and report the
missing executor identity; I3 prevents attaching it as a complete C1 basis.

**Claim C1.** "Returned outcome variant `ADMITTED`."

- Candidate evidence (class observation; producer identity still to establish):
  - the trace, 1,893 records, as Brotli chunks with SHA-256;
  - the output, `invoke-database-capability-summary-result.v1`.
- **Target disposition:** `OBSERVED`, only after I3 and the declared observation
  rule pass. This is not a current ledger result or a proof of the output's
  business correctness.
- **Limitations:**
  - `NOT_OBSERVABLE`: the input was not returned by the API (B4), so the claim
    cannot name an input digest;
  - `NOT_VERIFIED`: no conformance or cross-verification has run;
  - `OUT_OF_SCOPE`: formal proof.

**Claim C2.** "Provider `google/gemini-select` answered the exchange of operation
04 with `MODEL_RESPONSE_OBTAINED` in 3,066 ms."

- Evidence: one `model-response-shape.v1` (205 B, by digest) and one
  `provider-exchange-shape.v1` (252 B).
- Preserve the actual record producer and its relationship to the provider.
  These references describe testimony; their content is currently unavailable
  (B5). They cannot justify conformance, independent verification or admission
  by themselves. Whether the metadata supports the narrow C2 claim is decided
  explicitly by the observation rule, with content absence visible.
- **Limitation:** owner attribution was by time containment (B13), which is
  `NOT_VERIFIED` until S2.

W2.4 and Phase 3 will decide these claims using declared evaluator rule set v1.
Its digest and complete inputs must be retained. Missing identities, unavailable
content or an uninstalled rule cannot be presented as a replayed conclusion.

### 5.5 Explorer (from design E1)

- **Context column tabs: Run | Runs | Evidence.**
  - The Run tab becomes the report when a run ends.
  - Runs lists the principal's runs.
  - Clicking a circuit element opens Evidence.
- **Trust in the Evidence tab.** For each claim the element takes part in, show:
  - its disposition (for example `OBSERVED`);
  - its basis;
  - its limitations (for example "provider body `NOT_OBSERVABLE`").

  Limitations are shown, never hidden.
- Show the exact claim and subject digest, scope, supporting and refuting
  evidence, evaluation time, authority and any invalidation beside a disposition.
  Do not put a blanket "trusted" badge on a capability, provider or agent.
  Missing material stays `NOT_OBSERVABLE`; a historical disposition is labelled
  when it no longer permits current reliance.
- **Playback.** One bar for the whole invocation, the steps list, and the dot
  dwelling at the provider (B17).

## 6. Phases and work items

Repository owners follow the estate rules. SDA behaviour is changed by a
**request** to `scenario-driven-architecture`, never by editing it from here.
Capability meaning changes only through migration pairs in `sfx-embody`.

### Phase 0: freeze the model, decide, and run the spikes

| # | Work | Repo | Produces |
| --- | --- | --- | --- |
| W0.1 | Product owner sign-off that §2 is closed; record D1–D10 in this file. | All | Decision log |
| W0.2 | Record the staging values of `SDA_RUN_RETENTION` and `SDA_RUN_EVENT_RETENTION`, without printing secrets. | sfx-platform (deploy) | E06 |
| W0.3 | **Content spike:** capture the full serialized record of one `provider-exchange-shape.v1` and one `model-response-shape.v1`, the content B5 discards. Run it in a local SDA worktree with a temporary sink at `buffer.ts:100`; it is not merged. | SDA (request owner) | E07 |
| W0.4 | **Shape emission spike:** a `sfx-embody` preflight that re-declares the pre-G8 `providerEvidence` and `shapes` (B10), runs one equity and one Gemini invocation through `invoke-from-transaction.mjs`, and rolls back. It measures shape bytes, how many shapes `invocationByteBudget` suppresses (B11), and whether model-response payloads appear. | sfx-embody | E08 |
| W0.5 | sfx-identity tier, maximum size, and write latency of one 85 KB `varbinary` insert from the identity host region. | sfx-dal / Azure | E09 |
| W0.6 | **Declare the trust vocabulary and decision rules** (D8). An `sfx-embody` migration pair declares state identifiers 0–8, evidence classes, C1/C2 and evaluator rule set v1. Include prerequisites, identity manifests, independence, contradictions, invalidation and replay requirements (§2); no numeric promotion rule. Higher-state rules without agreed prerequisites remain unavailable. | sfx-embody | Declaration digest and rule fixtures |

**Exit criteria:**

- §2 is signed off and D1–D10 are answered.
- E06–E09 are retained, and the W0.6 digest is recorded.
- §5.2 is revised from E07 and E08.

**Delivery order.** Freeze §2 and record implementation decisions; establish
the missing evidence and rule digest; deliver the smallest durable C1 flow in
Phase 2 before adding C2 or new producers. Phase 1 can proceed on today's data
without implying a ledger disposition. Phase 2 exits only when one attributed
run survives restart, its narrow claim can be evaluated and replayed, a
contradiction/invalidation is retained, and L0–L10 pass for the implemented
rules. Phase 3 adds content under S1–S3; Phase 4 adds one producer at a time.
Required access checks and replay-aware retention rules accompany the first
durable release; Phase 5 adds operational automation and reporting.

### Phase 1: Explorer on today's data (sfx-platform only, no storage)

| # | Work | Acceptance |
| --- | --- | --- |
| W1.1 | Run report in the Run tab. | A1.1 |
| W1.2 | Playback bar, steps list and dwell model. | A1.2, A1.3 |
| W1.3 | Evidence tab: Time, Trace and Called. | A1.4 |
| W1.4 | Runs tab on the existing `GET /api/circuit/v1/session/runs` (B1), labelled as this server session's runs until Phase 2. | A1.5 |

W1.2 covers:

- the whole invocation including delivery phases;
- the provider exchange taken from nested step receipts by time containment (B13
  limits this to serial runs);
- hatched spans with no timed record;
- the dot dwelling at the callee
  ([replay-timing-fidelity.md](replay-timing-fidelity.md) steps 1 and 4).

### Phase 2: the ledger core and durable runs (no SDA change)

| # | Work | Repo |
| --- | --- | --- |
| W2.1 | Migration `002-trust-ledger`, creating the `ledger` and `evidence` schemas with the I1–I10 constraints, grants and procedures. Preflight with rollback, then commit, through `tools/identity-database`. Regenerate `SFX.Identity.DAL`. Retain the preflight, install, idempotence and generation receipts, as for `001` (`sfx-dal/identity/verification/`). | sfx-dal |
| W2.2 | Identity host endpoints under `/ledger/v1/*` and `/evidence/v1/*`: identify, assert, attach, decide, append trace, complete, and read for a validated principal. Each caller gets its own service key (Key Vault plus a vault reference, custody as identity-login.md:55-65). Host tests in `providers/cli-login/host-tests`. | sfx-providers |
| W2.3 | Circuit host. See below. Evidence-write failure does not change execution outcome; bounded retry and reconciliation record incomplete capture when storage recovers. While unavailable, the UI reports evidence persistence unconfirmed and grants no trust from that write. | sfx-platform |
| W2.4 | Evaluator rule set v1 as a declared capability (D8). It evaluates C1 against the identity, declaration, authority and observation prerequisites. It records exact executor/definition digests and limitations; contradiction, invalidation and replay use the same declared rules (I10). | sfx-embody (declaration) |
| W2.5 | Explorer: the Runs tab reads the durable list; `?run=<id>` replays the stored trace; the Evidence tab shows the disposition and limitations (§5.5). | sfx-platform |
| W2.6 | Gateway: the `/ledger/v1/*` and `/evidence/v1/*` routes stay loopback-only unless D4 needs a public read. | sfx-platform (deploy) |

W2.3 changes the circuit host to:

- register the run against its validated principal and assemble its immutable
  identity manifest from attributable run evidence;
- append Brotli trace chunks while the run executes;
- assert C1 when the returned outcome and required identities are available;
- attach trace and output as observation evidence, preserving missing ranges,
  capture failures and producer provenance.

### Phase 3: evidence content and provider claims (SDA requests plus estate rows)

| # | Work | Owner |
| --- | --- | --- |
| S1 | **Request: SDA API evidence port.** When the host separates a record (`buffer.ts:90-100`), it delivers `{ref, digest, size, mediaType, kind, runId, cursor, content}` to a configured provider endpoint with a service credential. `GET /v1/evidence/{ref}` resolves through that provider. The host keeps no database handle (B16). | SDA (request, cross-language) |
| S2 | **Request: owner identity on evidence records.** Model-call records carry the owning operation's and provider's `cellExecutionId` instead of `projected-capability-invocation` (B13). | SDA kernel (request) |
| S3 | **Request: an evidence budget separate from the lane budgets.** `payloadByteBound` (4,096) clips each shape, and `invocationByteBudget` suppresses shapes after 512 KB (B11). Both protect the lane; evidence bound for the store needs its own declared limits. | SDA kernel (request) |
| W3.1 | Identity host: `POST /evidence/v1/objects` for S1. Each object becomes `ledger.evidence` for claim C2 of its provider and run. | sfx-providers |
| W3.2 | Re-declare `providerEvidence` and `shapes` as before G8 (B10), in a migration pair that may install **only after S1 is live**, so evidence still never rides the lane. Add the retention and per-capability input-disclosure declarations (D5, D6). | sfx-embody |
| W3.3 | Explorer: In and Out panels and Request and Response panels, a Download bundle, and the C2 dispositions. | sfx-platform |

### Phase 4: existing producers write to the ledger

**Entry criterion:** gates L0–L10 pass on staging for the implemented rule set;
each new producer adds its own rule fixtures before admission.

Each producer is one work item. It records verifications or proof results with
its own identity and digest. Producers never write dispositions directly. The
declared evaluator evaluates their evidence; `ledger.admit` separately records
the authorized governance decision for W4.5.

| # | Producer | Evidence class | Starting point |
| --- | --- | --- | --- |
| W4.1 | Blueprint review findings for a capability version | conformance | `sfx-providers` blueprint review; 35 finding codes (B22) |
| W4.2 | Topology conformance | conformance | Zero violations for `authenticate-ide-user` (B22) |
| W4.3 | Cross-language testimony parity probe | cross-verification | Open today (B23). It records `VIOLATED` or `NOT_OBSERVABLE` until parity closes, which is itself useful evidence. |
| W4.4 | Derive the first route-exclusivity and coverage obligations from the exact declared transition system and contracts; submit them to the selected prover and verify returned certificates | formal proof | The baseline identifies 24 routes (B24); derivability does not mean proof. Q8 selects prover/checker and certificate format. Keep assumptions, unproved obligations and external-provider limits explicit (I5). |
| W4.5 | Estate admission | admission | The migration lifecycle's install-and-verify step (B25), recorded by `ledger.admit` with the evidence package (I9) |

### Phase 5: retention, access and operations

| # | Work |
| --- | --- |
| W5.1 | Retention purge of `evidence.*` content on a schedule, with tombstones (I8); deletion on request (D5). |
| W5.2 | Read audit (`evidence.access_audit`), plus a "who viewed this run" view if D4 enables sharing. |
| W5.3 | Operating views: rows and bytes per day; failed trace writes; claims by state; limitations by kind. |

## 7. Verification gates

Every gate is a script or a test with a retained receipt, as the existing staging
gates are (for example `deploy/sda-kernel/*-acceptance-*.json`).

### Decision-model gates (Phase 2 onward)

| Gate | Pass when | Tool |
| --- | --- | --- |
| L0 | The vocabulary in sfx-identity equals the estate declaration (W0.6) by digest | Drift check in `verify-trust-ledger.mjs` |
| L1 | Every persisted or returned trust assessment carries claim and scope; entity-global trust flags are absent. Vocabulary definitions and raw verification outcomes remain distinct from assessments. | Catalog, procedure and response-contract checks; not a blanket column-name ban |
| L2 | Each target rule refuses incomplete supporting evidence or an unresolved contradiction, never uses numeric state comparison, and handles identical retries idempotently | Procedure fixtures for accepted and refused bases |
| L3 | `attach_evidence` refuses a NULL or mismatched subject digest | Procedure test |
| L4 | Each target state's complete declared prerequisites are checked, including evidence class and scope. A reachability proof cannot establish external-provider correctness or imply admission. | Full rule matrix plus mixed-scope fixtures |
| L5 | Missing scope or assumptions is refused; an explicit empty assumptions list is distinguishable from unknown. A `PROVEN` result verifies its pinned obligation and certificate/checker where required by the rule. | Constraint and proof-result fixtures |
| L6 | Self-testimony cannot justify verification or admission; a renamed producer or a second producer sharing the same unqualified source fails independence. Only rule-qualified independent checks can establish `CROSS_VERIFIED`. | Procedure, lineage and role fixtures |
| L7 | A verification over absent evidence yields `NOT_OBSERVABLE` and records a limitation; the absence never justifies a new reliance | Procedure test |
| L8 | Application roles cannot rewrite append-only history. Later support preserves refutations; changed digests, revoked authority and unmet assumptions append an invalidation/superseding decision. Earlier conclusions remain readable, and unaffected scopes remain separate. Purge leaves digests and tombstones. | Permission checks and contradiction/invalidation fixtures |
| L9 | State 8 is written only through `ledger.admit` by an admission principal. Proof result rows are byte-identical before and after admission. | Procedure test |
| L10 | All declared replay fixtures with retained inputs reproduce the recorded deterministic decision or certificate-check result using pinned dependencies. Governance replay validates recorded authorization and prerequisites. Missing or purged inputs yield `NOT_OBSERVABLE`, never a replay success. | `verify-trust-ledger.mjs --replay`; include missing-input, changed-rule and invalidated cases |

### Run evidence gates

| Gate | Pass when | Tool |
| --- | --- | --- |
| A1.1 | Every report field equals `/v1/runs/{id}` and `/output` for the same run | new `verify-run-report.mjs` |
| A1.2 | Replay wall time matches captured time within 50 ms at 1× and 0.1× | existing `tools/sfx-api/verify-circuit-replay.mjs` (today 1.2 ms and 18.5 ms) |
| A1.3 | During each provider exchange interval the provider is the current component in **every** sampled frame. Today 32 of 406 frames visit it (B17). | tightened `verify-circuit-replay.mjs` |
| A1.4 | The receipts listed for an operation equal those time-contained in its interval in the capture | new `verify-evidence-panel.mjs` |
| A1.5 | The Runs tab lists exactly the session's attributions | `verify-explorer.mjs` extension |
| A2.1 | Each admitted Observe is attributed once to its validated principal; complete terminal runs with attributable identities produce one C1 claim. Retries do not duplicate it, and incomplete identities/outcomes stay pending with visible limitations. | `verify-run-evidence.mjs` |
| A2.2 | `trace_records` equals the API `latestCursor`; every chunk's SHA-256 verifies; decompressed records are byte-identical to `/events` | same |
| A2.3 | Stored and source traces produce the same event sequence, timeline duration and selected component at deterministic timeline positions. Browser frame counts and scheduling deviations are measured separately, with A1.2/A1.3 enforced. | `verify-circuit-replay.mjs --source stored` |
| A2.4 | A second principal gets 404 for list, read, trace and claims of the first principal's run, with no timing or message difference | host tests and a live test |
| A2.5 | After a staging container restart, the list, replay and dispositions still work | staging acceptance step |
| A2.6 | Change in admission latency and run wall time with and without ledger writes, over 10 runs each. The threshold is set from W0.5. | new measurement script |
| A2.7 | An identity-complete C1 fixture reaches `OBSERVED` under rule set v1 and L10 replays it. The incomplete staging example in §5.4 remains pending; neither it nor a provider reference implies business correctness or governance admission. | `verify-trust-ledger.mjs` |
| A2.8 | Evidence-store outage leaves execution outcome unchanged, reports persistence unconfirmed, and reconciles missing ranges and limitations on recovery without inventing complete evidence | Storage-failure and recovery acceptance |
| A3.1 | 100% of the references listed at `/v1/runs/{id}/evidence` resolve, and `sha256(content)` equals `ref.digest` | `verify-run-evidence.mjs --content` |
| A3.2 | Every evidence object's owner cell maps to a circuit node of the run's scene | same |
| A3.3 | Zero declared `deniedMembers` names and zero credential-shaped values in stored content or traces | scan in `verify-run-evidence.mjs` |
| A3.4 | Observer SSE bytes per run before and after W3.2 differ only by key fields; evidence never rides the lane | before/after capture on the same input |
| A3.5 | For the Gemini specimen, operations 04 and 10 show the model response; equity shows all 4 exchange statuses. C2 receives only the conclusions justified by identity/observation rules; provider testimony alone produces no verification or admission (I6). | browser acceptance plus ledger query |
| A4.n | Each producer submits only its authorized evidence or evaluation result; declared evaluation and governance admission enforce L2–L10 separately | per producer |

## 8. Security and privacy

- **Credentials.**
  - The identity host has separate callers, each with its own service key: the
    circuit host, the SDA API evidence port, the declared evaluator, each Phase 4
    producer, and the existing kernel callbacks.
  - Keys are stored in Key Vault, exposed through slot-specific vault references,
    and never present in Git, receipts or logs (identity-login.md:55-65).
- **Separation of duties.**
  - Producers attach evidence.
  - Evaluators and provers record verifications and proofs.
  - Only admission principals admit (I9).
  - Nobody edits history (I8).
- **Who is the runner.**
  - The principal always comes from a session the identity host validates itself.
  - A principal id supplied by a caller is never trusted.
- **What is never stored.**
  - Declared `deniedMembers` (B9), removed by the kernel and checked again by
    A3.3.
  - Inputs of private capabilities (D6).
  - Login and enrollment bodies (cli-login README:78-80).
- **Exposure.** Runs, claims and evidence are readable only by their principal and
  by grantees (D4). Reads are audited (W5.2).
- **Personal data.** Model prompts and responses can contain personal data.
  Retention removes their content and keeps their digests (D5, I8).

## 9. Risks

| # | Risk | Mitigation | Signal |
| --- | --- | --- | --- |
| R1 | Ledger writes load the database that login depends on | Separate schemas; bounded, batched, asynchronous writes that never block the run (W2.3); measure first (W0.5). If contention shows, move `ledger` and `evidence` to their own database: D1 keeps that move schema-local. | Login latency and DTU/vCore before and after Phase 2 |
| R2 | Events evicted from API memory before they are stored | Append while the run executes (W2.3); W0.2 records the limits | `trace_complete = 0`, A2.2 |
| R3 | Content size grows without bound once shapes return | Evidence budgets (S3), retention (D5), sizes measured in W0.4 before W3.2 | Bytes per run (W5.3) |
| R4 | Wrong ownership attribution under parallel operations | Time containment is interim and recorded as a `NOT_VERIFIED` limitation; S2 gives identity | A3.2 |
| R5 | SDA doctrine conflict ("no endpoint serves evidence content") | Content is served by the identity host via the platform unless the SDA owners accept resolution through the port (S1) | SDA request review |
| R6 | Kernel and observer clocks differ (receipt lag of 0.4–1.3 s) | Store and replay kernel `startedAt` and `completedAt`; keep `receivedAt` only as delivery metadata | [replay-timing-fidelity.md](replay-timing-fidelity.md) |
| R7 | The decision model drifts into new concepts during build | §2 is closed (W0.1). Claim kinds and rules change only by estate declaration (D8), and new claim kinds need a decision. | L0 drift check |
| R8 | Vocabulary sprawl (claim kinds or states created ad hoc) | Closed vocabulary (D8, D9), with foreign keys from every row | L0, L4 |
| R9 | Provider or model testimony read as verification | I6 and the Evidence tab's visible limitations | L6, A3.5 |
| R10 | A numeric ladder or changed producer ID launders testimony into stronger trust | Declared prerequisites and independence lineage; no numeric aggregation or automatic promotion | L2, L4, L6 |
| R11 | Purged content is presented as a replayable conclusion because its hash remains | D5 defines the replay period; retain prerequisites for that period, then show explicit replay unavailability | L10, W5.1 |

## 10. Open questions

| # | Question | Resolved by |
| --- | --- | --- |
| Q1 | Staging values of `SDA_RUN_RETENTION` and `SDA_RUN_EVENT_RETENTION` | W0.2 |
| Q2 | Exact content of `provider-exchange-shape.v1` and `model-response-shape.v1`, including whether a model-response record can carry the response text at all | W0.3 |
| Q3 | What `invocationByteBudget` suppresses on real runs. Run 849's lane payload (about 2.96 MB) is far above 512 KB. | W0.4 |
| Q4 | sfx-identity tier, maximum size and write latency | W0.5 |
| Q5 | Retention period and sharing model | D4, D5 |
| Q6 | Whether runs from the CLI and operator token are attributed, and to whom | D7 |
| Q7 | What counts as "materially independent" for `CROSS_VERIFIED`: a different language target, provider, runtime or machine? | W0.6 rule set; product owner |
| Q8 | Which prover discharges the first obligations (W4.4), and how its certificate is stored | Before Phase 4 |

## 11. Traceability

### Decisions to enforcement

| Decision | Invariant | Gate | Built in |
| --- | --- | --- | --- |
| T1 | I1 | L1 | W2.1 |
| T2 | I2 | L2 | W2.1, W2.4 |
| T3 | I3 | L3 | W2.1, W2.3 |
| T4 | I4 | L0, L4 | W0.6, W2.1 |
| T5 | I5 | L5 | W2.1, W4.4 |
| T6 | I6 | L6, A3.5 | W2.1, W3.1 |
| T7 | I7 | L7 | W2.1, W2.3 |
| T8 | I8 | L8 | W2.1, W5.1 |
| T9 | I9 | L9 | W2.1, W4.5 |
| T10 | I10 | L10, A2.7 | W2.1, W2.4 |

### Design E1 to work

| Design E1 slide | Phase and work | Gates |
| --- | --- | --- |
| 2 · What a run leaves behind today | §4 baseline | — |
| 3 · Run report | W1.1, then W2.3 | A1.1, A2.1 |
| 4 · Runs list and links | W1.4, then W2.5 | A1.5, A2.3–A2.5 |
| 5 · Playback | W1.2 | A1.2, A1.3 |
| 6 · Click an operation | W1.3, then W2.5 (disposition), W3.2 and W3.3 (In and Out) | A1.4, A2.7, A3.1–A3.3 |
| 7 · Click a provider | W1.3, then S1, S2, W3.1–W3.3 | A3.1–A3.5 |
| 8 · What it takes | This plan | — |

The claim-disposition additions in §5.5 are a focused extension to E1 slides 6
and 7, with run context from slide 3. Design their scope, basis, limitations,
contradiction and invalidation states before W2.5 implements them. Keep E1's
amber missing-evidence treatment and preserved circuit. Do not replace the
report's domain outcome `ADMITTED` with a ledger admission badge: the two
labels describe different decisions.

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
  `sfx-providers/outputs/capability-estate/live-circuit-platform-explorer/E1/`;
- for the trust ladder (B18–B25), the read-only lanes
  `sfx-embody/sql/inspect/formal-verification-readiness/` and
  `review-coverage-truth/`, which re-run against the live estate.

## Appendix B. How to reproduce the baseline

From `sfx-embody`, with the installed kernel:

```
cmd /c "sfx capability invoke read-observation-telemetry-authority --input {} --json"
cmd /c "sfx capability observe resolve-equity-market-price-evidence --input @equity-input.json"
node ../scenario-driven-architecture/languages/typescript/src/kernel/bootstrap/run-migration.mjs "sql\inspect\formal-verification-readiness\<file>.sql"
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
