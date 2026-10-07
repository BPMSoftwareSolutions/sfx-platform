# 04 — Serving, routing, change classes and deploy economics

Lane 4 of the SFX website evolution research (see
[`research-brief.md`](../research-brief.md)). Research only: no product code was
changed. Every claim about current behavior cites `path:line`. Proposals are
labelled `[proposal]`. The question: what must stay deployed versus what can
become data, and what serving/routing model lets page structure and content
change without a deploy while every existing authority and acceptance boundary
stays intact.

---

## What is served today (observed)

### Hosts and ports

- The observer is the circuit host. It starts on `OBSERVER_PORT` default 8787
  and listens on both `127.0.0.1` and `::1` (`live-circuit/dispatch-pair/observe-server.mjs:10`,
  `:492-510`).
- In the container the gateway (port 3000) launches it as
  `/opt/sfx/estate/demo/dispatch-pair/observe-server.mjs` with
  `SDA_API_ENDPOINT`, `PROCEDURE_EXTRACT_ENDPOINT` and `SFX_IDENTITY_ENDPOINT`
  and waits for `http://127.0.0.1:8787/health`
  (`deploy/sda-kernel/gateway.mjs:77-80`, `:89`).
- The gateway fronts everything: `/auth/*` → identity :8793, `/v1/*` → SDA API
  :8799, `/procedure-extract/*` → retrieval :8791, and `/circuit`,
  `/circuit/*`, `/api/circuit/*`, `/events` → observer :8787
  (`deploy/sda-kernel/gateway.mjs:140-163`, `:172`). Unknown paths get a 404
  page linking home (`gateway.mjs:118-120`, `:173-176`).
- Gateway health is `/healthz` and `/readyz` returning `ready`, `release`,
  `bootId`, `kernelDigest` and `kernelLanguage`
  (`deploy/sda-kernel/gateway.mjs:124-127`). The observer's own `/health` is
  `{status:'ok'}` (`live-circuit/dispatch-pair/observe-server.mjs:450-453`).
- `/internal/deployment` is bearer-only and returns the vault *fingerprint*,
  never bytes (`gateway.mjs:130-138`). `/robots.txt` disallows all when
  `SIDEFX_INDEXING=disabled` (`gateway.mjs:166-168`).

### The static `CIRCUIT_FILES` map mechanics

- Every client file the observer serves must be listed by hand in
  `CIRCUIT_FILES` as `[url path, [file on disk, content type]]`
  (`live-circuit/dispatch-pair/observe-server.mjs:14-45`). The map lists JS
  modules, CSS, the three HTML pages and six image assets.
- A hit reads the file and answers `200` with `cache-control: no-store`
  (`observe-server.mjs:473-478`). A miss falls through to
  `404 {"error":"not_found"}` (`observe-server.mjs:480`). There is no directory
  scan and no fallback: the map is an allowlist.
- Server-only modules are deliberately not in the map: `live-store.mjs`,
  `run-api.mjs`, `identity-session.mjs`, `evidence-store.mjs`, `deck-store.mjs`,
  `circuit-host.json` and all `verify-*.mjs` (map contents,
  `observe-server.mjs:14-45`).
- Client modules load through `<script type="module">` tags:
  `/circuit/home.js` (`live-circuit/circuit/home.html:119`),
  `/circuit/login.js` (`login.html:98`), `/circuit/explorer.js`
  (`explorer.html:318`), which in turn import the other mapped modules.

### Page routes

- `/circuit/home` → `home.html`, `/circuit/login` → `login.html`,
  `/circuit/explorer` → `explorer.html` (`observe-server.mjs:25-30`).
- `/circuit` and `/circuit/` answer `302` to `/circuit/explorer` with the query
  preserved (`observe-server.mjs:467-471`).
- `/` is special: the observer serves a built-in observation timeline page
  (`observe-server.mjs:376-424`, `:458-462`), but in the container the gateway
  rewrites `/` to `/circuit/home` and `/favicon.ico` to the emblem
  (`gateway.mjs:171-178`), so the timeline page is a direct-observer/local-dev
  artifact.
- The retired Next.js site is gone; its former routes are 404 or redirected
  (`docs/live-circuit-platform-revamp.md:392-408`).

### API routes

- Home configuration: `GET /api/circuit/v1/home` returns the `home` block from
  `circuit-host.json` plus an environment label (`observe-server.mjs:46-52`,
  `:430-433`).
