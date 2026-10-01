# sfx-api

Command-line access to the SDA Run API. The installed client submits a capability
invocation, waits for the remote result and prints its JSON.

See [sfx-api wrapper architecture](../../docs/sfx-api-wrapper-architecture.md)
for topology, responsibilities, installation, authentication, trace handling,
failure recovery and verified behavior.

```powershell
sfx-api capability observe request-capability-from-objective-v3 --input "What is Broadcom's current market price?" --json --trace
```
