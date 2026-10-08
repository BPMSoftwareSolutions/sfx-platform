# 13c — Serving path and estate readers: hard-coded items that constrain what the UI can declare (Lane C audit)

Prepared 2026-10-08. Lane C research analysis for the declarative UI circuits strategy
([`implementation-strategy.md`](../implementation-strategy.md) Revision 3) and lane C's boundary
work ([`11-trusted-shell-boundary.md`](11-trusted-shell-boundary.md)). Read-only: no code changed,
nothing committed.

Question: which hard-coded elements in the serving path and the estate readers constrain what a UI
declaration may say — routes, static map, source list, reader names, component allowlist, registry
manifest, trust policy, acceptance pins, build maps — which of them are trust-boundary (must stay
shell) and which are merely not-yet-declared, and what is the change surface for each?

Provenance: platform cites are `sfx-platform` @ `44cfaac`; estate reader cites are the sibling
checkout `sfx-embody` @ `897cf2d`. Classification labels used below:

- **[trust]** — admission, validation, routing or credential law; must remain shell (class (a)/(b)
  deploy, `implementation-strategy.md:388-393`).
- **[pending]** — declarable content that is hard-coded only because it has not moved to estate
  declaration yet.
- **[generated]** — should be emitted or cross-checked by a generator/parity gate so it cannot
  drift (K2, `analysis/07-kind-and-reader-tooling.md:123-141`; `11-trusted-shell-boundary.md:126-130`).

Every "promise" line is the strategy's own wording; where the code does more than the strategy
decreed, that is stated as a finding, not a violation.

---

## 1. The serving path at a glance

```
browser → gateway.mjs (public edge: route classes, POST allowlist, policy)
        → observe-server.mjs (host routes, CIRCUIT_FILES static map, generic /circuit/<slug>)
        → live-store.mjs (GET-only /api/circuit/v1/* readers; policy.readers → kernel invoke)
        → sfx-embody reader capabilities (read-ui-page, read-live-scenario-circuit,
          read-capability-details, read-standards-crosswalk; read-provider-details via retrieval)
```

`page-runtime.js` is the client mirror of the manifest and validator. `accept.mjs` pins the
deployed surface; `verify-pages.mjs`/`verify-components.mjs` are the local gates.

---

## 2. `live-circuit/dispatch-pair/observe-server.mjs` — routes, CIRCUIT_FILES, static serving