- Session: `/api/circuit/v1/session` (GET status, POST sign-in) and
  `/session/runs` and `/session/logout`
  (`live-circuit/circuit/identity-session.mjs:110-187`).
- Runs: `/api/circuit/v1/runs` (Observe POST) and run reads/streams
  (`live-circuit/circuit/run-api.mjs:13-124`).
- Circuit reads: `/api/circuit/v1/capabilities`, `/scenario`,
  `/capability-details`, `/provider-inspection`
  (`live-circuit/circuit/live-store.mjs:283-301`).
- Decks/media: `/circuit/decks`, `/circuit/deck`, `/circuit/deck-slide`
  (`observe-server.mjs:436-449`) reading estate evidence
  (`live-circuit/circuit/deck-store.mjs:11-35`).
- Events: `GET /events` SSE with replay selectors (`observe-server.mjs:454-457`,
  `:337-374`); `POST /events` and `/events/batch` admit testimony
  (`observe-server.mjs:463-466`).

### Documented failure mode when a client module is missing from the map

- The map returns 404 for any unlisted module (`observe-server.mjs:480`). The
  fix commit for the actual incident states it plainly: "The staging static map
  returns 404 for client modules it does not list, so the Explorer failed to
  initialize and the live browser acceptance timed out. Register pane-layout.js
  and assert its route in the public acceptance" (`git show 586dafd`, commit
  message; the entry itself is `observe-server.mjs:33`).
- The failed push was `0aaad9b` (client imported `pane-layout.js`; module not in
  the map): GitHub run `37524443832` failed the deploy job step "Real sign-in,
  live Observe, sign-out and captured replay" and the `finish` job then restored
  the prior digest (`staging.yml:207-212`). Public acceptance now pins both
  directions: `/circuit/pane-layout.js` must be `200`, removed modules such as
  `/circuit/app.js` must be `404` (`deploy/staging/accept.mjs:47`).

---

## Routing today

### URL shapes and query state

- Public page URLs are the three map keys
  (`observe-server.mjs:25-30`). There is no per-capability URL; selection is
  query state.
- The Explorer keeps one query vocabulary: `capability`, `namespace`,
  `scenario`, `node`, `row`, `page`, `detail`, `pointer`, `detailPage`, `view`,
  `run` (`live-circuit/circuit/explorer.js:12-16`). `syncUrl` writes all of them
  with `history.pushState`/`replaceState` (`explorer.js:36-42`).
- Sign-in carries `?return=` naming a same-origin circuit path
  (`live-circuit/circuit/login.js:25`, `:73`;
  `docs/live-circuit-browser-session.md:27`). Home links into the Explorer are
  built by `circuitHref` (`live-circuit/circuit/site.js:24-29`).
- With no query, the Explorer falls back to the host `hero` from
  `/api/circuit/v1/home` (`explorer.js:339-340`).

### Back/Forward

- A `popstate` listener rebuilds state from the query and chooses the cheapest
  correct action: reopen capability, re-read scenario, open run, set view, open
  detail, or select slide (`explorer.js:312-330`). Selection is therefore
  deep-linkable and history-correct today.

### How a new page is added today

1. Add `live-circuit/circuit/<name>.html` and its modules.
2. Register every file (HTML, JS, CSS, images) in `CIRCUIT_FILES` with a content
   type (`observe-server.mjs:14-45`).
3. Add navigation links by hand into each page's markup (e.g.
   `home.html:57-58`, `explorer.html:197-198`, `login.html:42-43`).
4. If the URL is not under `/circuit/**` or `/api/circuit/**`, add a gateway
   route; only `/` and `/favicon.ico` are special-cased today
   (`gateway.mjs:171-178`).
5. Add the route to public acceptance (`deploy/staging/accept.mjs:44-62`) and,
   if it is part of the sign-in/Observe flow, to the browser acceptance the
   deploy job drives (`deploy/staging/accept.mjs:8-18`;
   `staging.yml:99-101`).
6. Push: the watched paths (`staging.yml:6-14`) run checks, build one composite
   image, rebind the slot, run all acceptance gates and either record the
   release or roll back (`staging.yml:44-115`, `:179-221`).

---

## Change classes and target rule [proposal]

