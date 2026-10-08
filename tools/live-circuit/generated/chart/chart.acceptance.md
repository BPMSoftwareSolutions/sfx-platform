# Acceptance pins for component kind "chart"

Contract sha256: `909329ea974e558fc1e769d690b305c7f685dbe61ef80d033702e5e61607284c` (tool-computed over `chart.contract.json`; do not copy this
digest into the estate — the migration pair computes the canonical contract digest).

This is a class (b) policy/registry/shell change: a composite-image deploy with the
full staging acceptance, not a data-only page publish.

- [ ] Merge `chart.adapter.mjs` into `live-circuit/circuit/ui-components.js`
      (`UI_COMPONENT_ROLES` entry + `UI_COMPONENTS["chart"]`).
- [ ] Add `{ "kind": "chart", "version": 1 }` to `circuit-host.json`
      `ui.components` (allowlist; `circuit-host.json:17`).
- [ ] Regenerate the registry copies (K2): the served `uiRegistry`
      (`live-store.mjs:357-382`) and the client `UI_REGISTRY` (`page-runtime.js:22-54`).
- [ ] Reconcile the estate `ui-component.v1` contract seed in the
      `declare-ui-page-reading` pair (`sfx-embody/sql/migrations/declare-ui-page-reading.commit.sql:128-138`)
      so its `roles`/`props` agree with the table both directions.
- [ ] Add the `<kind>.parity.json` section to a `fixtures/pages` page and run
      `node live-circuit/circuit/verify-pages.mjs --fixtures`.
- [ ] Run the K1 conformance harness and the browser sign-in gate (WP0.7).
- [ ] Pins: `deploy/staging/accept.mjs:47-48` route list and
      `live-circuit/circuit/verify-pages.mjs:127-136` registry expectation.
- [ ] `CIRCUIT_FILES` entry only if the adapter ships as a new client module
      (`observe-server.mjs:14-49`); then add the module pin.
