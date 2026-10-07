# 07 — Kind and reader tooling for Phase 1 class (b) deploys

R&D lane 1 for the SFX website evolution. Research only: no product code changed, no commit made.
Reviewed 2026-10-07 against HEAD `bcf1e52` ("Render the declared component contract roles") and the
files named in the lane brief. Strategy references are to
[`implementation-strategy.md`](../implementation-strategy.md) Revision 3. Everything marked
`[proposal]` is design, not observable behaviour; every claim about current behaviour cites
`path:line`.

Question: what would make adding a new UI component kind (strategy §4.2, §4.3) and a new declared
data source/reader (strategy §4.6 class (b), §7.2, §9) an easy, low-risk operation rather than a
hand-built deploy? Preference: plain-`node` generators and verify scripts, no frameworks.

---

## 1. What exists, and where it drifts

**Component adapters.** Ten adapters ship in `live-circuit/circuit/ui-components.js:447-498`, each
with a hand-written `supportedRoles` array (`:450,455,460,465,470,475,480,485,490,495`). The client
validator reads that array to refuse unsupported props/bindings
(`live-circuit/circuit/page-runtime.js:142-170`; lookup `:145`, `id` exemption `:147,151`). The
server-side page validator checks component kind and version and binding source names but **not
roles** (`live-circuit/circuit/live-store.mjs:247-266`), so a role mismatch that passes the client
list becomes a client refusal or a silent drop, never a `422` at read time.

**The role-vocabulary defect, both faces.** HEAD fixed the first face: adapters had declared
internal prop names instead of the `ui-component.v1` role vocabulary, so most home sections refused
at render (commit `bcf1e52`). The second face remains: `supportedRoles` is a parallel, hand-kept
list that neither proves every declared role is consumed nor that every consumed role is declared.
Concrete drifts at HEAD:

- `text` lists the *values* of `TEXT_ROLES` as roles alongside `role`/`text`
  (`ui-components.js:10,460`): a declaration `props: { display: … }` validates but renders nothing
  (`renderText` reads only `props.role`/`text`, `:256-260`).
- `card-list` lists `catalogSourceId` (`:480`) which no renderer reads (`renderCardList`
  `:338-348`).
- `notice` lists `action` (`:495`) but the renderer reads `actionId` (`:412-433`).

The estate seeds carry the same drift: the `ui-component.v1` contracts at
`sfx-embody/sql/migrations/declare-ui-page-reading.commit.sql:128-138` have `roles` that disagree
with their own `props` (`text` roles are role values `:131`; `heading` roles omit `text` `:132`;
`card-list` roles omit `title`/`catalogSourceId` `:135`; `list` roles omit `empty` `:136`; `notice`
roles say `action` while props say `actionId` `:138`).

**Registry copies.** The deployed registry exists as a hand-synced set of copies:
`circuit-host.json:17` (`ui.components`, the validator allowlist), `live-store.mjs:357-382`
(`uiRegistry`, served at `/api/circuit/v1/ui-registry`, `:392`), `page-runtime.js:22-54` (the
embedded client copy; nothing fetches the served manifest from `page.js`), plus hand-written
expectations in `verify-pages.mjs:19-20` and pins in `deploy/staging/accept.mjs:47-48`. The served
manifest also lacks per-component `roles`/`states`, so it does not yet match the schema example in
strategy §7.2 lines 667-685.

**Serving, fixtures, acceptance.** The generic route host is `observe-server.mjs:489-495` with
reserved slugs `:53-54`; client modules are the hand-maintained `CIRCUIT_FILES` map `:14-49`. The
file-backed page source is `live-store.mjs:279-293` (env `SFX_PAGE_FIXTURE_DIR`), started by
`verify-pages.mjs:64-87`. Fixtures are hand-written JSON (`fixtures/pages/home.json:1`,
`unknown-component.json:18-20`). `verify-pages.mjs` hard-codes the expected registry `:19-20`,
checks it `:127-136`, drives refusals `:148-159` and source safety `:179-193`. `accept.mjs` pins
the four page modules `:47-48` and checks registry/page/digest paths `:82-96`. The failure the
pins exist for — a client module missing from the map (`:47`) — is recorded in strategy §2.1
lines 117-120.