| class | what ships it now | what triggers acceptance today | target [proposal] |
| --- | --- | --- | --- |
| (a) runtime / shell code — gateway, SDA API host, observer, client runtime modules, security policy files | composite image from the commit: `prepare-composite.mjs:33-34` places `gateway.mjs`, `api.mjs`, `initialize.sh`, `identity-policy.json`, `retrieval-policy.json`; `live-circuit.mjs:11-18` places `circuit/` and `observe-server.mjs`; `Dockerfile.composite:32-45` copies and digest-verifies | push under watched paths (`staging.yml:6-14`) → checks → deploy → full acceptance → finish/rollback | **stays deploy-only.** This is the trusted computing base; nothing may render a declaration before this code is verified |
| (b) host declarations — `circuit-host.json` (home hero/featured, identity circuit pointer, readers, cache/limits) and the two `/opt/sfx/host/*-policy.json` files | part of `live-circuit/circuit/**`, therefore in the image (`live-circuit.mjs:12`); read at module load (`observe-server.mjs:48`, `identity-session.mjs:12`, `run-api.mjs:9`, `live-store.mjs:14`) and by the gateway (`gateway.mjs:72`, `:93`) | same watched-path deploy as (a) | **split.** Trust/safety invariants (cookie name, `observeRequiresSession`, timeouts, body caps, cache, reader bindings) stay deployed; presentation facts (`home.hero`, `home.featured`, `identity.circuit.page`) become estate data. The file itself records this direction: `copyBasis` says home entries are "Host data until the list is declared as database authority (revamp P3)" (`circuit-host.json:6`; `docs/live-circuit-platform-revamp.md:343-364`) |
| (c) estate / database data — capabilities, scenes, navigation rows, readings | `sfx-embody` migration pairs; the platform "consumes the estate through the installed kernel and the database, never through a checkout at runtime" (`docs/live-circuit-platform-revamp.md:245-247`); readers are named in `circuit-host.json:17-21` | estate changes do **not** trigger `staging.yml`; the next platform deploy reads whatever estate is installed. The release fixture selection is data, "not runtime routing cases" (`deploy/staging/config.json:10-17`; `docs/automatic-staging-deployment.md:141-144`) | **becomes the home of page declarations, section composition, navigation and content rows.** Changes are estate publications (capability meaning only via `sfx-embody` migration pairs — `AGENTS.md`), no platform deploy |
| (d) content and media — images, decks, prose assets | images are map entries shipped in the image (`observe-server.mjs:39-44`); decks already read from estate evidence (`deck-store.mjs:11-14`) | same watched-path deploy (media lives under `live-circuit/**`) | **becomes data.** Media addressed by digest and served by content address; declarations reference the digest; no deploy |

**Target decision rule [proposal].** Deploy only what must be trusted before a
request is served: the gateway/observer/API shells, the security policies, the
generic renderer components, the declaration schema/validator, and the
component allowlist. Everything a visitor reads — page list, section
composition, copy, links, media — is a versioned declaration with a contract ID
and digest, refused visibly when invalid. Publishing it is a data operation with
its own gate, not a release.

---

## Runtime page loading options [proposal]

### Option A — estate-declared pages through the kernel (preferred)

- Add a `pages` reader beside `catalog`, `scenario` and `details`
  (`circuit-host.json:17-21`) and serve `GET /api/circuit/v1/pages?path=...`
  from `live-store.mjs:283-301`, inheriting the queue, timeout, size cap, cache
  and ETag machinery (`live-store.mjs:15-25`, `:164-187`, `:294-296`).
- Document contract (e.g. `site-page.v1`):
  `{ contractId, path, digest, sections: [{ component, props, bindings }] }`.
  The reader validates `outputContractId` and selection identity exactly as the
  existing readers do (`live-store.mjs:44`, `:204-209`, `:226-231`).
- Requires a declared reading in the estate, i.e. a new `sfx-embody` migration
  pair; no DAL change (`AGENTS.md`).
- Pros: one authority of record, one invocation path, one cache, existing
  refusal codes. Cons: uncached kernel reads took 3.9–5.0 s for details,
  mostly per-request kernel start-up (`docs/live-circuit-platform-revamp.md:353-359`);
  a resident delivery exists and should be used (`live-store.mjs:27-31`,
  `:106-116`).

### Option B — declaration files on the persistent `/home` volume