| # | Item (path:line) | What it is / why it exists | Class | Change surface to loosen | Strategy |
| --- | --- | --- | --- | --- | --- |
| 2.1 | `CIRCUIT_FILES` allowlist, 34 entries (`observe-server.mjs:14-49`) | Hand-maintained exact map path → (file, MIME). Serves executable client modules and media; anything absent is 404 — a miss once broke the Explorer (`implementation-strategy.md:176-180`). | [trust] executable code admission; media also [trust] until G5 | new module/media = class (a) deploy: add map entry + acceptance pin. K5/new-component generator may emit the entry (`analysis/07:145-149`); it must never be declaration-writable | "Every new client module … must be added to `CIRCUIT_FILES` and to the staging acceptance routes, or the deploy rolls back" (`implementation-strategy.md:653-656`); media restricted to allowlisted assets, new media class (a) (C5, `:64-65,1106-1107`; G5 `:1027`) |
| 2.2 | Reserved slugs `login, home, explorer, deck, decks, deck-slide, assets, page.html, page.js, page-runtime.js, ui-components.js` (`:53-54`) | Exact routes win; reserved set stops a declared slug shadowing a host route or client module. | [trust] route shadowing | shell deploy to change; page *instances* at other slugs need none (class (c)) | "Exact map entries always win; these slugs stay reserved so a declaration can never shadow login, the Explorer, a deck route or a client module" (`:50-52`); reserved = `login`, `home`, `explorer`, asset/module names (`implementation-strategy.md:359-361`) |
| 2.3 | Host policy load + `homeConfig()` (`:57-61`) | Reads `circuit-host.json`; `hero`/`featured`/sign-in circuit and `SFX_ENVIRONMENT_LABEL`/`SIDEFX_INDEXING` environment string. | [trust] route/trust data | `home.featured` already retired to declaration (`circuit-host.json:6`); retiring `home.hero` needs the Explorer fallback migrated first (class (a)) | C1: `home.hero` and the endpoint stay host route/trust data; only `home.featured` retires (`implementation-strategy.md:1096-1098`); D6 `:252` |
| 2.4 | `ringLimit = 2000`, `maxBodyBytes = 16 MiB` (`:62-63`) | In-memory ring cap and testimony body cap. | [trust] transport | shell deploy; not declaration data | transport policy, not promised declarable; reads/caps are shell (§6.3 `:636-642`) |
| 2.5 | Observation summarizer: `glyphFor`/`classFor`/`summarize` kind→glyph/class/text (`:103-209`) | Renders the live observation timeline; the *view* is shell chrome and is not a declared page. Constrains what the UI can show from testimony kinds. | [pending] presentation | a declared timeline (kind `timeline`) could carry it; the observation wire shape stays shell | D8 reads-not-receipts `:254`; `timeline` is a deployed kind (`ui-components.js:874-879`); lane A leaves this shell (`13a-explorer-runtime.md:338-364,394`) |
| 2.6 | SSE run-selector vocabulary `current|last|next|<ordinal>` + `graphId`, `since` (`:317-383`) | Live/replay transport contract for `/events`. | [trust] transport API | shell deploy; declaration can only link, never define | "No action kind may invent a route, a method, a header or a credential" (`implementation-strategy.md:354-355`) |
| 2.7 | Inline timeline HTML/CSS/JS (`:385-433`) | A second, hard-coded page ("/") outside the declared-page path. | [pending] presentation | convert to a declared page under the generic host; the `/` mapping is gateway host route | D7 "one renderer, many declared routes" (`:253`); `/` is host-served (`gateway.mjs:170-178`) |
| 2.8 | Exact route table (`:439-475`) — `/api/circuit/v1/home` `:439-442`; `/circuit/decks` `:445-448`; `/circuit/deck` `:449-452`; `/circuit/deck-slide` `:453-458`; `/health` `:459-462`; `/events` GET/POST `:463-475` | Host API surface; deck routes are the legacy Explorer reads; `/health` flips readiness. | [trust] route host; deck routes [pending] (Explorer API, not v1 declarable pages) | shell deploy; porting the Explorer onto declared readers is candidate work (lane A) | host route map listed as class (b) (`11-trusted-shell-boundary.md:54`); reads stay GET-only (`implementation-strategy.md:810-811`) |
| 2.9 | `CIRCUIT_FILES` serving with `no-store` (`:482-488`) | Static module delivery. | [trust] | shell deploy | C18 pins (`:1131-1133`) |
| 2.10 | Generic declared-page route: regex `^/circuit/[a-z][a-z0-9-]*$`, reserved check, serves `page.html` (`:490-495`) | The route *shape* and reserved check constrain every declarable page slug. | [trust] route shape | nested/slug loosening or top-level paths = shell + gateway rule (G3); new slugs need no deploy | "v1 pages live under `/circuit/<slug>` … exact matches resolve first, then `/circuit/<slug>` serves `page.html` + `page.js`" (`implementation-strategy.md:357-365`); top-level paths G3 (`:1025`) |

The two loopback listeners (`:508-526`) are local-deviation mechanics, not declaration constraints.

---

## 3. `live-circuit/circuit/live-store.mjs` — readers, sources, validation, cache