**The estate reader pattern.** `declare-ui-page-reading.commit.sql` is the one worked example of a
declared reader pair: schema and content tables `:73-115`, seed layout/component contracts/home
revision `:118-223`, the single-value `analysis.read_ui_page_document` `:227-299`, writer mechanics
`stage/promote/rollback` `:306-399`, the `read-ui-page` capability with contracts and one root
terminal scenario `:402-473`, the port binding to `sda-embodiment-plan-port.v1` /
`sda-declared-read-graph-provider.v1` `:474-528`, and the in-transaction proof
`:530-682`. `circuit-host.json:18-23` registers readers; `live-store.mjs:267-302` is the platform
read/refusal shape; `:388-394` is the route dispatch. Kernel-invoked readers need no `sfx-dal`
registration, no `retrieval-policy.json` entry and no gateway change: the gateway already proxies
`/api/circuit/*` and 405s everything but the three admitted POSTs
(`deploy/sda-kernel/gateway.mjs:157-164`; strategy §7.3, §7.4).

**Observed gap.** The WP0 publish receipts name tool `publish-ui-page`
(`docs/sfx-website-product-evolution/evidence/WP0-publish-rev3.json:2`), but no file matching that
tool exists at HEAD. Whatever the Phase 1 reader gate consumes (the registry manifest) must be
produced by a checked-in orchestrator; `[proposal]` check the publisher in or name its location
before Phase 1 acceptance depends on it.

---

## 2. What to build, in order

Ordering rule: K1 is the correctness foundation and changes no declaration semantics; K2 removes
registry drift; K3/K4 turn kind/fixture additions into generated checklists; K5 is the reader
scaffold and depends on K2/K4 outputs. Each item states its acceptance evidence. All tools are
`[proposal]` plain-`node` scripts, runnable as `node <script>.mjs`, matching the `verify-*.mjs`
convention (`AGENTS.md`).

### K1 — Role table + adapter conformance harness

**Build.** Refactor every adapter in `ui-components.js` to export a single `roles` table, e.g.
`roles: { eyebrow: { via: 'prop' }, figure: { via: 'binding' }, … }`, and make every render read go
through a runtime helper that resolves a role *by table lookup* (`declared`/`bindingValue` become
table-driven; no literal role strings in render code). `supportedRoles` is deleted; the validator
(`page-runtime.js:145`) uses `Object.keys(adapter.roles)`. Treat `id` as an explicit standard role
in the table instead of the `:147,151` special case. Add `live-circuit/circuit/verify-components.mjs`
`[proposal]`:

1. **Contract parity, both directions.** For each adapter, its role set equals the role keys of its
   `ui-component.v1` contract, and every contract prop/binding name has a role entry.
2. **Consumption probes.** Render each role with a unique sentinel value and assert the sentinel
   reaches the output (or, for action roles, a control/link wraps it). This makes
   `catalogSourceId`/`action`-style silent drops fail.
3. **Negative probe.** A declaration with a key outside the table refuses
   `UI_COMPONENT_ROLE_UNSUPPORTED`; no unknown key can validate.
4. **Source check.** Adapters contain no role string reads outside the table.

A DOM is needed only for the probes; the repo has no DOM in Node, so the harness carries a tiny
in-file DOM shim `[proposal]`, with the existing browser gate as the DOM-execution backstop
(WP0.7, strategy §9.2). Extend the server validator from the generated manifest (K2) so the
same refusal becomes `422` at read time (`live-store.mjs:247-266`).

**Acceptance evidence.** `verify-components.mjs` JSON receipt; `verify-pages.mjs` and the browser
gate stay green; the ten contract seeds at `declare-ui-page-reading.commit.sql:128-138` are
reconciled to the tables and re-proven by the estate pair. This is the WP0.2 refusal gate extended,
not a new gate.

**Effort.** S — 1-2 days. **Risk.** Low; behaviour-preserving, but touches all ten adapters, so
re-run `verify-pages --fixtures` and the browser sign-in gate before the deploy.

### K2 — Generated registry manifest + parity verifier