- App Service keeps `/home` across restarts and new images: the encrypted vault
  lives there and is proven unchanged after restart and after deploy
  (`Dockerfile.composite:46`; `gateway.mjs:24-31`;
  `deploy/staging/config.json:9`; `deploy/staging/release.mjs:117-118`, `:129`).
- The observer could read page declarations from a directory on that mount,
  cache in memory (TTL + ETag) and expose a signed-in, same-origin write
  endpoint.
- Pros: no kernel-start cost, trivially reviewable files, works offline.
  Cons: a second authority beside the estate; backup, migration and
  multi-instance invalidation are unsolved (`revamp.md:422-424`); the writer
  boundary is new. Suitable as a bridge, not the target.

### Option C — extend `circuit-host.json` per page (rejected)

- Any change under `live-circuit/circuit/**` is watched and deploys
  (`staging.yml:7`). Keep `circuit-host.json` for stable host policy only.

### Caching and invalidation

- Observed today: 30 s TTL, 24 entries / 32 MiB cache, `refresh=1` bypass
  (`circuit-host.json:11`; `live-store.mjs:286`), strong `ETag` with `304`
  (`live-store.mjs:294-296`), and `no-store` for static files
  (`observe-server.mjs:476`) and for errors (`live-store.mjs:298`).
- [proposal] Pages cache by `(path, declarationDigest)`; a new digest is the
  invalidation signal; keep `refresh=1` for operators and `no-store` on
  failures. No timer-based push needed because reads are same-origin.

### Versioning and digest validation

- The platform already refuses stale selections: `expectedSnapshotDigest` is
  validated and a mismatch is `409 SNAPSHOT_CHANGED`
  (`live-store.mjs:199`, `accept.mjs:97-98`), and the home preview refuses a
  scene whose `svgDigest` does not match (`site.js:48`).
- [proposal] Add `expectedPageDigest`; a mismatch renders "this page changed —
  reload" instead of a half-composed page. Digests are recorded in acceptance
  receipts as the estate's policy/scene digests already are
  (`revamp.md:452-453`).

### Failure display

- Precedent: a reading failure is a visible failure, never an empty workspace
  (`live-store.mjs:211-215`; `revamp.md:368-369`); the Explorer keeps its
  sections when the circuit fails to load (`explorer.js:79`); the home page
  prints "Host configuration could not be read" (`home.js:94-96`).
- [proposal] Same rule for pages: an invalid/unknown section or a digest
  mismatch produces a named, visible refusal; no blank shell and no silent
  omission.

### Hydration versus client composition

- The current pages are already client-composed from same-origin JSON — there
  is no SSR or hydration: `home.js:83-97` fetches home config, session, catalog
  and health in parallel; `explorer.js:332-342` mounts from reads. The
  browser's only writes are sign-in, sign-out and Observe
  (`docs/live-circuit-browser-session.md:34`).
- [proposal] Keep client composition with a generic component registry keyed by
  the section `component` name. An unknown key is refused, mirroring the
  existing `DECLARED_PROVIDER_REQUIRED` refusal (`live-store.mjs:240`;
  `accept.mjs:93-95`). This is the lane-1/3 provider stack's runtime contract.

### Local development workflow [proposal]

- Today: dependency-free ES modules, no build step; `verify-*.mjs` run with
  plain `node` (`AGENTS.md`; `staging.yml:35-42`). The observer runs directly
  (`node live-circuit/dispatch-pair/observe-server.mjs`), with `SDA_ESTATE_DIR`
  selecting a local kernel configuration (`live-store.mjs:13`;
  `revamp.md:291-294`), and a local fixture TLS server exists for transport
  tests (`live-circuit/dispatch-pair/fixture-server.mjs:1-67`).
- [proposal] Add a fixture page document and a file-backed page source to the
  observer so a page declaration can be exercised with `node verify-pages.mjs
  <base>` before it reaches the estate; keep zero build.

---

## Authority model

### Who may change what today

- Content authority is the estate: `sfx-embody` owns "capability rows, scene
  authority, the reading and its navigation policy, inspect evidence, migration
  lifecycle" (`revamp.md:240-243`). `sfx-platform` owns the runtime shell
  (`revamp.md:240`). Identity schema changes only through `sfx-dal` migrations
  (`AGENTS.md`).