| # | Item (path:line) | What it is / why it exists | Class | Change surface to loosen | Strategy |
| --- | --- | --- | --- | --- | --- |
| 3.1 | Estate root: `SDA_ESTATE_DIR` or repo root (`:14`); `circuit-host.json` load (`:15`) | Locates the estate delivery and trust policy; mirrors the kernel path. | [trust] configuration | host/deploy environment | "development names it explicitly with `SDA_ESTATE_DIR`" `:13-14`; fixture pattern promised §6.4 `:649-652` |
| 3.2 | `policy.readers[name]` lookup (`:173`) | Reader names are a closed set declared in `circuit-host.json:18-24`. A declaration naming another reader is refused before dispatch (`:124`). | [trust] reader admission | new reader = estate migration pair + host reader entry + route = class (b) deploy (K5) | "one new reading capability `read-ui-page` … `circuit-host.json` gains `readers.page`" (D1 `:247`); readers table class (b) (`11:55`) |
| 3.3 | Selection key lists per reader: scenario `['capabilityId','namespaceId','scenarioId','detailId','detailPointer','expectedSnapshotDigest']` (`:196`); details (`:219`); page (`:270`); crosswalk (`:310`); routes build them (`:454-459`) | Each reader's route query shape is hard-coded in the host; lengths/patterns hand-validated. The reader's input contract (declared in the estate) is not consulted. | [trust] input validation | contract-driven validation generated from the estate contracts would loosen hand lists; not promised | reader entries carry `inputContractId`/`outputContractId` (`circuit-host.json:20-23`); only output contracts are checked (`live-store.mjs:45,157`) |
| 3.4 | Refusal maps: `detailsRefusals` (`:215-216`), `pageRefusals` (`:238-239`), `crosswalkRefusals` (`:307`); resident `_NOT_FOUND`/`_SNAPSHOT_CHANGED` suffix map (`:37-39,148-151`) | Map estate status vocabulary to HTTP codes and named errors; a status not in the map is `422`/`502`. | [trust] failure law | estate contracts already declare status enums (`ui-page.v1`); generating the map from contracts is candidate work | named refusals never blank (C15, `:593-601,841-849`); `PAGE_SNAPSHOT_CHANGED` 409, malformed 400 (`:584-592`) |
| 3.5 | `pageActions` set, twelve kinds (`:240-241`); `pageSources` set, seven sources (`:242`) | Server-side validator allowlists; declaration data cannot name anything else (`:248-267`). | [trust] but duplicated [generated] | K2: emit validator tables from the same artifact as the manifest; today a hand-kept duplicate of `:416-438` | "registry, allowlist and validator stay shell" (I6, `11:73`); manifest is the machine-readable view consumed by the validators (`implementation-strategy.md:723-725`) |
| 3.6 | `validatePage` (`:248-267`) | Server check: component kind+version against `ui.allowed` policy, actions/sources against sets; READ page with no sections is invalid. | [trust] validation | generators only; the check itself must not move | D3 `:249`; refusals `422 UI_DECLARATION_INVALID` (`:593-595`) |
| 3.7 | Fixture source `SFX_PAGE_FIXTURE_DIR` (`:280-294,318-336`) | File-backed local dev for pages/crosswalks, `node verify-pages.mjs` before publication. | [pending] dev | keep; fixture set is the local analogue of the estate rows | §6.4 `:649-652` promised exactly this |
| 3.8 | `readProviderInspection` (`:345-394`): `PROCEDURE_EXTRACT_ENDPOINT` (`:346`), selection required (`:348`), scenario-derived `providerId`/`definitionDigest` (`:350-352`), `policy.retrieval.provider` (`:354`), request body `{procedure, parameters:{provider_id, estate_model_pk}}` (`:359-360`), `/json` (`:356`), canonical allowlist `canonicalProviders` (`:380`), result-set name `identityResultSet` and columns `provider_id`/`definition_digest` (`:388-390`) | The fifth reader is not in `readers`; it is a retrieval procedure call with host-hard-coded procedure names, params and identity columns. Constrains what provider inspection can ever return. | [trust] retrieval admission ([pending] as a reader) | contract for provider inspection (estate) would remove the column coupling; retrieval policy/host config stay shell | `retrieval.provider` in `circuit-host.json:12-16`; retrieval allowlist is security law (`11:57`); "page reads are kernel invokes, not retrieval-service procedures" (`implementation-strategy.md:753-756`) — provider inspection is the exception that still runs through retrieval |
| 3.9 | `componentRoles`/`uiComponents` (`:401-412`) | Manifest component rows derive roles/states from the K1 role table (`ui-components.js`), not from the estate contracts. | [generated] | K2 should derive the rows from the declared component contracts; until then the shell's own table is the source | "Component roles/states are derived from the exported role table (K1) so the manifest cannot drift from the adapters; `circuit-host.json ui.components` stays the kind/version allowlist" (`:395-400`); roles published in manifest (`implementation-strategy.md:730-733`) |
| 3.10 | `uiRegistry` manifest (`:413-439`): `routeHostVersion:'1'`, `pageContractVersions` list (`:414`), 12 actions (`:416-429`), 7 sources (`:430-438`), `limits.maximumSources` from policy (`:439`) | The deployed shell's machine-readable view. Sources include `crosswalk` (`:437`) and `provider-inspection` (`:434`) whose readers are not in the `readers` table. | [trust] class (b); [generated] parity | K2 generator + `verify-registry.mjs --check`; a new source/kind/route is still a class (b) deploy | manifest fields class (b), instances class (c) (`implementation-strategy.md:748-751`); D2 lists six sources `catalog, scenario, details, provider-inspection, session, release` (`:248`, §6.1 `:614-616`); `crosswalk` is the Phase 1 class (b) addition (`:943-944`) |
| 3.11 | Route dispatch chain (`:453-460`) and GET-only law (`:441-449`) | The only seven `/api/circuit/v1/*` reads; everything else 404; non-GET 405 with `allow: GET`. | [trust] route shape/method | new read route = class (b) deploy + acceptance pin; declaration can never add one | §8.1 `:810-820`; gateway mirrors the law `:446-447,163-164` |
| 3.12 | ETag/304 and cache LRU/TTL (`:462-464,165-188`; `circuit-host.json:11`) | Transport caching keyed by reader+payload; `refresh=1` bypass. | [trust] transport | policy values in host JSON; consistency promise deferred to G8 | §6.2 `:626-634`; G8 `:1030` |
| 3.13 | Capacity gate (`:23-27`) and resident transport (`:33-117`); env scrub of `SDA_API_TOKEN`/service keys (`:83-84,128-129`) | Kernel process admission and credential isolation. | [trust] credentials | shell deploy only (I5) | I5 `11:72`; credentials stay server-side (`implementation-strategy.md:821-822`) |

