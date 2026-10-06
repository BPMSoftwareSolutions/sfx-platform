# Lane 02: platform circuit host, run API, gateway and gates

Read-only recon + deep dive, 2026-10-06. Repo: sfx-platform `327a2c2`.
Scope: [plan](../../run-evidence-implementation-plan.md) §4 (B1, B2, B14–B17),
§5.1 steps 1–2, §6 W2.3, W2.6, W0.2, §7 A1.1–A1.5, A2.1–A2.8, A3.4, §8.

## Current state

- **Circuit host is one process**: `live-circuit/dispatch-pair/observe-server.mjs`
  (pages, session API, run proxy, observer ring/SSE). Started locally by
  `tools/live-circuit/start-local.mjs:63-71` (observer 8788 + SDA API 8799); in
  staging by `deploy/sda-kernel/gateway.mjs:73-76` as
  `demo/dispatch-pair/observe-server.mjs`. Image placement:
  `deploy/sda-kernel/live-circuit.mjs:11-18`, `Dockerfile.composite:25,33`.
- **Config**: `live-circuit/circuit/circuit-host.json:2-5` (api timeout 630s/
  1 MiB; identity cookie, `observeRequiresSession`, `maximumAttributedRuns:
  2000`). Env: `SDA_API_ENDPOINT/TOKEN` (`run-api.mjs:12-13`),
  `SFX_IDENTITY_ENDPOINT` (`identity-session.mjs:21`), `OBSERVER_PORT`
  (`observe-server.mjs:10`), `SDA_ESTATE_DIR` (`live-store.mjs:13`).
- **Attribution is memory-only**: `identity-session.mjs:18-19` array;
  `attributeRun` `:96-102`; read `GET /api/circuit/v1/session/runs` `:118-125`;
  populated after admission at `run-api.mjs:75-81`. A restart loses it
  (`docs/live-circuit-staging-deployment.md:275,279-283`).
- **Principal validation**: cookie → identity host `GET /auth/v1/session`
  (`identity-session.mjs:82-92`), gate before the SDA call (`run-api.mjs:57-67`);
  contract `docs/live-circuit-browser-session.md:16-35`, config `:75-81`. SDA
  still runs under the host machine token (`run-api.mjs:70-73`).
- **What the host knows**: at admission `runId, principalId/sessionId,
  capabilityId, namespaceId, admittedAt, subject={capabilityId, namespaceId}`
  (`run-api.mjs:52,75-78`). At run end only observer ring records (`run-end`
  payload has `apiRunId`, `exitCode`); run state/output are re-read by the
  browser via proxy (`observe-panel.js:157-179`).
- **Event chain**: SDA API bridge `tools/live-circuit/api-host.mjs:16-45`
  (staging twin `deploy/sda-kernel/api.mjs:12-40`) maps
  `run.started→run-start`, `graph.captured→observation(graph)`,
  `run.exited→run-end`, all else `→observation(payload)`; serialized POST to
  `SFX_OBSERVER_ENDPOINT` (10 s timeout, bridge failure exits the API). Observer
  normalizes (`observe-server.mjs:72-85`), 2,000-record ring (`:47,199-235`),
  run windows by run-start/end/graph (`:216-223`), SSE `/events` with
  `run=`/`since=` (`:326-363`), accepts `POST /events` (`:452-455`).
- **The bridge is lossy**: it drops `cursor`, `eventId`, `evidenceRef` and the
  record kind (`api-host.mjs:36`, B13) — observer payloads differ from
  `/v1/runs/{id}/events`.
- **Retention**: SDA defaults 1,000 events/run, 200 runs
  (`scenario-driven-architecture/services/sda-api/src/config.ts:49,51`); gateway
  sets `SDA_RUN_EVENT_RETENTION=20000` only (`gateway.mjs:107-108`); local
  launcher same (`start-local.mjs:70`); staging run history still defaults to
  200 (`docs/live-circuit-staging-deployment.md:308`).
- **Gateway/deploy**: routes `gateway.mjs:117-182`, identity allowlist
  `:137-139`, circuit prefix/POST allowlist `:152-159`, upstream map `:167`; no
  `/ledger` or `/evidence` route exists. Credential custody `:13-17` strips both
  identity settings; only the identity child receives them `:90-103`; observer
  gets no service key `:73-76`. Key Vault names/custody
  `deploy/sda-kernel/identity-login.md:55-65`,
  `docs/live-circuit-staging-deployment.md:210-226`.