- Host declarations (`circuit-host.json`, policy files) change only by reviewed
  repository commits; there is no runtime editor. The only browser writes the
  gateway admits are sign-in, sign-out and Observe
  (`gateway.mjs:162-164`; `docs/live-circuit-browser-session.md:34`).

### Boundaries that must be kept

- Server-side session validation (`identity-session.mjs:83-93`); Observe
  requires a signed-in session by default (`circuit-host.json:5`;
  `run-api.mjs:72-82`; fail-closed when identity is unconfigured,
  `identity-session.mjs:60`).
- CSRF: `SameSite=Strict` cookie plus present `Origin` equal to the forwarded
  host plus `Content-Type: application/json`
  (`identity-session.mjs:41-46`; `docs/live-circuit-browser-session.md:49-58`).
- Cookie: `__Host-sfx-session`, HttpOnly, Secure, `Path=/`, no Domain
  (`identity-session.mjs:169`; `docs/live-circuit-browser-session.md:39-46`).
- Gateway method allowlist: any non-GET circuit path outside the three declared
  POSTs is `405` (`gateway.mjs:162-164`).
- Per-user authority inside the SDA API is **not** established
  (`docs/live-circuit-browser-session.md:63-70`; `revamp.md:410-424`).

### [proposal] Authority for page declarations

- Public reads stay public and read-only. Authoring is a privileged write.
- Preferred near-term: authoring stays on the estate's governed publish path
  (migration pair / publication), not a browser CMS. Page declaration changes
  carry a contract ID and digest, and are installed like other estate data.
- If runtime authoring is later required, it must be a **declared capability**
  (meaning only through `sfx-embody` migration pairs — `AGENTS.md`), reached
  only through the session gate, with same-origin/CSRF checks identical to
  sign-in and Observe, and with per-user admission that does not exist yet
  (estate L5). It must appear in the gateway's explicit POST allowlist
  (`gateway.mjs:162-164`), never as an open route.
- Writes admit versioned declarations (new digest, previous retained), never
  free-form patches; no identity schema change (`sfx-dal` rule).

---

## Acceptance implications

### What staging must still prove (unchanged)

- Checks job: release policy, composite packaging, identity session, run API,
  objective, provider profile, run-scoped SSE, observer bridge
  (`staging.yml:35-42`).
- Bind by exact digest, restart, readiness and manifest/vault equality
  (`deploy/staging/release.mjs:64-121`, `:14-24`).
- Public reads, retired-route refusals, provider drill-down digest checks and
  stale-selection refusals (`accept.mjs:44-101`).
- Real browser sign-in, live Observe, replay at 1×/0.1×, durable run after a
  confirmed restart, external API CLI follow (`staging.yml:99-107`;
  `accept.mjs:8-18`, `:19-28`).
- Windows CLI login/logout/DPAPI checks in the separate job
  (`staging.yml:117-177`).
- Final confirmation: binding and health re-checked before `accepted.json`
  (`finish.mjs:1-15`; `docs/automatic-staging-deployment.md:138-139`).

### New checks a declarative UI needs [proposal]

1. **Schema validation** of page declarations at read time (and at publish time
   if a write path exists), refused with typed codes in the existing style:
   `404`/`409`/`422` (`live-store.mjs:214-215`, `:240`;
   `accept.mjs:75-78`, `:93-95`).
2. **Unknown component refusal**: the section `component` must be in the
   deployed registry; otherwise render the named refusal, never drop the
   section silently.
3. **Digest mismatch**: `expectedPageDigest` comparison, following the
   snapshot pattern (`accept.mjs:97-98`) and the SVG digest check
   (`site.js:48`).
4. **Data-only change gate**: a verifier, run like `verify-explorer.mjs`
   (`live-circuit/circuit/verify-explorer.mjs:2-9`), that fetches all declared
   pages and validates them against the deployed component registry without an
   image build. This is the cheaper gate that replaces deploy-per-content-change.
5. **No new client module needed**: assert a data-only page renders with the
   deployed module set, so the `pane-layout.js` failure class cannot recur
   (`git show 586dafd`).

### Keeping the rollback real

- A failed deploy/acceptance gate restores the prior exact digest while this
  workflow still owns the slot; another deployment's binding is never
  overwritten (`staging.yml:207-212`; `release.mjs:47-63`;
  `docs/automatic-staging-deployment.md:224-241`).