---

## 4. `live-circuit/circuit/circuit-host.json` — trust policy members

| # | Item (line) | What it is / why | Class | Change surface |
| --- | --- | --- | --- | --- |
| 4.1 | `contractId`, `delivery: database-memory`, `api.defaultNamespace: sidefx:capabilities` (1-4) | Delivery selection and default namespace for reads. | [trust] | host/deploy (class (b)); delivery must match `sfx.config.json` `deliveries` (`live-store.mjs:121-124`) |
| 4.2 | `identity` block (5): observe-requires-session, sign-in circuit capability/scenario, cookie `__Host-sfx-session`, session limits | Session trust policy. | [trust] | class (b) shell deploy; identity schema only through `sfx-dal`/`sfx-embody` per `AGENTS.md` |
| 4.3 | `home` block (6): `hero` + `copyBasis` | Explorer no-query default and environment label; copyBasis records why it is host data and that `featured` is declaration authority. | [trust] route data (C1) | retire only after the Explorer fallback moves (class (a)); `home.featured` already gone from this file |
| 4.4 | `timeoutMilliseconds`, `maximumResponseBytes`, `maximumConcurrentReads`, `maximumQueuedReads`, `cache` (7-11) | Read budget and cache policy. | [trust] limits | class (b); measured at WP0.5 |
| 4.5 | `retrieval.provider` (12-16): `analysis.read_provider_details`, `identityResultSet: provider_identity`, canonical procedure/result set, `canonicalProviders: ["sda-authority-transformation-port.v1"]` | Names the only two provider-inspection procedures and the canonical-body allowlist. | [trust] retrieval admission; allowlist [pending] | retrieval policy/security stays shell; a declared provider-inspection contract would move the column/result-set coupling to the estate |
| 4.6 | `ui.components` allowlist (17): 21 kind/version pairs | The deployed kind allowlist the validator and manifest consume. A declaration may never use a kind absent here. | [trust] (D3/I6) | new kind = class (b) deploy: allowlist + adapter + role table + manifest + acceptance; generator (K5) can emit all rows together (`analysis/07:145-149`) |
| 4.7 | `readers` table (18-24): catalog, scenario, details, page, crosswalk | Kernel subject mapping per reader, with input/output contract ids. | [trust] reader admission | new reader = estate migration pair + this table + route + manifest source + acceptance = class (b) |

---

## 5. `deploy/sda-kernel/gateway.mjs` — where declarations cannot reach