- **Staging gates**: `.github/workflows/staging.yml:72-89` (release → public →
  browser → restart-check → external), `:177-186` finish/rollback;
  `deploy/staging/accept.mjs:13-17` browser capture + replay, `:24-29` machine
  token from slot settings; receipts `deploy/sda-kernel/*-acceptance-*.json`,
  `docs/releases/staging-automation-2026-10-06.json`.

## Work item / gate -> files today

| Item/gate | Host-side files | Status |
| --- | --- | --- |
| W0.2 staging retention | `gateway.mjs:107-108`, SDA `config.ts:49,51`, `docs/live-circuit-staging-deployment.md:308`; evidence dir `docs/run-evidence-plan/evidence/` | No E06; values not recorded from live slot |
| W2.3 register run | `identity-session.mjs:19,96-102`, `run-api.mjs:75-81` | Memory only; no identity call |
| W2.3 append Brotli chunks | `observe-server.mjs:199-235` (`admit`), `:326-363`; streaming precedent `tools/sfx-api/sfx-api.mjs:132-151` | No durable writes/Brotli |
| W2.3 assert C1 / attach | SDA `/v1/runs/{id}` + `/output` via `run-api.mjs:21,70-85`; graph payload `canonicalGraphDigest` (`capture.sse` line 15) | No claim/ledger code |
| W2.6 gateway routes | `gateway.mjs:135-171`; `identity-policy.json:12-22` | Ledger/evidence routes absent (fail closed) |
| A1.1 report fields | `tools/live-circuit/verify-browser-session.mjs:123-129` fetches run+output | No `verify-run-report.mjs` |
| A1.2/A1.3 replay | `tools/sfx-api/verify-circuit-replay.mjs:62-100` | 1.2 ms/18.5 ms from `docs/replay-timing-fidelity.md:36-37`; accepted release 10.8/10.5 ms (`docs/releases/staging-automation-2026-10-06.json:170-206`); A1.3 only "visited" (`:91`) |
| A1.4/A1.5 | `live-circuit/circuit/verify-explorer.mjs` (30 lines, projection only); `home.js:32-45` uses session/runs | New evidence-panel / Runs-tab checks needed |
| A2.1–A2.5, A2.7 | none | New `verify-run-evidence.mjs`, `verify-trust-ledger.mjs` (W2.2-dependent) |
| A2.6 latency | `verify-timing.mjs` is a synthetic clock, not host latency | New 10-run measurement script |
| A3.4 lane parity | capture tooling exists (`verify-browser-session.mjs`, `verify-external-live.mjs`); Brotli only in E05 | Before/after W3.2 capture script |

## Reusable pieces

- Per-run SSE windowing and replay: `observe-server.mjs:291-363`,
  `verify-run-scoped-sse.mjs`.
- Incremental event polling with gaps/NDJSON: `sfx-api.mjs:112-171` (exercised
  at staging; artifacts `staging-run-*/api-traces/*.ndjson`).
- Durable append-only run journal with fsync, idempotent request digest, owner
  hashing, restart `UNKNOWN`, event cap:
  `services/capability-api/run-service.mjs:21-127`, tests
  `tests/run-service.test.mjs:9-54`.
- Attribution and session transport tests: `verify-identity-session.mjs:117-125`.
- `canonicalGraphDigest` already in the graph event; executor identity is not
  (B18 / plan §5.4).

## Missing / gaps

- No durable run registration or trace/output storage; the observer ring
  (2,000) is not a trace archive (`docs/live-circuit-staging-deployment.md:309`).
- Observer frames lack cursor/eventId/evidenceRef and evidence kind; A2.2 cannot
  pass from observer POSTs alone.
- No Brotli chunker, chunk SHA-256, incomplete-range semantics, or identity-host
  client with bounded retry/reconciliation.
- No per-run read authorization: run GETs through the circuit proxy are public
  (`run-api.mjs:19-22`; `docs/live-circuit-staging-deployment.md:129-134,142`) —
  A2.4 is new feature work, not just a test.
- No `verify-run-evidence.mjs`, `verify-run-report.mjs`,
  `verify-evidence-panel.mjs`, `verify-trust-ledger.mjs`, or A2.6 script.

## Deep dive findings

### 1. Phase 2 minimal durable call sequence

- **Register (browser bearer)**: synchronously in `run-api.mjs` after the 202
  body is parsed (`run-api.mjs:75-81`), forward the cookie bearer obtained via
  `sessionCookie(req)` (`identity-session.mjs:28-37`) to
  `POST /evidence/v1/runs` with `{runId, capabilityId, namespaceId, admittedAt}`.
  The body must never carry `principalId`; the identity host validates the
  session itself and binds `principalId/sessionId → runId`. This is the only
  user-bearer call.
