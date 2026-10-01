# Staging SDA host

The existing Linux website image is the base. The release adds the circuit demo,
the SDA Run API and a verified, self-contained kernel installation. The estate
delivery names that installed entry; it has no runtime checkout or build step.

`prepare.mjs <installed-root> <estate-root> <sda-api-source> <fresh-destination>`
packages an already verified installation, the demo's transport files, compiled
API files and interface authority. Build the API before packaging. Run preparation
on Linux so kernel permissions and internal symbolic links survive the tar archive.
Supply `WEBSITE_IMAGE` as an exact image digest to the Docker build.

The gateway listens on port 3000. The website listens internally on 3001, the SDA
API on 8799 and the observer on 8787. API events are forwarded in received order
to the existing observer; graph capture uses the API's validated graph. There is
no synthetic scenario execution or animation event generator. The browser retains
the same scenario clock, database rendering, component inspection and replay code.

The website and circuit demo are public and do not challenge browsers for a
username or password. Direct `/v1/` API clients send the existing `SDA_API_TOKEN`
as Bearer authentication, validated by the SDA API itself. The gateway forwards
the caller's authorization unchanged and never substitutes its server credential.
Website server actions retain their existing internal API credential. The circuit
also offers a JSON payload editor and **Observe**, using a same-origin
`POST /api/circuit/v1/runs` transport to the internal `/v1/runs` API. The observer
receives the API endpoint and server token; its kernel reader children do not.
The browser never receives that token. This public staging action intentionally
permits visitor invocation under the configured SDA admission policy. Other
external writes to the observer remain refused, including event injection.

The selected API run streams directly to its submitting circuit tab, with cursor
resumption and its own graph. The generic observer bridge remains available for
CLI and other external runs. Input contracts are read through the database scene's
navigation links; the viewer has no per-capability form or execution code.

## Vault custody and restart

The initial `vault-bootstrap.tar.gz` contains only the encrypted vault, its key
reference records and the encrypted Secret Service keyring. Its paths are relative
to `/home/sjones/.local/share`. It must never contain the keyring unlock password.
The password lives in Azure Key Vault and reaches the container through a slot
setting reference. The staging managed identity can read that one secret.

App Service persistent storage is enabled for `/home`. Initialization establishes
the runtime directory and drops privileges, explicitly preserving the selected
home and XDG data roots. `runuser` otherwise resets HOME and separates the restored
vault from its admitted locator. The keyring control socket lives under `/tmp`:
Unix sockets cannot live on the App Service storage share. Secret Service runs in
the foreground under supervision. Startup verifies master-key availability without
logging its bytes before exposing readiness. The unlock password is removed from
child environments; kernel children also receive no API authentication token.

The bootstrap archive is used only when the persistent vault is absent. Later
restarts reuse the stored ciphertext and keyring. Runtime provider credentials are
read through the declared vault; database and provider secret environment fallbacks
are not used. The current file vault is a single-instance deployment: multi-instance
concurrent vault writers require a separately verified storage coordination design.

## Published candidate, 2026-10-01

- Azure app/slot: `sidefx/staging`, resource group `sidefx_group`.
- Release: `sda-f50865d3feb4-r6`; ACR build `ca50`.
- Image: `bpmaiengineacr.azurecr.io/sidefx/sfx-platform@sha256:2e001dcba0de2e553a4823cf5d99aee091a7b578627288c70884435e6ccbe9d6`.
- Installed Linux C# kernel: `sha256:f50865d3feb452a148ae02c3845296a1bf7f096551345108915005951e09127e`.
- Previous stable image (r4): `bpmaiengineacr.azurecr.io/sidefx/sfx-platform@sha256:4f5bb9a9783d1708bac9da2609d9d241b8fb6ae815b1bea389cf1ab038d6cfbb`.

Linux Node installation and vault defects were repaired and its real Hello World
API invocation passes. The live estate currently pins some application digests to
C# Unicode serialization, so Node correctly refuses those applications. That open
SDA canonicalization issue is not bypassed. Linux C# is the selected release runtime.

Release r6 adds the circuit's API Observe action and handles omitted outcome
variant lists in the generic viewer. Browser acceptance includes a real objective
run, all three displayed providers while live, the admitted outcome, original
1× and 0.1× replay timing, a second capability's different input contract,
double-click suppression, and resuming a disconnected run without admitting it
again. Input drafts survive capability switching. The token stays on the host;
direct anonymous `/v1/runs` remains 401 and external event injection remains 405.
No database declarations, kernel installation or vault configuration changed.
See [`circuit-observe-acceptance-2026-10-01.json`](circuit-observe-acceptance-2026-10-01.json)
for the run IDs, capture checks and limits of this verification.

Release r4 removes the unrequested blanket HTTP Basic challenge introduced in r3.
An empty browser context with no credentials loaded the website, circuit and live
observer. Anonymous catalog and scenario reads returned 200; missing, invalid
Bearer and Basic credentials returned the API's JSON 401, without a browser
authentication challenge. External observer writes still returned 405.
Authorized run `3d38272e-e835-4c60-b65c-e258572d5035` returned
`EQUITY_MARKET_PRICE_EVIDENCE_RESOLVED`; its anonymous viewer recorded the displayed
provider under the live dot in 60 samples before process exit, with no JavaScript
errors. Replay measured 1.0 and 0.1. The gateway-only change preserves the kernel
installation and vault configuration. Evidence:
[`public-access-acceptance-2026-10-01.json`](public-access-acceptance-2026-10-01.json).

The following original deployment and restart checks were captured on r3:

Hosted run `94a5415d-add9-4192-b881-e2ab7f91d8dc` completed the objective through the
model and market provider, returning `EQUITY_MARKET_PRICE_EVIDENCE_RESOLVED`.
All 1,023 events reached SSE; 1,022 arrived before process exit. The graph and output
returned 200, unauthorized admission returned 401, and the database circuit catalog
returned 348 capabilities. Local and hosted receipts are retained in the ignored
`artifacts/deployment/sda-linux-proof/` directory. The durable summary is
[`acceptance-2026-10-01.json`](acceptance-2026-10-01.json).

After an explicit container restart, run `4664ec4b-2b61-43b1-af1a-4c0d681410e6`
again resolved real market evidence. The persistent encrypted vault's SHA-256
remained unchanged. Browser sampling recorded 898 live frames, including 90 with
the displayed provider under the dot before process exit. The admitted outcome
lit, the other outcome variants stayed unobserved, normal replay measured 1.0 and
slow replay 0.1. The replay window was 12,141.427 ms versus a 13,890 ms process
window, excluding setup. Provider drill-down and a second capability's paginated
scenario loaded successfully; browser JavaScript errors: zero.

These are functional deployment checks. The current database-rendered objective
page declares one displayed provider (Node Platform), and its verification panel
reports `NOT_FORMALLY_OBSERVABLE` because the captured graph lacks selected
definition digests. This release does not claim complete provider declaration
coverage, generation equality or successful execution of all 348 capabilities.

To roll back, set the staging slot's `linuxFxVersion` to the previous exact image.
Restore `SDA_API_ENDPOINT` to its prior configured service only if reverting the
API service as well. Do not erase the persistent vault during rollback. The prior
endpoint was a temporary tunnel, so it is not a durable fallback service.
