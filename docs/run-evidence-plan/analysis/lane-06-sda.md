# Lane 06: SDA API and kernel requests (S1–S3, W0.3, W4.3)

Read-only recon + deep dive, 2026-10-06. Repo:
scenario-driven-architecture `7075bb6`.
Scope: [plan](../../run-evidence-implementation-plan.md) §4 B2/B5/B10–B14/B16/B20,
§5.1 steps 2–3, §6 S1/S2/S3, W0.3, §7 A3.1–A3.4, R5, Q2/Q3.

## Current state

- **SDA API host.** `services/sda-api/src/buffer.ts:82-111` `append()`: full
  observation payload arrives as an object (`supervisor.ts:174-193`), is
  `JSON.stringify`-ed at `:84`, lane-filtered at `:90`, and only if
  `separated || truncated` gets an `evidenceRef` at `:100`. Lane selection:
  `withoutEvidence` `:156-165`, `preserveKeyFields` `:167-175`. Reference
  `{ref,digest,mediaType,size,producer}` from `produceReference` `:181-190`
  (sha256 of the host's own serialization; producer hardcoded `sda-api-host`
  `:33,58,72`). `types.ts:3-9` has no `kind/runId/cursor/content`.
- **Routes.** `server.ts:57-112`; `readEvidence` `:318-321` returns references
  only; `resolveEvidence` `:323-330` throws `501 EVIDENCE_PROVIDER_NOT_CONFIGURED`.
- **Config/env.** `config.ts:40-54`: `SDA_API_HOST/PORT`, `SDA_REQUEST_BYTE_CAP`,
  `SDA_OUTPUT_BYTE_CAP`, `SDA_CAPABILITY_GRAPH_BYTE_CAP`,
  `SDA_EVENT_PAYLOAD_BYTE_BOUND`, `SDA_RUN_EVENT_RETENTION` (`:49`, default
  1000), `SDA_RUN_TIMEOUT_MS`, `SDA_RUN_RETENTION` (`:51`, default 200).
  `auth.ts:27-37`: `SDA_API_TOKEN` + `SDA_API_TOKEN_SCOPES` (bearer, constant-time
  `:46-71`). `estate.ts:28-55`: `SDA_ESTATE_DIR` + `sfx.config.json` delivery
  `database-memory`. `authority.ts:22-24` allows `SDA_API_AUTHORITY` override.
- **Doctrine.** `interfaces/sda-api/sda-api-v1.authority.json:66-68`: one home
  per heavy datum; host holds no DB handle; no endpoint serves content.
  `:95-99` `evidenceProvider.state=STUBBED`; `:380-396` resolve op already
  designs a **302 redirect to the provider pointer ("deferred")** (`:389`) plus
  501 (`:392`); `authorityDigest` self-hash `:398-400`.
- **Kernel budgets.** `languages/typescript/src/kernel/bootstrap/command-carrier.mjs:256-311`
  (read `payloadByteBound` `:309`, `eventByteBudget` `:310`,
  `invocationByteBudget` `:311`; `invocationBytes` `:312`), shape pick/clip/deny
  `:228-243`, shapes emitted `:355-362`, per-event drop shapes then
  providerEvidence `:363-373`, whole-run suppression `:374-375`. Equivalents:
  csharp `ScenarioKernel/bootstrap/KernelObservation.cs:129-277` (`:187-189`
  bounds, `:252-259` shapes, `:260-274` budgets); python
  `kernel/bootstrap/observation.py:145-326` (`:248-256`, `:302-322`).
- **Estate declaration (E02).** No `shapes`, `providerEvidence: []`,
  `deniedMembers` 20 names, 4096/65536/524288. Evidence policy per model call:
  `sfx-embody/sql/migrations/declare-agent-capability.sql:82-88` (hashes/metadata
  only).
