# 11 — The trusted-shell boundary: what provider work may never own

Prepared 2026-10-07. Lane C research analysis for the declarative UI circuits strategy
([`implementation-strategy.md`](../implementation-strategy.md) §4.3, §4.6, §8, §11.2) and the user
review ([`review.md`](../review.md)). Method: read-only. Every claim about current behaviour cites
`path:line`. Everything marked `[proposal]` is design, not observable behaviour. No code was
changed and nothing was committed. Question: where is the trusted-shell boundary, and what must
provider work (gate G2, `sfx-providers/providers/`) never be allowed to own?

## 1. The boundary in one law

The settled architecture is: durable meaning → estate declarations → `read-ui-page` → trusted
browser shell → physical presentation (`review.md:8-30`; `implementation-strategy.md:51-59`). The
shell is the only executable surface admitted to turn declaration bytes into routes, DOM, dispatch
and credentials; declarations are data (`implementation-strategy.md:260-263`). Shell files change
only through a class (a)/(b) deploy with the full staging acceptance and rollback
(`implementation-strategy.md:388-393`).

**Provider law `[proposal]`.** A provider may describe and realize declared meaning; it may never
validate, route, dispatch, authorize, or widen credentials. The registry, allowlist and validator
stay shell-owned, and declaration data can never install trusted code. A change that would give a
provider any of those powers is a shell change and must pass the shell gate; it cannot arrive
through publication, provider packaging, or a declaration.

Today a provider can only *describe*: `ui-embodiment-plan.v1` is a plan applied by a target
adapter, and ADR-0007 requires targets to apply admitted plans and report
`SUPPORTED`/`ADAPTED`/`NOT_SUPPORTED` without reinterpreting meaning
(`analysis/03-ui-capability-providers.md:237-248`). The browser is not yet a selectable binding
target — bindings resolve only `node`, `python` and `csharp` (`analysis/03:225-227`;
`implementation-strategy.md:786-787`).

## 2. The never-provider list

Classification `[proposal]`. Grouping follows `implementation-strategy.md:51-59` and the watched
deploy paths in `AGENTS.md` and `staging.yml:35-43`. These files define what "trusted" means before
a request is served; admitting any of them as an estate provider would move validation, routing,
dispatch or credential handling into replaceable provider code.

### 2.1 Runtime and validator (5)

| # | File | Boundary role | Why it may never be a provider | Citations |
| --- | --- | --- | --- | --- |
| 1 | `live-circuit/circuit/page.html` | Shell skeleton and chrome; declarations render only into `#page-root` | Header/nav/identity/footer are chrome and stay shell (D6); a provider that owned this could restructure the trusted page and load arbitrary modules | `page.html:11-29`; `implementation-strategy.md:62-63,252` |
| 2 | `live-circuit/circuit/page.js` | Page bootstrap: path → `GET /page`, digest binding, declared-navigation render, runtime mount | Route-to-page binding, digest supply and popstate re-read are trust behaviour; a provider owning them could desynchronize path, revision and digest | `page.js:6-7,38-84`; C6 `implementation-strategy.md:1108-1109`; C27 `:1169-1171` |
| 3 | `live-circuit/circuit/page-runtime.js` | Client runtime + **client validator** (`validatePage`), the client registry copy, `safeUrl`, and the only dispatch decision | Validation and dispatch are exactly the authorities a provider must never hold; the runtime decides what renders, what refuses and what a click may do | `page-runtime.js:22-54,82-96,173-254,609-681`; D3 `implementation-strategy.md:249` |
| 4 | `live-circuit/circuit/ui-components.js` | Shipped adapter registry and the single role table; DOM construction that strips handler attributes and renders text as text | Realizations may migrate, but the registry map, role vocabulary and handler-free construction are the shell's admission and safety floor; a provider that owned the registry could admit itself | `ui-components.js:15-28,51-58,463-552`; `implementation-strategy.md:303-314`; `verify-components.mjs:305-335` |
| 5 | `live-circuit/circuit/live-store.mjs` | Server read runtime: **server validator**, deployed `ui-registry` manifest, GET-only reader routes, source/credential handling | Server-side validation and the manifest are the deployed allowlist of record; provider work must never move the check or the allowlist to the party being checked | `live-store.mjs:8,240-267,372-419`; `implementation-strategy.md:18,248-250` |

