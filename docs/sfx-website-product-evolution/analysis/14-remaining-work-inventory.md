# 14 — Remaining-work inventory

Prepared 2026-10-08 against the working tree; re-verified 2026-10-09 against `5eee1df`. Read-only
inventory: no code, declaration, estate, provider or workflow file was changed by this document.
Every item names its status, the plan section it stems from with line cites, its change surface,
the acceptance evidence it owes, and whether it can finish in one turn or is externally gated.
Nothing is asserted that the cited file or a dated artifact does not show; unverifiable items are
in §8.

**Originating plan.** The plan this inventory executes is
[`sidefx-circuit-driven-ui-strategy.md`](../../sidefx-circuit-driven-ui-strategy.md) (SP; proposed
2026-10-08, currently untracked — R8). Remaining items map to its lines:

| SP line | Plan statement | Inventory items |
| --- | --- | --- |
| L9 | `sfx-platform` is a thin consumer/composer; UI/UX providers are owned in `sfx-providers` | B2, B3, B5, B7, R9, H18–H21 |
| L22, L39, L128 | Four provider slots (region table at L19–L24) and the first post-login Explorer experience | P0-a, R1, R3, R4, B6 |
| L48 | Each provider has its own circuit; provider drilldown recurses with the same template | B7, H11, H12, H20 |
| L56, L58 | Ownership split: provider code/assets vs database-declared page/circuit meaning | B1, B2, B4, B6, R9 |
| L78, L103 | One provider per slot; assets by declared manifest/digest; no provider-specific code in `sfx-platform` (also L60, L79) | R1, B1, B2, B3, R7, F3, F4 |
| L118 | Unit B — provider seam extraction into `sfx-providers` | B3, R1, R9 |
| L122 | Unit D — live flywheel from real testimony, not animation assumptions | P0-a, P0-b, T4, B7 |

**Abbreviations.** SP = [`sidefx-circuit-driven-ui-strategy.md`](../../sidefx-circuit-driven-ui-strategy.md)
(the originating plan; line cites above); IS = [`implementation-strategy.md`](../implementation-strategy.md) Rev 4;
BS = [`ui-circuit-blueprint-strategy.md`](../ui-circuit-blueprint-strategy.md);
LB = [`landing-blueprint.md`](../landing-blueprint.md);
RB = [`ui-explorer-region-blueprint.md`](../ui-explorer-region-blueprint.md);
A09/A11/A12/A13a/A13b/A13c = [`analysis/09-iteration-loop-tooling.md`](09-iteration-loop-tooling.md),
[`analysis/11-trusted-shell-boundary.md`](11-trusted-shell-boundary.md),
[`analysis/12-ui-runtime-providers.md`](12-ui-runtime-providers.md),
[`analysis/13a-explorer-runtime.md`](13a-explorer-runtime.md),
[`analysis/13b-shell-pages.md`](13b-shell-pages.md),
[`analysis/13c-serving-and-readers.md`](13c-serving-and-readers.md);
REV = [`review.md`](../review.md).

**Status legend.** *done* = landed and evidenced in-repo; *uncommitted* = present in the working
tree, not in any commit; *pending* = plan action not performed; *unverified* = claimed or implied
but not supported by an artifact read here.

---

## 1. Local facts checked (2026-10-08; re-verified 2026-10-09 against `5eee1df`)

**Git (`sfx-platform`).** `main` at `5eee1df`, four commits ahead of `origin/main` (`c4f67df`) and
clean apart from untracked `docs/canonical-scenario-blueprint.md` and
`docs/sidefx-circuit-driven-ui-strategy.md`. The declared-region wave is committed (not pushed):
`62551f9` composite provider packaging, `6274d11` verification wiring, `5eee1df` region/footer
mounts, on top of `7f39a5e` (this inventory and the runbook). `outputs/**` is ignored — `5eee1df`
adds `outputs/` to `.gitignore` — so the landing deck remains a local-only check input (F3/R7).

