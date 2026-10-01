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

All staging routes except `/healthz` and `/readyz` require the existing
`SDA_API_TOKEN`: API clients can send Bearer authentication; browsers use HTTP Basic
with any username and that token as password. This also protects website actions
which call the internal API with their server credential. External writes to the
observer are refused. `/v1/runs` remains the invocation surface.

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
- Release: `sda-f50865d3feb4-r3`; ACR build `ca4w`.
- Image: `bpmaiengineacr.azurecr.io/sidefx/sfx-platform@sha256:3fdf2ca17e2256f86d1b550ec6ca52fbf1a7ee6ae1fe89add89ffbbf867cd2e9`.
- Installed Linux C# kernel: `sha256:f50865d3feb452a148ae02c3845296a1bf7f096551345108915005951e09127e`.
- Previous image: `bpmaiengineacr.azurecr.io/sidefx/sfx-platform@sha256:5686009cd7746d82f98303fc3235412ed6aa0823cffef6f9700cad679d73499b`.

Linux Node installation and vault defects were repaired and its real Hello World
API invocation passes. The live estate currently pins some application digests to
C# Unicode serialization, so Node correctly refuses those applications. That open
SDA canonicalization issue is not bypassed. Linux C# is the selected release runtime.

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