**Build.** One generator, `live-circuit/circuit/generate-registry.mjs` `[proposal]`, with inputs
`circuit-host.json` `ui.components`/`readers` plus the adapter role tables (K1). It emits a static
data module `live-circuit/circuit/ui-registry.generated.mjs` (exported object, no logic) and a
publisher copy `deploy/sda-kernel/ui-registry.json`. `page-runtime.js:22-54` and
`live-store.mjs:357-382` import/derive from the generated artifact, and the served manifest gains
per-component `roles`/`states` per strategy §7.2:667-685. `verify-registry.mjs --check`
`[proposal]` asserts: generated artifact == `circuit-host.json:17` == served
`/api/circuit/v1/ui-registry` == `accept.mjs` pins == `verify-pages.mjs:19-20`; drift is a failed
gate, not a stale copy. (Component contract digests stay absent from the shell manifest by design,
`live-store.mjs:354-356`.)

**Acceptance evidence.** A `registry-parity` group in `verify-pages.mjs`; `accept.mjs public`
compares the served manifest to the generated file (minus digests) and fails on any component or
source not in both; `--check` fails when a kind is added to one copy only.

**Effort.** S — ~1 day. **Risk.** Low; the only genuine decision is which copy is canonical
(proposed: `circuit-host.json` + adapter tables, generated outward).

### K3 — Component-kind scaffolder

**Build.** `tools/live-circuit/new-component.mjs` `[proposal]`: input a kind name, version and
role spec, output (a) the `ui-component.v1` contract JSON, (b) an adapter stub whose render reads
through the K1 role table, (c) the estate seed row text for the migration pair, (d) a golden
fixture page section, and (e) a class (b) checklist (`deploy/ui-kind-<kind>.json`) naming the
allowlist entry (`circuit-host.json:17`), registry regeneration (K2), `CIRCUIT_FILES` entry only
if a new module (`observe-server.mjs:14-49`), accept pin (`accept.mjs:47-48`), and
`verify-pages.mjs:19-20` expectation. A `--check` mode regenerates the ten shipped kinds and
requires byte equality with the shipped contracts and allowlist.

**Acceptance evidence.** `--check` exits 0 at HEAD; scaffolding a scratch kind and running
`verify-components.mjs` plus `verify-pages.mjs --fixtures` is green with no deploy; the checklist
is the recorded class (b) surface for the real Phase 1 kinds (`table`, `field-list`,
`disclosure`, `badge`, `status-chip`; strategy §4.2:233-239, B.1:1017-1018).

**Effort.** M — 2-3 days. **Risk.** Medium: templates drift from estate authoring conventions;
`--check` against the existing pair is the mitigation.

### K4 — Fixture and acceptance-pin generation

**Build.** `tools/live-circuit/pin-pages.mjs` `[proposal]`: `--from <base> <path>` fetches a served
page, normalizes volatile fields (`readAt`), and writes `fixtures/pages/<slug>.json` for
`SFX_PAGE_FIXTURE_DIR` (`live-store.mjs:279-293`); `--manifest` regenerates
`deploy/staging/accept-manifest.json` from `CIRCUIT_FILES` and the reserved slug set
(`observe-server.mjs:14-49,53-54`) plus expected refusals, and `accept.mjs` iterates the manifest
instead of the hard-coded pins at `:47-48`. `--check` fails when a module or refusal fixture exists
without a pin — the exact failure class of strategy §2.1:117-120.

**Acceptance evidence.** `accept.mjs public` produces the same receipt from the generated manifest;
`--check` fails on an intentionally removed pin during the drill; fixture files captured from the
staging reader match `verify-pages.mjs --fixtures` expectations.

**Effort.** S — 0.5-1 day. **Risk.** Low; fixtures remain regression aids, never acceptance
evidence.

### K5 — Reader-declaration scaffolder

**Build.** `tools/live-circuit/new-reader.mjs` `[proposal]` plus an `sfx-embody` pair template.
Input spec: `{ sourceId, reader, route, requestContract, outputContract, procedure, statuses }`.
Outputs:

1. **Estate pair skeleton** modeled on `declare-ui-page-reading.commit.sql`: content table DDL
   `:73-115`, the single-value reader `:227-299`, refusal status vocabulary (THROWs for invalid
   input like `:241-254`), capability document with contracts and one root terminal scenario
   `:402-473`, port binding `:474-528`, grant, and an in-transaction proof skeleton `:530-682`.