### 2.2 Routing and security policy (7)

| # | File | Boundary role | Why it may never be a provider | Citations |
| --- | --- | --- | --- | --- |
| 1 | `deploy/sda-kernel/gateway.mjs` | Public edge policy: route classes, circuit POST allowlist, identity route allowlist, retrieval auth, unknown-path 404, credential env scrub | This is the outermost route/method/credential law; any provider that could edit or extend it could widen the public surface | `gateway.mjs:17-23,140-176`; `implementation-strategy.md:819-822` |
| 2 | `live-circuit/dispatch-pair/observe-server.mjs` | Host route map, `CIRCUIT_FILES` static allowlist, reserved slugs, exact-then-generic route host, testimony ingress | A new module or route is a deploy plus acceptance pin; a provider that could register routes would serve trusted code by declaration | `observe-server.mjs:14-49,53-54,472-475,482-495`; C18 `implementation-strategy.md:1131-1133` |
| 3 | `live-circuit/circuit/circuit-host.json` | Trust members: identity/session policy, `home.hero` route data, `ui.components` allowlist, `readers.page`, cache/retrieval limits | The allowlist and reader table are class (b); a declaration may never use a kind or reader not listed here | `circuit-host.json:5-6,11-15,17-23`; `implementation-strategy.md:693-721,748-751` |
| 4 | `deploy/sda-kernel/identity-policy.json` | The only admitted identity routes and capability contracts | Identity routes and their contracts are admission policy, not provider configuration | `identity-policy.json:12-22`; `gateway.mjs:142-144` |
| 5 | `deploy/sda-kernel/retrieval-policy.json` | The only procedures `procedure-extract` may run | Retrieval admission is a security allowlist; providers must not extend procedure reach | `retrieval-policy.json:2-9`; `gateway.mjs:146-156` |
| 6 | `live-circuit/circuit/run-api.mjs` | The only browser write seam: route shape, method, same-origin JSON, admitted observe body, server-held token and scoped idempotency | If a provider owned the seam it could invent routes, headers or credentials; the declaration's `dispatchClass` may only name this seam | `run-api.mjs:21-24,45-52,62-68,85-92`; `implementation-strategy.md:318-355` |
| 7 | `live-circuit/circuit/identity-session.mjs` | Session transport: cookie shape, same-origin JSON CSRF half, identity-host calls, sign-in/out/read routes | Credential handling never leaves the shell; provider work must not touch cookie, origin or bearer mechanics | `identity-session.mjs:29-46,58-93,110-186`; `implementation-strategy.md:812-818` |

## 3. Enforcement invariants that must hold after G2

These are the conditions under which provider work stays safe even after the browser binding target,
`ui-embodiment-plan.v1` admission and multi-child composition are granted (`implementation-strategy.md:784-791`).

| # | Invariant | What it means | Current enforcement |
| --- | --- | --- | --- |
| I1 | A provider may describe, never validate | Provider output (plans, projections, digests, version claims) is candidate data re-checked by the shell, never a proof. Unknown kind/role/action/source refuses by name | Client `validatePage` (`page-runtime.js:173-254`) and server `validatePage` (`live-store.mjs:248-267`) against `circuit-host.json:17` and `UI_COMPONENT_ROLES` (`ui-components.js:463-524`); §8.4 `implementation-strategy.md:842-849` |
| I2 | A provider may never route | Providers may not register routes, name new destinations, or act as a route host. Declared links resolve only through admitted navigation and `safeUrl` | Gateway route/POST allowlists (`gateway.mjs:140-164`); host map and reserved slugs (`observe-server.mjs:53-54,482-495`); `safeUrl` (`page-runtime.js:82-96`) |
| I3 | A provider may never dispatch | Only the shell decides kind → seam and constructs requests. Adapters receive `context.dispatch`; the shell performs the single `fetch` to `/api/circuit/v1/runs` | Fixed kind→dispatchClass table (`page-runtime.js:31-44`; `live-store.mjs:375-388`); `dispatchAction` (`page-runtime.js:609-671`); only `postRun` fetches (`page-runtime.js:585-603`) |
| I4 | A provider may never authorize | `dispatchClass` names a browser seam, not authority; actual authority stays downstream in the capability system. Session gate, origin check and admission remain shell | C22 `implementation-strategy.md:1150-1153`; `run-api.mjs:72-82`; `identity-session.mjs:83-93` |
| I5 | A provider may never widen credentials | Provider code and declarations cannot read, request or forward credentials. `SDA_API_TOKEN` and service keys never reach the browser or a provider | Reader spawn strips tokens (`live-store.mjs:83-84,128-129`); gateway deletes secret env (`gateway.mjs:17-23`); server-only bearer (`run-api.mjs:85-92`) |
| I6 | Registry, allowlist and validator stay shell | A new kind/source/action/route is a shell deploy; the manifest and both validators are class (b). No declaration, provider or publication can add an admitted kind or reader | D3 and boundary rule `implementation-strategy.md:303-314`; manifest class (b) `:748-751`; `verify-components.mjs:305-336` |
| I7 | Declaration data can never install trusted code | Declarations carry text, URLs and bindings only; no markup, style, handler text, script or arbitrary protocol may execute; adapters construct elements and text through admitted primitives | `h()` drops `on*` and sets `textContent` (`ui-components.js:19,23`); `safeHref`/`safeUrl` (`ui-components.js:51-58`; `page-runtime.js:82-96`); §8.5 `implementation-strategy.md:851-857` |

