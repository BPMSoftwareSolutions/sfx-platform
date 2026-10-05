# Staging login API and live circuit

The `sidefx/staging` slot hosts the private login API at
`https://sidefx-staging-fyfhb9gubneqbpaz.eastus2-01.azurewebsites.net`.
Release `sda-f50865d3feb4-r9` adds the published Linux identity host and current
circuit assets to the existing image. The installed SDA Kernel is unchanged.

## Test the login flow

Open the [authentication circuit](https://sidefx-staging-fyfhb9gubneqbpaz.eastus2-01.azurewebsites.net/circuit?capability=authenticate-ide-user&namespace=sidefx%3Acapabilities&scenario=authenticate-ide-user&page=scenario-1).
Keep **Animate execution evidence** and **Follow execution page** checked, and
use **Return to live** if the viewer is replaying an earlier run. Then run:

```powershell
$endpoint = 'https://sidefx-staging-fyfhb9gubneqbpaz.eastus2-01.azurewebsites.net'
sfx login --endpoint $endpoint --username sidney
sfx whoami --endpoint $endpoint --json
sfx logout --endpoint $endpoint --json
```

Use an enrolled identifier. The realm is `sfx-ide-local`, backed by the existing
staging `sfx-identity` database: an account enrolled by the local pilot helper
works here with the same password. The deployment neither creates nor resets a
personal account. Password entry is hidden. No administrator API token or local
certificate override is required for these HTTPS login commands.

Login runs the database-declared `authenticate-ide-user` scenario: 17 operations,
three server providers and three circuit pages. The observer receives actual
kernel events as they occur. The private HTTP response returns the session only
to the CLI helper. The scenario carries a correlation and provider origin, not
credentials. `whoami` and `logout` call their dedicated session endpoints; they
do not invent another authentication circuit execution.

A browser can also sign in at `/circuit/login`. It runs the same
`authenticate-ide-user` capability through `POST /auth/v1/login`. The observer keeps
the session in an HttpOnly cookie, and Observe then requires it. See
[the browser session contract](../../docs/live-circuit-browser-session.md).

Do not put a password into the circuit's generic JSON Observe editor. That
editor invokes capability input, and cannot create the private login context.
The command above is the login ingress while this page is its live observer.

## Topology and custody

| Boundary | Route or responsibility |
| --- | --- |
| Azure frontend | HTTPS-only public origin |
| Platform gateway, port 3000 | Exact routes from `identity-policy.json`; forwards caller headers |
| Identity host, loopback 8793 | `POST /auth/v1/login`, `GET /auth/v1/session`, `POST /auth/v1/logout` |
| Private callbacks | `/auth/v1/provider/resolve`, `/verify`, `/establish`; require service bearer, current private context and ordered stage |
| Installed Linux C# kernel | Interprets database-selected login graph and binds the vault credential |
| Generated identity DAL | Named identity procedures, private connection supplied only to identity host |
| Observer, loopback 8787 | Real kernel events ingested internally; public SSE at `/events` |

The gateway captures and removes `SFX_IDENTITY_CONNECTION_STRING` and
`SFX_IDENTITY_SERVICE_KEY` from inherited environments. Only the identity child
receives them, and that child removes them again before starting the kernel.
The user bearer, private callback service key and existing SDA API machine token
are separate credentials. Login does not yet authorize user bearers for `/v1/runs`.

The service key is an independent staging key in Azure Key Vault secret
`sidefx-staging-identity-service-key`, supplied through a slot-specific Key Vault
reference. Staging's managed identity has Secrets User access scoped to that
secret. The matching kernel credential is encrypted in the persistent Linux
vault under reference `SFX_IDENTITY_SERVICE_KEY`.

Provisioning used the installed Linux Node lifecycle and existing vault mechanic
against `sfx-embody/sql/migrations/prepare-staging-identity-vault.preflight.sql`.
The database transaction rolled back; no temporary credential writer was admitted
to the public estate. The input traveled on a private pipe into a temporary
mode-0600 file removed in `finally`. Only ciphertext and non-secret receipts were
retained. The encrypted vault was uploaded with the current Kudu ETag after
checking that all four prior entries were byte-for-byte preserved. Repeating this
operation requires a fresh vault snapshot and a new operator-controlled key;
never replace a live vault with an older bootstrap archive.

## Rebuild and rollback

Publish `sfx-providers/providers/cli-login/host/LoginHost.csproj` for `linux-x64`,
Release, self-contained. Its Linux dependency lock is checked in. Then:

```text
node deploy/sda-kernel/prepare-identity.mjs <published-host> <previous-release.json> <fresh-context> <release-id>
```

Build that fresh context in ACR, passing the exact previous image digest as
`STAGING_IMAGE`. No credentials or source checkout enter the image. Preserve the
estate's Linux delivery configuration; the packager copies only circuit/observer
files, not the developer machine's `sfx.config.json`.

- ACR build: `ca54`.
- Deployed image: `bpmaiengineacr.azurecr.io/sidefx/sfx-platform@sha256:7b9bbfba5fe84ac650ccedb57461a7951577c34a9424b138a8ebc789ad11d772`.
- Kernel: `sha256:f50865d3feb452a148ae02c3845296a1bf7f096551345108915005951e09127e`.
- Previous image: `bpmaiengineacr.azurecr.io/sidefx/sfx-platform@sha256:f4bca13e4ffbcbdf6d57f7ccdd49813292f892b2c01ab6ef8eeb0c726ab9de20`.

Rollback selects the previous image in the staging slot. Preserve the persistent
vault and identity database; the prior image simply has no login routes. Do not
swap this test deployment into production as part of this operation.

Acceptance is recorded in `identity-acceptance-2026-10-04.json`. The versioned
remote harness is `sfx-providers/providers/cli-login/remote-tests/`; it uses the
installed Windows CLI, a disposable principal, real HTTPS and live SSE. Native
macOS acceptance and per-principal capability authorization remain separate work.
