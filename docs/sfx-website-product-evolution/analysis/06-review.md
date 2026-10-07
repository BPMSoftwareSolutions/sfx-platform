# 06 — Adversarial review of `implementation-strategy.md`

Review lane for the SFX website evolution. Research only: no product code changed, no commit
made. Reviewed 2026-10-07 against
[`implementation-strategy.md`](../implementation-strategy.md) (Revision 1), [`intent.md`](../intent.md),
[`research-brief.md`](../research-brief.md), lanes 01–05, and the code.

Method: every claim about current behaviour in the strategy's §1–§9 and Appendix A was
spot-checked against the repository; `path:line` cites the conflict. Verified positions that
need no correction are recorded after the list. Severity: **blocker** = the document is
internally wrong or the plan cannot land without a change; **should-fix** = implementable but
materially incomplete, misleading or unsafe; **polish** = citation/consistency defect.

---

## Corrections

### C1 (blocker) — Retiring the `home` host block breaks the untouched Explorer

**Strategy:** D1 (line 168: "the `home` block is retired"), D6 (line 173), §2.3 (lines 121–128);
§1.3 (lines 71–73: "Converting the Explorer … its acceptance pins stay untouched in v1").

**Evidence:** `live-circuit/circuit/explorer.js:332` fetches `/api/circuit/v1/home`; `:338–340`
uses `host.body.environment` for the environment label and `host.body.hero` as the **default
capability selection when the URL has no query**, falling through to `open(...)`. `GET
/api/circuit/v1/home` is `observe-server.mjs:430–433`, sourced from `circuit-host.json:6`.
Retiring the block (or the endpoint) removes the Explorer's default selection and env label —
behaviour the strategy promises not to touch.

**Required change:** keep `home.hero` and `GET /api/circuit/v1/home` as host trust/route data
(and say so), or migrate the Explorer fallback to the declared navigation data and add the
Explorer acceptance impact explicitly — which contradicts §1.3 as written.

### C2 (blocker) — The data-only publish path has no named tool; hidden migration/DAL costs are unstated

**Strategy:** §4.6 class (c) (line 275: "estate publication (migration pair / publish
procedure)"); §7.1 (lines 502–505: `publish_ui_page`/`rollback_ui_page` "both in a migration
pair"); §7.4 (lines 533–536: "No change in v1 … adds no generated repository").

