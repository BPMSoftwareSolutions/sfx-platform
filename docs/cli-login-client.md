# CLI login client

The platform client owns `sfx login`, `sfx whoami`, and `sfx logout`.
Other `sfx` commands still go to the existing installed local launcher.
`sfx-api` uses the same selected user session for remote requests. No SDA Kernel
grammar, capability dispatcher, or kernel source is changed.

## Commands

```powershell
sfx login --endpoint https://localhost:8793
sfx whoami --json
sfx logout --json
```

An optional `--username` skips the username prompt. The password is always read
from the interactive terminal without echo. There is no password argument,
environment variable, stdin-password mode, `--input`, or login `--trace` option.
Noninteractive login refuses. `--json` prints metadata only; prompts and bounded
diagnostics go to stderr. Ctrl+C cancels acquisition before HTTP submission and
restores terminal input handling.

The endpoint must use HTTPS, including local development. Redirects are refused;
certificate validation remains enabled. The private API supplies the realm.
`whoami` validates the bearer against that API and verifies realm, principal and
session identity before printing its allowlisted metadata.

These commands require a running private identity host and an enrolled account.
The local integration harness uses a disposable account and removes it afterward.
Azure staging now hosts `/auth/v1/*` in release `sda-f50865d3feb4-r9`.
Installing this client does not enroll a real user or grant capability access.
The [staging login runbook](../deploy/sda-kernel/identity-login.md) includes the
hosted circuit URL, command loop, deployed identities and acceptance evidence.

## Source and topology

| Source | Responsibility |
| --- | --- |
| `tools/sfx-api/sfx-api.mjs` | Authentication command routing and existing generic run transport. |
| `tools/sfx-api/auth.mjs` | Login/session/logout lifecycle, response projection and failure behavior. |
| `tools/sfx-api/session-store.mjs`, `session-store.ps1` | Endpoint selection and protected session persistence. |
| `tools/sfx-api/login-input/` | Private terminal/HTTPS helper, reusing `CliLoginInputProvider` from `sfx-providers`. |
| `tools/sfx-api/install-login.mjs`, `install-login.ps1` | Content-addressed client installation; preserves the prior local launcher. |

The reusable provider assembly contains input handling, private value contracts
and interfaces only. The published client has no SQL driver, identity DAL,
Argon2 implementation, database connection, or kernel dependency. The server
invokes the declared authentication circuit through the installed kernel; the
three server providers own principal lookup, password verification and sessions.

The helper inherits the terminal on stdin/stderr and sends the private login
result through a pipe owned by the wrapper. Its stdout is never inherited by the
terminal. The wrapper prints metadata and sends the bearer only to the secure
store and same-endpoint Authorization headers. Passwords never enter JavaScript,
local files, generic graph input, or normal run traces.

## Sessions and machine credentials

A human login selects user authentication even when rejected or cancelled.
`sfx-api` then requires that endpoint's user session. Logout, expiration, storage
failure and endpoint changes never fall back to `SDA_API_TOKEN` or `SFX_API_TOKEN`.
Existing machine-only installations continue to work. An operator can explicitly
choose the separate machine profile:

```text
sfx-api capability observe <capability> --input @request.json --json --auth machine
```

User-mode `sfx-api` sends the user's bearer unchanged. It does not exchange it for
the deployment token. The deployed Run API has not yet been integrated with
per-principal capability authorization and will reject that bearer. This is
outstanding server work, not an implicit grant or client fallback.

Selection and metadata live under `%LOCALAPPDATA%\sfx\user-sessions` on Windows
or `~/.local/share/sfx/user-sessions` on macOS. `SFX_SESSION_HOME` can select an
isolated profile directory. Credential keys derive from endpoint, server realm,
principal ID and session ID; private records repeat those values and are checked
against metadata on read.

