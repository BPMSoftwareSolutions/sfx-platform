# 15 — Provider deployment boundary

Prepared 2026-10-08 as a design specification only: no code, declaration, estate, provider or
workflow file was changed by this document. The originating plan is
[`sidefx-circuit-driven-ui-strategy.md`](../../sidefx-circuit-driven-ui-strategy.md) (SP; proposed
2026-10-08, untracked — A14 R8). References below: A12 =
[`analysis/12-ui-runtime-providers.md`](12-ui-runtime-providers.md); A14 =
[`analysis/14-remaining-work-inventory.md`](14-remaining-work-inventory.md); RB =
[`ui-explorer-region-blueprint.md`](../ui-explorer-region-blueprint.md); loader files:
`live-circuit/dispatch-pair/observe-server.mjs` (observer), `live-circuit/circuit/region-host.mjs`
(server region host), `live-circuit/circuit/region-runtime.js` (browser region runtime); provider:
`sfx-providers/providers/ui-explorer-region/` (README and `ui-explorer-region.mjs`).

This document specifies the boundary SP L54–L79 describes but does not settle. Every normative
statement is a **`[proposal]`**; nothing here is admitted, implemented or declared. SP L66 itself
says its API names are "illustrative; names not yet admitted", and SP L130's unproven list is
marked explicitly in §5. Status for every item below is **not started** — only the baseline in §0
exists.

---

## 0. Baseline: the loader as it exists today

These are observable facts, cited so the proposals in §1–§4 can be read as deltas.

- **One host route performs the provider operation.** `serveRegionApi` (`region-host.mjs:82-99`) is
  reached at `/api/circuit/v1/region` (`region-host.mjs:15`) from `observe-server.mjs:456`; GET
  only, `405` otherwise, `cache-control: no-store`, and statuses map `AUTHORED`→200,
  `UI_REGION_REQUEST_INVALID`→400, `UI_REGION_REQUEST_OVERSIZED`→413, `UI_REGION_UNKNOWN`→404,
  else 503 (`region-host.mjs:84-96`).
- **The binding is a hand-kept map.** `REGION_PROVIDERS` binds `header | left-sidebar | middle |
  right-sidebar` to `ui-explorer-region` and `footer` to `ui-shell-footer`
  (`region-host.mjs:21-27`); an unmapped `regionId` is validated by the header package rather than
  falling through (`region-host.mjs:51-53`).
- **The provider is loaded server-side from a directory.** `SFX_UI_PROVIDER_DIR` is required
  (`region-host.mjs:56-57`); `<dir>/<package>/<package>.mjs` or the flat `<dir>/<package>.mjs`
  (`region-host.mjs:37-45`); the module is ESM-imported and cached by path
  (`region-host.mjs:55-67`); it must export `invoke` and a `ui.region.load` `READ_ONLY` operation
  whose contracts are `ui-region-request.v1` → `ui-region-content.v1` (`region-host.mjs:61-64`).
- **The browser receives projected data, never provider code.** The runtime fetches the host route
  same-origin (`region-runtime.js:54-66`), validates the candidate shape (`:83-120`), recomputes
  every asset and candidate `sha256` digest in the browser (`:125-138`), sanitizes CSS/HTML/SVG
  against closed allowlists (`:25-40`, `:193-207`), and renders named failure states
  (`:260-276`). No provider module or asset is fetched by the browser
  (`observe-server.mjs:40-44`; `prepare-composite.mjs:48-49`; RB §4.4).
- **The package carries identity but is not admitted.** `ui-explorer-region` declares
  `providerId`, `package`, `version: '0.1.0'`, `bindingState: 'UNBOUND'`, readiness
  `REVIEWABLE`/`HELD`, `contractStatus: PROPOSED` (`ui-explorer-region.mjs:14-36`), and a
  `ui-content-manifest.v1`/`explorer.v1` manifest with twelve digested assets (`:10`, `:123-140`).
  Its README states it is not declared in the estate, contracts are `PROPOSED`, bindings `UNBOUND`,
  and browser execution waits on G2 (README lines 9-16, 83-84).
- **Deployment copies one pinned version.** `prepare-composite.mjs:48-55` copies packages under
  `estate/ui-providers`; `Dockerfile.composite:46` sets
  `SFX_UI_PROVIDER_DIR=/opt/sfx/estate/ui-providers`; `staging.yml:87-90` sparse-checks
  `sfx-providers` at pinned ref `a33b442…` (release job) and `:147-154` at `86a30842…` (CLI input
  job). There is no per-slot selection and no admitted generation digest.
