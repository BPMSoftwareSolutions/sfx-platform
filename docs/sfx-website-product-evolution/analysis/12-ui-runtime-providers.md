# 12 — UI runtime provider family: five browser concerns, packages, versions and the G2 migration

Lane B design for the SFX website evolution, 2026-10-07. Design and scaffold only: the reference
implementation lives in `sfx-providers/providers/ui-runtime-token-set/` and its check in
`sfx-providers/tests/ui-runtime-token-set.test.mjs`; no sfx-platform code changed, no commit made.
Strategy references are to [`implementation-strategy.md`](../implementation-strategy.md) Revision 3;
kind/reader references are to [`analysis/07`](07-kind-and-reader-tooling.md). Everything marked
`[proposal]` is design, not observable behaviour.

Question: how do the five browser concerns of the shipped shell — component kinds/renderers,
adapter behaviour, component contract roles, token sets and action dispatch — become provider
packages under `sfx-providers/providers/`, what versions do they carry, and how do the shipped
shell adapters migrate onto them without changing contracts once gate G2 lands?

---

## 1. Status and scope

- v1 (strategy §4.0 D2) ships all five concerns as shell code: kinds and renderers in
  `live-circuit/circuit/ui-components.js`, adapter and validator behaviour in `page-runtime.js`,
  roles derived from the `ui-component.v1` contracts, tokens in `live-circuit/circuit/site.css`,
  action dispatch mapped onto existing seams by `dispatchClass` (strategy §4.4).
- The north-star home is `sfx-providers/providers/ui-page-runtime/` (strategy §7.6), with the
  uniform module contract pattern (`altitude-01/altitude-01.mjs:4-41`, `:72-111`;
  `circuit-presentation.mjs:5-25`).
- This lane resolves that home into five sibling packages, one per concern, plus the umbrella
  composite that arrives only when G2 admits multi-child composition. It implements the smallest
  concern first — token sets — because it needs no browser execution and no DOM.
- Nothing here is declared in the estate. Contracts are `PROPOSED`, provider bindings are
  `UNBOUND`, and SDA behaviour is untouched: a browser binding target is a request to
  `scenario-driven-architecture` (strategy §7.5; `analysis/03-ui-capability-providers.md:225-248`).

---

## 2. The uniform module contract `[proposal]`

Every ui-runtime package exports the same three members, plus shape metadata for estate
declaration:

| export | fields | purpose |
| --- | --- | --- |
| `descriptor` | `moduleContractId: ui-runtime-provider.v1`, `providerId`, `package`, `version`, `runtime`, `type`, `method`, `executionLocation`, `declarationProfile`, `nativeShape`, `bindingState`, `readiness`, `contractStatus`, `operations[]` | identity and declared configuration, mirroring the fields a declared provider configuration already carries (`declare-provider-details-read.sql:184-199`) |
| `capabilities` | `capabilityId`, `role`, `platformCapabilityId`, `conformanceContractId`, `status` | the declared capability links the estate derives `provider_capability_implementation` rows from (`declare-provider-identity.sql:143-159`) |
| `invoke(input, options)` | returns `{ providerId, toolId, providerExecution, elapsedMs, requestBytes, disposition, candidate, shapeConforms, findings }` | one deterministic operation call; `disposition` is `AUTHORED` or `HELD` with named `findings`, never a silent fallback |

`descriptor.operations[]` carries `operationId`, `inputContractId`, `outputContractId` and
`effect: READ_ONLY`. This is the altitude/circuit envelope (`altitude-01.mjs:72-111`;
`circuit-presentation.mjs:14-25`) with the identity members lifted into `descriptor` and the
capability links into `capabilities`, so the estate can read the provider document from the module
without executing it. `bindingState: UNBOUND` plus explicit readiness mirrors the login circuit's
declaration-before-admission pattern (`declare-authenticate-ide-user.sql:86-94`, `:106-114`): the
package is reviewable before it is executable.

No package may define semantic meaning. Contracts live in the estate; a package implements one.

