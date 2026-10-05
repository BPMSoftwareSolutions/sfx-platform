# Local Live Circuit development stack

From this repository, run:

```text
node tools/live-circuit/start-local.mjs <built-SDA-API-dist/src-directory> <estate-directory> <identity-origin> [observer-port=8788] [api-port=8799]
```

Supply a previously built API (its `config.js`, `server.js`, `supervisor.js` and
associated authority files must be present), and an estate whose `sfx.config.json`
selects an admitted installed kernel. This tool does not build SDA or change its
source, the estate configuration, the database, or Azure. It has no embedded
checkout paths and is not part of the staging image.

Use the staging HTTPS origin to sign in through staging's real identity API, or
an explicitly configured local identity host. View the circuit on **localhost**;
the browser session uses a Secure cookie. The port defaults avoid the established
8787 observer. Occupied or equal ports are refused without stopping their owners.

The launcher creates a random machine token for these two child processes only,
keeps it out of logs and kernel children, and waits for observer/API readiness.
Ctrl+C or either child exiting stops this stack's owned processes. Windows uses
the owned process trees so an executing kernel cannot be left behind. No existing
CLI profile or machine credential is changed.

`PROCEDURE_EXTRACT_ENDPOINT`, if set by the operator, is inherited by the observer.
A remote authenticated retrieval endpoint needs its own credential configuration;
this stack's ephemeral machine token is valid only for its local Run API. Use a
local retrieval service for full provider inspection, or the hosted circuit.

The sign-in gate remains enabled. Signing in is separate from accepting local
Observe: use a real contract payload, watch the run while live and retain its
actual graph, outcome, provider visits and timestamps. API readiness alone does
not prove a capability executes.