- **No provider manifest route exists.** The only served manifest is the shell component registry
  `ui-registry.v1` at `/api/circuit/v1/ui-registry` (`live-store.mjs:406`, `:451`), which is not a
  provider manifest. Nothing serves `/ui-providers/*`.
- **Security control today is server-side isolation only.** The sole `content-security-policy`
  response header in the circuit tree is on the deck-slide SVG route (`observe-server.mjs:468`);
  the session cookie is `HttpOnly; Secure; SameSite=Strict` (`identity-session.mjs:5-6`, `:169`;
  `circuit-host.json:5`), and the browser script never receives the bearer (`login.js:3`). The G2
  `browser-runtime` binding target is not admitted and the request is withdrawn (A12 §5; A14 W9),
  so no browser-loading mechanic is in force.

---

## 1. P1 — versioned provider API

**What exists today.** A provider's identity, version, contracts and asset digests exist only as
module exports (`descriptor`, `contentManifest`, `inputShape`/`outputShape`) and inside the
operation response envelope; no HTTP manifest read exists (§0). The nearest served document,
`ui-registry.v1`, is the shell's component registry, not provider identity. The host address is a
static region→package map, so nothing today can answer "what version of which provider serves this
slot, and with what digests and contracts?" without importing the module.

**What is specified `[proposal]`.**
- A read-only host route `GET /ui-providers/{providerId}/manifest` returns one manifest document.
  The route is served by the shell host, never by provider-specific code in `sfx-platform`
  (SP L60/L79), is same-origin, `no-store`, GET only, and requires no session beyond the page's.
- The document carries:
  - **identity** — `providerId`, `package`, `declarationProfile`, `runtime`, `type`, `method`,
    `executionLocation`;
  - **version** — repo-side semver (`descriptor.version`), `bindingState`, readiness, and the
    admitted generation reference when bound (A12 §4);
  - **digest** — the manifest body's own `sha256:` digest;
  - **contracts** — for every operation: `operationId`, `effect`, input/output contract ids,
    contract status (`PROPOSED`/admitted) and contract digests;
  - **entrypoint** — package-relative module path and operation ids only; the manifest never
    carries executable bytes;
  - **integrity** — per-asset `sha256:` digest and byte count for every declared asset (the
    `ui-content-manifest.v1` data), plus digest algorithm identification.
- The manifest is a projection of the package's own exports plus estate admission data; it is not a
  new source of truth (A12 §9: the package implements contracts, never defines them). Unknown
  `providerId` refuses `404` with a named code, and an unreadable or digest-inconsistent manifest
  refuses with a named code — candidate codes `UI_PROVIDER_UNKNOWN` and
  `UI_PROVIDER_MANIFEST_INVALID` `[proposal]`, deliberately naming no admitted code.
- The manifest route grants no execution authority by itself; it is a read. The SP L67 asset route
  is out of this item's minimum scope and remains `[proposal]`.

**Change surface.** *shell* — implement the route and refusal mapping; no provider-specific branch
(the map plus admitted selection stay data). *provider* — align every package to expose the
manifest projection from existing `descriptor`/`contentManifest` exports; any shape change is a
package version change. *estate* — provider definitions and contract statuses remain declared
data; the manifest must reflect them. *CI* — a parity check that every packaged provider serves a
manifest whose digests recompute, plus pin updates.

**Acceptance evidence `[proposal]`.** A receipt showing the manifest for `sfx-ui-explorer-region`
with all six field groups; digests recomputed independently and equal; unknown provider `404` by
named code; a tampered manifest refused by name; repeat reads byte-stable while the package is
unchanged. No such receipt exists.

**Status.** Not started.

**SP lines satisfied.** L64–L70 (proposed provider API: manifest/identity/digest/contracts/
entrypoint); L9 (providers exposed through a versioned provider API); L118 (generic
manifest/asset-loading boundary, Unit B).

---

## 2. P2 — admission and version selection, with the host-unchanged guarantee

**What exists today.** There is no version selection. Exactly one copy of each package is imported
from `SFX_UI_PROVIDER_DIR` and cached by path; the served version is whatever the pinned
`staging.yml` ref copied into the composite (`staging.yml:87-90`; `prepare-composite.mjs:48-55`);
`ui-explorer-region` is `UNBOUND` with contracts `PROPOSED` (README 9-16). No estate binding, no
generation digest, no per-slot choice and no rollback seam exist; SP L97/L09 is an acceptance
scenario, not a test. A12 §4/§6 define the intended estate mechanics: declaration via
`model.add_provider` / `model.declare_contract` / `model.declare_provider_port_implementation` /
`model.bind_provider`, a generation digest pinning the provider definition for a binding, and
bindings that stay `UNBOUND` until conformance passes. A14 B1 records that estate pair as pending.