- [proposal] Data publishes need an equivalent, reversible gate: validate
  before publish; retain the previous declaration digest; on failure keep
  serving the last good page (degraded, visible) rather than a blank one.
  Whether data publication is atomic with the estate's own migration mechanism
  is an open question.

---

## Deploy economics

### What triggers a release

- Watched paths: `live-circuit/**`, `deploy/sda-kernel/**`, `deploy/staging/**`,
  `tools/live-circuit/**`, `tools/sfx-api/**`, `infra/azure.json`,
  `infra/authorize-staging-release.ps1`, and the workflow itself
  (`staging.yml:6-14`). Docs and the root README are outside and do not restart
  staging (`docs/automatic-staging-deployment.md:8-12`).
- One release runs at a time; newer pushes never cancel a running release
  (`staging.yml:21-24`; `docs/automatic-staging-deployment.md:170-172`).

### Cost of one release (observed)

- Job budgets: checks 10 min, deploy 55 min, windows-cli 20 min, finish 15 min
  (`staging.yml:29`, `:48`, `:120`, `:183`).
- Work inside a deploy: pinned identity `dotnet publish`
  (`staging.yml:91-95`; `build-identity.mjs:13-17`), composite staging and
  hashing (`prepare-composite.mjs:31-68`), ACR build
  (`release.mjs:100-106`), pull of the previous image to read its manifest
  (`release.mjs:71-76`), bind/restart/readiness with a 10-minute deadline
  (`release.mjs:14-24`, `:110-120`), Playwright install
  (`staging.yml:73-76`), full browser/replay gates (`accept.mjs:8-18`),
  restart/durable/external gates (`staging.yml:102-107`), and the Windows CLI
  job (`staging.yml:117-177`).
- Measured wall-clock (GitHub API, Oct 6–7 2026): last successful push
  `37656076412` = 16m11s; workflow_dispatch `37661922323` = 18m05s; other
  successes 12m43s–16m51s (`37513029598`, `37617943437`, `37518715996`,
  `37550222803`, `37621099659`). Failing releases still cost 7m36s–14m37s and
  run a rollback (`37524443832`, `37544368654`, `37511837459`, `37506870735`).
  This matches the brief's 16–18 minutes plus a build (`research-brief.md:88-90`).

### Target [proposal]

- Page structure, content and media changes cost **zero releases**. They move
  through the estate/publication path with the new data gate.
- Full deploys remain for: runtime/shell code, host trust policy, the
  declaration schema/validator, and anything that changes the component
  registry — because those define what a declaration is allowed to mean. That
  is the correct place to keep today's full acceptance and rollback.

---

## Gaps and unknowns

1. **Authoring identity and roles.** There is no browser authoring identity or
   per-user authority in the API yet (`docs/live-circuit-browser-session.md:63-70`;
   `revamp.md:410-424`). A browser CMS is blocked on estate L5; near-term
   authoring must be estate-side.
2. **Estate publish workflow.** How quickly a declaration/content change can be
   made and installed (migration pair vs direct row write, review, rollback) is
   not documented here and needs an owner decision.
3. **Page read latency.** Uncached capability-details reads are 3.9–5.0 s,
   mostly kernel start-up (`revamp.md:353-359`). A page reader should use the
   resident delivery (`live-store.mjs:106-116`); actual page-read timing is
   unmeasured.
4. **Media storage.** `/home` persistence is proven for the vault across
   restarts and deploys (`release.mjs:117-118`, `:129`), but ownership,
   backup, size limits, and whether media belongs in SQL, `/home`, or an
   object store are undecided.
5. **URL / IA mapping.** The gateway only special-cases `/` and
   `/favicon.ico` (`gateway.mjs:171-178`); the six-story IA wants many
   top-level paths (`intent.md:970-1044`). Either the gateway gains a prefix
   rule or all pages live under `/circuit/`. The Explorer route-name question
   remains open (`revamp.md:464-465`).
6. **Draft/preview semantics.** Digest validation gives integrity, not a
   staging/preview/rollback workflow for declarations.
7. **Home block migration.** `circuit-host.json`'s `copyBasis` anticipates
   estate authority for the featured list (`circuit-host.json:6`), but no
   `home` reader exists.
8. **Multi-instance cache.** Multiple instances wait on durable, coordinated
   state (`revamp.md:422-424`); a page cache would need invalidation across
   instances or a shared store.