2. **Reader entry** in `circuit-host.json:18-23` (`operation`, `request`, `inputContractId`,
   `outputContractId`).
3. **Route and read function** following `readPage`/`readCapabilityDetails`
   (`live-store.mjs:267-302`) and the dispatch branch `:388-394`, including the payload whitelist,
   GET-only rule and refusal map; source row in the generated registry (K2) and the
   `live-store.mjs:241` source set.
4. **Fixture + pin** via K4; a `verify-reader.mjs` stub asserting `contractId` equality
   (`live-store.mjs:44,156` pattern is the server-side check), refusal statuses, and the
   GET/405 route policy (`gateway.mjs:157-164`).

The scaffolder refuses any spec that names a non-GET route, a method, a header or a credential —
the same rule as strategy §4.4:295.

**One-time vs per-reader costs.**

| Cost | One-time (paid in Phase 0 / K1-K4) | Per reader |
| --- | --- | --- |
| Estate | pair conventions, `sidefx_ui` schema, capability/port/proof pattern, seeds | one migration pair generated from the spec + hand-owned in-transaction proof; no `sfx-dal`, no retrieval policy (strategy §7.3:693-707, §7.4:709-720) |
| Platform | route host, manifest, publish gate, conformance harness, fixtures | reader entry, read function/route, registry regeneration, acceptance pin: ~30-80 generated lines |
| Client | `page-runtime.js`, `ui-components.js`, `page.js` | none unless a payload transform module is added; then `CIRCUIT_FILES` + pin (class (a)) |
| Gate | full staging acceptance machinery | one `verify-pages`/`verify-reader` run + one publish drill |

**Acceptance evidence.** Scaffold a throwaway `standards-crosswalk` reader: the pair's
in-transaction proof passes (the `:530-682` pattern); `verify-pages.mjs --fixtures` renders a page
binding the new source; `accept.mjs public` has the new route pinned; WP1.x receipt per strategy
§9.2:821 and Phase 1 exit (`:894-896`). `--check` reproduces the `page`/`scenario`/`details`
reader entries from the template.

**Effort.** L — 3-5 days for the scaffolder; each subsequent reader then ~0.5-1 day plus review.
**Risk.** Medium-high: the estate half is where meaning and proof live; the generator must emit
reviewable skeletons and never evidence, and the in-transaction proof stays hand-owned.

---

## 3. Effort and risk summary

| Item | Effort | Risk | Main failure mode |
| --- | --- | --- | --- |
| K1 role table + conformance harness | S, 1-2 d | Low | Adapter churn; caught by `verify-pages` + browser gate |
| K2 registry generation + parity | S, 1 d | Low | Choosing the wrong canonical copy; parity check makes it visible |
| K3 kind scaffolder | M, 2-3 d | Medium | Template drift from estate conventions; `--check` |
| K4 fixture/pin generation | S, 0.5-1 d | Low | Fixtures mistaken for evidence; keep them regression-only |
| K5 reader scaffolder | L, 3-5 d | Med-high | SQL/proof templating; hand-owned proof, generated skeleton |

Phase 1's class (b) deploy is one K3 run for five kinds plus one K5 run for the crosswalk reader;
the deploy itself remains the existing full staging acceptance (strategy §4.6:330-333).

## 4. The one design rule

**A component kind's roles exist only as keys of the adapter's exported role table, and every prop
or binding the adapter reads is accessed through that table; the `ui-component.v1` contract, the
registry manifest, the client and server validators, the fixture generator and the publish gate are
all derived from it.**

This makes the role-vocabulary defect unrepresentable in both directions: a contract role the
adapter does not consume cannot be generated, and a role the adapter consumes cannot be missing
from the contract (the table is the only access path), so no declaration can validate and then
silently drop — the defect class of `ui-components.js:460,480,495` versus `:256-260,338-348,412-433`
and of `declare-ui-page-reading.commit.sql:131-138`. The `id` special case
(`page-runtime.js:147,151`) becomes an ordinary table entry rather than an exception.
