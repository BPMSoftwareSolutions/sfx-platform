# Automatic Live Circuit staging releases

The user decision on 2026-10-05 is **automatic deployment on pushes to `main`**.
No manual start or approval is required. Since 2026-10-09 (per the
[staging verification audit](staging-verification-audit.md)) the path is two
workflows:

- `.github/workflows/staging-checks.yml` (**Live Circuit checks**) runs on every
  watched push, every PR and `workflow_dispatch`. It never touches Azure or
  waits for the staging lock; its jobs run in parallel.
- `.github/workflows/staging.yml` (**Live Circuit staging**) is the release
  transaction. It starts only from a successful checks run on `main` and
  releases exactly that run's commit and identity publish. Its workflow
  concurrency group is the staging lock.

To release or recover manually, dispatch Live Circuit checks on `main`, or
re-run the release run. Only `main` can bind the slot.

Push paths cover the circuit, host/packagers, release tools, CLI and acceptance
tools, Azure binding and both workflows. Changes confined to `docs/` or the root
README do not restart staging. All changes under the watched directories,
including their local documentation, trigger the release. No release label or
operator command is needed for runtime changes under those paths.

The target is `sidefx/staging` in `sidefx_group`. Production is never swapped or
rebound. The website-only `container.yml` was removed on 2026-10-07; it had been
build/test only. Its `AZURE_STAGING_ENABLED=false` switch stays false; the new
workflow does not use it.

## Accepted automatic release