**Git (`sfx-providers`).** `main` is level with origin at `a33b442` ("Add the shared shell footer UI
region provider", pushed); `efad258` (ui-runtime-token-set), `9875017` (ui-explorer-region
package), `8d23da2` (region blueprint conformance) and `4d45615` precede it. Uncommitted:
untracked `docs/visual-assets/` and three `providers/cli-login/**/packages.lock.json`
modifications (unrelated churn).

**Git (`sfx-embody`).** Three commits ahead of origin. Uncommitted:
`docs/request-sda-cli-dispatch-preflight-parity.md` (its status line says the SDA working tree fix is
implemented but estate installation — commit twin, kernel selection, deck regeneration — is the
remaining turn) and untracked `docs/research/cli-login/07-node-preflight-parity.out.txt`,
`08-node-preflight-uncommitted-child.{out.txt,sql}`.

**CI.** Latest `Live Circuit staging` run `37818835706` is green for `c4f67df`. The four local
commits (`7f39a5e`, `62551f9`, `6274d11`, `5eee1df`) have no run; `origin/main` is still `c4f67df`,
so the single batch push will trigger a full staging release. Watched paths include
`live-circuit/**`, `tools/live-circuit/**`, `deploy/staging/**` and the workflow itself
(`.github/workflows/staging.yml:6-14`).

**Captures (local, gitignored).** `artifacts/regions-local/capture.json` (2026-10-09T02:05:59Z, 41
checks, 0 failures) shows the Explorer's `header`, `left-sidebar`, `middle`, `right-sidebar` and
`footer` all `source=declared`, slots filled, digests verified and named failures/tamper refusals
proved. `artifacts/live-login-local/capture.json` (2026-10-09T00:36:09Z, signed-out) shows the same
five declared on the Explorer, footer-only on login, the `ui-page-landing` circuit readable through
the details/scene readers, and two provider drill-downs; its `pending` record is the signed-in
login session (`TEST_PRINCIPAL_CREDENTIALS_UNAVAILABLE`). `artifacts/region-header-local/capture.json`
(2026-10-08T22:16:58Z) is the superseded header-only proof.

**Stated local facts vs artifacts.** The "region mounts header/middle/footer vs missing left/right"
framing is not supported by the working tree or by either capture: all four Explorer regions plus
the shared footer are wired in `explorer.js` and captured declared (see §8 F1). What is true: the
Explorer mounts all five; home, login and generic declared pages mount only the shared footer,
their headers remaining hand-authored shell (`home.html:55-61`, `login.html:40-46`, `page.html:11-28`).

**Staging reachability of the region wave (closed in-repo, unproven until deploy).** The deploy job
now sparse-checks `sfx-providers` at pinned ref `a33b442`
(`.github/workflows/staging.yml:88`, commit `6274d11`), which carries the `ui-explorer-region` and
`ui-shell-footer` packages; `prepare-composite.mjs` copies them under `estate/ui-providers/` and
`Dockerfile.composite` sets `SFX_UI_PROVIDER_DIR=/opt/sfx/estate/ui-providers` (commit `62551f9`),
with packaging refusals covered by `verify-composite-package.mjs`. `region-host.mjs:56-57` still
requires `SFX_UI_PROVIDER_DIR`; that the deployed observer serves `AUTHORED` regions is not provable
locally and remains the batch deploy's acceptance (F4).

---

## 2. Phase 0 residual gates (IS §9.2, §10 Phase 0)