**Admission rule `[proposal]`.** Provider packages themselves are versioned estate artifacts
admitted through migration pairs and port bindings (`bindingState: UNBOUND` until admitted,
`analysis/03:308-311`). Their admission, digest pinning and removal are class (b) shell events; the
shell keeps a generic projector and named refusals, so an unbound or failing provider degrades to a
visible refusal, never a silent fallback (`page-runtime.js:231-232`;
`implementation-strategy.md:307-309`).

## 4. Migration path: the five browser concerns

The five browser concerns are **display, data, actions, events and layout** — the strategy's
north-star row vocabulary (`implementation-strategy.md:226-229`; `analysis/03:263-271`). Their
provider migration is packaging, not meaning: the semantic contracts do not move (`§4.3:315-316`),
and phase boundaries freeze the contract before the next phase begins (`§10:903-906`).

| Concern | Shipped adapter today | Versioned provider target `[proposal]` | Contract that must not change |
| --- | --- | --- | --- |
| Layout/placement | `createRegions`, `selectVariants` (`page-runtime.js:407-449`) consuming `ui-layout.v1` | Layout provider bound through `UiEmbodimentProvider` (`implementation-strategy.md:226`; `analysis/03:313-329`) | `ui-layout.v1` regions/policy |
| Display/projection | `UI_COMPONENT_ROLES` + adapters (`ui-components.js:463-552`), render loop (`page-runtime.js:702-723`) | One versioned provider package per kind under `sfx-providers/providers/ui-page-runtime/` (`implementation-strategy.md:798-802`) | `ui-component.v1` kinds/roles/states |
| Data/binding | source registry (`page-runtime.js:45-52`), `collectSourceRequests`/`loadSources`/`resolveComponentBinding` (`:299-406`) | Declared reader/data ports; the shell keeps the source allowlist, dedupe and cap (`page-runtime.js:346-360`) | `ui-page.v1` sources and binding kinds (`implementation-strategy.md:505-509`) |
| Actions | fixed kind→dispatchClass table (`page-runtime.js:31-44`) and `dispatchAction` (`:609-671`) | Action providers realize admitted kinds; dispatch seam stays shell-fixed, and "no action kind may invent a route, a method, a header or a credential" (`implementation-strategy.md:355`) | §4.4 twelve kinds and three dispatch classes |
| Events | fixed `EVENT_NAMES` (`page-runtime.js:58`), `attachEvents`/`fireLoadEvents` (`:503-524`) | Event-binding provider over the admitted DOM event set; load events may only emit reads (`page-runtime.js:247-250`) | §4.4 event vocabulary and scope rules |

**Sequence `[proposal]`.** (1) Phase 1 exit freezes the v1 contracts; (2) file G2 with the v1
schema and page documents as the concrete input (`implementation-strategy.md:782-794`); (3) admit
the browser binding target and `ui-embodiment-plan.v1`, requiring providers to apply admitted plans
without reinterpreting meaning (`analysis/03:237-248`); (4) version each provider package by
migration pair and bind one port per concern; (5) record provider refs/digests in the `ui-registry`
manifest as a class (b) change `[proposal]`. Throughout, I1–I7 hold and the shell validator,
allowlist and route host stay shell. **No declaration changes, no page re-publication and no digest
changes** follow from a provider move: only the provider binding changes.

