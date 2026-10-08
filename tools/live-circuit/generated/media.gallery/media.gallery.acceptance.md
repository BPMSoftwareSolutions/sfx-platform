# Acceptance pins for component kind "media.gallery"

Contract sha256: `ebae29cacba7a4726ac94b64539c0fe25434a5f32d7e92a610242c5107e6bb60` (tool-computed over `media.gallery.contract.json`; do not copy this
digest into the estate — the migration pair computes the canonical contract digest).

This is a class (b) policy/registry/shell change: a composite-image deploy with the
full staging acceptance, not a data-only page publish.

- [ ] Merge `media.gallery.adapter.mjs` into `live-circuit/circuit/ui-components.js`
      (`UI_COMPONENT_ROLES` entry + `UI_COMPONENTS["media.gallery"]`).
- [ ] Add `{ "kind": "media.gallery", "version": 1 }` to `circuit-host.json`
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
