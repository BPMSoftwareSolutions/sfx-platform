# Capability command API

An HTTP transport over the `sfx` SDK. It runs **beside** the web process and owns the database
boundary, so the website keeps its §11.1 invariant: the web process opens no database
connection, embeds no runtime and holds no credential.

## The surface

One route. `object`, `operation` and `subject` are data on the envelope, never path segments or
branches — `sidefx-cli`'s Entity Neutrality Law observed literally. Adding a capability, verb or
provider to the estate changes nothing here.

```
GET  /healthz    liveness
GET  /commands   the command surface, read from the project's command mapping
POST /commands   { object, operation, subject, namespace?, input? }
```

```bash
curl -X POST http://127.0.0.1:8787/commands -H 'content-type: application/json' -d '{
  "object": "capability",
  "operation": "invoke",
  "subject": "resolve-sidefx-eligible-providers",
  "input": { "contractId": "sidefx-provider-resolution-request.v1" }
}'
```

A successful command returns `{ result, durationMs }`. An estate refusal returns
`{ error: { code, message, details } }` with the estate's own code intact —
`CAPABILITY_PREPARATION_REQUIRED`, `CAPABILITY_PREPARATION_STALE`, `CAPABILITY_NOT_FOUND` —
because a refusal is a real answer about that capability, not a transport failure. A domain
rejection is carried through as a completed command whose kernel disposition is `rejected`.

## Running it

The service resolves its command mapping and process bindings from an `sfx` project — the
`sfx-embody` workspace, which owns the database delivery, its credential reference and the
integrity checks. This service adds no provider implementation of its own.

```bash
npm install
SIDEFX_PROJECT_DIR=../../../sfx-embody npm start
```

| Variable | Purpose |
| --- | --- |
| `SIDEFX_PROJECT_DIR` | Project whose `sfx.config.json` declares the process bindings |
| `SIDEFX_PROJECT_CONFIG` | Explicit config path, when it is not the project default |
| `PORT` / `HOST` | Listen address (default `8787`, `0.0.0.0`) |
| `SIDEFX_COMMAND_TIMEOUT_MS` | Bound on one estate command (default 600000) |
| `SIDEFX_MAX_CONCURRENT` | Commands in flight; each holds a connection and a runtime (default 2) |
| `SIDEFX_MAX_BODY_BYTES` | Request body cap (default 1 MiB) |

The database connection string is resolved by the estate workspace's own reader, from its
existing environment reference. It is never passed through this service, and never appears in a
request, a response or a log line here.

## What it is not

This is a transport. It performs no capability-specific dispatch, interprets no canonical input
and owns no admission policy — the estate owns all of that. It does not make a capability
executable: preparation does, and a capability without one is reported as requiring it.
