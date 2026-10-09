# Landing circuit acceptance — 2026-10-09

The installed `ui-page-landing` circuit completed through the local Run API at
`http://localhost:8788` while its declared HTTPS exchanges called the hosted
`https://sfx-ui-providers.azurewebsites.net` providers.

```json
{"contractId":"ui-page-request.v1","payload":{"path":"/circuit/explorer"}}
```

Run `03fdc8c6-147d-474b-9d35-f1da0377b8f1` ended at
`2026-10-09T19:14:06.096Z`: `READ`, exit 0, 5.15 seconds, 364 cell and
363 edge observations. The browser showed the four root child calls and their
ports as observed. `local-api-run.png` records that result. This local API has
no durable evidence store configured; its run link lasts only while retained.

The earlier installed-kernel capture retained here is a separate invocation:
`sfx-observer:7f4245ec71934cca939587a8:74927`, started at
`2026-10-09T18:52:10.2333286Z`. `scene.json` is the database scene used to
project it. The capture supplies actual graph and receipt data for the
regression; it is not represented as the later browser run.

The header, left, middle, right and footer circuits returned `AUTHORED`, the
provider drill-down returned `READ`, and landing returned `READ`. Each of the
six provider exchange cells completed. The root output contains the declared
page and layout, not an aggregate of the providers' response bodies. A root
`READ` alone is not evidence that all child providers succeeded.

## Receipt join repaired

Composed scenario cells have no parent cell in this captured graph. Their
declared return edges identify the owning `invoke-scenario` operation. The
Explorer now uses that exact relationship to locate live activity and joins
the child's return receipt to its admitted return edge before lighting the
completed call. Missing, ambiguous or mismatched evidence remains a named
diagnostic; it does not count as a successful call.

`verify-scenario-return.mjs` checks all four calls, live activity before return,
and 32 negative cases against altered copies of this capture. The gate is
offline, deterministic and independent of other offline gates. Its copies are
never sent to a live observer.

## Release scope

This platform release carries the receipt join and its regression evidence.
The installed SQL declaration pairs are recorded in `sfx-embody`. The hosted
provider API was deployed from `sfx-providers` commit `9703942` before acceptance.

The unfinished platform provider-selection, packaging and browser-loader edits
are not part of this release. The current release still uses its existing
pinned region packages to render Explorer; the invoked estate circuit calls
Azure. Converting the platform into the full hosted browser-provider consumer
remains a separate Stage B change. This acceptance does not claim that change
or staging acceptance has passed.