- **Shape producers.** Only csharp emits the record kinds:
  `languages/csharp/src/ScenarioKernel.Adapters/Graph/GovernedEffectPorts.cs:286-318`
  (`provider-exchange-shape.v1` `:291`, model response `:307-317`),
  `ModelResponseObservation` `:562-578`, `ModelResponseShapeFor` `:543-560`,
  `ResponseShapeFor` `:584-609`; body bound
  `SemanticExecutionGraphScheduler.cs:68` (`ObservedPayloadByteBound=4 KB`) and
  `ObservedShape` `:1321-1345` (payload, else `payloadRef`). Node/python have no
  equivalent evidence-kind emission (only testimony `providerEvidence`:
  `semantic-execution-graph/scheduler.js:558,566`).
- **B13 label.** Gemini records carry
  `cellId/cellExecutionId="projected-capability-invocation"` (E03 `:84-85,102-103`)
  because nested invocation hardcodes it. Equity records carry real provider cell
  ids (E04 `:96-97,114-115,132-133,150-151`). Observer bridge drops record kinds
  (`sfx-platform/tools/live-circuit/api-host.mjs:36`).
- **Scheduler digests declared but off-lane.** `scheduler.js:564,567` compute
  `inputDigest`/`outcomeDigest`; E02 `observationFields` excludes them.

## S1 evidence port — exact change points

- `buffer.ts`: extend `RunBufferOptions`/append to deliver the full `serialized`
  record (the exact string hashed at `:84`/`:182`) plus
  `{ref,digest,size,mediaType,kind,runId,cursor}` when `separated || event.truncated`
  (`:90-100`); sink injection likely via `RunBufferOptions` (`:5-14`).
- `supervisor.ts:65-73`: pass the configured sink into every `RunBuffer`;
  `config.ts:40-54`: new env (endpoint + service credential + bound);
  `server.ts:323-330`: replace 501 with resolution through the provider (302
  pointer fits the already-declared deferred response) or drop-inject
  `EvidenceProvider` into `createHost` (`server.ts:44`).
- `authority.json`: move `evidenceProvider` off `STUBBED` (`:95-99`), possibly
  adjust `resolve-evidence-reference` (`:380-396`); re-mint `authorityDigest`
  (`:398-400`). Doctrine lines `:66-68` are the R5 conflict; the redirect is the
  declared escape.
- `types.ts:3-9` optional envelope fields; new outbound client module (no deps
  in `package.json:1-22`, use `node:http`/fetch); tests
  `test/buffer.test.ts:136-251`, `test/live-smoke.test.ts:113`.
- Credential: a per-caller key like identity's (`identity-login.md:55-65`, Key
  Vault + slot refs); deployment/env owned by sfx-platform. S1 is TypeScript-host
  only, but useless until W2.2's `POST /evidence/v1/objects` exists; W3.2 may
  install only **after S1 live**.

## S2 owner identity on evidence records — exact change points

- csharp (live kernel): `Adapters/Consumer/ProjectedCapabilityInvocationProvider.cs:23-40`,
  hardcodes `"projected-capability-invocation"` for
  cellId/cellExecutionId/rootExecutionId (`:31-33`); the seam only forwards
  `rootExecutionId` (`:25-38`) while
  `ProjectedConsumerPlatform.cs:448-479,506-524` dispatches nested effects with
  `rootExecutionId` alone. Fix: thread the outer cell identity (cellId/
  cellExecutionId of the invoking provider cell) through the platform-effect
  dispatch into `GovernedEffectPorts.cs:286-318` context.
- node: `runtimes/node/projected-capability-invocation-provider.mjs:112-116`
  (only `rootExecutionId`, default `"projected-capability-invocation"` `:113`);
  plus emission parity (none today).
- python: `platform/projected_capability_invocation_provider.py:546-549` (same
  default `:548`); plus emission parity (none today).
- Cross-language obligation is explicit (`AGENTS.md:51-52`: csharp/node/python,
  csharp unblocks). Gate A3.2 needs owner cell mapped to a circuit node.
- **S2 is not an id swap**: node/python need the whole shape-emission mechanism
  added, not just an identifier change.

## S3 separate evidence budget — exact change points

- Kernel budget sites above: add a declared evidence bound (name not yet chosen
  anywhere — only the plan mentions it) and stop
  `invocationByteBudget`/`eventByteBudget` from suppressing/clipping evidence
  whose home is the store.