| ID | Item | Status | Source | Change surface | Acceptance evidence owed | Turn / gate |
| --- | --- | --- | --- | --- | --- | --- |
| P0-a | WP0.6 signed-in home renders declared `when: signed-in` variant and session run list in a real browser | pending | IS:142, 880; A09:78-94 | shell (browser gate extension; `tools/live-circuit/verify-browser-session.mjs` home step) | WP0 receipt + signed-in screenshots; deck signed-in slot (IS:152-153) | Externally gated: CI OIDC→Key Vault test principal; no local credential |
| P0-b | WP0.7 DOM execution proof of rendering safety (`textContent`, URL profile, no declaration script/style/handler execution) | pending (source-checked only) | IS:143, 881; IS §8.5:852-858; A13b §7:356-362 | shell (browser gate) | WP0 receipt with a real browser run over `unsafe`/`javascript:` fixtures | One turn locally with `SFX_BROWSER_TEST_MODULE`; CI gate otherwise |
| P0-c | WP0.2/WP0.3 standalone receipts under the §9.2 convention | unverified (no `evidence/WP0-*` files for refusals/digests) | IS:161-164, 876-877 | docs/evidence only | `evidence/WP0-<date>.json` for refusal and digest groups | One turn (local run + write receipt) |
| P0-d | U1 deck signed-in captures | pending (blocked by P0-a) | IS:145-153 | provider/deck artifacts (`sfx-providers/outputs/.../U1`) | signed-in captures in `capture.json` + `verify_deck.py` re-check | Externally gated with P0-a |
| P0-e | P0.6 home content authority (six settled propositions as declaration content) | done | IS:924, 1179-1182 | estate (class c) | `fixtures/pages/home.json:341-383`; U1 revision-4 capture digest match | — |
| P0-f | `home.featured` retirement with `home.hero`/endpoint retained for the Explorer | done (featured); hero now changed (see R3) | IS §2.3:202-208, D6:254, C1:922 | estate + host | `observe-server.mjs` still serves the endpoint; `verify-identity-session.mjs` pin | — |

---

## 3. Declared-region wave (committed 2026-10-09, unpushed)

The wave was committed after the first issue of this inventory as `62551f9` (composite provider
packaging), `6274d11` (verification wiring) and `5eee1df` (region/footer mounts); statuses below
are updated by the 2026-10-09 verification pass.

| ID | Item | Status | Source | Change surface | Acceptance evidence owed | Turn / gate |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | Four Explorer regions + shared footer mounted from declared `ui-region-content.v1` provider content (`region-host.mjs`, `region-runtime.js`, `explorer-shell.js`, `footer.js`; `explorer.html` mounts only; `home/login/page` footer mounts) | committed (`5eee1df` mounts, `62551f9` packaging), locally green; unpushed | BS §4-§5:121-193; LB §5-§6:289-358; RB §1-§3:32-351 | shell (a/b) + provider (ui-explorer-region and ui-shell-footer committed); CI checks + acceptance pins | `verify-region.mjs` green (re-run 2026-10-09); browser capture `artifacts/regions-local` (02:05:59Z, 0 failures); staging acceptance extension; provider dir present in the composite | Local done; staging externally gated (push, ~18 min, OIDC) |
| R2 | `view.html` deleted; provider drill-down folded into `declaration-detail` as primary view with collapsed raw authority; provider glyph click opens view | committed (`5eee1df`) | LB §6:327-358; RB §6:430-445 | shell (`circuit-runtime.js`, `view-runtime.js`, `verify-view.mjs`, `observe-server.mjs`, `accept.mjs`) | `verify-view.mjs` green; `artifacts/live-login-local` drill-down screenshots 05/06; staging acceptance pins for 404 `/circuit/view[.html]` (verified 404 locally) | Staging gated |
| R3 | `circuit-host.json home.hero` changed to `ui-page-landing`/`sidefx:capabilities`; `verify-identity-session.mjs` pin updated | committed (`5eee1df`); live host confirms hero | IS C1:204-208; A13c §2.3:49 | host config (class b) | updated pin + capture showing default selection reads `ui-page-landing` (`live-login-local` 03-04) | Done locally; contradicting namespace cited in §8 F2 |
| R4 | `login.js` default return target changed to `/circuit/explorer?capability=ui-page-landing&namespace=sidefx%3Acapabilities` | committed (`5eee1df`); target returns 200 on the live observer | LB §3:252-263; A13b §2.3:103-123 | shell (a) | browser re-capture of the post-login default landing; `verify-identity-session`/login fixture update if any | Signed-in re-capture needs P0-a |
| R5 | `verify-region.mjs` added to staging `checks`; acceptance pins for `region-runtime.js`/`explorer-shell.js`/`footer.js` and view 404s | committed (`6274d11`) | IS §9.2:883-887 (module pin rule) | CI (`staging.yml`, `accept.mjs`) | green checks job; public acceptance for the pins | Push/CI outstanding |
| R6 | `verify-regions-browser.mjs` (five regions, failure/tamper/blueprint diff) exists but is not wired into `staging.yml`; `verify-region-header-browser.mjs` is its superseded header-only predecessor | committed (`6274d11`); still not wired into `staging.yml` | BS §6:208-220 (browser capture proof) | CI + tools | decide: wire into the browser job or keep local-only; remove or archive the header-only tool | One turn |
| R7 | `outputs/**` (landing blueprint decks incl. `outputs/capability-estate/landing-circuit/circuit-blueprint.json`) is a local-only check input; `verify-region.mjs:28,213-234` and both region browser tools depend on it | `outputs/` now ignored by `5eee1df`; deck not committed | RB §3.1:329-333 (deck derived from `explorer.html`); RB §6:442-445 | repo hygiene/CI | commit a bounded deck or relocate the check input; in CI the check currently records a limitation | One turn |
| R8 | Untracked design docs `docs/canonical-scenario-blueprint.md` and `docs/sidefx-circuit-driven-ui-strategy.md` | still untracked (SP is the originating plan cited above) | not in the four plans | docs | none; naming/strategy proposals only | One turn |
| R9 | `sfx-providers` footer provider (`ui-shell-footer`) and its test; pinned release ref | done: committed and pushed as `a33b442`; pins updated (`62551f9` identity-sources, `6274d11` workflow) | RB §3.2:337-342; BS §5:173-177 | provider repo + CI pin/env | provider test green (7/7 re-run); new pin; `SFX_UI_PROVIDER_DIR` set (composite packaging) | Staging deploy gated |