| # | Item (line) | What it is / why | Class | Change surface |
| --- | --- | --- | --- | --- |
| 5.1 | Secret extraction + env scrub (8-23); vault/keyring bootstrap (26-70) | Edge credential handling; deletes connection strings and service keys from child environments. | [trust] | shell deploy; no declaration path |
| 5.2 | Host launches and fixed ports: observer `8787`, retrieval `8791`, identity `8793`, API `8799` (73-115) | Process topology. | [trust] | shell deploy |
| 5.3 | Route classes: `/v1/` API, `/auth/` identity, `/procedure-extract/`, `/circuit` + `/api/circuit/` + `/events` (140-157) | The public route taxonomy; unknown paths 404. | [trust] I2 | shell deploy; top-level vanity paths G3 |
| 5.4 | Identity route allowlist from `identity-policy.json:12-22` (142-144) | Only admitted auth method/path pairs. | [trust] | policy file + shell deploy |
| 5.5 | Retrieval auth + procedure allowlist from `retrieval-policy.json:2-9` (145-156) | Bearer-gated, only six `analysis.*` procedures. | [trust] | policy file + shell deploy; readers deliberately absent (`implementation-strategy.md:753-767`) |
| 5.6 | Circuit POST allowlist: `/api/circuit/v1/runs`, `/session`, `/session/logout` (162-163); all other circuit non-GET 405 (164) | The only browser write paths. | [trust] C22/I4 | shell deploy; strategy forbids widening (`:819-820`) |
| 5.7 | `/robots.txt` (166-169), `/` → `/circuit/home`, `/favicon.ico` → emblem (170-178) | Host-served SEO/landing routes. | [trust] route data [pending] presentation | `/` mapping is host chrome (D6); content is declared |
| 5.8 | Inline 404 page (118-120) | Website-retired fallback. | [pending] | replace with a declared page if wanted; route law stays |

---

## 6. The estate readers (`sfx-embody` @ `897cf2d`)

Four readers are capabilities declared through `model.declare_capability_document` with one root
terminal scenario, contracts and a pinned port statement; the fifth is a retrieval procedure.

| Reader | Declaration | Pinned internals that constrain the UI | Class | Change surface |
| --- | --- | --- | --- | --- |
| `read-ui-page` | `declare-ui-page-reading.commit.sql:406` (capability doc); procedure `analysis.read_ui_page_document` `:227`; statement/prov/port check `:509-526` | Contracts `ui-page-request.v1`/`ui-page.v1`; statuses `READ/NOT_FOUND/NOT_DECLARED/SNAPSHOT_CHANGED`; statement `EXEC analysis.read_ui_page_document @input=@input,@estate_model_pk=@estate_model_pk;`; port `read-ui-page-port`, platform `sda-embodiment-plan-port.v1`, provider `sda-declared-read-graph-provider.v1` | estate data [generated] (schema) | pages are data publishes (`stage_ui_page`/`promote_ui_page`/`rollback_ui_page` `:306-372`); a new reader is a migration pair; new/different statements require an estate change, and the host entry is class (b) |
| `read-live-scenario-circuit` | `declare-live-scenario-circuit.commit.sql:785`; procedure `:144`; contract `live-scenario-circuit.v1` `:766` | One capability, one root terminal scenario; output contract name; slide/geometry fields the host transforms (`live-store.mjs:209-210`) | estate data | new scenarios/capabilities are estate publishes; the reader itself changes only by migration |
| `read-capability-details` | `declare-capability-details-reading.commit.sql:4200`; procedure `analysis.read_capability_details_document` `:4158` (also `analysis.read_capability_details`, `read-capability-details.commit.sql:69`) | Contract `capability-details.v1`; required `sets.capability_navigation` array (`live-store.mjs:229-231`) | estate data; the host's required set name is a hard coupling [generated] | reader contract should declare the set; until then the host and reader move together |
| `read-standards-crosswalk` | `declare-healthcare-solutions-page.commit.sql:392`; procedure `analysis.read_standards_crosswalk` `:262`; statement check `:510` | Contracts `standards-crosswalk-request.v1`/`standards-crosswalk.v1`; statuses `READ/NOT_FOUND/NOT_DECLARED`; seed row `healthcare-solutions.v1` `:139-160`; page binding `{sourceId:'crosswalk', input:{crosswalkId}}` `:189` | estate data | crosswalk content publishes as estate rows; a new crosswalk id needs no shell deploy (acceptance discovers it from the page binding, `accept.mjs:96-99`) |
| `read-provider-details` | `declare-provider-details-read.commit.sql:52`; result sets `provider_identity` `:165` etc.; grant `:510`; allowlisted in `retrieval-policy.json:2-9` | Procedure name, `/json` POST shape, `provider_id`/`estate_model_pk` params, result-set names and identity columns are host-hard-coded (`live-store.mjs:350-390`); canonical-body allowlist in `circuit-host.json:15` | [trust] retrieval; coupling [pending] | a declared provider-inspection contract (estate) plus SDA composition would remove the shape coupling; retrieval admission stays shell |

