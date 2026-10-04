# IDE enrollment

`sfx-api enroll` submits an operator-authorized private request to the staging
identity API. The database-declared `enroll-ide-user` circuit controls execution.
It does not create a session; use `sfx login` after enrollment.

Open the [enrollment live circuit](https://sidefx-staging-fyfhb9gubneqbpaz.eastus2-01.azurewebsites.net/circuit?capability=enroll-ide-user&namespace=sidefx%3Acapabilities&scenario=enroll-ide-user&page=scenario-1).
Enable **Animate execution evidence** and **Follow execution page**, and stay in
live mode. Then run from your terminal:

```powershell
sfx-api enroll --endpoint https://sidefx-staging-fyfhb9gubneqbpaz.eastus2-01.azurewebsites.net --username sidney --json
```

The CLI prompts for the new password and confirmation, both hidden. The declared
minimum is 12 characters. It accepts no password flag, JSON password file or
redirected password input. `ENROLLED` means a new principal, Argon2id verifier and
audit record committed atomically in `sfx-identity`, realm `sfx-ide-local`.
`ALREADY_ENROLLED` means the existing identity was preserved, including its
password. It is not a password reset. Duplicate/rejected enrollment exits nonzero.

Enrollment uses the endpoint's machine credential from the installed encrypted
API profile, `SFX_API_TOKEN`, or `SDA_API_TOKEN`. The `enroll` command explicitly
selects that operator credential without changing the user's selected login
profile. Ordinary login requires no operator token. On another machine, an Azure
administrator can load the existing staging token into the current shell without
printing it (Azure CLI must already be authenticated):

```powershell
$env:SFX_API_TOKEN = az webapp config appsettings list --resource-group sidefx_group --name sidefx --slot staging --query "[?name=='SDA_API_TOKEN'].value | [0]" --output tsv
```

For macOS zsh, the equivalent environment assignment is:

```sh
export SFX_API_TOKEN="$(az webapp config appsettings list --resource-group sidefx_group --name sidefx --slot staging --query "[?name=='SDA_API_TOKEN'].value | [0]" --output tsv)"
```

This is the existing administrator credential, not a new end-user password or
session token. Native macOS enrollment acceptance has not been run.

## Boundaries and declared flow

`POST /auth/v1/enroll` accepts exactly `{identifier,password}` over HTTPS and
requires the operator bearer. The host allocates a bounded, expiring private
context. Only `{correlationId,providerOrigin}` enters the kernel input contract.
The graph first invokes `password-credential-provider` to create the verifier,
then `identity-principal-provider` to call the generated
`IdentityProvisionPrincipalCredentialRepository`. The existing database procedure
owns the transaction and unique realm/normalized-identifier constraint.

Each provider call has a distinct vault credential binding, exact HTTPS authority,
one-use private context stage and safe correlated response. The provider key
cannot authorize the enrollment ingress; the operator key cannot call provider
callbacks. No password, verifier, connection string, operator bearer or session
credential is sent to the observer. The original HTTPS response and the kernel's
declared result must agree.

The circuit has one input, 12 operations, two server providers and four outcomes:
`ENROLLED`, `ALREADY_ENROLLED`, `ENROLLMENT_REJECTED`, `IDENTITY_UNAVAILABLE`.
Invalid transport, missing operator authority and ingress overload are HTTP
refusals before scenario entry; they do not manufacture scenario execution.

The two scenario pages follow the viewer's existing seven-operation pagination.
The dot reaches the password provider on page 1 and the principal provider on
page 2. Startup, connection, session setup, authority reads and graph preparation
remain excluded from the scenario playback clock.

## Durable source and verification

- API: `sfx-providers/providers/cli-login/host/EnrollmentApplication.cs`.
- Hidden input: `sfx-providers/providers/cli-login-input-provider/`.
- CLI: `tools/sfx-api/auth.mjs`, `sfx-api.mjs`, `login-input/Program.cs`.
- Deployment: `identity-policy.json`, `gateway.mjs`, `prepare-identity.mjs`.
- Declaration: `sfx-embody/sql/migrations/declare-enroll-ide-user.sql` and its commit twin.
- Tests: `sfx-providers/providers/enrollment-tests/`, `providers/enrollment-remote-tests/`,
  `tools/sfx-api/live-enroll-test.mjs` and `verify-enrollment-live.mjs`.

The existing CLI installer publishes the updated helper and wrapper; no checkout,
database connection or build runs during an enrollment command. The old temporary
`enroll-pilot.ps1` is superseded by this command. The acceptance harness uses only
random disposable identities and removes those fixtures after verification.
No personal account is enrolled or reset by deployment.

Staging release `sda-f50865d3feb4-r12` passed the installed Windows command loop
and live browser acceptance on 2026-10-04. The versioned
[acceptance receipt](identity-enrollment-acceptance-2026-10-04.json) retains image,
kernel, DAL, policy and migration identities, check results and evidence hashes.
The host emitted 1,769 events in the remote loop; the live browser showed both
providers with no JavaScript errors. Passwords and identifiers were absent from
the observed stream. The five static deck evidence warnings remain disclosed;
these runtime checks do not establish complete formal observability.

The browser acceptance command takes an HTTPS origin, evidence directory, and
the external acceptance executable plus its arguments. Set
`SFX_BROWSER_TEST_MODULE` to an installed Playwright module and
`SFX_BROWSER_EXECUTABLE` to Chromium. It opens the live circuit before starting
the CLI test, follows pages, and samples rendered frames without replay or a
reduced-motion override. Test tooling is not shipped as a CLI dependency.
