# 09 — Iteration-loop tooling: author, preview, publish-and-capture, signed-in evidence, fixture sync

Research lane for the author-and-review iteration loop of declarative UI circuits (R&D lane 3,
WP0.6). Question: what tooling makes a page change cheap to author, inspect, publish, capture and
keep honest end to end? Method: read-only. Every claim about current behaviour cites `path:line`.
Everything marked `[proposal]` is design, not observable behaviour. No product code was changed
and nothing was committed. The strategy's work items are
[`implementation-strategy.md`](../implementation-strategy.md) §9.2, §10, G8.

---

## 1. What exists today (verified 2026-10-07)

### 1.1 The publish path

- The publisher/orchestrator is `sfx-embody/tools/publish-ui-page.mjs`. One run is
  validate → stage → candidate read → promote (CAS) → post-verify → receipt/rollback
  (`publish-ui-page.mjs:7`, `:89-157`). The candidate is a `ui-page-definition.v1` file;
  the receipt defaults to `docs/sfx-website-product-evolution/evidence/WP0-publish-*.json`
  (`:44-45`).
- Validation is deliberately shallow: `checkRegistry` compares component `kind`/`version` and
  action `kind` against `GET /api/circuit/v1/ui-registry` (`publish-ui-page.mjs:66-81`); source
  ids are read but discarded (`void sources`, `:79`). It does **not** check prop/binding role
  vocabulary, `contractDigest`, binding kinds, events or `when` values.
- Candidate verification reads the staged revision with `revision=N&refresh=1` and requires the
  served `pageDigest` to equal the file's SHA-256 (`publish-ui-page.mjs:117-122`). Promotion is a
  conditional pointer move with `expectedCurrentRevision` (`:124-130`); a failed post-verify
  triggers automatic `rollback_ui_page` under the same CAS law (`:137-147`); `--fail-post-verify`
  exists for the rollback drill (`:132,146`).
- The reader supports `payload.revision` and `expectedPageDigest` and returns
  `NOT_FOUND`/`NOT_DECLARED`/`SNAPSHOT_CHANGED` statuses
  (`sfx-embody/sql/migrations/declare-ui-page-reading.commit.sql:245-272`); the CAS procedures and
  the pointer law are in the same migration (`:39-41`, `:341-369`, `:372-397`).
- The platform serves the same selection over `GET /api/circuit/v1/page`
  (`live-circuit/circuit/live-store.mjs:267-302`, `:391`) and validates the composed document at
  read time against `circuit-host.json`'s `ui.components` allowlist
  (`live-store.mjs:249-265`; `circuit-host.json:17`).
- The deployed `ui-registry` manifest intentionally carries only kind/version and no contract
  digests or roles (`live-store.mjs:353-359`); the estate's role vocabulary lives in
  `sidefx_ui.ui_component_definition` rows (`declare-ui-page-reading.commit.sql:127-144`) and in
  each client adapter's `supportedRoles` (`live-circuit/circuit/ui-components.js:450-495`).
- The client validator refuses a prop or binding role outside the adapter's `supportedRoles` with
  `UI_COMPONENT_ROLE_UNSUPPORTED` at render time (`live-circuit/circuit/page-runtime.js:142-170`).
- Publish receipts exist (`evidence/WP0-publish-rev2.json`, `-rev3.json`,
  `-2026-10-07T200044.json`, `-2026-10-07T200052.json`) and record `fromRevision`,
  `candidateRevision`, `digest`, steps, refusal and actor (`WP0-publish-2026-10-07T200052.json:1-51`).

### 1.2 Revision reads and preview

- `revision=N` is a working server-side read (SQL `:245-265`; publisher `:117`), but neither page
  entry module ever sends it: `page.js` and `home.js` fetch by `path` (+ bound digest) only
  (`live-circuit/circuit/page.js:38-59`; `home.js:49-85`). There is therefore no URL today that
  renders a staged candidate before promotion; the only pre-promotion visual check is the
  publisher's digest/status read, which is not a browser render.

### 1.3 Capture and deck