**Evidence:** Estate procedures are installed by migration pairs run through the SDA-checkout
lifecycle (`sfx-embody/AGENTS.md:66–90`, still the estate's "owed violation"). A server-side
writer needs `sfx-dal` registration + regeneration + service publish
(`docs/live-circuit-provider-details.md:219–241`, `:240`). The slash in "migration pair /
publish procedure" means either every content publish is a migration-pair lifecycle action or
the publish is a server-side DAL call — and the second contradicts §7.4. The strategy never
says what the publisher executes, nor that the initial `readers.page`, route host, registry
route and component adapters are watched-path deploys while a subsequent page publish is not.

**Required change:** name the tool exactly (e.g. `publish_ui_page` invoked by SQL from the
estate's governed publish path; DAL not required). State the one-time install/deploy costs
(migration pair install, class (a)/(b) shell deploy) versus per-publish costs (none), and
reconcile §7.1/§7.4. If a DAL call path is chosen, add the registration/regeneration/release
to P0.1/P0.5 instead.

### C3 (blocker) — The Phase 0 home declaration uses an undeployed component kind (`hero`)

**Strategy:** §5.3 (line 345: `"component": { "kind": "hero" … }`); §5.4 (lines 372–387: contract
for kind `hero`); vs §4.2 (lines 190–202), §7.2 (line 513) and B.1 (line 788), whose v1 allowlist
is `section, text, heading, stat, card, card-list, list, media.figure, identity-session, notice`.

**Evidence:** §4.3's own rule (lines 217–219) refuses an unknown kind with
`UI_COMPONENT_NOT_SUPPORTED`. The strategy's first page example therefore fails its own
validator, and the `hero` contract cannot be published against `ui.components`.

**Required change:** add `hero` to §4.2/§7.2/B.1 (and the Phase 1 additions table), or rewrite
the §5.3/§5.4 example to compose the hero from deployed kinds.

### C4 (should-fix) — The gate promotes before it verifies and has no automatic rollback

**Strategy:** §4.6 (lines 278–285): (3) "publish append-only, move the current pointer …";
(4) "run `verify-pages` against staging and record a publish receipt"; (5) "rollback is a pointer
move … plus a re-verify."

**Evidence:** the existing release proves the opposite discipline: a failed gate **automatically**
restores the prior digest (`staging.yml:207–212`; `docs/automatic-staging-deployment.md:224–241`).
The strategy's read-time degraded fallback only covers registry/digest failures, not a
semantically wrong revision that passes schema validation. As written, a failed WP0.4 leaves the
broken revision current until a human acts.

**Required change:** verify the candidate revision against the deployed registry before moving
the pointer (candidate revision + current pointer, promote only on pass), or make failed verify
trigger an automatic pointer rollback; name who owns that automation.

### C5 (should-fix) — "Media references are data" hides a new serving route

**Strategy:** §4.6 class (d) (line 276); §1.1 (lines 55–56); §11.1 R9 (line 714); G5 (line 745:
"Digest-addressed on `/home` for v1").

**Evidence:** the observer serves a fixed hand-maintained allowlist and 404s anything else
(`observe-server.mjs:14–45`, `:473–480`); the gateway only proxies `/circuit/*` and
`/api/circuit/*` (`gateway.mjs:157`). No route serves digest-addressed media from `/home`.
Publishing new media therefore requires a new observer route — a watched-path class (a)
deploy — not a data-only publish.

**Required change:** define the media serving route and classify it as a deploy (or estate
reader); or restrict v1 declarations to media already in `CIRCUIT_FILES` and say so.

### C6 (should-fix) — `expectedPageDigest` cannot be supplied on first load

**Strategy:** §4.5 (line 261: "requests `GET /api/circuit/v1/page?path=…&expectedPageDigest=…`");
§6.1 (line 443); §5.7 (lines 426–429).

**Evidence:** nothing in §4.5/§5.1/§5.7 tells the client where the digest comes from before the
first page read. Deep links, reloads and popstate all arrive without one. As written, either
every first read omits the guard (making the 409 coverage hollow) or the design is unimplementable.

**Required change:** define acquisition — omit on first load and bind the returned digest for
subsequent reads; carry the digest in declared navigation links; or fetch the manifest first.
State how 409 `PAGE_SNAPSHOT_CHANGED` is ever reached.

### C7 (should-fix) — Event-to-action input binding is undefined

**Strategy:** §4.4 (lines 247–251); §5.5 (lines 391–394: `"input": { "subject": { "binding":
"subject" } }`); §5.6 (lines 401–403).

**Evidence:** no section defines what `binding` resolves against — row values, form controls,
component state, URL/query — nor how several values are shaped for `observe`/`objective`. The
action descriptor is the only place a declared action receives data, and it is a placeholder.

**Required change:** define binding scopes and resolution (e.g. `event.value`, `section.row.<field>`,
`form.<name>`, `route.<param>`), the admitted input shape per kind, and the refusal when a
binding cannot resolve.

### C8 (should-fix) — The host registry manifest and source allowlist have no schema

**Strategy:** D2 (line 169: shell fetches a fixed host-managed source registry), §6.1 (lines
448–449: sources limited to `catalog, session, release, scenario, details, provider-inspection`),
§5.3 (line 368: `UI_SOURCE_NOT_SUPPORTED`), §7.2 (lines 512–519: only `ui.components` and
`readers.page`).

**Evidence:** `session` (`/api/circuit/v1/session`) and `release` (`/healthz`) are not
`circuit-host.json` readers (`circuit-host.json:17–21`); `provider-inspection` is the
retrieval-backed reader (`:12–16`). The registry manifest the validator and gate consult is
never specified, so neither the client nor the publish gate can implement the allowlist check.

**Required change:** add the `ui-registry` manifest schema to §7.2 (component kinds/versions,
action kinds, source ids/routes, contract versions, route-host version) and state which fields
are class (b) versus class (c).

### C9 (should-fix) — Signed-in home copy cannot be declaration data; WP0.4 is overstated

**Strategy:** D6 (line 173: home sections render from the declared page); §10 WP0.4 (line 620:
"a live home copy change published as data with no release").

**Evidence:** `home.js:23–28` swaps eyebrow/headline/lede/micro when a session is present, and
`home.js:32–45` renders the session run list; the recovered public page read is cached and
session-free by design (§6.1, lines 454–455). A per-session copy variant has no representation
in the declaration anatomy of §5.

**Required change:** either define state-scoped copy (e.g. sections/roles conditioned on
session), or keep session copy in the shell and scope WP0.4's "copy change" claim to public
copy. Add a WP0 gate that proves the signed-in variant still renders after conversion.

### C10 (should-fix) — Phase 0 entry cites the wrong gates

**Strategy:** §10 (line 647: "gates G1, G5 (component set), G6 (publication ownership)
answered"); §11.4 (lines 744–746): G4 = publication ownership, G5 = media storage,
G6 = component registry set.

**Required change:** "G1, G4 (publication ownership), G6 (component set)" — otherwise the
decision the phase actually depends on (G4) is not the one requested.

### C11 (should-fix) — The page-local `<style>` ban conflicts with "Explorer untouched"

**Strategy:** D7 (line 174: "ban page-local `<style>` blocks"); §1.3 (lines 71–73); §11.2
(line 728).

**Evidence:** all three pages carry local style blocks: `home.html:10–52`, `login.html:9–37`,
`explorer.html:10–192`. Enforcing the ban globally rewrites `explorer.html`, which the strategy
places out of scope and whose acceptance pins must survive.

**Required change:** scope the ban to new and converted pages in v1, or schedule the Explorer
style migration as a separate deploy with its own acceptance note.

### C12 (should-fix) — The Phase 1 pick and its rationale are not supported by the cited page

**Strategy:** §10 Phase 1 (lines 663–673): the industry template "forces declared navigation and
the `table`/`field-list`/`disclosure`/`badge` component additions"; "success converts ten pages
at once in Phase 2".

**Evidence:** the template at `intent.md:169–179` is a five-stage static narrative
(INDUSTRY PRESSURE → … → EVIDENCE); it does not require tables, field lists or data bindings,
so Phase 1 as written proves static composition only — the data/actions/events half of the
hypothesis (`research-brief.md:30–34`) stays unproven until Phase 2. "Ten pages at once" counts
the ten regulated industries (`intent.md:154–165`) but the Solutions IA (`intent.md:990–998`)
also contains non-industry doors (Independent Evaluation, Enterprise AI Governance, Government
& Defense) that do not use the template.

**Required change:** justify each Phase-1 component from the actual page content, add at least
one data-bound section (e.g. a Standards crosswalk table reading a declared reader) to prove
bindings, and reword the conversion claim to "ten industry instances".

### C13 (should-fix) — "Six-story IA" and the citation do not match intent

**Strategy:** §1.2 (line 67: "the six-story IA"); §10 Phase 2 (lines 688–689: "the six-story IA
(`intent.md:970-1044`)").

**Evidence:** `research-brief.md:9–12` lists six stories; `intent.md:970–1044` is a nine-area
top-level IA (Why SFX, Platform, Solutions, Standards, Ecosystem, Research, Media, Academy,
Product). The Phase 2 list itself has nine waves.

**Required change:** use "six positioning stories" for the brief and "nine-area IA" for
`intent.md:970–1044`; do not conflate them.

### C14 (should-fix) — The kernel-vs-retrieval choice is correct but the contrast is missing

**Strategy:** §7.3 (lines 525–529: page reads are kernel invokes so `retrieval-policy.json` is
not extended); §7.4 (lines 531–536).

**Verified correct:** the four-step retrieval chain (estate procedure → `sfx-dal` registration +
regeneration → `retrieval-policy.json` admission → `circuit-host.json` reader) applies only to
the procedure-extract path (`docs/live-circuit-provider-details.md:76–100`); the kernel readers
`catalog`/`scenario`/`details` are absent from `retrieval-policy.json` (`deploy/sda-kernel/
retrieval-policy.json:2–9`; `circuit-host.json:17–21`), and the revamp explicitly rejected the
retrieval allowlist because it "would tie every reading change to DAL regeneration and a
service release" (`docs/live-circuit-platform-revamp.md:362–364`).

**Required change:** state the rejected path and its DAL/policy/service costs explicitly, and
confirm the order: `read-ui-page` estate install → `readers.page`/route host/registry (class b
deploy) → declarations (class c). This prevents an implementer from repeating the retrieval
chain for the new reader.

### C15 (polish) — Snapshot-refusal citation is wrong and the 422 style is missing

**Strategy:** §5.7 (line 429: "409 … in the style of the existing snapshot refusal
(`live-store.mjs:199`; `accept.mjs:97-98`)").

**Evidence:** `live-store.mjs:199` is the 400 for a malformed `expectedSnapshotDigest`; the 409
mapping for `*_SNAPSHOT_CHANGED` is `live-store.mjs:37,149`, and `accept.mjs:97–98` shows the
409. The existing refusal vocabulary is 404/409/**422** (`README.md:48–52`;
`live-store.mjs:42,154`), but §5.7/§8.4/§9.2 never define the invalid-declaration refusal.

**Required change:** correct the citation and add the schema-invalid refusal (e.g.
`UI_DECLARATION_INVALID`, 422) to the §5.7 rules and §9.2 WP0.2 fixtures.

### C16 (polish) — `toggle` runs-all seam citation

**Strategy:** §4.4 (line 241) cites only `circuit-runtime.js:387-388` for
`follow`/`overlay`/`runs-all`.

**Evidence:** `runs-all` is wired at `run-context.js:52,58`; `circuit-runtime.js:387–388` covers
`overlay` and `follow` only.

**Required change:** cite both seams.

### C17 (polish) — Write enumeration omits the observer's testimony admission routes

**Strategy:** D4 (line 171) and §8.1 (lines 566–574: "Writes stay exactly: session sign-in/out
… and Observe/objective `POST /runs`").

**Evidence:** the observer also accepts `POST /events` and `/events/batch`
(`observe-server.mjs:463–466`). The public gateway does block them (`gateway.mjs:162–164`;
`accept.mjs:49` pins `POST /events` → 405), so the browser-write claim holds, but the statement
"writes stay exactly" is incomplete and the DA route is reachable in local development.

**Required change:** name the admission routes and state they are testimony ingestion, not a
browser write path (and that the gateway 405s them publicly). Also spell the session paths in
full (`/api/circuit/v1/session[/logout]`) rather than `/session`.

### C18 (polish) — "Adding a declared page needs no deploy" is unqualified, and module serving is ambiguous

**Strategy:** §4.5 (lines 265–267); §6.4 (line 483); §9.2 (line 625).

**Evidence:** the route host serves `page.html` for `/circuit/<slug>`, but `page.js` has a dot
and cannot match the slug regex; unless `page.js`/`page-runtime.js`/`ui-components.js` are
`CIRCUIT_FILES` entries, the browser import 404s (`observe-server.mjs:14–45`, `:473–480`).

**Required change:** state that the new modules are map entries and acceptance pins (the
strategy says this generically; name the modules), and qualify "no deploy" as "no deploy for
instances of deployed kinds, after the route host and registry have shipped".

### C19 (polish) — "Everything a visitor reads is a declaration" overstates the shell

**Strategy:** §1.1 (lines 55–56).

**Evidence:** D6 (line 173) keeps header/footer/identity as shell, and §4.5 says only the nav
mount renders from a navigation declaration. Header/footer copy and `home.html:55–61,111–118`
chrome are not declared.

**Required change:** state the boundary (chrome and identity stay shell; nav, section and page
content are declared).

---

## Verified positions (no correction required)

- **Read path (review item 4):** the strategy correctly uses a kernel-invoked `read-ui-page`,
  mirroring `read-capability-details` and `read-live-scenario-circuit`
  (`sfx-embody/sql/migrations/declare-live-scenario-circuit.commit.sql:785–791`;
  `circuit-host.json:17–21`). No `sfx-dal` registration, retrieval-policy edit or
  procedure-extract change is needed on that path (C14 asks only for the explicit contrast).
- **Platform rules (item 2):** capability meaning stays in `sfx-embody` migration pairs; SDA
  changes are deferred to G2; identity schema is untouched; no writer enters retrieval policy;
  no new browser write path; no build step or framework for `live-circuit` (§6.4).
- **Action taxonomy (item 7):** all twelve kinds map to existing seams, spot-checked:
  `syncUrl` (`explorer.js:36–42`), selection (`explorer.js:89–107`; `circuit-runtime.js:108–117`),
  session (`identity-session.mjs:143–183`), observe (`run-api.mjs:62–68`), objective
  (`objective-run.js:22–25`), playback/view/toggle (`circuit-runtime.js:387–398`), pane
  (`pane-layout.js:43–52`), copy/download (`run-context.js:80–90`), stage-change
  (`provider-profile.js:70–72`), refresh (`live-store.mjs:286`). None invents authority.
- **Contractual surfaces (item 6):** `verify-objective.mjs`, `verify-provider-profile.mjs` and
  `verify-explorer.mjs` drive the Explorer (`explorer.html`/`explorer.js`, `circuit-host.json`
  retrieval block) and are unaffected by home conversion; the staging browser acceptance drives
  Explorer `#identity` from `/circuit/explorer` (`tools/live-circuit/verify-browser-session.mjs:101–104,161`),
  not home. C1 is the one real contractual conflict found.
- **Modules and rollback (item 5):** the strategy does state the `CIRCUIT_FILES`/acceptance rule
  and pointer rollback (§6.4, §9.2, §9.3); C5/C18 ask for the missing specifics.
- **Security/honesty (item 9):** reads-are-not-receipts (D8), failures never empty (§8.4),
  credentials server-side (§8.1), named refusals, degraded visibility and publisher-owned
  rollback are all present; C4/C15 tighten them.

## Verdict

**Implementation must not start until C1–C3 are fixed** (Explorer dependency, publish tool and
hidden costs, self-refusing `hero`). C4–C14 are material and should be fixed in the same revision
because they define what "data-only" means and whether the first page can be implemented from the
document alone; C15–C19 are citation and consistency cleanup.

**The user must decide first:** the publication tool and owner (C2, G4); whether host `home`
survives as route data or the Explorer fallback migrates (C1); the v1 component allowlist
including `hero` (C3, G6); and the media serving/storage route (C5, G5). Home remains the right
thin slice; the industry Solutions template remains a reasonable Phase 1 **only if** a data-bound
section is added and the conversion-count claim is corrected (C12).