**What is specified `[proposal]`.**
- Admission selects a version: a slot resolves through its admitted binding to
  `providerId` + selected version/generation digest; selection is per slot, from admitted
  bindings, and never global "latest" (SP L107: candidate → validate → prove → atomic selection).
- Version selection changes only selection data and the provider package content; it must not
  change shell source, routes, validator, projector or runtime. This is the host-unchanged
  guarantee of SP L97/L09, and the thin-composer guarantee of SP L60/L128.
- Rollback reselects the prior admitted generation; an incompatible provider refuses and leaves
  the prior selection in force — no silent fallback (SP L95, A12 §6 invariants).
- **Acceptance test `[proposal]` (the L09 test).** Fixtures: package `ui-explorer-region` at v1
  and v2 with identical contracts but different declared assets/content, plus an incompatible v3
  (different contract version). Steps and evidence:
  1. serve v1; record every shell file digest, the served region candidate digest and a
     conformance pass;
  2. select v2 through admission; prove the shell file digests are identical, conformance still
     passes, and the served region carries v2's candidate digest/identity;
  3. request v3; prove a named contract refusal and that v2 remains selected;
  4. reselect v1; prove rollback renders the v1 content with no shell delta.
  Evidence is the estate pair preflight/commit and in-transaction proof (A14 B1 convention), a
  shell-digest comparison report, and selection/capture receipts.

**Change surface.** *shell* — read the admitted selection and manifest; no provider-specific code.
*provider* — one package per version, checks unchanged. *estate* — the migration pair declaring
identities, contracts, ports and bindings, with version/generation data (A14 B1). *CI* — the
two-version fixture, the host-unchanged comparison and conformance gate in `checks`, and the
pinned provider ref.

**Acceptance evidence `[proposal]`.** The four-step test above, recorded as a receipt; today A14
R1's local captures prove only the single-version declared-region mount, and A14 F4 notes the
deployment dependency is unproven.

**Status.** Not started (estate half externally gated by the `sfx-embody` lifecycle, A14 E3; G2 is
not an open gate, A14 W9).

**SP lines satisfied.** L97 (L09: new version selected through admission, host unchanged, contract
conforms); L9 and L128 (admitted provider bindings); L107 (atomic change and rollback).

---

## 3. P3 — browser loading security mechanics and the trust boundary

**What exists today.** The proven mechanic is *no browser loading*: provider modules execute only
server-side inside the host process, and the browser receives JSON that it validates, digest-checks
and sanitizes (§0). There is no site-wide CSP, no subresource integrity use, no browser sandbox,
and no content-addressed browser fetch; version pinning exists only as the deploy ref and the
path-keyed module cache. SP L70 requires CSP, integrity checks, isolation and version pinning to be
*proven* for any chosen browser-loading mechanic before remote modules are trusted; no
`browser-runtime` binding target is admitted (A12 §5) and the G2 request is withdrawn (A14 W9).

**What is specified `[proposal]` (only if browser loading is ever admitted).**
- **Trust boundary.** Trusted: the host shell, admitted declarations and the selected admitted
  binding. Untrusted: provider package bytes, manifest fields until digest-verified, and any
  browser-delivered asset. Provider implementations never become kernel authority (SP L62), and
  authorization/credentials remain outside arbitrary UI assets (SP L70); the session bearer stays
  in the `HttpOnly` cookie (`identity-session.mjs:5-6`) and never enters provider content.
- **CSP.** A strict host-page policy that provider content cannot widen: no script, no inline
  handlers/styles beyond the declared mechanism, no fetch/connect beyond same-origin host routes;
  any provider script must be hash/nonce-allowlisted, and the policy must fail closed. The only CSP
  header today is scoped to the deck-slide SVG (`observe-server.mjs:468`), so a site-wide policy
  would be new.
- **Integrity.** Every provider asset is fetched with the manifest's `sha256:` digest and verified
  before use; any mismatch is a named refusal with no execution and no partial render; unverified
  bytes are never interpreted. (The browser already recomputes digests for host-projected content,
  `region-runtime.js:125-138`; the proposal extends this to any directly fetched asset.)
- **Isolation.** Provider code runs only behind the host boundary with no ambient authority — no
  session, credential, kernel or network authority beyond the admitted operation; if a browser
  compartment is used it holds no token and cannot address the governed invocation path.
- **Version pinning.** Assets are immutable and content-addressed; a selection pins the admitted
  generation; caches may not satisfy a pinned digest with different bytes; there is no floating
  latest.