---

## 4. Phase 1 and Phase 2 residual programme (IS §10)

| ID | Item | Status | Source | Change surface | Acceptance evidence owed | Turn / gate |
| --- | --- | --- | --- | --- | --- | --- |
| W1 | Phase 1 second page (industry Solutions template, Healthcare first) + crosswalk reader + five Phase-1 kinds | done | IS:930-947, 951-953; A13b §1:22-27 | estate + class (b) shell | `evidence/WP1-pages-2026-10-07.json`, `WP1-publish-20261007T191516.json`, `WP1-registry-churn-2026-10-07.json`; `/circuit/healthcare-solutions` pinned in `accept.mjs` | — |
| W2 | One reuse proof of a second industry instance from the same template | pending/unverified (no receipt found) | IS:951-957 (exit) | estate (class c) | a second page declaration + browser acceptance + no `ui-page.v1` change | One publish turn; staging gated if browser proof needed |
| W3 | Declared navigation as a Phase 1 deliverable (page-document `navigation` member) | partial: generic `page.js:24-36` renders it; home/Explorer keep hand-authored nav | IS:951-953, C27:370-378 | estate (class c) + shell for chrome kinds | declared nav on the converted pages; no nav republication on page publish (C27) | One turn per page plus capture |
| W4 | Honest-claims content review and claims gate | done | IS:830 (R6), G9:1032; commits "Record the first published story page through the claims gate" | estate + tooling (`verify-claims.mjs`, `claims/` fixtures) | `WP2-why-sfx-*` receipts; `verify-claims.mjs --fixtures` in `checks` | — |
| W5 | Nine-area IA as declared routes (Phase 2 waves) | pending | IS:76-78, 959-976 | estate (class c) + class (a)/(b) for new kinds/media | per-wave learning receipt: pages converted, kinds added, releases avoided, latency, refusals | Externally paced (releases); each wave one-turn publishes |
| W6 | Media serving/storage route + digest-addressed pipeline | pending (gate G5) | IS:1028; R9:994 | class (a) deploy + storage choice | G5 decision; new-media route acceptance; declarations restricted meanwhile to allowlisted assets | Externally gated (team decision + deploy) |
| W7 | Public-claim provenance model (statement/basis/sourceRefs/observedAt/effectiveAt/classification/status) | pending (gate G9) | IS:1032; REV:558-605 | estate contracts + class (b) | G9 decision; claim-bearing Standards/Research waves blocked until then | Externally gated (PO gate) |
| W8 | Phase 1/2 exit records and learning receipts per wave | pending | IS:955-957, 971-976 | docs/evidence | phase exit evidence files | One turn per phase close |
| W9 | G2 SDA request | withdrawn; no filing | IS §7.5:784-795, G2:1025; BS §7:222-257 | none now | prove-then-request: only a failing captured blueprint artifact may ground an ask | Not an open gate |