---

## 3. Five concerns, five packages `[proposal]`

Family package version `0.1.0` for all five; `ui-runtime-token-set` is implemented in this lane.
Contracts consumed are the strategy §7.1 family (`ui-page.v1`, `ui-layout.v1`, `ui-component.v1`)
unless a row says otherwise.

| # | concern | package / `providerId` | operation(s) | consumes | produces / refuses | platform port `[proposal]` | first execution |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | kinds / renderers | `ui-runtime-kinds` / `sfx-ui-runtime-kinds` | `ui.kinds.describe`, `ui.component.render` | `ui-component.v1` registry rows, `ui-registry.v1` manifest entry | rendered node/plan per kind; `UI_COMPONENT_NOT_SUPPORTED` | `sda-ui-component-port.v1` | browser (DOM needed) |
| 2 | adapter behaviour | `ui-runtime-adapters` / `sfx-ui-runtime-adapters` | `ui.component.adapt` | the K1 role table (`analysis/07:91-113`), `ui-component.v1` roles/props/states | role-resolved binding values, state attributes, refusal behaviour; `UI_COMPONENT_ROLE_UNSUPPORTED` | `sda-ui-adapter-port.v1` | table/parity in node; DOM for probes |
| 3 | contract roles | `ui-runtime-contract-roles` / `sfx-ui-runtime-contract-roles` | `ui.roles.describe` | `ui-component.v1` contracts | role/props/states tables and parity receipts for K1/K2 (`analysis/07:124-141`), manifest `roles`/`states` (strategy §7.2:730-733) | `sda-ui-contract-role-port.v1` | node (pure data) |
| 4 | token sets | `ui-runtime-token-set` / `sfx-ui-runtime-token-set` | `ui.tokens.resolve` | `site.css:4-12`-derived `site.v1` | `ui-token-set.v1` candidate with digest; unknown set/group/name refuse (§7) | `sda-ui-token-set-port.v1` | node or browser (pure data) |
| 5 | action dispatch | `ui-runtime-action-dispatch` / `sfx-ui-runtime-action-dispatch` | `ui.actions.describe`, `ui.action.dispatch` | the twelve declared action kinds, three dispatch classes, event vocabulary (strategy §4.4:318-339) | action-kind rows for the manifest; dispatch through the named pre-existing seam only | `sda-ui-action-port.v1` | browser (seams); describe is pure data |
| — | umbrella | `ui-page-runtime` / `sfx-ui-page-runtime` | composition per strategy §7.6 | the five packages | one page render; no meaning of its own | to be named at G2 | browser, after multi-child composition |

Notes.

- Kinds/adapters are deliberately separate here even though their likely first G2 shape merges
  them: concern 1 owns the kind→renderer map, concern 2 owns the role-table access discipline that
  makes every render read table-driven (`analysis/07:238-248`). Keeping them separate keeps the
  merge a G2 decision, not a scaffold decision.
- Concern 3 is a provider, not only a build tool, because the served manifest must publish
  per-kind `roles`/`states` (strategy §7.2:730-733) and the publish gate must compare them to the
  contracts. K1/K2 remain the build-time verifiers; the package is the runtime read of the same
  table.
- Concern 5 never widens authority: `dispatchClass` still names the pre-existing seam, actual
  authority stays downstream in the capability system (strategy §4.4; D4, C22), and no new browser
  write path is added (strategy §8.1).

---

## 4. Contract and version map

| contract | owner | consumers at G2 |
| --- | --- | --- |
| `ui-page.v1`, `ui-layout.v1`, `ui-component.v1`, `ui-page-definition.v1`, `ui-page-request.v1` | estate migration pair (strategy §7.1) | shell, all five packages, publish gate |
| `ui-registry.v1` manifest | shell, class (b) deploy (strategy §7.2) | client validator, publish gate, packages 1/3/5 |
| `ui-token-request.v1`, `ui-token-set.v1` | `[proposal]` declared with package 4; `PROPOSED` in its module | package 4, layout `policy.tokenSet` (strategy §5.2:470) |
| action taxonomy v1 (twelve kinds, three classes) | estate/strategy §4.4 | package 5, section `actions[]` |
| `ui-embodiment-plan.v1` | SDA (existing projection code, `ui-embodiment-plan-v1.mjs:26-146`) | admission protocol at G2 |