**Change surface.** *shell* — CSP/headers, integrity verification, isolation boundary, pin
enforcement; *provider* — content that survives the allowlists and carries no executable authority;
*estate* — admitted contracts selecting the mechanic; *CI* — negative security fixtures and a
browser gate that does not exist yet (A14 F3: `verify-regions-browser.mjs` is not wired into
`staging.yml`).

**Acceptance evidence `[proposal]`.** Named refusals for a tampered asset digest, a
version/generation mismatch, a CSP-forbidden construct, an undeclared entrypoint and an attempted
authority fetch; proof that served provider assets carry no credential; a browser-gate receipt
under an admitted browser binding. Today only local, gitignored captures exist.

**Status.** Not started; every element of this section is explicitly unproven (SP L130 "UI
loading/security mechanics").

**SP lines satisfied.** L70 (CSP, integrity, isolation, version pinning must be proven; credentials
outside UI assets); L128 (no arbitrary remote-code authority); L130 (unproven marker).

---

## 4. P4 — package boundaries, independent versioning and release independence

**What exists today.** Provider code lives only in the `sfx-providers` repository, one package
directory per provider (`ui-explorer-region`, `ui-shell-footer`, `ui-runtime-token-set`, …), with
its own dependency-free test (`README` §Check). `sfx-platform` holds no provider-specific region
implementation; it consumes packages through `SFX_UI_PROVIDER_DIR` and the composite copy
(`prepare-composite.mjs:48-55`). Independence is partial: repo-side semver exists
(`ui-explorer-region.mjs:18`), but every platform release re-pins one provider ref
(`staging.yml:88`) and repackages the tree, and A12 §3's five-package split plus umbrella is
`[proposal]` with boundaries deferred to G2 (A12 §8). A12 §4 states the rule that a package version
bump and a provider-definition change are the same act when bound, so version and generation
digest must move together.

**What is specified `[proposal]`.**
- One package per independently versioned provider concern; semantic contracts remain estate data;
  package semver and the admitted generation digest move together when the provider is bound
  (A12 §4/§9).
- Independence rules: a patch/minor provider release changes only that package and never shell
  source, another provider's version or a declaration; a contract change is a declaration revision
  and a new admission; a platform release may carry any admitted provider version and is pinned by
  digest.
- Providers remain independently testable without platform or estate: each package's own check runs
  with plain `node` (`node --test tests/ui-explorer-region.test.mjs`).
- **Release-independence test `[proposal]`.** Package vX and vX+1 both pass their own checks and
  host conformance; swapping the packaged version requires no shell diff; an incompatible contract
  version refuses by name. Evidence: per-version check output, composite inventory digests, an
  empty host diff for the version swap, and the refusal fixture.

**Change surface.** *shell* — pins and packaging only, no code; *provider* — package layout,
checks, release refs; *estate* — versions and digests as declaration data; *CI* — per-package
checks, digest inventory, version-swap drill.

**Acceptance evidence `[proposal]`.** The release-independence test above; today A14 B3 records
1 of 6 A12 packages done and the composite packaging proves digest inventory
(`verify-composite-package.mjs:77`), but no independent version train exists.

**Status.** Not started (each further package is externally paced by deploys, A14 B3).

**SP lines satisfied.** L103 (each UI provider independently packaged and tested; no
provider-specific implementation retained in `sfx-platform`); L56 (ownership split); L9
(`sfx-providers` ownership); L118 (extraction without changing the promised experience); L130
(exact package boundaries unproven).

---

## 5. SP L130 — unproven items, marked explicitly

SP L130 lists seven items that must not be represented as admitted or implemented. All seven remain
unproven today; the ones this document touches are candidates only, not settlements:

| L130 item | State | Relation to this document |
| --- | --- | --- |
| Existing vocabulary alignment | **unproven** | Out of scope; region/port role names remain `[proposal]` (SP L26). |
| Precise provider API contract | **unproven** | P1 specifies a candidate manifest route/shape only; names are not admitted (SP L66). |
| Exact package boundaries | **unproven** | P4 states independence rules; A12's five-package split stays `[proposal]` (A12 §8). |
| UI loading/security mechanics | **unproven** | P3 states requirements only; no browser binding is admitted (A14 W9). |
| Four-region conformance | **unproven in staging** | Local captures only (A14 §1, R1; F3/F4); out of scope here. |
| Performance budgets | **unproven** | No measured landing/provider-load budget exists (SP L108); out of scope. |
| Live operation-level telemetry coverage | **unproven** | Unit D (SP L122) has no evidence in this document; out of scope. |

Additionally, this document's P1–P4 items are themselves unproven proposals: status is not started
for each. The only facts asserted are the baseline citations in §0.