- Estate declaration supplies the new number (W0.4/W3.2 pair); SDA host may also
  need a max delivery size for S1.
- **Q2 answer today**: csharp can carry model text
  (`GovernedEffectPorts.cs:548-555` decodes JSON body under 4 KB, else
  `payloadRef`), but the estate's `shapes` are absent so the filter drops
  `modelResponse`/`requestShape`/`responseShape` (E03 refs are only 252/205 B).
  Response text appears only after W3.2 re-declaration; `captureResponseHash`
  policy already assumes hashes.
- **Q3**: `invocationBytes` accumulates every event's filtered size and latches
  `shapesSuppressed` for the rest of the run (node `:374-375`, csharp `:273-274`,
  python `:321-322`); run 849 lane ≈2.96 MB vs 512 KB budget, so shapes are
  likely suppressed after the early run.
- **S3 must land with/before W3.2**: without it, W3.2's declared shapes are
  likely suppressed before the exact Gemini records A3.5 checks. Minimal change
  per language: read one new declared bound (`evidenceByteBudget`) beside
  `payloadByteBound`; keep two accounts — lane bytes vs evidence bytes; apply
  `eventByteBudget`/`invocationByteBudget` to the lane only. Tests mirror the
  existing observation-filter vectors.

## Deep dive: Phase 2 independence and S1 design

- **Phase 2 truly needs zero SDA changes.** Per-run reads work during execution:
  paging `server.ts:181-193`, SSE `:195-241` (only ends at terminal `:222-227`),
  `latestCursor`/`retainedFrom`/`evictedCount` in every page `:187-192` and the
  run resource `:407-410`. W2.3 needs registration (identity host), Brotli
  chunks while executing, and C1 from the terminal record/output — all
  platform-side. A2.2's observer-bridge loss is platform-side too (bridge
  enrichment; see lane 02). Consistent with D3 "Phase 2 needs no SDA change".
- **S1 recommendation: (b) push at separation, plus (c) platform read.**
  - (a) direct 302 to the identity host fails: the identity host is loopback and
    its routes require a service bearer; the connection string/key never leave
    that child. `Location: http://127.0.0.1:8793/...` reaches the browser's
    loopback, not the server's, and no browser holds the service key. W2.6 keeps
    `/ledger|/evidence` loopback-only.
  - (b) push at separation is required anyway (W3.1): `buffer.ts:90-100` has
    `serialized` + digest; deliver
    `{ref,digest,size,mediaType,kind,runId,cursor,content}` to the identity host
    with a service key. The only way content survives restart (host keeps no DB).
  - (c) resolution belongs to the platform: the circuit host authenticates the
    user and can call the identity host with its service key; expose a
    session-guarded platform route. Satisfies A3.1 without sda-api serving
    content (R5 doctrine).
  - If the declared operation must not stay 501: change `server.ts:323-330` to
    302 to a configured platform resolver URL (`SDA_EVIDENCE_RESOLVER_URL`,
    never loopback), matching `authority.json:389`. Do **not** proxy bytes
    through sda-api.
  - Exact changes: `buffer.ts:5-14,88-100,181-190` (sink hook),
    `supervisor.ts:65-73`, `config.ts:40-54`, new `src/evidence-provider.mjs`,
    `server.ts:323-330`, `types.ts:3-9`,
    `authority.json:95-99,380-396,398-400`, tests.

## Served kernel language

- The installed delivery is `KernelEntry.exe` under `kernel/d0fe2b83…`
  (sfx-embody `sfx.config.json` deliveries.database-memory), a .NET single-file
  install; staging is explicitly the "Installed Linux C# kernel"
  (`identity-login.md:51`); deployment artifacts under
  `sfx-platform/artifacts/deployment/linux-csharp-kernel/`.
- Decisive evidence: E03/E04 contain `provider-exchange-shape.v1` and
  `model-response-shape.v1`, and only csharp emits these. The deployed kernel
  that produced E03/E04 was csharp.