Package versions are repo-side semver in `descriptor.version`; estate admission mints the
generation digest that pins the provider definition for a binding
(`declare-provider-identity.sql:121-141`). A package version bump and a provider definition change
are the same act when the package is bound, so the repository version and the digest must move
together.

---

## 5. What G2 must land (unchanged from strategy §7.5)

One request to `scenario-driven-architecture`:

1. a `browser-runtime` binding target (today `node`, `python`, `csharp` only —
   `bind-slot-provider.sql:10,30`);
2. `ui-embodiment-plan.v1` admitted as a provider protocol (`ui-embodiment-plan-v1.mjs:26-146`);
3. multi-child `invoke-scenario` composition (page → layout → sections), so the umbrella can
   invoke the five packages and compose outcomes;
4. page-view testimony semantics, if page views are ever to produce evidence — D8 says not in v1
   (strategy §4.0 D8; §8.3).

Do not file before Phase 1 exit evidence; file with the v1 declaration schema as the input
(strategy §7.5:793-794).

---

## 6. Migration once G2 lands, without contract changes

The contracts are already estate rows; only realisation moves. The shipped shell keeps its
validator, refusals and fetch loop; the adapters move behind the provider boundary.

| shipped v1 artefact | becomes | contract change |
| --- | --- | --- |
| `ui-components.js` adapter map (`kind → render`) | `ui-runtime-kinds` | none: `ui-component.v1` entries still name `kind`/`version`/`contractDigest` |
| adapter `roles` tables and read discipline (K1, `analysis/07:91-113`) | `ui-runtime-adapters` | none: role tables are derived from `ui-component.v1`; the table is the only access path (`analysis/07:238-248`) |
| `supportedRoles`/contract role arrays and registry manifest role fields | `ui-runtime-contract-roles` | none: manifest gains provider identity/digests, which is a class (b) shell deploy, not a declaration change (strategy §7.2:748-751) |
| `site.css:4-12` custom properties | `ui-runtime-token-set` | none: `policy.tokenSet: "site.v1"` is already declaration data (strategy §5.2:470) |
| `dispatchClass` handling in `page-runtime.js` and the seam map | `ui-runtime-action-dispatch` | none: action entries keep `kind`/`dispatchClass`/inputs; authority resolution is downstream (strategy §4.4) |
| `page.js`/`home.js` mount | `ui-page-runtime` composite | none: `ui-page.v1` documents are byte-identical |

Sequence and classes:

1. **G2 request lands** (SDA work; no repository change here).
2. **Estate pair** (class (b), migration): declare the five provider identities, the token
   contracts, the port implementations for the browser target, and bindings — `model.add_provider`
   / provider document (`declare-provider-identity.sql:121-141`),
   `model.declare_provider_port_implementation` (`:8-24`, `:54-105`), `model.bind_provider`
   (`execution-binding-mechanics.md:87-94`). Bindings stay `UNBOUND` until conformance runs.
3. **Manifest extension** (class (b) shell deploy): `ui-registry.v1` gains per-kind and per-action
   `providerId`/`providerDigest`; the validator's refusal codes and the `ui.components` allowlist
   are unchanged (strategy §7.2:718-720).
4. **Move in dependency order, one package per deploy:** token-set (already scaffolded) →
   contract-roles → adapters → kinds/renderers → action dispatch. Each move is proven by the
   shell's existing gates plus the package's own check; no declaration is republished.
5. **Tokens publish as data (class (c)):** once `ui-token-set.v1` is admitted, a token change is a
   data publish through the `publish-ui-page` gate; `site.css` then consumes the published set and
   the deprecated `--cyan`/`--observation` alias retires under G7 (strategy §4.0 D7; §11.4 G7).
   Page-local style forks stay banned (`:1007-1008`).

