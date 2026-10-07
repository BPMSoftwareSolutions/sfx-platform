# Automatic Live Circuit staging releases

The user decision on 2026-10-05 is **automatic deployment on pushes to `main`**.
`.github/workflows/staging.yml` owns this path. No manual start or approval is
required. PRs run checks without Azure credentials. `workflow_dispatch` is an
optional recovery trigger; only `main` can bind the slot.

Push paths cover the circuit, host/packagers, release tools, CLI and acceptance
tools, Azure binding and this workflow. Changes confined to `docs/` or the root
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

1. Run release-policy, composite-packaging and browser-session contract checks.
   PRs stop here.
2. Authenticate with GitHub OIDC. No Azure client secret or publish profile is
   stored in GitHub.
3. Record the current image, manifest and encrypted-vault fingerprint. Build in
   ACR with a unique commit/run/attempt tag. Lock both tag and manifest against
   write/delete, and lock the rollback manifest.
4. Recheck the binding before PATCH. Refuse if another deployment changed it.
   Persist recovery state **before** PATCH, bind by digest, restart, and wait
   for the expected release. Match the running manifest and vault fingerprint.
5. Check public pages/catalog, provider drill-down digests, stale-selection
   refusal and protected API boundaries. Require the platform home page at `/`,
   404 for retired website routes (`/capabilities`, `/about`, `/sitemap.xml`) and
   a disallow-all `robots.txt`.
6. Use the real sign-in UI: wrong-password refusal, Secure/HttpOnly/SameSite
   Strict host cookie, anonymous Observe refusal, signed-in live Observe with
   provider/owning-step/call/exact-outcome visibility, principal attribution,
   sign-out and revocation. Scan console, testimony, output and a bounded Azure
   log sample for the tested secrets.
7. Verify every receipt prefix. Replay that capture at 1x and 0.1x and verify
   provider intervals and the captured scenario clock. Live acceptance never
   substitutes synthetic events or API responses.
8. Require the browser's run to reach complete SQL capture; retain event, graph
   and output digests. Restart again; require a different gateway `bootId` with
   the same release and vault fingerprint. Sign in as the same owner, list and
   reopen that same run, and require all event identities and digests to match,
   with no new Observe submission and Linear still selected by default.
   Then invoke the actual API CLI wrapper while an anonymous
   browser follows live, requiring provider and exact outcome visits. This also
   exercises vault-backed providers after the confirmed restart.
9. On Windows, build the separately pinned input provider, install the actual
   wrapper, and test hidden terminal login, cancellation, DPAPI persistence,
   whoami/logout/revocation and redirected-input refusal. That test build is
   never shipped in the Linux image and does not rebuild SDA.
10. Reconfirm the slot binding and health, then publish `accepted.json`. A build
    or successful PATCH alone is not acceptance.

The selected capability/input are release fixture data in
`deploy/staging/config.json`, not runtime routing cases. These gates prove the
selected end-to-end path and transport regressions, not every estate capability
or complete formal observability.

Replay verification selects the completed capability run from the capture
(which also contains real sign-in/sign-out runs), retaining its original receipt
IDs, values and timestamps. Its browser consumes that retained run without new
live events interrupting it. Separately timed provider receipts require a dwell
throughout that recorded interval. When only the owning operation is timed,
the test verifies provider visitation within that window and explicitly records
schematic transport location; it never fabricates a provider duration.

The log check streams actual container output through the slot's authenticated
SCM endpoint. Publishing credentials travel over private stdin to the bounded
log reader, never argv or artifacts. HTTP 200 and a real host startup marker are
required, so an Azure CLI error message cannot masquerade as checked host logs.

Provider inspection follows each definition's shape. Provider entities must
return matching database digests; catalog/executor authorities without a
`providerId` must preserve the explicit `DECLARED_PROVIDER_REQUIRED` refusal.
On the r15 baseline this applies to the Node Platform catalog, while both Gemini
provider entities retrieve successfully. Receipts record that held inspection;
they do not call it successful provider retrieval.

## Credentials and one-time setup

The managed identity `sfx-platform-github-staging` uses the environment's
`AZURE_CLIENT_ID`, `AZURE_TENANT_ID` and `AZURE_SUBSCRIPTION_ID`. The existing
staging environment allows `main` without reviewer approval. The entire release,
Windows acceptance and recovery share a concurrency group; newer pushes never
cancel a running release.

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
binding. A failed deployment, browser, replay, restart, external flow or Windows
CLI gate restores the prior exact digest and waits for readiness. Rollback acts
only while the slot still points at this workflow's candidate; it preserves and
reports another deployment's binding.

Artifacts contain manifests, fingerprints, receipts, scene, captured events,
sampled frames and screenshots. No fixture password, session bearer, publishing
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