Reader asymmetry finding: the first four are capability readers reached through
`policy.readers`; `read-provider-details` has no `readers` entry and is reached through the
retrieval service. The strategy's D2/§6.1 source list is therefore one short: `provider-inspection`
is a source in the manifest (`live-store.mjs:434`) but not a host reader, and its route params are
hard-coded rather than contract-validated.

---

## 7. Acceptance pins (`deploy/staging/accept.mjs`, `config.json`)

| Pin | Lines | What it proves | Class | Change surface |
| --- | --- | --- | --- | --- |
| Route/method/status table incl. `/circuit/home`, `/circuit/healthcare-solutions`, `page.*` 200, removed modules 404, POST 405s, `/capabilities`/`/about`/`/sitemap.xml` 404 | `accept.mjs:46-51` | Deployed surface: modules served, retired website paths 404, writes refused. | security pins [trust]; page-path pins [pending] | security pins must stay; page/module pins are extended per phase (§9.2 `:883-886`) |
| `/circuit` → `/circuit/explorer` redirect preserving selection | `:58-63` | Old link continuity. | [trust] route | shell deploy |
| `/` platform home title, robots disallow | `:65-69` | Host chrome and indexing law. | [trust] | shell deploy |
| capability-details READ + navigation row + unknown 404 | `:70-79` | Reader contract behavior. | [trust] contract pin | reader/estate change moves this pin with a deploy |
| ui-registry 200; `/circuit/home` READ digest; 404/409/400 refusals; `/circuit/healthcare-solutions` READ; crosswalk binding discovered from the page and its reader read; unknown crosswalk 404 | `:82-111` | Declared-page contract and digest paths. | [trust] contract behavior; page identity [pending] | the crosswalk pin already discovers the id from the declaration (`:96-99`) — the model for loosening page pins |
| scenario/detail/provider-inspection pins over `config.observe.subject` | `:112-133`; `config.json:10-17` | Provider drill-down and refusal (`DECLARED_PROVIDER_REQUIRED`, 409). | [trust] behavior; fixture identity is CI data | `config.json` pins the observed subject and objective input; changing the demo subject is a config change (watched path) |

Acceptance pins constrain declarations only in that a *page identity* the team wants covered must be
added by hand; there is no declared page list the gate iterates. The strategy promised named page
routes/refusals per phase, not automatic discovery (`implementation-strategy.md:883-886`).

---

## 8. Build maps

| Map | Where | What it is | Class | Change surface |
| --- | --- | --- | --- | --- |
| Manifest component/source expectation lists | `verify-pages.mjs:21-23` | Local gate's hand-kept `expectedComponents` (21) and `expectedSources` (7). | [generated] | K2 generator should emit both from the same artifact as the manifest (`analysis/07:123-141`); update surface is `tools/` (not watched by staging) |
| K1 contract/role tables | `verify-components.mjs:81-102` | Hand-kept roles+props per kind for adapter conformance. | [generated] | K2/K3 generation from `ui-component.v1` contracts (`analysis/07:91-141`); today a checked-but-manual table |
| Shipped role table + adapter map | `ui-components.js:777` (`UI_COMPONENT_ROLES`), `:939` (`UI_COMPONENTS`) | The shell's single role vocabulary and adapter registry. | [trust] (registry is shell, D3/I6) | new kind = class (b); role derivation should come from the estate contract (K2) |
| Client registry copy | `page-runtime.js:22-58` | Hand-kept client duplicate of the server manifest (kinds, actions, sources, limits). | [generated] — the strategy already records this gap | `verify-registry.mjs --check` parity (`11:126-130`); generator target is `ui-registry.generated.mjs` (`analysis/07:126-127`) |
| Server manifest | `live-store.mjs:407-439` | Manifest derived from `circuit-host.json` + role table. | [trust] class (b) + [generated] parity | same generator; consumption replaces the inline object |
| Generated kind artifacts | `tools/live-circuit/generated/<kind>/{contract,parity}.json`, `.adapter.mjs`, `.acceptance.md`; generator `tools/live-circuit/new-component.mjs` (`:5-20,34-35,205-222`) | One-time scaffolds for new kinds; parity fixtures feed the K1 probes. | build artifacts | generator inputs are contract + role table + `circuit-host.json` (`analysis/07:145-149`); not in the serving path |
| Client binding/event/scope sets | `page-runtime.js:60-64` | Closed vocabularies duplicated from the strategy §4.4/§5.3 tables. | [trust] validator vocabulary [generated] | should derive from manifest/registry parity; a vocabulary change is a shell deploy + contract version |