---

## 5. Iteration-loop tooling T1–T5 and G8 (A09)

All five are `[proposal]`; none of the files exists (A09 §6:329-337, confirmed absent from
`tools/live-circuit/`).

| ID | Item | Status | Source | Change surface | Acceptance evidence owed | Turn / gate |
| --- | --- | --- | --- | --- | --- | --- |
| T1 | `page-definition.mjs` authoring validator + template; role map read from estate contract rows; publisher role check | pending | A09:144-171 | tools + `sfx-embody` publisher | `node --test tools/live-circuit/page-definition.test.mjs`; five negatives refuse by code; renaming a role refuses before staging | One turn (local); publisher side needs `sfx-embody` change |
| T2 | `diff-page-revisions.mjs` + candidate preview (`?revision=N` read parameter, operator-only) | pending | A09:173-189 | tools + shell read parameter | seeded 1→4 and 3→2 deltas; preview uses the one renderer; screenshot | One turn |
| T3 | `publish-capture.mjs` one-command publish→capture→deck→SHA256SUMS; relax `build_ui_page_deck.py:88-93` hard-coded revision/section/contract/capture counts | pending (prerequisite defect open) | A09:191-215 | tools + provider deck scripts | receipt ok → capture revision/digest match → `VERIFY_DECK_OK`; `--fail-post-verify` produces rollback and no capture/SHA update | One turn for scripts; deck fix lives in `sfx-providers` |
| T4 | Signed-in capture as CI artifact (WP0.6) | pending | A09:217-238 | CI + tools | browser receipt + artifact record; deck consumes the artifact explicitly; no secret in logs | Externally gated (P0-a) |
| T5 | `sync-page-fixtures.mjs` drift guard (served declaration vs fixtures vs role map) | pending | A09:240-262 | tools + fixtures | `--check` passes after publish; renaming an adapter role fails naming section/role and the publisher refuses | One turn for the tool; publisher half in `sfx-embody` |
| G8 | Page-cache publication consistency promise (tools read `refresh=1`; record read URL; single-base post-verify; 409 safety net; no declaration cache bypass) | pending | A09:296-326; IS §6.2:626-634, G8:1031 | team decision + maybe host response field | decision record; tooling rules 1-5 enforced | Externally gated (team gate) |

---

## 6. Blueprint/provider migration (BS §4-§5) and blueprint publication

