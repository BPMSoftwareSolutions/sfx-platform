# Lane 04: identity host and existing producers (sfx-providers)

Read-only recon + deep dive, 2026-10-06. Repo: sfx-providers `86a3084`, with
read-only references to sfx-platform and sfx-embody.
Scope: [plan](../../run-evidence-implementation-plan.md) §3 D2/D4/D6/D7/D10,
§5.1 steps 1 and 3, §5.2, §6 W2.2, W3.1, W4.1, W4.2, §7 L2–L10, A2.4, §8.

## Current state

- **Identity host**: .NET 8 minimal API (ASP.NET Core/Kestrel),
  `providers/cli-login/host`. Entry `host/Program.cs:1-2` →
  `LoginApplication.Create` (`host/LoginApplication.cs:11-13`). Runs on loopback
  8793 (`identity-login.md:49`; `gateway.mjs:90-103`).
- **Routes today**: `GET /health` (`LoginApplication.cs:55`);
  `POST /auth/v1/login` (`:58-110`); `POST /auth/v1/provider/{resolve|verify|establish}`
  (`:114-156`); `GET /auth/v1/session` (`:157-162`); `POST /auth/v1/logout`
  (`:163-169`); enrollment `POST /auth/v1/enroll`,
  `POST /auth/v1/enrollment-provider/{hash|provision}`
  (`EnrollmentApplication.cs:41-76,77-114`). Route allowlist mirrors this
  (`deploy/sda-kernel/identity-policy.json:12-22`).
- **Session validation is self-contained**: `GET /auth/v1/session` →
  `IdeSessionProvider.ValidateAsync` (`providers/ide-session-provider/IdeSessionProvider.cs:55-68`)
  → bearer shape (44-char base64 of 32 bytes) hashed SHA-256 →
  `GeneratedIdentityDal.ValidateSessionAsync` (`GeneratedIdentityDal.cs:65-70`)
  → `identity.validate_session`. Bearer persisted only as SHA-256
  (`sfx-dal/identity/README.md:108-119`).
- **DAL**: `IIdentityDal.cs:6-29` defines 7 ops; `GeneratedIdentityDal.cs:14-122`
  binds named CodeLightly repositories. No cancellation parameters on generated
  methods; adapter awaits then checks cancellation (`:108-121`).
- **Host tests**: console exe, no test framework (`host-tests/HostTests.csproj:1-4`).
  `host-tests/Program.cs:17-18` requires `--preflight` or `--installed`; starts
  the real app on 8793 with the local dev cert and injected kernel `run` delegate
  (`:27,32-42,56`); tests plaintext refusal, session validate/revoke, rejected
  login, no private values in observations, SQL cleanup (`:59-93,125-129,131-148`).
  Kernel delegate injected at `:150-182`.
- **Circuit host** validates the browser session by calling the identity host
  (`live-circuit/circuit/identity-session.mjs:82-92`) and forwards Observe with
  only the machine token (`run-api.mjs:57-78`), attributing runs in memory
  (`identity-session.mjs:96-102,118-125`). `/api/circuit/v1/session` contract
  checked by `verify-identity-session.mjs` against a stub (`:20-44`); no
  second-principal 404 test exists (A2.4 gap).

## Endpoint surface map (W2.2/W3.1)

- `POST /ledger/v1/subjects` → `ledger.identify_subject`; caller key + validated
  session. Global 4 KiB Kestrel body cap (`LoginApplication.cs:21`) is fine;
  middleware TLS guard currently only covers `/auth/v1` (`:45-50`) and must be
  extended for gateway exposure.
- `POST /ledger/v1/claims` → `ledger.assert_claim`; `asserted_by` from validated
  session, never request JSON (plan §8).
- `POST /ledger/v1/evidence` → `ledger.attach_evidence`; I3 digest check lives
  in the procedure.
- `POST /ledger/v1/decisions` → `ledger.decide_disposition` (evaluator key).
- `POST /ledger/v1/admissions` → `ledger.admit` (admission principal, D10;
  operator token precedent `EnrollmentApplication.cs:32-37`).
- `POST /evidence/v1/runs` (register/identity manifest),
  `POST /evidence/v1/runs/{id}/trace` (Brotli chunk append),
  `POST /evidence/v1/runs/{id}/complete`, `GET /evidence/v1/runs`,
  `GET /evidence/v1/runs/{id}`, `GET .../trace`,
  `GET /ledger/v1/claims?principal=...` → `read_claims_for_principal`.