---

## 9. Verdict: trust boundary vs not-yet-declared

**Must stay shell (class (a)/(b); declarations may never widen):**

1. Gateway route classes, identity/retrieval allowlists, circuit POST allowlist
   (`gateway.mjs:140-164`).
2. Observer host routes, `CIRCUIT_FILES`, reserved slugs, generic-route regex
   (`observe-server.mjs:14-54,439-495`).
3. Reader admission (`circuit-host.json:18-24` + `live-store.mjs:173`) and route/method law
   (`live-store.mjs:441-449`).
4. Component kind/version allowlist (`circuit-host.json:17`), both validators
   (`live-store.mjs:240-267`; `page-runtime.js:22-64`), and the registry manifest as class (b).
5. Credential/session/cache/capacity policy (`circuit-host.json:5,7-11`;
   `live-store.mjs:23-27,83-84,128-129`).

**Merely not-yet-declared (change surfaces listed in §2–§8):**

1. `home.hero` host route data — retires only after the Explorer fallback migration (C1).
2. The inline `/` timeline page (`observe-server.mjs:385-433`) — convert to a declared page.
3. Observation glyph/class rendering — declarable as `timeline` if a page wants it.
4. Deck routes — port onto declared readers when the Explorer migrates (lane A's scope).
5. Page identities in acceptance — could iterate a declared page list instead of hand pins.
6. `read-provider-details` shape — a declared provider-inspection contract.
7. Reader input validation and refusal maps — contract-generated rather than hand lists.

**Generated parity debt (the strategy already records these as missing checks):**

1. Three hand-kept copies of the registry (client `page-runtime.js:22-58`, server
   `live-store.mjs:407-439`, policy `circuit-host.json:17`) — K2 generator plus
   `verify-registry.mjs --check` (`analysis/07:123-141`; `11:126-130`).
2. K1 role tables and `verify-pages` expectation lists — generated from the component contracts.
3. `CIRCUIT_FILES` entries could be emitted by `new-component.mjs --check` (`analysis/07:145-149`)
   but the file itself stays shell; never declaration-writable (I6/I7, `11:73-74`).

---

## 10. Where the code does more than the strategy decreed

1. **Sources beyond D2.** D2/§6.1 name six sources; the deployed manifest has seven (`crosswalk`,
   `live-store.mjs:437`, `page-runtime.js:55`). The Phase 1 strategy explicitly priced this as a
   class (b) addition (`implementation-strategy.md:943-944`), so it is accounted for, but the D2
   sentence is stale and should be corrected on the next revision.
2. **Provider inspection is not a reader.** The strategy says the shell fetches a fixed
   host-managed source registry and that retrieval is not extended for page reads
   (`:248,753-756`); provider inspection is a source whose procedure names, params and identity
   columns are hard-coded in the host. This is the one place a "reader" bypasses the readers table.
3. **Validator tables are hand-kept.** The strategy calls the manifest the machine-readable view
   the validators consume (`:723-725`); today the server validator uses separate `pageActions`/
   `pageSources` sets (`live-store.mjs:240-242`) and `verify-pages.mjs:21-23` keeps another pair.
   K2 closes this, but until it lands the "cannot drift" claim in `live-store.mjs:395-400` is
   stronger than the code.
4. **`home.featured` retirement is done** (`circuit-host.json:6` now records it as declaration
   authority; only `hero` remains) — this is a strategy promise kept, recorded here so future
   audits do not re-open it.

## 11. Honest limits

- Estate line cites are from the sibling `sfx-embody` checkout at `897cf2d`; the readers were read,
  not executed, and the platform acceptance evidence for them (WP0/WP1 receipts) was not re-run
  for this audit.
- "Trust" vs "pending" classification outside the strategy's explicit rulings (D3, C18, C5, I2-I7)
  is this audit's judgement; §9 states the basis for each grouping.
- `verify-components.mjs` is not wired into `staging.yml` today (`11:113`); its pass status was not
  claimed here.
- No declaration, shell or estate file was changed; nothing was committed.