| ID | Item | Status | Source | Change surface | Acceptance evidence owed | Turn / gate |
| --- | --- | --- | --- | --- | --- | --- |
| B1 | Estate migration pair declaring provider identities, token/browser-port contracts and bindings `UNBOUND`/`REVIEWABLE`/`HELD` | pending | BS §5:173-177; RB §3.2:337-342; LB §5.4-5.5:300-313 | estate (`sfx-embody` migration pair) | pair preflight/commit + in-transaction proof; install through the SDA-checkout lifecycle | Externally gated by estate lifecycle (separate repo, watched install) |
| B2 | `ui-registry` manifest extension as a class (b) deploy (provider packages listed; refusals unchanged) | pending | BS §5:178; IS §4.3:310-316 | shell class (b) | manifest diff + acceptance | One turn after B1 |
| B3 | Provider packages `ui-runtime-token-set` (done: A12:170-191; commit `efad258`) → contract-roles → adapters → kinds/renderers → action-dispatch → `ui-page-runtime` umbrella | 1 of 6 done; `ui-explorer-region` is a fifth, blueprint-specific package (committed) | BS §5:180-182; A12:124-137, 138-155 | provider repo, one package per deploy | each package's own check + shell gates; no fallback; code mass leaving `sfx-platform` counted | Externally paced (deploys); each package one turn |
| B4 | Token publication as data (`ui-token-set.v1` admitted; class c) | pending | BS §5:182; A12:170-191 | estate | token-set parity fixture green | Depends on B1 |
| B5 | Login (`authenticate-ide-user`) conversion to a declared circuit — first blueprint conversion | pending (explicitly out of v1 scope) | BS:43-51; A13b §2.3:103-126; LB §3:239-275 | estate + shell class (a) if converted | declared form/copy + transport stays shell; browser sign-in/re-sign-out capture | Externally paced; one turn for declaration once B1 lands |
| B6 | Landing circuit `ui-page-landing` declaration completeness (boundary/given/when/then, four region resolves) | partial: capability is published/readable and regions serve; the LB/RB proposal members (boundary, given, when, then, providers, observationBindings) are not admitted | LB §2:152-236; RB §1:32-93 | estate (class c) | declaration carrying the LB §1 template members; region blueprint diff clean | One turn per declaration after B1 |
| B7 | Provider drill-down flywheel (`ui-view.v1` at provider scope) | partial: view-runtime and the `provider-profile` view are deployed and captured (`live-login-local` 05/06); B1/B2 make it estate-declared | LB §6:327-358; RB §6:430-445; BS §4:110-119 | estate + shell | drill-down reads through the page reader; named refusals | One turn after B1 |
| B8 | Plan-internal inconsistency: BS §5 item 1 ("G2 lands in SDA") predates BS §7's default-no-SDA-change | flagged | BS §5:175 vs BS §7:222-235 | docs | revision harmonisation | One turn |

---

## 7. Hard-coded retirements still outstanding from A13a–A13c

### 7.1 A13b deployed-code conflicts (each closed only by a class (a)/(b) deploy)

| ID | Retirement | Status | Source | Change surface | Acceptance evidence owed |
| --- | --- | --- | --- | --- | --- |
| H1 | Admitted-kind set (21) still outruns the used-by rule; six kinds have no published page use (`tabs`, `timeline`, `form`, `media.gallery`, `code`, `chart`, carried by U2 specimen fixtures) | outstanding | A13b §1:29-41, §6.1:343, §7:368-369 | shell class (b) registry/allowlist | allowlist re-pruned to used kinds or the used-by rule revised; specimen fixtures reclassified |
| H2 | Converted home still ships a 43-line page-local `<style>` block (D7/C11 ban) | outstanding | A13b §2.1:53-56, §6.2:344; IS D7:255, §11.2:1007-1008 | shell class (a) + `site.css` | styles moved to the token stylesheet; `<style>` absent from converted pages; capture re-check |
| H3 | Accent alias direction inverted: `site.css` defines only `--cyan`; `--observation` exists page-locally in `explorer.html:14` and is consumed by `circuit-canvas.css:8-20` | outstanding | A13b §2.5:172-183, §6.3:345; IS D7:255, G7:1030 | shell class (a) | `--observation` in `site.css` with `--cyan` alias; no page-local definitions |
| H4 | Generic declared pages have a dead identity/env/release mount and unused declared `title` | outstanding | A13b §2.2:89-95, §6.4-6.5:346-347; IS:377-378, 444 | shell class (a) (`page.js`) | `page.js` binds session/release/title; browser capture of `/circuit/healthcare-solutions` |
| H5 | Six local action kinds (`select`, `playback`, `view`, `toggle`, `pane`, `stage-change`) dispatch an unlistened `page-action` event; `pane` has no realised seam | outstanding | A13b §1:34-38, §6.6:348; IS §4.4:328-341 | shell class (a) (listeners) or vocabulary reduction | a declared page exercising each kind with a real effect, or the vocabulary re-scoped |
| H6 | `refresh` re-renders sources without `refresh=1` | outstanding | A13b §6.7:349; IS:341 | shell class (a) | `refresh` reaches the read bypass; operator-only rule kept |
| H7 | Media allowlist not enforced: `safeUrl` admits any http(s) host; `media.figure`/`media.gallery` render declared external sources | outstanding | A13b §6.8:350; IS:63-65, 393-394 (C5) | shell class (a)/(b) + G5 | allowlist enforcement or G5 route decision; negative fixture |
| H8 | `site.css` lacks the adapter component classes; Phase 1/U2 kinds render unstyled on generic pages | outstanding | A13b §2.5:180-183, §6.9:351 | shell class (a) | classes in the one stylesheet; generic-page capture |
| H9 | Client `UI_REGISTRY`, served manifest and `verify-pages` expectation lists are hand-kept and never compared | outstanding | A13b §1:40-41, §7:363-365; A13c §3.5:70, §8:156-157, §9:190-193; A11:126-130 | shell class (b) + tools (K2 generator, `verify-registry.mjs --check`) | parity check green in `checks`; one generator as the source |
| H10 | `home.featured` residue still served in the host `home` response | informational | A13b §6.10:352 | host (class b) | endpoint cleanup or recorded as intentional |