## 5. Verification

### 5.1 What the existing checks already enforce

| Check | Where it runs | Invariants it enforces |
| --- | --- | --- |
| `verify-components.mjs` | not wired into CI today (only referenced by `analysis/07-kind-and-reader-tooling.md:98,115`) | I6/I7: allowlist == adapters == role table (`verify-components.mjs:305-306`), version agreement (`:307-312`), `supportedRoles` derived (`:322-324`), contract parity (`:326-329`), per-role consumption probes (`:331-335`) |
| `verify-pages.mjs --fixtures` | `staging.yml:41` | I1/I6 refusals for unknown component/action/source (`verify-pages.mjs:148-159`); data digests 200/409/400 (`:161-177`); manifest presence (`:127-136`); I7 source scan: `textContent` used, no `innerHTML`, `safeUrl` present (`:179-193`, limitation note `:204-207`) |
| `accept.mjs public` | `staging.yml:100` | I2/I3: page modules pinned 200, removed modules 404, `POST /events` 405, `POST /api/circuit/v1/scenario` 405 (`accept.mjs:47-51`); I1: page read and `ui-registry` 200, 404/409/400 page refusals (`:82-96`) |
| `accept.mjs browser` + `browser-captures.mjs` | `staging.yml:102,104-109`; `accept.mjs:8-18` | I7 DOM proof: markup renders as literal text, no script elements, refused `javascript:`/`data:` hrefs, no execution, admitted control navigates (`browser-captures.mjs:180-183,226-233`); strategy §8.5 / WP0.7 (`implementation-strategy.md:851-857,880`) |

None of these checks yet observe the *provider* boundary, because no provider package runs in the
shell; and no check compares the client registry copy with the server manifest.

### 5.2 Missing checks to add `[proposal]`

1. **Wire component conformance into CI.** Add `node live-circuit/circuit/verify-components.mjs` to
   `staging.yml:35-43`, so the role/adapter parity and consumption probes are a recorded gate, not a
   local tool (`analysis/07:115-118`).
2. **Registry parity.** Build the K2 generator/verifier (`analysis/07:123-142`):
   `verify-registry.mjs --check` must prove client `UI_REGISTRY` (`page-runtime.js:22-54`) equals
   the served `uiRegistry` (`live-store.mjs:372-397`), equals `circuit-host.json:17`, equals the
   `accept.mjs` and `verify-pages.mjs` expectations. Today `verify-pages.mjs:127-136` checks only
   kinds/sources of the served manifest, and the two copies are hand-kept.
3. **A trusted-shell boundary scan.** `verify-trusted-shell.mjs` `[proposal]`: fail when a shell
   module imports from `sfx-providers/providers/**`; when the shell or served declaration path
   contains `innerHTML`, `eval` or `new Function`; when `page-runtime.js` exposes a kind or source
   not present in `circuit-host.json`; or when route strings appear outside the gateway/observer
   route hosts. This is the I2–I6 backstop no runtime probe provides today.
4. **Method pins for the new routes.** `accept.mjs:50` pins `POST /api/circuit/v1/scenario` 405 but
   not the new endpoints; add POST 405 pins for `/api/circuit/v1/page` and
   `/api/circuit/v1/ui-registry`, proving the gateway POST allowlist
   (`gateway.mjs:162-164`) is not widened by declarations.
5. **Post-G2 provider admission check `[proposal]`.** Once packages exist, publish a check that
   each manifest provider reference is class (b), digest/version-pinned, bound through an admitted
   port, and unreachable from any declaration field; plus a negative fixture proving an unbound or
   tampered provider refuses visibly.

## 6. Boundary test

Before any provider change merges `[proposal]`:

1. Does it validate, or does it hand its claims to the shell validator?
2. Does it add or resolve a route, method or header?
3. Does it decide dispatch, or call `context.dispatch`?
4. Does it touch authority, sessions, cookies or credentials?
5. Does it change the registry, allowlist, manifest or schema?
6. Does any declaration or provider artifact reach an executable sink (`innerHTML`, `eval`,
   handler text, non-admitted URL scheme)?

A "yes" to 2–6 or a "no" to 1 means the change is a shell change: it requires the class (a)/(b)
staging gate and cannot be delivered by provider packaging or publication.