- W3.1 adds `POST /evidence/v1/objects` (S1 receiver) writing `ledger.evidence`
  for C2.
- Callers: circuit host (has session bearer), SDA API evidence port (no session;
  needs run/claim binding supplied by the S1 payload), evaluator, Phase 4
  producers, kernel callbacks.

## Reusable pieces

- Auth/transport: fixed-time SHA-256 bearer compare against one 64-hex key
  (`LoginApplication.cs:25-27,114-121`); separate operator bearer for a
  privileged ingress (`EnrollmentApplication.cs:117-122`); private-context
  correlation + ordered stage + 2-minute expiry (`PrivateExecution.cs:12-27`).
- Principal-from-session: reuse `IdeSessionProvider.ValidateAsync`; circuit host
  already forwards the browser cookie only to the identity host.
- Private-value discipline: logging cleared and 4 KiB body
  (`LoginApplication.cs:19-21`); only `WritePrivateRequestAsync/ResponseAsync`
  carry secrets; bodies stay out of logs, circuit I/O, generic run records and
  procedure-extract (`cli-login/README.md:78-82`); kernel child env stripped and
  service-key leakage refused (`KernelRun.cs:46-49,95-96`); canary scan in tests
  (`host-tests/Program.cs:125-126`).
- `deniedMembers` (20 credential names) is removed by the kernel, not the host:
  `scenario-driven-architecture/.../command-carrier.mjs:309-312,355-376`;
  declared in estate telemetry. A3.3 would add the store-side scan; none exists.
- Estate producer surfaces: `analysis.fv_capability_topology_conformance` +
  `model.assert_capability_topology_conformance`
  (`sfx-embody/sql/migrations/declare-topology-conformance-fail-closed.commit.sql:61-313,317+`);
  `governed-detection` capability emitting `detection-finding.v1` scoped findings
  with the same codes as the sfx-providers review
  (`declare-governed-detection-capability.commit.sql:37-59,852-892,1130`);
  blueprint finding repair-map writer keyed by `capability-blueprint-review.v1`
  (`declare-blueprint-finding-repair-map-procedure.commit.sql:87,134`).
- Deployment plumbing: gateway captures/strips identity creds and injects per
  child (`gateway.mjs:13-17,87-103`); packaging `prepare-identity.mjs:14-29`;
  vault/secret inventory `docs/live-circuit-staging-deployment.md:205-226`;
  vault name `deploy/staging/config.json:3`; role grant pattern
  `infra/authorize-staging-release.ps1:10-15`.

## Missing / gaps per work item

- **W2.2**: no `/ledger` or `/evidence` routes anywhere. No multi-key caller
  registry (one key hash, `LoginApplication.cs:25-27`); no ledger DAL
  repositories (blocked on W2.1 + regeneration); no request/response contracts;
  no per-route body limits (trace chunks exceed 4 KiB); middleware auth/TLS/error
  semantics are `/auth/v1`-specific; login admission semaphore of 4 (`:35`) must
  not be shared with ledger writes (R1).
- **W3.1**: `POST /evidence/v1/objects` absent; S1 sender absent; identity host
  has no content store or object-write path.
- **W4.1**: blueprint review is a Node module
  (`src/capability-presentation/blueprint-review.mjs:6-73`), embedded into deck
  output (`blueprint.mjs:76`; `capability-deck.mjs:32,39-41`), invokable via CLI
  or HTTP provider (`server.mjs:180-228`). Output
  `capability-blueprint-review.v1` has `issues[]`, `errors/warnings`, `signal`,
  `isAdmissionReceipt:false` (`blueprint-review.mjs:71-72`); codes are a
  hardcoded hypothesis needing declaration. No receipt goes to the ledger; the
  estate's `governed-detection` covers only 5 readings.
- **W4.2**: topology conformance exists in estate SQL, not sfx-providers. Current
  evidence is contradictory (see below). A2.4 second-principal 404 path does not
  exist (in-memory filter only, `identity-session.mjs:118-125`).

## B22 resolution (deep dive)

**Both claims are true for different profile surfaces and dates.**

- Zero violations: `providers/cli-login/README.md:26-27`, backed by
  `sfx-embody/docs/research/authenticate-ide-user-circuit-review.json:51-58`
  (`model.assert_capability_topology_conformance`, `CONFORMANT`, `violations: 0`,
  evidence `evidence/authenticate-ide-user/36-final-topology.txt`), `checkedAt`
  `2026-10-03T18:09:58Z`.