### 7.2 A13a Explorer runtime (v1 keeps these shell; retirements are later-phase work)

| ID | Retirement | Status | Source | Change surface | Acceptance evidence owed |
| --- | --- | --- | --- | --- | --- |
| H11 | `provider-profile.js` per-row editors and per-engagement staging have no declared form scope: need a declared panel + generic projector or a `provider-profile` kind | outstanding | A13a §2:84-93, §13:384 | estate (class c) or shell class (b) | declared pane exercising the editors; or a named finding that v1 keeps them shell |
| H12 | Circuit canvas overlay (glyphs, routes, tokens, telemetry) has no kind: `circuit-scene` or a declared panel interpreting declared geometry | outstanding | A13a §3:127-132, §13:385 | shell class (b) if a new kind | capture of the declared canvas vs the shell renderer |
| H13 | Receipt-join engines stay shell by D8: `traversal.js`, `run-evidence.mjs`, `execution-cursor.js`, `deck-trace.js`; declared panels for run-context chrome, objective form/strip, observe form and playback timeline are candidate, not promised | outstanding (by decision) | A13a §4:160-161, §6:227-229, §7:258-261, §8:290-294, §10:332-334, §11:362-364, §13:386-394; IS D8:256 | shell class (a) + possible new readers | any move needs a new declared reading; otherwise record as remaining shell |

### 7.3 A13c serving and readers

| ID | Retirement | Status | Source | Change surface | Acceptance evidence owed |
| --- | --- | --- | --- | --- | --- |
| H14 | `home.hero` host route data retires only after the Explorer no-query fallback is migrated | outstanding | A13c §2.3:49, §9:180; IS C1:204-208, 922 | shell class (a) | Explorer fallback migration + acceptance; then remove hero/endpoint |
| H15 | Inline `/` timeline page (`observe-server.mjs:385-433`) is a second hard-coded page outside the declared path | outstanding | A13c §2.7:53 | shell class (a) + estate declaration | `/` served by the declared-page host or the inline page removed |
| H16 | Legacy deck routes (`/circuit/decks`, `/circuit/deck`, `/circuit/deck-slide`) remain a parallel API | outstanding | A13c §2.8:54 | shell class (a) | port onto declared readers; acceptance pins move |
| H17 | Acceptance page identities are hand-pinned; no declared page list is iterated | outstanding | A13c §7:140-145 | CI (`accept.mjs`) | declared-page iteration or documented exception |
| H18 | `read-provider-details` is not a `readers` entry; procedure names, params and identity columns are hard-coded | outstanding | A13c §3.8:73, §6:122,126-128, §10.2:205-208 | estate contract + class (b) | declared provider-inspection contract; manifest source consistent |
| H19 | Reader input validation and refusal maps are hand lists, not generated from the estate contracts | outstanding | A13c §3.3-3.4:68-69, §9:186 | shell class (b) + estate contracts | generated/validated maps; drift check |
| H20 | Observation summarizer rendering could move to a declared `timeline` | outstanding | A13c §2.5:51, §9:182 | estate (class c) | a page declaring the timeline; capture |
| H21 | Build/parity debt: K1 role tables, `verify-pages` expectation lists, `CIRCUIT_FILES` emission | outstanding | A13c §8:149-159, §9:188-195; A12:124-137 | tools + shell class (a)/(b) | K2/K3 generation or checks; `new-component.mjs --check` for map entries |