- `capture_live_ui.mjs` is the visual source of truth: it captures `/circuit/home` (desktop and
  mobile) and `/circuit/explorer` with a headless pinned Chromium
  (`sfx-providers/outputs/capability-estate/live-circuit-platform-explorer/U1/generator/capture_live_ui.mjs:39-59`,
  `:180-196`), records per-section DOM geometry, refusals and page revision/digest (`:133-178`),
  writes `sources/visual/capture.json` and refreshes the page/registry snapshots next to it
  (`:233-252`). Its own origin read is plain: no `refresh=1`, no revision pin (`:92-98`).
- `build_ui_page_deck.py` asserts cross-source invariants before saving (capture revision ==
  page-document revision == publish receipt digest; every PNG hashes to its record; every
  captured section exists in the declaration) (`build_ui_page_deck.py:86-109`) and makes the pptx
  byte-stable for a fixed capture (`:375-391`). Some assertions are hard-coded to the current
  capture set: revision 4, 13 sections, 10 contracts, 3 captures, 2 desktop
  (`:88-93`).
- `verify_deck.py` re-opens the saved deck and re-verifies embedded image hashes, every
  annotation rectangle recomputed from `capture.json`, caption/legend/state text and both
  appendices (`verify_deck.py:88-190`). `render.ps1` proves the deck opens in PowerPoint through
  COM (`generator/render.ps1:1-17`).
- `U1/SHA256SUMS` is a hand-maintained 26-line list of deck, render PNGs, generator files and
  sources (`U1/SHA256SUMS:1-26`). Nothing regenerates it; the U1 `sources/README.md` is likewise
  manual (`sources/README.md:1-67`).

### 1.4 Signed-in evidence (WP0.6)

- Local capture supports signed-in home only when `SFX_CAPTURE_IDENTIFIER`/`SFX_CAPTURE_PASSWORD`
  arrive from the environment or `--env-file`; otherwise it records the two captures as `pending`
  with `TEST_PRINCIPAL_CREDENTIALS_UNAVAILABLE` and captures nothing
  (`capture_live_ui.mjs:72-75`, `:198-228`). The current local record is pending
  (`sources/README.md:41-45`).
- The staging browser gate already acquires a private, ephemeral principal through OIDC → Key
  Vault (`deploy/staging/accept.mjs:8-14`; `deploy/staging/common.mjs:46-51`), passes it to
  `tools/live-circuit/verify-browser-session.mjs` over stdin, and that verifier signs in through
  the product UI, asserts cookie attributes and never prints or persists the credential
  (`verify-browser-session.mjs:1-3`, `:11-13`, `:71-95`, `:186-187`). The workflow runs this and
  uploads `artifacts/staging/` with 30-day retention (`staging.yml:101-116`).
- The signed-in home's declared variants exist and are exercised: `when: signed-in` sections
  `home-counts-session`, `home-signed-in-heading`, `home-signed-in-runs`
  (`fixtures/pages/home.json:120-146`, `:224-262`), scoped selection in
  `page-runtime.js:407-429`. No browser step asserts or screenshots them yet.

### 1.5 Local fixtures and the role-vocabulary defect

- Six file-backed fixtures exist (`live-circuit/circuit/fixtures/pages/`: `home`, `degraded`,
  `stale`, `unknown-component`, `unknown-action`, `unsafe`). The observer serves them through
  `SFX_PAGE_FIXTURE_DIR` (`live-store.mjs:279-293`); `verify-pages.mjs --fixtures` starts the
  observer on port 8897 and runs every group (`verify-pages.mjs:4-7`, `:64-100`, `:138-193`), and
  CI runs it in `checks` (`staging.yml:41`).
- The fixtures are hand-maintained: the fixture check reads a slug's JSON and only asserts the
  negation marker appears (`verify-pages.mjs:148-159`). Nothing compares `home.json` against the
  served declaration. `home.json` currently matches revision 4 / digest
  `b5892887…` (`fixtures/pages/home.json:6-7`; the same values in the U1 snapshot,
  `sources/README.md:14`).