- **Append (service key)**: during execution,
  `POST /evidence/v1/runs/{runId}/trace` with chunks
  `{chunkIndex, firstCursor, lastCursor, sha256, brotli}`. Hook
  `observe-server.mjs`'s `admit()` (`:199-235`); correlate `run-start` by
  `payload.apiRunId` (`capture.sse` line 1701).
- **Complete (service key)**: `POST /evidence/v1/runs/{runId}/complete` with
  `{state, terminal, latestCursor, recordCount, output, gaps[]}`. Do not infer
  terminal state; read `/v1/runs/{id}` (`server.ts:176-179`).
- **Assert/attach (service key)**: `POST /ledger/v1/subjects` → `/claims` (C1) →
  `/evidence` with trace/output refs; combine complete+attach in one
  transactional call to shrink retry windows. Assert C1 only when terminal +
  outcome + capability + graph digest exist; executor digest is likely pending
  (§5.4) — attach as pending observation with a limitation; I3 forbids a
  complete C1 basis.
- A2.7 additionally requires the W2.4 evaluator; A2.1 requires register/complete
  idempotent per runId so retries do not duplicate.
- Principal derivation: identity host validates the forwarded bearer at
  register; afterwards it authorizes the circuit host's service key against that
  run binding. The circuit-host key does not exist today (gateway passes none to
  the observer, `gateway.mjs:73-76`) — new Key Vault secret + vault ref + env
  per §8.
- Principal-from-session is only achievable synchronously in `run-api.mjs`;
  `identity-session.mjs:83-92` never persists the bearer, so deferred
  registration from the observer cannot attest the session.

### 2. A2.2 trace fidelity decision — enrich the bridge

- Option (a), appending from observer frames: ruled out — frames are normalized
  (`observe-server.mjs:72-85`), drop `cursor/eventId/evidenceRef/kind`
  (`api-host.mjs:36`), and the ring is 2,000 records total
  (`observe-server.mjs:47`). Byte-identity impossible.
- Option (b), circuit host follows `GET /v1/runs/{id}/events` itself: works
  without bridge edits but adds a second event consumer, reconnect/gap handling,
  and polling from cursor 1; duplicates a transport the bridge already has.
- **Option (c), recommended**: the bridge wrappers are platform-owned
  (`tools/live-circuit/api-host.mjs`, `deploy/sda-kernel/api.mjs`) and receive
  exact `RunEvent` objects via `buffer.subscribe` (`buffer.ts:109`); SSE emits
  the same `JSON.stringify(event)` (`server.ts:220`). Forward
  `{kind:'sda-event', event}` including `run.admitted` (safe: only
  object/operation/subject/namespace, `supervisor.ts:77-82`), preserve the
  envelope in `normalizeEvent/admit`, and store exact per-event JSON plus
  `latestCursor`. No SDA change, no extra connection, eviction (R2) cannot beat
  an in-process append, and existing observer consumers are unaffected if fields
  are additive.
- Restart does not differentiate options: circuit host and API share one
  container restart boundary
  (`docs/live-circuit-staging-deployment.md:106-112,275`). A2.5 depends on
  durable completion, not the transport.

### 3. W0.2 execution

- Read-only, api-version from `infra/azure.json`: slot
  `.../sites/sidefx/slots/staging`; `az rest --method post --url
  "$slot/config/appsettings/list?api-version=<v>" --query
  "properties.SDA_RUN_RETENTION" -o tsv`, same for
  `SDA_RUN_EVENT_RETENTION`.
- Expected result: both absent from settings; effective values are run retention
  200 (default, SDA `config.ts:51`) and events 20,000 (hardcoded at
  `gateway.mjs:107`; local `start-local.mjs:70`). Record the absence plus the
  launch-source values; do not claim a staging settings override.
- E06: create `docs/run-evidence-plan/evidence/E06-staging-run-retention.json`
  with checkedAt, release id, settings read (nulls), effective values + source
  lines, and one staging run's `evictedCount:0`; add its SHA-256 row to the
  evidence README. Filter output to those two keys only (never dump settings).
- Permissions: the CI deployment identity already has slot-scoped Website
  Contributor and `deploy/staging/common.mjs:40-45` already POSTs
  appsettings/list, so the current identity can do this; no operator step unless
  interactive `az login` or `SDA_API_TOKEN` becomes a Key Vault reference.

### 4. W2.6 loopback-only

- Primary mechanism: route omission, made explicit. Unknown paths already 404
  (`gateway.mjs:167-171`) and only `/auth/*` is allowlisted (`:136-139`), so
  `/ledger/*` and `/evidence/*` are already unreachable publicly. Add an
  explicit prefix rejection / `loopbackOnly` class in the gateway route table
  and a public assertion in `accept.mjs`.