- Precedent: csharp-first is accepted
  (`request-sda-embodiment-plan-port-registration.md:5,203`; `AGENTS.md:52`
  "csharp is the live kernel that unblocks acceptance"), with node/python parity
  as the standing obligation. A3.5 is browser+ledger on staging → csharp-only
  gates it. Scope S2/S3 csharp-first; file node/python parity as a declared
  follow-up.

## Request process and owners

- Loop and format: `AGENTS.md:12-23` (step 4 request doc in `docs/`), `:40-56`
  (format example `docs/request-sda-embodiment-plan-port-registration.md`;
  evidence first, declared identity, per-language implementation, registries,
  conformance, exit criteria; three-language obligation; csharp live kernel).
  Full worked examples: `docs/sda-change-request-capability-projection.md:1-52`,
  `docs/request-sda-embodiment-plan-port-registration.md:1-11,89-156,205-212`
  (owner line 5).
- Estate-authored requests live in `sfx-embody/docs/sda-change-request-*.md`
  (e.g. `sda-change-request-projected-testimony.md:3-4,19` states SDA is
  read-only and the estate must not edit it).
- Review path: commits to SDA `main`; CI
  `.github/workflows/conformance.yml` runs csharp + python + node (+go/java).
  No CODEOWNERS/OWNERS found. Recent request commits are all one author. The
  plan forbids editing SDA from sfx-platform.

## W0.3 content-spike mechanics

- Sink: at `buffer.ts:100` (or just after), capture
  `{ref,digest,kind,runId,cursor,content:serialized}` to a file/HTTP; build with
  `npm run build` then `npm start` (`services/sda-api/package.json:9-13`), from
  a throwaway git worktree (pattern `C:\lab\repos\sda-wt-f0/f1`; temp worktrees
  under the pre-approved temp dir). Env: `SDA_ESTATE_DIR` + `SDA_API_TOKEN`
  (+ scopes) + host/port + retention (`main.ts:5-25`).
- Or `sfx-platform/tools/live-circuit/start-local.mjs`
  (`tools/live-circuit/README.md:5-6`), but its token is random and unprinted
  and `api-host.mjs:36` rewrites kinds — direct `main.js` is better for the
  spike.
- Produce runs: `POST /v1/runs {"object":"capability","operation":"observe",
  "subject":"request-capability-from-objective-v3","input":{...}}` (Gemini, 2
  model calls) and `resolve-equity-market-price-evidence` (≤4 HTTP). Read
  `/events`, `/evidence`, `/v1/evidence/{ref}` (501 today).
- **Gap:** under the current declaration the host only receives lean records;
  W0.3 alone cannot answer Q2 (text/body content). Run W0.3 against the W0.4 pre-
  declaration, or capture at the kernel emission seam. One worktree change
  (sink + counter) can serve both spikes.

## W4.3 parity probe

- `conformance/projected-testimony/verify-projected-testimony.mjs`: runs
  node/python/csharp projected CLIs (`:119-200`), receipt
  `projected-testimony-conformance.v1` `:523-542`, exit 1/0 and `TESTIMONY
  CLOSED` `:517-547`; default projected root
  `<sfx-embody>/embodiments/resolve-equity-market-price-evidence/projected` `:44`.
  Current gap: 8/112/5 cell sets on the resolved branch (plan B23); 8/111/5 on
  F6; missing timing/digest/resolver testimony `:220-256`.
- A parity producer calls the probe with `--receipt <file>` and records
  `VIOLATED`/`NOT_OBSERVABLE` while open.
- **Blockers:** the emitters the request targets were **deleted from SDA
  2026-09-20** (`52f4186`, archived to `sda-legacy`, not checked out under
  `C:\lab\repos`); sfx-embody removed `embodiments/` 2026-09-18 (`6e3d146`).
  The probe cannot run locally until the projected workspace is regenerated and
  the emitter repo located. Decide restore vs regenerate before scheduling W4.3.

## Reusable pieces

- Lane/evidence unit tests `services/sda-api/test/buffer.test.ts:136-251`;
  live smoke `test/live-smoke.test.ts:113`.
- Declared-authority readers (`authority.ts:57-80`, `config.ts:1-13`) and
  env/secret-strip patterns (`api-host.mjs:13-14`, `start-local.mjs:30-33`).