Windows protects private records for the current user using DPAPI through
`Export-Clixml`. macOS uses generic-password Keychain items under service
`sfx-cli-user-session`; values enter `/usr/bin/security -i` through stdin, never
process arguments. Every write requires successful read-back. Apple documents
that interactive channel in its
[security manual](https://github.com/apple-oss-distributions/Security/blob/main/SecurityTool/macOS/security.1).
Linux refuses secure session persistence; there is no plaintext fallback.

If storing a newly issued session fails, the client attempts server revocation
and reports incomplete login. Replacement login revokes the previous session
before replacing its credential. Logout attempts remote revocation and removes
the local credential. Offline logout returns `LOCAL_SESSION_REMOVED`,
`remoteRevocationConfirmed: false`, and exit code 1, without claiming revocation.

Mutating commands acquire a per-endpoint `.lock` file. Handled cancellation and
errors remove it. After a killed process, confirm no login/logout is running
before removing that endpoint's stale `.lock` from the session profile directory.
Read-only status does not hold the mutation lock.

## Build and install

Build with .NET 8 SDK in the platform checkout. The provider project is a build
input, not a runtime checkout dependency. Override `LoginInputProviderProject`
with an absolute project path for a different checkout arrangement.

```powershell
dotnet publish tools/sfx-api/login-input/LoginInput.csproj -r win-x64 --self-contained true -c Release -o artifacts/cli-login/input
./tools/sfx-api/install-login.ps1 -Endpoint https://localhost:8793 -InputDirectory artifacts/cli-login/input
```

The Windows installer finds the existing `sfx.ps1`, copies its delegate into a
digest-addressed installation, and installs both `sfx` and `sfx-api` launchers.
It resolves path aliases so an nvm junction cannot make the delegate point back
to its replacement. `login-install.json` records the version, destination,
delegate, delegate SHA-256 and bin directory. It neither requests an administrator token nor
replaces the existing machine credential. Node 20 or later runs the client.
Published input binaries include their .NET runtime. Commands run away from both
checkouts. No runtime is added to `sfx-embody`.

To adopt an updated canonical SDA launcher, pass its file explicitly with
`-LocalLauncher` and the existing command directory with `-BinDirectory`.
The source is an installation input: dispatch points to the copied,
digest-addressed launcher rather than to that source path. The old installed
copy is preserved. Reinstalling with the existing authentication wrapper keeps
its current delegate; running `sfx login` alone does not update the launcher.

On a Mac, build for its architecture and place the wrapper directory on PATH:

```sh
dotnet publish tools/sfx-api/login-input/LoginInput.csproj -r osx-arm64 --self-contained true -c Release -o artifacts/cli-login/input
node tools/sfx-api/install-login.mjs \
  --endpoint https://your-identity-host.example \
  --input-directory artifacts/cli-login/input \
  --local-launcher "$(command -v sfx)" --bin "$HOME/.local/bin"
```

Use `osx-x64` for an Intel Mac. Uninstall by restoring the recorded local launcher
and removing only the wrapper launchers; revoke sessions before deleting profiles.

## Verification

```text
node --test tools/sfx-api/auth.test.mjs tools/sfx-api/install-login.test.mjs
dotnet run --project ../sfx-providers/providers/cli-login/tests/LoginProviders.Tests.csproj
```

Thirteen client/installer checks and fourteen provider checks pass. These cover
password flags, endpoint isolation, metadata-only output, storage failure and
revocation, replacement login, offline logout, expiration, no administrator-token
fallback, concurrent mutations, Windows DPAPI and reinstallation through a Windows
directory junction. The macOS adapter contract is tested and its executable is
cross-built; actual Keychain/prompt verification on macOS remains outstanding.

`live-auth-test.mjs` is a test-only client of the real host integration harness.
The harness supplies disposable credentials over a private pipe, never argv or
environment. With `SFX_LOGIN_TEST_PTY_MODULE` pointing to an isolated installation
of Microsoft's `node-pty` 1.1.0, it drives the installed command through Windows
ConPTY and checks password non-echo. This verification dependency is not shipped.

Set `SFX_LOGIN_CLI_TEST_MODULE` to this test module and
`SFX_LOGIN_CLI_TEST_BIN` to the installed bin directory when running the provider
host's existing `--installed` integration mode. The twelve live client checks
pass against real HTTPS, Argon2, generated DAL, identity database and installed
kernel: interactive login/cancellation, secure persistence, shared bearer selection,
installed status/logout, server rejection after revocation, non-TTY/flag refusals
and no private values in output or captured kernel observations.

Identity connection and service credentials stay in the parent host process and
are stripped before CLI launch. `NODE_EXTRA_CA_CERTS` contains only the trusted
local public certificate; TLS validation is never disabled. The provider harness
retains `cli-receipt.json`, `receipt.json` and actual observations under its chosen
evidence directory. No real account or session remains after verification.