---

## 8. External gates and flagged items

**External gates.** E1 staging release: any watched-path commit triggers CI with OIDC credentials
and a measured wall clock of 12m43s–18m05s (IS:176-177; latest green run 17m59s); the region wave
must bump the pinned `sfx-providers` ref and configure `SFX_UI_PROVIDER_DIR` before it can serve
regions in staging. E2 WP0.6/WP0.7 browser gates need the CI test principal (P0-a). E3 the
`sfx-embody` SDA request ("estate installation … remaining turn") is gated by that repo's lifecycle
and AGENTS.md's request-only rule for SDA behaviour. E4 gates G3 (route/IA, IS:1026), G5
(media, IS:1028), G7 (tokens, IS:1030), G8 (cache, IS:1031), G9 (claims, IS:1032) are human
decisions; G1/G4/G6 are recorded accepted (IS:1174-1182).

**F1 (flagged).** The stated local fact that left/right region mounts are missing is not
reproducible: `explorer.js` mounts `tree` (left-sidebar), `region-middle`, `context`
(right-sidebar), `region-header` and the footer, and both the 2026-10-08T23:45Z regions capture and
the 2026-10-09T00:36Z live-login capture report all five declared with digests verified. The only
"missing" reading the artifacts support is that home, login and generic declared pages mount the
footer only; their headers remain hand-authored.

**F2 (flagged).** `landing-blueprint.md:154` declares the landing capability in namespace
`sidefx:ui`, while the implemented/readable circuit and every caller use `sidefx:capabilities`
(`circuit-host.json` home block, `login.js` default return, live-login capture URLs). One of the two
is stale; not resolved here.

**F3 (flagged).** `verify-region.mjs` records *pass* when neither `SFX_UI_PROVIDER_DIR` nor a sibling
`sfx-providers` checkout is present (`verify-region.mjs:240-243`), and records a limitation when the
untracked deck is absent (`:232-234`); in a clean CI checkout the provider and deck halves of the
gate therefore do not run. The browser proof (`verify-regions-browser.mjs`) is not wired into
`staging.yml`, so the region wave's real-browser evidence currently exists only in the local,
gitignored `artifacts/`.

**F4 (flagged).** The region work moves the Explorer's entire chrome behind a runtime dependency on
`SFX_UI_PROVIDER_DIR`; without the directory packaged into the composite, the deployed Explorer
degrades to five named failure states. This is a deployment dependency, not verifiable from the
local captures.

**F5 (flagged).** Phase 1 exit evidence is not recorded as a phase record; the WP1 receipts prove
the second page, crosswalk and registry churn but the IS Phase 1 exit sentence ("second page
served; one publish receipt; browser acceptance; no schema change", IS:955-957) has no single
receipt, and the second-industry reuse proof has no artifact found here.

**F6 (flagged).** BS §5 step 1 says "G2 lands in SDA" while BS §7 and IS Rev 4 withdraw the request;
the sequencing table is stale relative to the withdrawal (see B8).

**F7 (resolved 2026-10-09).** `outputs/**` is ignored by `.gitignore` (added in `5eee1df`), so the
region-wave commits exclude it; the deck remains a local-only check input, and the checks that read
it must tolerate its absence in CI (F3/R7).