- Do not use a client-address check as the control: every public request reaches
  the container from the Azure frontend, so `socket.remoteAddress` is not the
  browser, and header checks are spoofable at that edge.
- If D4 later needs public reads: add one explicit session-authorized gateway
  route for `GET /evidence/v1/runs*` forwarding to 8793 and let the identity
  host authorize by bearer; never expose trace/complete/ledger writes.

### 5. A2.6 latency harness

- Metric: admission ack latency (POST send → 202 in `run-api.mjs:75-81`) and
  kernel wall time (`startedAt`/`endedAt` from `/v1/runs/{id}`), each median and
  p95 over 10 runs with evidence writes on vs off (`circuit-host.json` flag or
  env). Ignore browser sampling.
- New `verify-run-latency.mjs` under `deploy/staging/` (reuse `common.mjs`
  helpers); local enough for the loop using `start-local.mjs:63-71` plus the
  local identity host (W2.2). One staging execution is needed for the release
  receipt because the W0.5 threshold is Azure write latency. Use a cheap
  deterministic capability locally; the staging fixture makes real provider
  calls, so limit staging runs.

## Effort and parallel allocation

- W0.2: 0.5 day. W2.3: 4–7 (client 1.5–2.5; observe-server hooks 1–1.5;
  register 0.5; config/tests 0.5; failure/reconciliation 1; fixtures 0.5);
  bridge envelope enrichment +1–1.5 if tracked separately. W2.6: 0.5–1.
  A1.1 verify-run-report: 1.5. A2.1+A2.2 verify-run-evidence: 3–5. A2.6: 1.5–2
  incl. receipt. A3.4: 1. A2.4 authorization: 2–4 (proxy + identity read scoping
  + tests).
- **Turn A (host writes)**: W2.3 + bridge envelope, built against a stub identity
  host so W2.2 does not block; freezes the stored record schema. Blocks
  A2.1/A2.2 verification.
- **Turn B (contract + verification)**: W2.2 endpoint schemas with
  sfx-providers, A1.1 and A2.1/A2.2 harnesses against A's frozen schema, A2.4
  scope design/tests.
- **Turn C (deploy/measure)**: W0.2 E06, W2.6 guard + acceptance assertion,
  A2.6 off-arm harness immediately, A3.4 before-capture.
- Dependencies: envelope schema freeze gates B's A2.2 verifier; live W2.2 gates
  final A2.1/A2.2/A2.7 receipts; W0.5 gates only A2.6 pass/fail.

## Plan corrections from this lane

- Only `SDA_RUN_EVENT_RETENTION` is raised (`gateway.mjs:107`); run retention is
  never set in platform launch paths, so staging/local use the 200 default
  (`config.ts:51`). W0.2 must record absence, not a value.
- Observer frames cannot be byte-identical to `/events`; W2.3/A2.2 must name the
  bridge-envelope change (`api-host.mjs:36`, `observe-server.mjs:47`).
- A1.2's "today 1.2 ms and 18.5 ms" is from the design finding
  (`docs/replay-timing-fidelity.md:36-37`); the accepted release is 10.8/10.5 ms
  (`docs/releases/staging-automation-2026-10-06.json:170-206`) — cite the
  receipt as baseline.
- An "immutable identity manifest" cannot be assembled at admission: graph
  digest arrives later (`observe-server.mjs:220-222`; `capture.sse` line 15) and
  executor identity is absent; assembly is run-end and may be pending.
- A2.4 assumes principal-scoped reads; run GETs are public through the proxy
  (`run-api.mjs:19-22`), so authorization must be built, not just tested.
- W1.4/W2.5 "Runs tab" does not exist (see lane 01).
- B13 overstates "every API event as observation": run.started/run.exited map to
  run-start/run-end (`api-host.mjs:33-35`), and `run.admitted` (cursor 1) is
  dropped (`api-host.mjs:31`).
- Principal-from-session is only achievable synchronously in `run-api.mjs`;
  `identity-session.mjs:83-92` never persists the bearer.
- Open decisions: persist from observer frames vs follow `/v1/runs/{id}/events`;
  registration auth model (user bearer vs service key); admittedAt ↔ kernel
  startedAt reconciliation (R6); bounded trace flush/retry policy under A2.8;
  concrete W2.6 loopback mechanism.

## Confidence

High on host/admission/event/gateway facts (files read directly). Medium on
exact staging env values (source lines authoritative; live app settings not
queried). Medium on effort ranges.