Current accepted release: [`37518715996`](https://github.com/BPMSoftwareSolutions/sfx-platform/actions/runs/37518715996),
source `909be62`, accepted **2026-10-06 19:39 UTC**. The pinned identity host and
generated DAL now capture into SQL through private service credentials. Run
`878600a2-95d6-409d-9a50-36a53fe1ea73` reopens after a confirmed container restart
with all 1,894 events, graph and output identical. Browser, replay, external flow
and all 12 Windows CLI checks passed. See [E14](run-evidence-plan/evidence/E14-staging-restart-acceptance.json)
for the exact image digest, process IDs and evidence hashes. Linear remains the
default; capability outcome `ADMITTED` is separate from `NOT_EVALUATED` trust.

[Push-triggered run 37396070778](https://github.com/BPMSoftwareSolutions/sfx-platform/actions/runs/37396070778)
was the first automatic release, passing all four jobs on **2026-10-06 at 01:03 UTC**. It ran
`circuit-e52b3eb246e8-37396070778-1`, image digest
`sha256:bc94ae5f17ac3bf3670638ebc406ee940e372d2c85507ca7be1ffe98c475ff9f`.
The tag and manifest are write/delete locked. ARM binding and public health
were checked again after completion and matched that accepted release.

The [version-controlled receipt](releases/staging-automation-2026-10-06.json)
retains browser sign-in/Observe, all three providers visited live, exact
`ADMITTED` outcomes, replay timing, unchanged vault after a confirmed process
restart, external CLI follow and all 12 installed Windows CLI checks.
The 11,738.185 ms captured scenario replayed in 11,749 ms at 1x and
117,392.3 ms at 0.1x, within the 50 ms measurement tolerance at each rate.
This acceptance uses actual execution evidence; the timing qualification below
still applies to provider transport within the captured operation.

Automatic rollback was exercised during bring-up: a failed acceptance gate in
[run 37390693755](https://github.com/BPMSoftwareSolutions/sfx-platform/actions/runs/37390693755)
restored the exact r15 digest. Its recovery receipt is retained with the accepted
release evidence. The final workflow also rolls back a failed final binding check.

The external-flow harness waits for both `run-end` and a painted exact outcome,
not merely CLI process exit. Real verification exposed independent CLI and SSE
completion: the local proving run painted the outcome 118 ms after CLI exit;
the accepted GitHub run painted it 8 ms afterward. Stopping at process exit
would falsely fail an otherwise correct live circuit.

## What a push releases

The workflow reads the slot's **current exact image digest**, pulls that image,
and extracts `/opt/sfx/release.json`. It refuses a website-only manifest, mutable
base tag, foreign registry/repository, or missing installed-service identity.
The manifest must agree with the running health response.

Every push builds **one composite image** (revamp P2). It does not layer on the
previous image and it contains no Next.js website:

- the runtime is the pinned `node:24.20.0-bookworm-slim@sha256:6642ef…` base
  named in `deploy/sda-kernel/Dockerfile.composite`;
- the previous exact image is used only as the **components image**: its
  installed kernel, SDA API build, retrieval host/DAL, identity host/DAL,
  installed delivery configuration (`estate/sfx.config.json`) and encrypted vault
  bootstrap are copied by digest;
- every host file (`gateway.mjs`, `api.mjs`, `initialize.sh`, the identity and
  retrieval policies) and all of `live-circuit/` come from the checked-out commit.

`prepare-composite.mjs` stages the host files and circuit, records every placed
file's SHA-256, the source commit, the pinned base, the components image and its
release id, and the previous manifest's digest, and marks `website: false`. The
Docker build fingerprints each component (paths, contents, modes, symlinks) in
the components image and again after the copy, and refuses the image unless they
are identical, every placed file matches the manifest and `/app` does not exist.
The fingerprints are kept in the image at `/opt/sfx/.components/`.

The gateway serves the platform home page at `/` and its emblem at
`/favicon.ico` from the circuit host, answers `/robots.txt` itself (disallow all
when `SIDEFX_INDEXING=disabled`), and returns 404 for every path the retired
website used. Kernel and retrieval changes cannot ship this way. The identity
transport has one explicit update path: `identity-sources.json` pins the provider
and generated identity DAL commits, checked out and published with a locked
restore by the workflow. The packager inventories every new identity file; the
image replaces the complete identity directory and proves every other installed
component unchanged. The release policy refuses unpinned sources or binary
digests that do not match that inventory. Changes
under `infra/` other than `azure.json` and `authorize-staging-release.ps1` are
refused before building; they are separate infrastructure operations.

The first composite release was preflighted in ACR (build only, no push) against
`circuit-b8f15c889fb6-37399599577-1`: components identical, no `/app`, no missing
shared libraries in the kernel, identity or retrieval executables, and the
observer served `/circuit/home`, `/circuit/login`, its assets and the home API.

## Release sequence and gates

**Live Circuit checks** (parallel jobs, no Azure, no staging lock; PRs stop here):

1. *Offline contract gates* — `node deploy/staging/offline-checks.mjs` runs the
   fifteen gates listed in that file as separate processes on spare ports with
   an isolated host environment, four at a time, and records each gate's result
   and duration in `artifacts/checks/offline-checks.json`. The region gate
   requires the release-pinned providers (`SFX_UI_PROVIDER_DIR`); a missing
   required input fails as a configuration error instead of reducing coverage.
2. *Candidate browser qualification* — the checked-out Explorer in a real
   browser: run history/retry/sign-in recovery, the provider drill-down's
   declared view read, and the objective composer's exact admission
   (`verify-run-evidence-browser.mjs`); then replay of the pinned retained
   capture with prompt and deliberately delayed delivery
   (`tools/live-circuit/verify-replay-candidate.mjs`).
3. *Windows client* — build the pinned hidden-input helper and run the CLI
   client tests (`auth.test.mjs`, `install-login.test.mjs`).
4. *Pinned identity transport* (not on PRs) — publish the identity host from the
   commits in `identity-sources.json` with a locked restore, and record every
   file's SHA-256 in `identity-publish.json` beside it.

**Live Circuit staging** (one transaction holding the staging lock):

5. Authenticate with GitHub OIDC. No Azure client secret or publish profile is
   stored in GitHub. Download the identity publish from the qualifying checks
   run and refuse it unless its bytes and source pins match its manifest and
   this commit's `identity-sources.json`.
6. Record the current image, manifest and encrypted-vault fingerprint. Refuse a
   commit that does not descend from the installed release's source
   (`RELEASE_OUT_OF_ORDER`); checks runs can finish out of order. Compute the
   release scope from that source commit (`scope.json`). Build in ACR with a
   unique commit/run/attempt tag. Lock both tag and manifest against
   write/delete, and lock the rollback manifest.
7. Recheck the binding before PATCH. Refuse if another deployment changed it.
   Persist recovery state **before** PATCH, bind by digest, restart, and wait
   for the expected release. Match the running manifest and vault fingerprint.
8. *Deployment contract smoke* — anonymous, execution-free reads: the platform
   home page at `/`, served pages and shell modules, retired website and
   circuit routes still 404, protected operations still 401/405, a
   disallow-all `robots.txt`, all five declared regions `AUTHORED` from the
   pinned packages, catalog, capability details, declared pages and crosswalk,
   the fixture's declared outcome, and provider drill-down digests with
   stale-selection refusal. Static reads run six at a time; reader-backed reads
   run one at a time (see *Read concurrency* below). Every read is recorded in
   `smoke.json`, and the scenario snapshot is pinned in `snapshot.json`.
   Refusal matrices for page digests, unknown crosswalks and unknown regions
   are fixture gates (step 1), not deployed reads.
9. Use the real sign-in UI: wrong-password refusal, Secure/HttpOnly/SameSite
   Strict host cookie, anonymous Observe refusal, signed-in live Observe with
   provider/owning-step/call/exact-outcome visibility, principal attribution,
   complete SQL capture before restart, sign-out and revocation. Scan console,
   testimony and output for the tested secrets. The scenario snapshot must still
   be the one the smoke pinned (`DECLARATION_SNAPSHOT_CHANGED` otherwise).
10. Verify every receipt prefix and every declared replay rate with a
    deterministic scheduler over that fresh capture. This is pure processing;
    browser replay rendering is qualified on the candidate in step 2.
11. Restart again; require a different gateway `bootId` with the same release
    and vault fingerprint. Sign in as the same owner, list and reopen that same
    run, and require all event identities and digests to match, with no new
    Observe submission and Linear still selected by default. Then invoke the
    actual API CLI wrapper while an anonymous browser follows live, requiring
    provider and exact outcome visits.
12. *Windows client gate*, only when the release scope changes the installed
    CLI, its login input or the identity contract (`clientScope` in
    `policy.mjs`): build the pinned input provider, install the actual wrapper,
    and test hidden terminal login, cancellation, DPAPI persistence,
    whoami/logout/revocation and redirected-input refusal. Otherwise the
    receipt records the gate as omitted with its reason.
13. Reconfirm the slot binding and health and require a passing ledger record
    (`gates/<id>.json`) for every required gate, then publish `accepted.json`
    listing each gate's duration, every omitted scope and the evidence digests.
    A build or successful PATCH alone is not acceptance. Any other outcome
    restores the prior exact image before the lock is released.
14. *Presentation captures* (post-acceptance qualification, its own session):
    the declared home signed out and signed in at each viewport, specimen pages,
    provider views and DOM safety. A failure is reported on that job; it never
    rolls back an accepted release.

Every gate records its duration, result and — only when there is explicit
evidence — a classification: `product`, `changed-input`,
`dependency-unavailable` or `harness`; otherwise `unclassified`.

The selected capability/input are release fixture data in
`deploy/staging/config.json`, not runtime routing cases. These gates prove the
selected end-to-end path and transport regressions, not every estate capability
or complete formal observability.

The execution fixture is **not yet deterministic**. `request-capability-from-objective-v3`
depends on Gemini model selection and summary, live equity market data and
estate declarations read from SQL, and `config.json` (`executionFixture`) says
so; every acceptance receipt and step summary repeats it. The audit's target is
a fixed, side-effect-free capability approved through `sfx-embody` migration
pairs. Once it is declared, point `observe`, `expectedOutcome` and
`executionFixture` at it, and keep the objective-v3 journey as separately
classified integration qualification.

The fixture's expected outcome must track the declared capability contract.
The smoke gate checks that its exact variant exists before live Observe and
classifies a missing variant as `changed-input`.
The objective-v3 discovery composition returns `RETURNED` for returned child
evidence; the older `ADMITTED` expectation is no longer declared. `RETURNED`
does not assert domain success or objective fulfillment. Release
[37875553936](https://github.com/BPMSoftwareSolutions/sfx-platform/actions/runs/37875553936)
completed its real Observe in 29 seconds with returned market-price evidence,
then failed the stale `ADMITTED` assertion and rolled back. This was fixture
drift, not a sign-in or model timeout. Historical receipts above retain their
original outcomes.

For a browser-gate failure, inspect `browser/failed.json` (phase,
classification and redacted assertion), `browser/progress.json` (last phase), and `browser/run.json` (actual
execution, when available) in the `staging-release` artifact. The parent command
withholds raw child output because authentication material can be present;
`COMMAND_FAILED: node (1)` alone does not identify which assertion failed.

`verify-timing.mjs` checks every declared rate (including 0.1x), each receipt
timestamp, pause/resume, stepping, speed changes and delayed-scheduler catch-up
using a deterministic scheduler over the unchanged real capture, both offline on
the pinned evidence and in the release on the fresh capture.
`replay-timing.json` labels these as virtual-clock measurements.

Browser replay rendering is qualified on the candidate, not inside the staging
lock. Release [37919308588](https://github.com/BPMSoftwareSolutions/sfx-platform/actions/runs/37919308588)
timed out waiting for 1x replay to finish and rolled back. Reproduced on
2026-10-09 with that run's retained scene and capture under 4x CPU throttling,
the cause was an Explorer race: a stale 1.5 s reconnect timer from the bare
live stream fired while the replay stream was still delivering (2,062 of 2,408
records) and closed it, so `run-end` never arrived and replay never started.
`circuit-runtime.js` now ignores events from superseded streams and cancels a
pending reconnect whenever it opens a new stream. The candidate qualification
replays the pinned capture twice: delivered at once, and delivered over four
seconds while the live stream keeps disconnecting, so a 1.5 s reconnect is
always pending during delivery regardless of runner speed. The pre-fix runtime
failed the delayed case as `REPLAY_RUN_NOT_RECEIVED` in 4 of 4 local runs; the
fixed runtime passed both cases in 3 of 3. A failed replay retains
`failed.json` (stage, classification, mode, observer and stream lifecycle, last
samples) and `failed.png`, and a painting miss with sparse frame sampling is
classified `RENDER_SAMPLING_SPARSE` rather than `PROVIDER_NOT_PAINTED`.

For an explicit wall-clock qualification, run
`node tools/sfx-api/verify-circuit-replay.mjs <origin> <scene.json> <capture.sse> <output-directory> --full-wall-clock`.
That diagnostic retains both full-duration rates and the original 50 ms
tolerance. It consumes retained evidence and makes no new capability invocation.

Replay verification selects the completed capability run from the capture
(which also contains real sign-in/sign-out runs), retaining its original receipt
IDs, values and timestamps. Its browser consumes that retained run without new
live events interrupting it. Separately timed provider receipts require a dwell
throughout that recorded interval. When only the owning operation is timed,
the test verifies provider visitation within that window and explicitly records
schematic transport location; it never fabricates a provider duration.

The log check streams actual container output through the slot's authenticated
SCM endpoint. Publishing credentials travel over private stdin to the bounded
log reader, never argv or artifacts. A secret or bearer-like credential in any
sample obtained fails the browser gate. Whether a complete sample can be
obtained depends on SCM log transport: a sample without HTTP 200, without the
real host startup marker, or over its bound is recorded as an omitted live scan
in the receipt rather than failing the release. The required disclosure check
is the controlled canary test in `verify-identity-session.mjs` (step 1).

### Read concurrency

Deployed reads are parallel only where that was demonstrated safe. Static
routes, region packages and the registry run six at a time. Reader-backed
reads share the circuit host's two read slots (`maximumConcurrentReads`) and
its 30 s retrieval timeout; on 2026-10-09 three overlapped provider inspections
against staging failed with `CIRCUIT_READER_UNAVAILABLE` after about 40 s,
while the same inspections run one at a time succeeded in about 20 s each. That
lane therefore stays sequential and runs alongside the static lane. Live
browser Observe, the API CLI follower and the global-observer capture remain
strictly ordered: they still select runs by latest-run or graph, so concurrent
executions are not yet attributed by exact run ID throughout.

Provider inspection follows each definition's shape. Provider entities must
return matching database digests; catalog/executor authorities without a
`providerId` must preserve the explicit `DECLARED_PROVIDER_REQUIRED` refusal.
On the r15 baseline this applies to the Node Platform catalog, while both Gemini
provider entities retrieve successfully. Receipts record that held inspection;
they do not call it successful provider retrieval.

## Credentials and one-time setup

The managed identity `sfx-platform-github-staging` uses the environment's
`AZURE_CLIENT_ID`, `AZURE_TENANT_ID` and `AZURE_SUBSCRIPTION_ID`. The existing
staging environment allows `main` without reviewer approval. The release
workflow's concurrency group (`live-circuit-staging-release`) is the staging
lock: binding, acceptance, the Windows client gate, the receipt or rollback and
presentation captures all run inside one workflow run, so there is no gap
between jobs for another release to bind or restart the slot. Newer pushes
never cancel a running release. The checks workflow's jobs never take the lock
and never receive Azure credentials. The release job additionally needs
`actions: read` to download the identity publish from the checks run.

Existing rights are AcrPush on `bpmaiengineacr` and Website Contributor on the
**staging slot only**. `infra/authorize-staging-release.ps1` adds ACR Tasks
Contributor on that registry and Key Vault Secrets User on exactly
`aiengine-kv-20260406/secrets/sfx-staging-release-acceptance`. It does not run the
old website bootstrap, alter storage settings or grant production access.

`deploy/staging/enroll-acceptance.mjs` bootstraps the dedicated
`staging-release-acceptance` identity through the enrollment API, generates a
random password, stores it in that Key Vault secret, and verifies login/logout.
Rerunning preserves the credential and does not reset an existing password. This
is a durable CI account, **not** a disposable principal or personal user. Checks
revoke their sessions. No identity DB connection or direct SQL writer is used.

The browser/CLI harness receives the credential over private stdin. The machine
API token is read privately from slot settings, never passed in argv or retained
as an artifact. Its existing direct `SDA_API_TOKEN` setting is unchanged. P0's
planned Key Vault reference must also update the credential resolver and its
secret-scoped permission; unresolved references fail closed.

`GET /internal/deployment` requires the machine bearer and returns metadata,
process identity and **ciphertext hash/length**, never vault bytes or credentials.
Public health includes the random process ID. The first transition from r15 uses
authenticated Kudu to fingerprint ciphertext, discarding bytes and publishing
credentials in memory. Subsequent releases use the private metadata route.

## Failure, rollback and evidence

Durable run capture uses separate sticky Key Vault references named
`SFX_EVIDENCE_SERVICE_KEY` and `SFX_EVIDENCE_CALLERS`. The one-time operator tool
`node deploy/staging/provision-evidence.mjs` provisions those secrets and grants
the staging managed identity access to just those secrets; it does not restart
or bind staging. The workflow enables their references only after binding the
candidate identity host. Recovery records references only and restores the old
settings with the old image when it still owns the binding. The CI identity does
not receive the capture secrets. The gateway gives the writer key only to the
observer and the caller registry only to the private identity service.

Complete captures survive container restarts. This does not resume execution
inside a terminated kernel, recover material never captured, or grant a trust
verdict. An unavailable run returns controls to the user, hides Resume, and
explains that a new Observe is a new execution. Temporary stream failures remain
resumable. No error path automatically submits another run.

A 401 is a separate recovery path: the Explorer refreshes the identity header,
hides Resume, and offers sign-in with a return link to the selected run. Observe
is disabled until authentication is renewed; the input remains editable. A 401
at admission states that the request was not admitted. The restart acceptance
opens the stored run without a cookie first, follows this sign-in link, and
requires the same run and retained output afterward with zero new submissions.

`state.json` retains previous/candidate digests and a flag persisted before
binding. A failed deploy, smoke, browser, evidence, restart, durable or external
gate, a failed required Windows client gate, or a ledger missing any required
gate restores the prior exact digest and waits for readiness. A failed
presentation capture after acceptance does not. Rollback acts
only while the slot still points at this workflow's candidate; it preserves and
reports another deployment's binding.

Artifacts contain manifests, fingerprints, the gate ledger (`gates/*.json`),
receipts, scene, captured events, sampled frames and screenshots;
`offline-checks`, `candidate-browser` and `identity-publish` come from the checks
run, `staging-release`, `staging-final` and `staging-presentation` from the
release run. No fixture password, session bearer, publishing
credential, raw Azure logs or vault bytes are retained. Detailed evidence lasts
30 days; accepted/rollback receipts last 90 days. Locked ACR manifests retain
source and previous-image lineage.

Normal gate failures recover automatically. No workflow can guarantee recovery
after a runner is killed or the entire workflow is force-cancelled. If interrupted
after binding, download that run's `staging-release` artifact and invoke
`node deploy/staging/release.mjs rollback` with `SFX_RELEASE_EVIDENCE` pointing to
it and Azure CLI authenticated, or rerun the recovery job. Ownership checks still
apply. Do not cancel an active release to accelerate a newer push.

The older manual runbook remains an incident/full-runtime reference, not the
normal circuit release path.

References: [GitHub deployment concurrency](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments),
[OIDC to Azure](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-azure),
[ACR roles](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-roles).