- NON_CONFORMANT 7/6/1: `u6-truth-probe-review.v2.md:3` (`capability_summary`;
  `provider_conformance` remains CONFORMANT), hard-coded as the live expectation
  in `sql/migrations/p2-read-capability-details-orchestrator.commit.sql:1854-1868`
  (comment "complete-evaluation readback (U5.5)", auth 7/6/1, v3 2/1/1, both
  NON_CONFORMANT; "provider gate is clean... placeholder-only
  provider_conformance" `:1858`).
- Timeline: gate installed 2026-10-01; receipt 2026-10-03 18:09Z (pre-U1,
  22-dimension profile). U1 re-mint added dims 23-28, 29 entries
  (`sql/migrations/re-mint-topology-profile-dims-23-28.commit.sql:5-6,40-50`,
  commit `5e960be` 2026-10-03 20:38 -0400). U6a-c exposed canonical evidence and
  evaluation identity through the read; review v2 (`fad62b7`) confirms the split.
  Selected profile digest `a63e3ccc...`.
- W4.2 must pin the surface and profile digest. Current state: capability/
  complete evaluation = VIOLATED (6 refuse, 1 warn); provider_conformance subset
  = clean. Expect `VIOLATED`, or use the provider slice with a `scope`
  limitation. **B22 needs correction**: it was zero under the pre-U1 assertion
  and remains zero only for the narrower provider slice; cite the receipt, not
  just the README.

## W4.1 35-code catalog and producer path

- The catalog is not declared. `capability-blueprint-review.v1` appears in
  sfx-embody migrations only as `findingSource` in the repair-map AUTHORITY
  (`declare-blueprint-finding-repair-map-procedure.commit.sql:87,134`), never as
  a contract. The 35 codes exist only in a read-only inspect lane
  (`sql/inspect/review-coverage-truth/00-finding-catalog.sql:1-30`;
  `README.md:25-27`: 15 review + gap passthrough, 10 context-audit, 9
  reader/held) and a 24-code hypothesis (`repair-mapping-coverage/00-coverage.sql`).
  Code is a hardcoded hypothesis per `docs/executable-verification-readiness.md:406-408`.
- Smallest versioned rule: extend the already-declared
  `blueprint-finding-repair-map.v1` AUTHORITY (same `put_semantic_definition`
  pattern, `declare-blueprint-finding-repair-map-procedure.commit.sql:80-88,145-149`)
  into a catalog with `{code, emitter, severity, condition, sourceRef}`. The
  resulting `definition_digest` is the `rule_digest`; add an L0-style drift
  check against `blueprint-review.mjs`/`model.mjs` at a pinned revision. A
  code-constant digest in sfx-providers alone conflicts with D8.
- Recommended producer path: for the five readings already declared in-estate use
  `governed-detection` (`declare-governed-detection-capability.commit.sql:37-59,852-892,1130`;
  runs through the kernel, D8-aligned). For the full 35-code review, ingest the
  sfx-providers receipt via an operator import path; do not claim the in-estate
  five establish the 35.
- `ledger.verification` mapping: `claim_id` = concept-conformance claim for the
  capability version; `scope` = capability version + surfaces covered;
  `evaluator_subject_id/digest` = review tool/capability subject; `rule_digest` =
  catalog AUTHORITY digest; input evidence = `snapshotDigest`,
  `circuit-review.json`/`context-audit.json` digests, estate definition digest;
  `authority_refs` = catalog + review contract; `independence_basis`;
  `outcome` = SATISFIED (no errors under declared rule) / VIOLATED /
  NOT_OBSERVABLE (missing snapshot/inspection); `performed_at`. Producers attach;
  evaluator decides.

## Caller-key registry

**Recommendation: host-side map, not a DAL table.**

- Per-caller Key Vault secrets, each exposed as one slot setting (e.g.
  `SFX_IDENTITY_KEY_<CALLER>`), plus a static role map in host config. At startup
  hash each key (SHA-256, as `LoginApplication.cs:27`) and discard plaintext;
  fixed-time compare (`:117-121`). Reasons: keys are deployment config, not
  domain data; a DB table would put rotation behind W2.1 migration + DAL regen,
  and would be the only mutable auth config inside the ledger DB.
- Roles: `circuit-host`, `evidence-port`, `evaluator`, `producer`, `admission`.
  Role is never caller-supplied JSON; it comes from the map entry.
- D10: give admission its own secret, mirroring
  `SFX_IDENTITY_ENROLLMENT_TOKEN` (`EnrollmentApplication.cs:32-37,77-79,117-122`)
  and the separation "callback keys cannot enroll" (`host/README.md:3-5`). The
  admission key maps to the estate operator principal recorded in `decided_by`;
  expansion is a map entry, no schema change. Do not reuse the kernel callback
  service key.

## Exact middleware changes

- TLS guard: `LoginApplication.cs:45-50` currently checks only `/auth/v1`;
  extend the prefix set to `/ledger/v1` and `/evidence/v1` while keeping the
  `SFX_IDENTITY_LOCAL_GATEWAY` loopback exception.
- Body cap: `:21` sets global 4 KiB. Keep for auth; set per-endpoint limits via
  endpoint metadata (or the `IHttpMaxRequestBodySizeFeature` pattern in
  `host-tests/Program.cs:45`): trace chunks and objects sized from W0.4/W0.5;
  ledger JSON small. Set before body read; one read only.
- Auth: add a filter after `:38-54` for the new prefixes: require caller bearer,
  map to `{callerId, role}`; principal-bearing routes additionally validate
  `x-sfx-session` via `sessions.ValidateAsync` (`:157-162`); never accept a
  principal id from JSON.
- Concurrency: `admission` at `:35` is login-only (`WaitAsync(0)` → 429 at
  `:60`). Add separate bounded semaphores per class and a small shared cap so
  ledger writes cannot starve login (R1).
- Error mapping: `:52-53` maps failures to 503; add 404/409 mapping for
  ownership and missing refs (A2.4 requires identical 404 for a second
  principal).
- Structure: follow `EnrollmentApplication.Map(app, ...)` (`:56`) with a
  `LedgerApplication.Map`; map before `return app` (`:171`). `/health` stays
  anonymous.
- Constraints: Kestrel `MaxRequestBodySize` must be set before reading; minimal
  API JSON binding may pre-read, so prefer manual `JsonDocument.ParseAsync`
  (`:64` pattern); request bodies cannot be read twice without
  `EnableBuffering`; `Results.Json` + global no-store headers already apply
  (`:40`).

## Producer reachability

- D2 says every caller uses its own credential over loopback; W2.6 keeps routes
  loopback-only unless D4 needs public read. That is satisfiable for in-container
  callers (circuit host, SDA port, kernel-executed capabilities). It is **not**
  satisfiable for sfx-providers CLI/CI producers, because the review is not
  packaged in the image (`prepare-identity.mjs:14-29` copies only the host and
  live-circuit) and reads the estate DB via `CAPABILITY_ESTATE_HOST_MODULE`
  (`src/capability-presentation/estate.mjs:47-59`).
- Recommendation: in-estate declared capabilities for repeatable gates
  (`governed-detection`, `assert_capability_topology_conformance`), and one
  operator-authenticated import route through the gateway for external tool
  receipts (same operator bearer precedent as `/auth/v1/enroll`,
  `gateway.mjs:98`; `identity-enrollment.md:22-40`). Add this decision to
  W2.6/W4.1; otherwise W4.1 cannot submit.

## Recommended W2.2 route table

Auth: `Authorization: Bearer <caller key>`; principal: `x-sfx-session` unless
noted.

| Route | Request → Response |
| --- | --- |
| `POST /ledger/v1/subjects` | `{kind, canonicalRef, digest, version, provenance}` → `{subjectId, digest}` |
| `POST /ledger/v1/claims` | `{subjectId, claimKind, statement, scope}`; `asserted_by` = session principal → `{claimId, statementDigest}` |
| `POST /ledger/v1/evidence` | `{claimId, evidenceClass, subjectDigest, contentRef\|content, digest, observedAt, polarity}` → `{evidenceId}` |
| `POST /ledger/v1/verifications` | role evaluator; `{claimId, scope, ruleDigest, inputEvidence[{id,digest}], authorityRefs, independenceBasis, outcome, limitations[]}` → `{verificationId}` |
| `POST /ledger/v1/decisions` | role evaluator; `{claimId, scope, targetTrustState, ruleDigest, basis, invalidation}` → `{dispositionId}` |
| `POST /ledger/v1/admissions` | role admission; `{claimId, scope, evidencePackageDigest, conditions[]}` → `{dispositionId}` |
| `POST /evidence/v1/runs` | `{runId, capabilityRef, namespaceId, graphDigest, executorDigest, admittedAt}`; principal = session → `{runRecordId}` |
| `POST /evidence/v1/runs/{runId}/trace` | `{chunkIndex, sha256, records, content(brotli, base64)}` → `{accepted, traceRecords}` |
| `POST /evidence/v1/runs/{runId}/complete` | `{outcome, outputDigest, output?, traceRecords, partial, missingRanges}` → `{completed, claimId?}` |
| `GET /evidence/v1/runs[/{runId}[/trace]]`, `GET /ledger/v1/claims?principal=me` | session; owner-only, identical 404 otherwise (A2.4) |
| `POST /evidence/v1/objects` | W3.1, role evidence-port, no session; `{ref, digest, mediaType, size, producer, kind, runId, cursor, content}` → `{objectId, evidenceId}`; principal bound from `evidence.run` |

- Circuit host: it already holds the user bearer (`identity-session.mjs:82-92`);
  on server-to-server calls send the caller key plus the bearer as a header, not
  the cookie. Host resolves `principalId` itself; a caller-supplied principal is
  never trusted.
- SDA evidence port: caller key only; it never has a session, so
  `POST /evidence/v1/objects` must carry `runId` and the host resolves the
  principal from the run record registered by the circuit host. Unknown run →
  409/404 without distinguishing ownership.

## Effort and 3-turn allocation

- W2.2 host module 6-9 eng-days; W2.2 host tests 3-5; W3.1 endpoint 1.5-3
  (after S1); W4.1 3-5; W4.2 2-4 (plus profile-pin decision). Excludes W2.1
  migration/DAL regeneration and W0.6.
- Key provisioning lead: 3-7 calendar days (secret create, slot vault
  references, managed-identity grant, gateway injection additions,
  `gateway.mjs:90-103`; kernel vault entry is operator-controlled and repeats
  require a fresh vault snapshot and new operator key). Start day 1.
- Turn A (critical path): W2.1 + DAL regen → W2.2 module → host tests; key
  provisioning in parallel. ~12-16 days wall with two engineers.
- Turn B: W3.1 + S1 coordination + A2.4 owner-read tests; starts once W2.2 base
  routes exist. ~4-6 days.
- Turn C: W4.1/W4.2 adapters + catalog digest + rule fixtures; depends on W2.1
  verification tables and W0.6; W4.2 blocked until the profile/dimension pin is
  decided. ~6-9 days.

## Plan corrections from this lane

1. B22: replace "zero violations" with the versioned statement (pre-U1 assert 0,
   2026-10-03; current U5.5/U6 complete evaluation VIOLATED 6 refuse + 1 warn;
   provider_conformance clean; profile digest `a63e3ccc...`); cite
   `authenticate-ide-user-circuit-review.json:51-58` and
   `p2-read-capability-details-orchestrator.commit.sql:1854-1868`.
2. W4.2 must name the surface (capability evaluation vs provider slice) and
   expect VIOLATED or scoped SATISFIED.
3. Add the 35-code catalog to W0.6 (or a new W0.7) as a declared AUTHORITY and
   pin its digest; anchor it to `blueprint-finding-repair-map.v1`.
4. W4.1 should reconcile with the already-declared `governed-detection`
   (5 readings) instead of implying the whole 35-code review runs in-estate.
5. W2.2 depends on W0.6 for `decide`; sequence explicitly.
6. D2/W2.6 under-specify caller identity: add the caller-key registry and admit
   it is one key today (`LoginApplication.cs:25-27`).
7. W2.6 loopback-only conflicts with W4.1/W4.3 CLI/CI producers; choose
   in-estate capability or an operator import route.
8. Per-route body caps are mandatory; the global 4 KiB conflicts with trace
   chunks and evidence objects; size from W0.4/W0.5.
9. A2.4 needs owner-read endpoints that do not exist.
10. D7 remains open and shapes `complete`/`assert` attribution for CLI/operator
    runs.

## Confidence

High: identity host shape, routes, session validation, DAL wiring, key custody,
private-value handling, circuit-host session flow, blueprint-review output,
topology gate existence. Medium: exact per-caller key design, producer
reachability, W2.2 sizing.