- csharp conformance precedents `GovernedEffectPortsTests.cs`,
  `ObservationFailureAndModelResponseTests.cs`,
  `SemanticExecutionGraphShapeObservationTests.cs`,
  `KernelObservationFilterConformanceTests.cs`; python observation vector tests;
  node `test/conformance/observation-filter.conformance.test.mjs`.
- Receipts E01–E05 as spike fixtures; probe receipt schema.

## Missing / gaps

- No declared evidence-bound vocabulary anywhere; S3 needs a new name in the
  estate telemetry authority.
- Node/python do not emit `provider-exchange-shape.v1`/`model-response-shape.v1`
  at all, so S2/S3 parity implies porting the csharp emission (not just id
  threading).
- S1's outbound service credential and endpoint config exist nowhere yet (no
  env, no client, no Key Vault secret).
- W0.3/W0.4 coupling; Q2 stays open until re-declaration.
- tools/ removal strands the capability-projection and projected-testimony
  emitter work; the prior embodiment-plan request is still open.

## Sizing, review latency and 3-turn allocation

- **S1**: one language (TS), ~6 files + tests + authority digest re-mint;
  2–4 eng-days SDA + 1 day platform/gateway/credential; blocked by W2.2 receiver
  (2–4 days sfx-providers) — sequence after W2.2.
- **S2**: csharp-first 1–2 eng-days; all-language 5–10. **S3**: csharp 1–2;
  all-language 3–5; needs W0.4 numbers + W3.2 declaration.
- **W4.3 producer**: 1–2 days to call the probe and record VIOLATED — blocked
  until projected bodies/emitters are restored.
- **W0.3** 0.5–1 day; **W0.4** 1–2 days.
- Turn 1 (file now, parallel): S1 request + W0.3 spike + W0.2 record; also S2
  csharp-first request (independent, small). Turn 2: W0.4 estate pair, S3 +
  W3.2 as a pair after S1 live, csharp implementation. Turn 3: node/python
  parity, W4.3 producer and Phase 4 entry.
- Lead times from git history: provider-physical-altitudes request filed
  2026-09-15, csharp seams landed 2026-09-18, live 2026-09-21: **3–6 calendar
  days** for a focused csharp change + live verification. Embodiment-plan
  request filed 2026-09-27, still open: **9+ days**. Projected-testimony parity
  open since 2026-09-15, stalled: **3 weeks**. Realistic one SDA request
  (docs + csharp-first + CI + estate verify) ≈ **1–2 weeks**; node/python parity
  adds **+2–4 weeks**. Bottleneck: recent SDA/estate commits are a single
  author — requests serialize through one operator. Parallelizable: W0.3/W0.4,
  W0.2, identity W2.1/W2.2, platform W1.x/W2.3.

## Plan corrections from this lane

- **B5 overstates**: the host does not receive evidence members in full — the
  kernel filter strips undeclared shapes/providerEvidence first, which is why
  E03 refs are 252/205 B. "Content B5 discards" is only the residual record.
- **W4.3 is stranded**: the emitters the request names were deleted 2026-09-20
  (archived to `sda-legacy`, not checked out), and sfx-embody removed
  `embodiments/` 2026-09-18, so the probe's default root does not exist. Decide
  restore vs regenerate before scheduling W4.3.
- **W0.4 mechanics**: replace "invoke-from-transaction + rollback" with a
  temporary committed pair (or add a trace seam); uncommitted declarations are
  invisible to the installed kernel.
- **S2 is not an id swap** (see above).
- **A3.5 depends on S3**; **R5 needs reachability/credentials** added to
  doctrine, and the 302 must target the platform, not loopback.

## Confidence

High: all cited SDA API/kernel/probe paths and line numbers; doctrine; request
format; E03/E04 contents; digest/authority behavior; Phase 2 independence.
Open: Q2 exact body content (needs W0.4-class re-declaration before/with W0.3);
S1 resolution by 302 to platform vs identity-host proxy; exact S2 threading seam
per language; where projection emitters now live; Q1 staging retention values;
whether `eventPayloadByteBound` also needs an evidence-side cap once S1 delivers
content.
