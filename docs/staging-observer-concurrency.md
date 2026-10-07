# Staging external-follow deployment failure

Failed workflow: [37544368654](https://github.com/BPMSoftwareSolutions/sfx-platform/actions/runs/37544368654), source `586dafd0345d2ebf7b9146129c30a571fffb87e1`.

The composite image built and passed public reads, browser sign-in/Observe,
captured replay, restart and same-owner durable reopening. External API command
`ffafc303-b928-4dad-8903-98d2b1b73b4e` returned `ADMITTED`, but its anonymous
external-follow viewer never painted the outcome. The release was rejected and
the previous exact image was restored.

## Evidence and cause

The workflow's `staging-release` artifact contains `external/capture.sse`,
`external/receipt.json`, `external/external.png`, and the separately attributed
API trace under `api-traces/`. The observer stream records:

| Sequence | Event |
| --- | --- |
| 461 | API run-start, PID 273, API run ID above |
| 467 | `graph:request-capability-from-objective-v3` |
| 1015 | Concurrent native run-start, PID 294 |
| 1043 | `graph:authenticate-ide-user` |
| 1804 | Native run-end, PID 294 |
| 2813 | API run-end, exit 0, original API run ID |

The API bridge retained `apiRunId` only on boundaries. Its observation frames
lost invocation attribution. Both the observer's scoped replay and the viewer
used a single latest run/window; interleaved sign-in events therefore replaced
the current run. The viewer correctly held the resulting ambiguous capture.
The external acceptance sampler also used a single current graph/open flag.
The capability's execution and SQL retention were not the failing gates.

## Repair

Both API bridge entrypoints put `runId: sda-api:<API run ID>` on every observer
envelope. Kernel testimony stays verbatim, including any payload fields named
`runId`. This is transport correlation, not verified executor attribution or a
trust verdict. The observer preserves the envelope ID and scopes replay by it.
The viewer accumulates matching frames per invocation; unattributed native runs
use a separate legacy window, with unresolved overlap still held. A missing
start never borrows another run. The release sampler follows the selected run's
identity and requires that run to end and its exact outcome to be painted.

No kernel, capability declaration, provider, database policy, outcome rule, or
linear-view default changes.

## Regression checks

- `deploy/sda-kernel/verify-observer-bridge.mjs`: packaged and local entrypoints,
  overlapping fixture supervisors, identical graph/cell identities, every frame
  attributed, testimony unchanged. Runs in the staging checks job.
- `live-circuit/dispatch-pair/verify-run-scoped-sse.mjs`: two attributed
  invocations of the same graph plus an untagged native run; live delivery,
  next/current replay, exact boundaries, missing-start refusal, duplicate ID
  held, unattributed overlap held. Runs in the staging checks job.
- `live-circuit/circuit/verify-run-evidence-browser.mjs`: retained real receipts
  inside explicit fixture envelopes, with an overlapping native graph; browser
  still paints `ADMITTED` with all operation rows in external-follow mode.
  Existing 401, 404, 503, evidence, history and replay controls also pass. Runs
  before the workflow binds a candidate image.
- Local release policy, composite packaging, identity-session and run-API
  checks pass. These fixture checks are not claims of a fresh live invocation.

The normal staging workflow remains the only deployment path; real-host gates
and the accepted-image receipt are required before calling the repair deployed.