Invariants that hold across the whole migration:

- Declarations never contain executable markup; text renders as text, URLs validate against an
  admitted scheme (C25, strategy §8.5).
- Unknown kind, role, action, source or contract version refuses visibly; never a silent drop or
  fallback renderer (strategy §8.4).
- A page render is a reading, not a receipt (D8; strategy §8.3); no run, claim or trust state is
  minted by moving renderers into providers.
- The ui-runtime family is the north-star home, not a bridge: unlike the altitude bridge
  (`bridge.policy.json`), no package is shrink-only.

---

## 7. Reference provider: `ui-runtime-token-set` (implemented)

- Module: `sfx-providers/providers/ui-runtime-token-set/ui-runtime-token-set.mjs`. Exports
  `descriptor`, `capabilities`, `invoke` (alias `handle`), `inputShape`, `outputShape`, and the
  token table as data. One operation, `ui.tokens.resolve`; `effect: READ_ONLY`; no dependency
  beyond `node:crypto`.
- Candidate `site.v1`: 17 entries copied from `site.css:4-12` on 2026-10-07, grouped
  `surface`/`text`/`accent`/`signal`/`border`/`geometry`/`typography`, plus the declared
  `--observation` alias of `--cyan` pending G7. The candidate carries `derivedFrom`, `capturedAt`,
  the selected `tokens[]`, `aliases[]` and a `sha256:` digest.
- Refusal codes: `UI_TOKEN_REQUEST_INVALID`, `UI_TOKEN_REQUEST_OVERSIZED` (16384 bytes),
  `UI_TOKEN_SET_UNKNOWN`, `UI_TOKEN_GROUP_UNKNOWN`, `UI_TOKEN_NAME_UNKNOWN`. `groups` and `names`
  union; `names` resolves aliases.
- Binding expectation: provider declaration via `model.add_provider`, contracts
  `ui-token-request.v1`/`ui-token-set.v1` via `model.declare_contract`, port
  `sda-ui-token-set-port.v1` via `model.declare_provider_port_implementation`, binding via
  `model.bind_provider`. Full sequence in the package README.
- Check: `node --test tests/ui-runtime-token-set.test.mjs` proves the contract exports,
  deterministic full-set resolution, group/name/alias selection and every refusal without a
  browser, network or estate.
- Why first: it is the only concern with no DOM and no seam, so it proves the uniform module
  contract, the declaration shape and the estate binding request with the least risk.

---

## 8. Open questions and risks

- **Adapter/kind split.** If G2's embodiment protocol already carries the kind→role mapping, kinds
  and adapters may merge into one package; the scaffold keeps them separate and neither package's
  operation contract changes if they later merge.
- **Contract-roles as runtime read.** K1/K2 are build-time verifiers (`analysis/07:91-141`).
  Publishing roles/states in the manifest makes them runtime data; if the manifest contract stays
  the only carrier, package 3 may shrink to the manifest generator rather than a bound provider.
- **Testimony for renders.** D8 defers page-view evidence; until testimony exists, a provider
  render cannot be distinguished from a reading in evidence terms (strategy §7.5 item 4).
- **Token versioning.** `site.v1` is a string in layout policy; there is no declared token-set
  version history until the estate pair lands. The alias in §7 is declaration debt carried
  explicitly.
- **Browser-target admission order.** The five packages can be declared `UNBOUND` early, but
  moving a shell concern before its binding is admitted would create two realisations; the deploy
  order in §6 item 4 moves each concern only after its binding conformance passes.

## 9. The one design rule

**A browser concern becomes a ui-runtime provider package only when its semantic contract already
exists in the estate; the package implements the contract, never defines it.** Kinds, roles, token
values and action kinds are declared data; packages are replaceable realisation. This is what lets
the shipped shell adapters migrate in place once G2 lands: the declarations do not change, so a
migration cannot change meaning.
