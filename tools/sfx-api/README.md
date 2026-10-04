# sfx-api

The wrapper also supplies `sfx login`, `sfx whoami`, and `sfx logout`.
See [CLI login client](../../docs/cli-login-client.md) for source, secure session
storage, installation, live verification and remaining Azure/authorization work.
Local `sfx capability` commands still use the existing local launcher.

`sfx-api enroll --endpoint <HTTPS origin> --username <identifier> --json`
enrolls through the real observed circuit using hidden password confirmation and
the operator's existing machine API credential. See
[IDE enrollment](../../deploy/sda-kernel/identity-enrollment.md).

Command-line access to the SDA Run API. The installed client submits a capability
invocation, waits for the remote result and prints its JSON.

See [sfx-api wrapper architecture](../../docs/sfx-api-wrapper-architecture.md)
for topology, responsibilities, installation, authentication, trace handling,
failure recovery and verified behavior.

```powershell
sfx-api capability observe request-capability-from-objective-v3 --input "What is Broadcom's current market price?" --json --trace
```