- The role-vocabulary defect is commit `bcf1e52` ("The adapters declared internal prop names
  instead of the `ui-component.v1` role vocabulary, so most home sections refused at render.
  Support exactly the contract roles and props; verify-pages stays green."). It repaired adapters
  and fixtures together. Nothing prevents a repeat: the publisher cannot see roles (§1.1), the
  registry manifest does not carry them (`live-store.mjs:353-359`), and the fixture check does not
  compare role keys against anything.

### 1.6 Cache and publication consistency

- Page reads are cached per observer instance: key `[name,payload]` incl. path/revision/digest,
  LRU 24 entries / 32 MiB / 30 s TTL, `refresh=1` bypass, in-flight coalescing, ETag/304, and
  `no-store` on the error path (`live-store.mjs:164-187`, `:386`, `:396-401`;
  `circuit-host.json:11`). Measured: cold 1128–1378 ms, warm 40–50 ms
  (`evidence/WP0-latency-2026-10-07.json:8-16`).
- The strategy records the single-instance scope and defers the promise to gate G8
  (`implementation-strategy.md:566-574`, `:970`). The publisher post-verifies one base URL only
  (`publish-ui-page.mjs:133-136`); nothing tells a capture whether its read came from a lagging
  instance or a TTL hit.

---

## 2. What to build, in order (all scripts dependency-free ES modules)

Build order: T1 (the validator is the base for T2, T3, T5) → T2 → T3 (visual review follows
promotion) → T4 (CI artifact) → T5 (drift guard). Acceptance evidence follows the WP0
conventions (`implementation-strategy.md:810-826`; evidence files under
`docs/sfx-website-product-evolution/evidence/`).

| # | Tool [proposal] | Purpose | Effort | Main risk |
| --- | --- | --- | --- | --- |
| T1 | `tools/live-circuit/page-definition.mjs` + schema + template | full authoring validation | M | a third validator diverging from the shell |
| T2 | `tools/live-circuit/diff-page-revisions.mjs` (+ preview parameter) | revision diff / candidate preview | M | preview not using the one renderer |
| T3 | `tools/live-circuit/publish-capture.mjs` (+ SHA256SUMS updater) | one-command publish→capture→deck→sums | S–M | hard-coded deck assertions; cross-repo paths |
| T4 | staging-gate screenshot step | signed-in artifact (WP0.6) | S | session-scoped, non-deterministic pixels |
| T5 | `tools/live-circuit/sync-page-fixtures.mjs` (+ publisher role check) | fixture/role drift guard | M | fixtures becoming generated artifacts |

### T1 — Page-definition authoring schema, validator and example template `[proposal]`

- `tools/live-circuit/page-definition.mjs`: one export `validatePageDefinition(candidate,
  registry)` returning `{ ok, refusals: [{ code, sectionId?, detail }] }` using the existing code
  vocabulary (`UI_DECLARATION_INVALID`, `UI_COMPONENT_NOT_SUPPORTED`,
  `UI_COMPONENT_ROLE_UNSUPPORTED`, `UI_SOURCE_NOT_SUPPORTED`, `UI_ACTION_BINDING_UNRESOLVED`;
  `page-runtime.js:173-254`; `live-store.mjs:249-265`). Checks the definition document id,
  `pageId`/`path`/`revision`, `layoutRef`, source refs and the 8-source cap, unique `sectionId`s,
  component kind/version and `contractDigest` presence, prop/binding role keys against the
  component contract's roles, binding-kind closure, action kind/`dispatchClass`/
  duplicate `actionId`, input scope vocabulary, event on/action resolution and `when.session`.
- The role map comes from the estate contract rows; the publisher already has a database pool
  (`publish-ui-page.mjs:83-92`), so it can read `sidefx_ui.ui_component_definition` roles
  (`declare-ui-page-reading.commit.sql:127-144`) instead of relying on the manifest, which
  deliberately omits them (`live-store.mjs:353-359`). For local fixtures, generate the contract
  file that is currently hand-extracted: `sources/README.md:16` describes
  `ui-component-contracts.v1.json` as copied from the migration; `[proposal]` a
  `export-component-contracts.mjs` reads the same seed or DB and writes it.
- `tools/live-circuit/templates/ui-page-definition.v1.template.json`: the migration's home seed
  document is the canonical example (`declare-ui-page-reading.commit.sql:147-223`); the template
  is that shape with placeholder props, a `{ kind, version }` stub per admitted kind and comments
  removed (JSON has no comments; an adjacent `AUTHORING.md` explains roles).
- Acceptance evidence: `node --test tools/live-circuit/page-definition.test.mjs` (run from
  `staging.yml`'s `checks`, beside `:41`) proves (a) the current `home.json` fixture and the U1
  `ui-page.v1-home.json` snapshot pass, (b) each of the five negatives refuses with its declared
  code, (c) a candidate that renames `text.role` to an unknown role refuses
  `UI_COMPONENT_ROLE_UNSUPPORTED` **before** staging. `verify-pages.mjs` imports the same module
  so `--fixtures` keeps WP0.2/WP0.7 evidence real (`implementation-strategy.md:815,820`).

### T2 — Revision diff and candidate preview `[proposal]`

- `tools/live-circuit/diff-page-revisions.mjs <base> <path> <fromRevision> <toRevision>`: two
  `GET /api/circuit/v1/page?path=…&revision=N&refresh=1` reads (`live-store.mjs:391`), then a
  structural diff keyed by `sectionId` and role (added/removed/changed props, bindings, actions,
  events, `when`), plus revisions and digests. Output JSON and a human summary; exit 1 on
  unintended changes only when asked (`--fail-on-change`). This is the "read revision=N" step the
  publisher already uses (`publish-ui-page.mjs:117`) promoted to a review tool.
- Candidate preview (visual): the one renderer reads no revision today (`page.js:41-44`;
  `home.js:51-54`). Two honest options. `[proposal]` (preferred, smallest) accept `?revision=N`
  in `page.js`/`home.js` only as a read parameter, add it to the API query and skip digest
  binding for that load, document it operator/staging-only, and pin it in acceptance; or accept
  that full visual review happens after promotion and T3 recaptures. Do **not** build a second
  renderer (strategy §11.2, `implementation-strategy.md:940-943`).
- Acceptance evidence: diff of the seeded revision 1→4 and of revision 3→2 (rollback direction)
  reproduces the expected section deltas; the preview URL renders the staged candidate with the
  same adapter registry and one renderer, screenshot recorded as evidence.

### T3 — Publish-and-capture in one command `[proposal]`

- `tools/live-circuit/publish-capture.mjs` orchestrates, with all cross-repo paths as flags:
  1. run the publisher (`--publisher <sfx-embody/tools/publish-ui-page.mjs> --candidate
     <definition.json> --base <url> --actor <id> --receipt <dir>`); stop unless the receipt is
     `ok` (`publish-ui-page.mjs:149-158`);
  2. run the capture with the receipt's `candidateRevision` and a post-promotion `refresh=1`
     read, then assert `capture.json` revision/digest equal the receipt digest
     (`capture_live_ui.mjs:233-252`) — a mismatch is a hard failure, never a decked stale page
     (§1.6);
  3. rebuild the deck (`build_ui_page_deck.py`) and run `verify_deck.py`;
  4. rewrite `U1/SHA256SUMS` from an explicit manifest with `tools/live-circuit/update-sha256sums.mjs`
     (`--check` verifies, `--update` rewrites; unknown/removed files require `--add`/`--remove`).
- Prerequisite defect to fix first: `build_ui_page_deck.py` hard-codes revision 4, 13 sections,
  10 contracts and 3 captures (`build_ui_page_deck.py:88-93`), so the first real content publish
  breaks the build. `[proposal]` relax those to capture-relative invariants (revision equals the
  capture's, section count equals the captured count, last promoted receipt digest equals the
  captured digest) while keeping the no-mockup asserts (`:94-109`).
- Acceptance evidence: one invocation after a copy-only publish produces a new receipt, a new
  `capture.json` with `revision = candidateRevision` and matching digest, `VERIFY_DECK_OK`, and a
  `SHA256SUMS` that verifies; rerunning with unchanged sources is byte-identical except the
  capture timestamp; the `--fail-post-verify` drill produces rollback and **no** capture/SHA
  update (WP0.4, `implementation-strategy.md:817`). The candidate definition is retained next to
  the receipt (today the receipt stores only `path.basename(candidateFile)`,
  `publish-ui-page.mjs:40`) so a publish is reproducible after rollback.

### T4 — Signed-in capture as a CI artifact (WP0.6) `[proposal]`

- Add a home step to the existing browser gate after the sign-in assertions
  (`verify-browser-session.mjs:88-95`), before sign-out: `goto /circuit/home`, wait for the
  `when: signed-in` sections (e.g. `#home-signed-in-runs` plus the session `stat`;
  `fixtures/pages/home.json:120-146,224-262`), assert the signed-out `notice` is absent, then
  `page.screenshot({ path: <evidence>/browser/home-signed-in-desktop.png, fullPage: true })` at
  the existing 1600×1200 viewport (`verify-browser-session.mjs:21`). Record the page
  revision/digest and the PNG SHA-256 in the receipt (`:196-201`).
- Credentials stay exactly where they are: OIDC→Key Vault at run time
  (`accept.mjs:8-14`; `common.mjs:46-51`), stdin to the verifier, no printing
  (`verify-browser-session.mjs:186-187`), 30-day artifact retention (`staging.yml:111-116`).
  Nothing enters `.env.local`; local capture keeps recording `pending`
  (`capture_live_ui.mjs:222-227`). `[proposal]` extend `capture_live_ui.mjs` with
  `--signed-in-image <png> --signed-in-receipt <json>` so the deck's signed-in slot can consume
  the CI artifact explicitly (state `signed-in (staging artifact)`), never a locally forged one.
- Acceptance evidence: WP0.6 receipt = the browser receipt plus the artifact record; the deck
  lists the signed-in capture with its source (`file:line`/workflow run) or stays properly
  pending; no secret appears in artifacts or logs (reuse `:186-187`).
- Privacy note: the screenshot renders the principal identifier. It is committed nowhere in v1:
  it stays an artifact. Committing it would require redaction or an acceptance principal whose
  identifier is non-identifying.

### T5 — Fixture sync against the served declaration `[proposal]`

- `tools/live-circuit/sync-page-fixtures.mjs <base> [--check] [--write]`:
  - `--check` reads each fixture's served counterpart (`refresh=1`), then compares
    `revision`, `pageDigest`, the sectionId set, per-section component kind/version/
    `contractDigest`, and the role-name sets of `props`/`bindings`; it also compares fixture
    component roles against the exported contract roles (T1). Fails with a named drift list.
    This is the guard the role-vocabulary defect lacked (commit `bcf1e52`): adapters, fixtures and
    the declaration must move together (`ui-components.js:450-495`;
    `fixtures/pages/home.json:20-388`).
  - `--write` regenerates only `home`-class fixtures from the served declaration (normalising
    `readAt`/`source`); the refusal fixtures (`unknown-component`, `unknown-action`, `unsafe`,
    `stale`, `degraded`) stay hand-authored and `--check` treats them as exempt.
  - Close the publisher gap too: extend `checkRegistry` (`publish-ui-page.mjs:66-81`) to validate
    candidate role keys against the contract rows (T1's role map) so a role drift is refused
    `UI_COMPONENT_ROLE_UNSUPPORTED` at publish time, not discovered as a rendered notice.
- Acceptance evidence: after a real publish, `--check` passes; after renaming an adapter role
  without touching the declaration, `--check` fails naming the section and role, the publisher
  refuses the candidate, and `verify-pages --fixtures` stays green (WP0.2).
- Where it runs: the check needs a live base, so it belongs beside the publisher drill (WP0.4)
  and the staging post-deploy acceptance, not the dependency-free `checks` job — or as a fixture
  snapshot comparison against `U1/sources/ui-page.v1-home.json`, which is the same document
  (`sources/README.md:14`).

---

## 3. Effort and risk

| # | Effort (person-days) | Risk | Mitigation |
| --- | --- | --- | --- |
| T1 | 1–2 | A third validator drifts from `page-runtime.validatePage` and `live-store.validatePage` | One module; shell validators remain authoritative for rendering, the publisher imports the same vocabulary; tests pin the shared refusal table |
| T2 | 2–3 | Preview rendered by a different path is not production fidelity | Preview reuses `page-runtime.js` only; `?revision=` is a read parameter, not a renderer; capture after promotion remains the fidelity proof |
| T3 | 1 | Cross-repo paths and mutable deck assertions make the one command brittle | All paths flagged; relax `build_ui_page_deck.py:88-93` to capture-relative invariants first; fail closed on digest mismatch |
| T4 | 0.5–1 | Session-scoped run list makes pixels non-deterministic; screenshot includes an identity | Treat the PNG as evidence, not a baseline; record revision/digest and principal; artifact-only retention; no secrets in logs |
| T5 | 1–2 | Fixtures become derived, losing their role as independent negatives | Only home-class fixtures are writable; refusal fixtures stay authored; drift check fails loudly |
| total | ~6–9 | | all dependency-free Node; no new runtime surface except the optional `revision` read parameter |

---

## 4. Steps that stay manual by design

- **Promotion and rollback decisions.** The publisher performs automatic CAS rollback on a failed
  post-verify (`publish-ui-page.mjs:137-147`), but a stale-CAS refusal or a re-stage choice stays
  with the publication owner; the actor is recorded, not inferred (`:40`, `:112`, `:127`).
- **Honest-claims and content review.** The gate validates structure, never truth; the
  `copyBasis` discipline and compliance wording stay human (strategy R6,
  `implementation-strategy.md:930`; `circuit-host.json:6`).
- **Signed-in credentials.** Locally, capture stays pending; the CI principal is fetched per run
  and never stored (`capture_live_ui.mjs:222-227`; `common.mjs:46-51`).
- **Deck render and final review.** `render.ps1` needs PowerPoint COM on Windows
  (`render.ps1:1-17`), and `verify_deck.py` proves mechanics, not editorial quality.
- **Gates G2/G3/G5/G8/G9** (`implementation-strategy.md:959-971`) and any new component kind,
  source or media route remain deliberate class (a)/(b) deploys with the full staging acceptance
  (strategy §4.6, `:328-365`).
- **`refresh=1` stays an operator flag**, never declaration data (`live-store.mjs:386`).

---

## 5. Cache-consistency notes for G8

Facts: per-instance LRU with a 30 s TTL, payload-keyed cache (path/revision/digest), in-flight
coalescing, `refresh=1` bypass, ETag/304 and error `no-store`
(`live-store.mjs:164-187`, `:396-401`; `circuit-host.json:11`). A post-publish read without
`refresh=1` can legally serve the previous revision for up to the TTL, and on a second instance
indefinitely until its own TTL expires; strategy §6.2 defers the promise to G8
(`implementation-strategy.md:566-574`, `:970`).

Notes `[proposal]` for the G8 decision and the tooling built above:

1. **Tools always fail closed.** T3/T5 must read with `refresh=1` after promotion (or retry until
   the expected digest is observed with a bounded deadline) and abort on a digest mismatch rather
   than capture, diff or fixture-sync against a stale revision. The publisher already reads with
   `refresh=1` (`publish-ui-page.mjs:117,133`); the capture script does not (`:92-98`).
2. **Record the observation.** `capture.json`/receipts should record the read URL, `refresh=1`,
   `readAt` and `pageDigest` so a later reviewer can tell which revision was seen
   (`capture_live_ui.mjs:239-244` already records revision/digest; add the query).
3. **One base today.** The publisher post-verifies a single base (`publish-ui-page.mjs:133-136`);
   if G8 chooses bounded staleness (TTL), that is the stated promise; if it chooses
   read-your-writes, post-verify needs a fan-out or a stored pointer read plus an instance
   identity in the response. Propose exposing the serving instance/release digest in the page
   response (or a header) when G8 is decided.
4. **409 remains the client safety net.** A bound digest that no longer matches renders
   `PAGE_SNAPSHOT_CHANGED` (`live-store.mjs:298-299`; `accept.mjs:88-89`), so a lagging instance
   degrades visibly rather than mixing sections across revisions.
5. **No cache-bypass in declarations.** `refresh=1` must remain operator-only; a `refresh` action
   is local (`page-runtime.js:633`) and never maps to the query parameter.

---

## 6. Limits of this document

- No code exists yet for T1–T5; every tool name, module path and flag is `[proposal]`.
- Effort is an estimate, not a forecast; the largest unknowns are the preview read parameter and
  the role map's source (DB read vs manifest extension) in T1/T5.
- WP0.6 here is the strategy's signed-in browser gate
  (`implementation-strategy.md:819`), not P0.6 content authority (`:863`).
- This document is lane evidence, not a work order; implementation goes through
  `sfx-embody` for the publisher/role read and `sfx-platform` for the scripts and gate.
