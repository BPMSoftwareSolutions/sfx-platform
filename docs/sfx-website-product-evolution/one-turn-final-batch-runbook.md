# One-turn final-batch runbook — declared UI regions and shared chrome

Prepared 2026-10-08; executed 2026-10-09. Status: **lanes A–C committed (`62551f9`, `6274d11`,
`5eee1df`), unpushed; the single push → watch → receipts (§3.7–§3.9) remains.** This document is
the work order that lands the declarative-UI region batch in one turn: the four Explorer regions
and the shared shell footer mounted from declared providers, the verification wiring, and the
provider packaging that makes the batch servable on staging.

Authority chain for the batch:
[`sidefx-circuit-driven-ui-strategy.md`](../sidefx-circuit-driven-ui-strategy.md) is the
originating plan (L9 thin `sfx-platform` / providers-owned; L22/L39/L128 four post-login Explorer
provider slots; L48 per-provider circuits and recursive drilldown; L56/L58 ownership split;
L78/L103 one provider per slot, assets by manifest/digest, no provider code in `sfx-platform`;
L118 provider seam extraction; L122 live flywheel from real testimony), then
[`implementation-strategy.md`](implementation-strategy.md) §4.6
(change classes and the data gate), §9 (acceptance and verification), §10 (staged rollout);
[`ui-circuit-blueprint-strategy.md`](ui-circuit-blueprint-strategy.md) §1 (blueprint first), §4
(UI/UX provider architecture), §5 (module-by-module migration), §6.3 (verification is click-path
and screenshot based), §7 (no SDA change);
[`ui-explorer-region-blueprint.md`](ui-explorer-region-blueprint.md) §1 (region template and closed
vocabulary), §2.2/§2.4 (left and right sidebar circuits), §3 (provider circuit instance), §4
(separation of responsibility), §5 (conformance), §6 (status and sequencing);
[`landing-blueprint.md`](landing-blueprint.md) §2.4 (region subcircuits), §5.4 (providers live in
`sfx-providers`), §7.3 (trust), §8 (status);
[`analysis/09-iteration-loop-tooling.md`](analysis/09-iteration-loop-tooling.md) §1.3–1.4
(capture and signed-in evidence), §2 T3/T4 (publish-capture and signed-in artifact), §4 (steps
manual by design); [`../../docs/automatic-staging-deployment.md`](../../docs/automatic-staging-deployment.md)
(release sequence, credentials, rollback) and [`AGENTS.md`](../../../AGENTS.md) (watched paths,
rollback discipline). Everything marked "EXTERNAL GATE" cannot be executed locally and must be
watched, never simulated.

The batch produces class (a) shell/runtime and class (b) policy/registry/route-host changes only
(`implementation-strategy.md:390-395`). It publishes **no** declaration and runs **no**
`publish-ui-page`; the data gate (§9.2) is untouched. The only deploy is the automatic staging
release triggered by the single pushed commit range.

---

## 0. Execution and verification state (2026-10-09)

The batch was executed after this runbook was prepared; the three lane commits exist locally and
the working tree is clean apart from the two untracked planning docs. Verified in this pass:

- `sfx-platform`: `main` = `5eee1df`, four commits ahead of `origin/main` (`c4f67df`), unpushed —
  `62551f9` (Lane C: provider packaging; pin `a33b442`), `6274d11` (Lane B: checks/public
  acceptance; workflow pin `a33b442`), `5eee1df` (Lane A: region/footer mounts, `view.html`
  deleted, `home.hero` = `ui-page-landing`, `login.js` default target, `.gitignore` gains
  `outputs/`). `git status --porcelain` shows only `?? docs/canonical-scenario-blueprint.md` and
  `?? docs/sidefx-circuit-driven-ui-strategy.md`.
- `sfx-providers`: `main` = `a33b442` (footer provider) level with origin; the footer test re-runs
  7/7. Only untracked `docs/visual-assets/` and `providers/cli-login/**/packages.lock.json` churn
  remain.
- `sfx-embody`: three commits ahead of origin with the modified SDA request doc and untracked
  `docs/research/cli-login/0{7,8}-*` files (unchanged from the inventory).
- Re-run gates: provider tests 7/7; `node deploy/sda-kernel/verify-composite-package.mjs` exit 0
  (provider refusals covered); `SFX_UI_PROVIDER_DIR=… node live-circuit/circuit/verify-region.mjs`
  all pass, including the four-region blueprint-deck diff.
- Live observer `http://127.0.0.1:8788`: `header`, `left-sidebar`, `middle`, `right-sidebar` and
  `footer` answer `AUTHORED`/`shapeConforms:true`; `banner` 404 `UI_REGION_UNKNOWN`;
  `/api/circuit/v1/capability-details?capabilityId=ui-page-landing&namespaceId=sidefx%3Acapabilities`
  is HTTP 200 `status=READ`; `/api/circuit/v1/home` hero = `ui-page-landing`; `/circuit/login` 200;
  the new default target
  `/circuit/explorer?capability=ui-page-landing&namespace=sidefx%3Acapabilities` is 200;
  `/circuit/view` and `/circuit/view.html` are 404 (acceptance pins in `accept.mjs`).
- Not verifiable locally: the batch deploy (no run for `5eee1df`; `origin/main` is `c4f67df`) and
  the signed-in browser captures (credential gate, §2). No staging evidence is claimed.

**Corrections to the runbook as first written.**

1. The header said "not started" and the old §0 said the wave was uncommitted with untracked
   `ui-shell-footer`; both are stale — see the table below. §3.1's commit/push commands are
   already executed.
2. The old §0 said `outputs/` was not ignored: `5eee1df` adds `outputs/` to `.gitignore`. The deck
   itself remains a local-only check input (inventory R7/F7).
3. The old §0 said the pinned `sfx-providers` ref `a020024c` predates the packages: both
   `deploy/staging/identity-sources.json` and `.github/workflows/staging.yml:88` now pin `a33b442`.
4. §3.6's cited regions capture timestamp is superseded: `artifacts/regions-local/capture.json`
   is now 2026-10-09T02:05:59Z (41 checks, 0 failures); `live-login-local` is unchanged at
   2026-10-09T00:36:09Z.
5. §3.5 was not re-run in full in this pass; every file it names exists, and the §3.4 and
   packaging gates were re-run and pass.

**Done vs outstanding.**

| Runbook step | State |
| --- | --- |
| §3.1 provider footer commit + push (`sfx-providers`) | done — `a33b442`, pushed |
| §3.2 composite packaging + pins | done — `62551f9`; packaging conformance re-run exit 0 |
| §3.3 checks/public acceptance wiring | done — `6274d11` |
| §3.4 region mounts + `verify-region.mjs` | done — `5eee1df`; re-run green |
| §3.5 local checks suite | not re-run in full this pass; files present |
| §3.6 local browser captures | regions-local present (02:05:59Z, 0 failures); signed-in captures pending |
| §3.7 three lane commits | done — `62551f9`, `6274d11`, `5eee1df` |
| §3.7 single push | outstanding — `main` four ahead of `origin/main` |
| §3.8 watch batch deploy | outstanding (external gate) |
| §3.9 staging receipts | outstanding (external gate) |
| §3.10 rollback | not needed (no deploy yet) |

---

## 1. Lanes — disjoint file ownership

One lane per file; an executor that finds a lane file modified outside its lane stops and reports
(`ui-circuit-blueprint-strategy.md:181-193`, one package per deploy, no big-bang). Lane order is
C → B → A because Lane B pins Lane C's commit.

| Lane | Owns (only these files) | Deliverable | Plan authority |
| --- | --- | --- | --- |
| **C — provider/asset alignment** | `sfx-providers/providers/ui-shell-footer/**`, `sfx-providers/tests/ui-shell-footer.test.mjs`; `sfx-platform/deploy/staging/identity-sources.json`, `deploy/staging/release.mjs`, `deploy/sda-kernel/prepare-composite.mjs`, `deploy/sda-kernel/Dockerfile.composite`, `deploy/sda-kernel/verify-composite-package.mjs` | The five declared region packages reach the deployed observer; asset digests match the shell slots | `ui-explorer-region-blueprint.md` §3.3, §4.4, §6; `landing-blueprint.md` §5.4; `implementation-strategy.md` §4.6 |
| **B — verification wiring** | `.github/workflows/staging.yml`, `deploy/staging/accept.mjs`, `live-circuit/circuit/verify-region.mjs`, `verify-identity-session.mjs`, `verify-objective.mjs`, `verify-view.mjs`, `tools/live-circuit/verify-regions-browser.mjs`, `verify-region-header-browser.mjs` | Checks run `verify-region.mjs`; public acceptance pins the region route; CI checks out Lane C's provider commit | `implementation-strategy.md` §9.1–9.2; `analysis/09` §1.3–1.4, T4; `ui-circuit-blueprint-strategy.md` §6.3 |
| **A — left/right region mounts** | `live-circuit/circuit/explorer.html`, `explorer.js`, `explorer-shell.js`, `region-runtime.js`, `region-host.mjs`, `footer.js`, `home.html`, `home.js`, `login.html`, `login.js`, `page.html`, `page.js`, `site.js`, `circuit-runtime.js`, `run-context.js`, `view-runtime.js`, `view.html` (delete), `circuit-host.json`, `README.md`, `.gitignore`; `live-circuit/dispatch-pair/observe-server.mjs` | Explorer mounts all four regions; home/login/declared pages mount the shared footer; named failures replace chrome | `ui-explorer-region-blueprint.md` §1, §2.2, §2.4, §5.2; `landing-blueprint.md` §2.4; `implementation-strategy.md` §1.1, §4.5 |

Out of scope for the batch (leave uncommitted or committed separately; they are outside the
watched paths and do not affect the deploy): `docs/canonical-scenario-blueprint.md`,
`docs/sidefx-circuit-driven-ui-strategy.md`, and the generated `outputs/` landing deck (Lane A adds
`outputs/` to `.gitignore`; its absence is recorded as a limitation by
`verify-region.mjs:232-233`).

---

## 2. External gates (the only steps not executable locally)

- **EXTERNAL GATE — CI credentials.** The signed-in browser acceptance acquires a private
  principal only in CI through OIDC → Key Vault
  (`aiengine-kv-20260406/secrets/sfx-staging-release-acceptance`) and passes it to
  `verify-browser-session.mjs` over stdin
  (`deploy/staging/accept.mjs:1-14`; `docs/automatic-staging-deployment.md:166-198`;
  `analysis/09:85-95,288-291`). The local capture is expected to record both signed-in captures
  `pending` with reason `TEST_PRINCIPAL_CREDENTIALS_UNAVAILABLE`
  (`tools/live-circuit/browser-captures.mjs:14,639-654`) — that is the honest local result, never
  forged. Do not attempt to source this credential outside CI.
- **EXTERNAL GATE — the single batch deploy.** The push to `main` starts
  `.github/workflows/staging.yml`; the deploy job cannot run locally and its measured duration is
  12m43s–18m05s for successful releases (`analysis/04-serving-routing-deploy.md:393-398`), plus
  the Windows CLI job; watch it, do not inline a substitute.
- **Cross-repo sequencing (not a credential).** Lane C's `sfx-providers` commit must land before
  the `sfx-platform` push, or the pinned ref does not resolve in CI
  (`docs/automatic-staging-deployment.md:88-95`).

---

## 3. Ordered steps

Every step states its source. Commands are PowerShell 5.1 from the repository root unless noted.
Run everything from a state where `git status --porcelain` shows only the files owned by §1.

### 3.1 Lane C — commit the provider package (`sfx-providers`) — DONE (`a33b442`, pushed; commands kept as the record)

Source: `ui-explorer-region-blueprint.md` §6 (package check; one package per deploy);
`landing-blueprint.md` §5.4 (providers live in `sfx-providers`).

```powershell
Set-Location C:\lab\repos\sfx-providers
node --test tests/ui-explorer-region.test.mjs tests/ui-shell-footer.test.mjs
git add providers/ui-shell-footer tests/ui-shell-footer.test.mjs
git status --porcelain   # must list only the two new paths staged and the lockfile churn unstaged
git commit -m "Add the shared shell footer UI region provider"
git push origin main
$providersRef = git rev-parse HEAD
$providersRef   # record this 40-hex value for §3.2 and §3.3
Set-Location C:\lab\repos\sfx-platform
```

Do not stage `providers/cli-login/**/packages.lock.json`.

### 3.2 Lane C — ship the provider packages in the composite release (`sfx-platform`) — DONE (`62551f9`)

Source: `ui-explorer-region-blueprint.md` §3.3, §4.4 (provider content read through the host; the
browser never imports provider code); `implementation-strategy.md` §4.6 (class (a)/(b) deploy);
`docs/automatic-staging-deployment.md:88-102` (pinned sources; composite build).

**(a) `deploy/staging/identity-sources.json`** — set `providers` to `$providersRef` (the `dal` pin
stays `bcaae40c2447bd9454b6eea9e3e001f0fc61b25b`; the policy owns exactly these two keys,
`deploy/staging/policy.mjs:22-29`).

**(b) `deploy/staging/release.mjs`** — in `deploy()` after the `sourcesFile` line, require and pass
the pinned provider checkout:

```js
const providersCheckout = path.join(root, '.release-sources/sfx-providers/providers');
assert(fs.existsSync(path.join(providersCheckout, 'ui-shell-footer', 'ui-shell-footer.mjs')), 'Pinned provider checkout required for the region packages');
await run(process.execPath, ['deploy/sda-kernel/prepare-composite.mjs', path.join(evidence, 'previous-release.json'), context, id, previousImage,
  path.join(root, 'artifacts/identity-publish'), sourcesFile, providersCheckout]);
```

**(c) `deploy/sda-kernel/prepare-composite.mjs`** — take the providers directory as the new 7th
argument and copy the two packages into the staged runtime:

```js
const [previousFile, destination, id, componentsImage, publishedIdentity, identitySourcesFile, uiProviders, extra] = process.argv.slice(2);
```

after the existing identity-publish guard (currently line 17):

```js
if (!publishedIdentity && uiProviders) throw new Error('UI_PROVIDERS_REQUIRE_IDENTITY_PUBLISH');
if (publishedIdentity && !uiProviders) throw new Error('UI_PROVIDERS_REQUIRED');
```

immediately after the identity `fs.cpSync` block (currently line 45):

```js
// The declared UI region packages travel with the composite release and are
// loaded server-side by the observer through SFX_UI_PROVIDER_DIR; the browser
// never imports provider code (ui-explorer-region-blueprint.md §4.4).
for (const name of ['ui-explorer-region', 'ui-shell-footer']) {
  const source = path.join(path.resolve(uiProviders), name);
  const moduleFile = path.join(source, `${name}.mjs`);
  if (!fs.existsSync(moduleFile) || !fs.existsSync(path.join(source, 'assets'))) throw new Error('UI_PROVIDER_PACKAGE_INCOMPLETE: ' + name);
  if (!fs.readFileSync(moduleFile, 'utf8').includes("'ui.region.load'")) throw new Error('UI_PROVIDER_OPERATION_REQUIRED: ' + name);
  fs.cpSync(source, path.join(runtime, 'estate', 'ui-providers', name), { recursive: true });
}
```

The existing `inventory(runtime)` walker then records every copied file in
`release.json.circuit.files`, and `Dockerfile.composite:38-40` verifies each digest — no separate
manifest entry is needed.

**(d) `deploy/sda-kernel/Dockerfile.composite`** — append to the `ENV` on line 46:

```dockerfile
ENV NODE_ENV=production HOME=/home/sjones XDG_DATA_HOME=/home/sjones/.local/share PORT=3000 SFX_UI_PROVIDER_DIR=/opt/sfx/estate/ui-providers
```

**(e) `deploy/sda-kernel/verify-composite-package.mjs`** — keep packaging conformance honest:

- line 39: allow the provider tree —
  `assert(host.includes(name) || name.startsWith('estate/demo/') || name.startsWith('estate/ui-providers/'), ...)`.
- before the identity invocation (line 58): build a fixture providers root with
  `ui-explorer-region/ui-explorer-region.mjs` and `ui-shell-footer/ui-shell-footer.mjs` (each
  containing `'ui.region.load'`) plus an `assets/` file per package; pass the root as the 7th
  argument to the identity invocation at line 63.
- after line 69: assert `updated.circuit.files` contains
  `estate/ui-providers/ui-explorer-region/ui-explorer-region.mjs` and
  `estate/ui-providers/ui-shell-footer/ui-shell-footer.mjs`.
- add two refusals: the identity invocation without the providers root fails
  (`UI_PROVIDERS_REQUIRED`), and a providers root missing `ui-shell-footer/assets` fails
  (`UI_PROVIDER_PACKAGE_INCOMPLETE`).

**(f)** Run the packaging conformance and the checker:

```powershell
node deploy/sda-kernel/verify-composite-package.mjs
node --test deploy/staging/policy.test.mjs
```

### 3.3 Lane B — verification wiring — DONE (`6274d11`)

Source: `implementation-strategy.md` §9.1 (checks and public refusals), §9.2 (`accept.mjs` public
additions); `analysis/09` §1.3 (capture is the visual source of truth); `ui-explorer-region-blueprint.md`
§5.2 (named failures only).

**(a) `.github/workflows/staging.yml`** — keep the `checks` line
`node live-circuit/circuit/verify-region.mjs` (line 42) and set the pinned checkout
(`ref:` at line 88) to `$providersRef`, so the release build and the identity publish read the
same provider commit (`docs/automatic-staging-deployment.md:88-95`).

**(b) `deploy/staging/accept.mjs`** — after the module-pin loop (currently line 58), insert the
deployed region proof, so a missing `SFX_UI_PROVIDER_DIR` or package fails the release instead of
shipping a named failure:

```js
// Declared region host: every region must be served AUTHORED from the pinned
// provider packages in the image; a missing package is UI_REGION_PROVIDER_UNREADABLE
// (ui-explorer-region-blueprint.md §3.2, §5.2).
for (const regionId of ['header', 'left-sidebar', 'middle', 'right-sidebar', 'footer']) {
  const region = await json(config.origin + '/api/circuit/v1/region?' + new URLSearchParams({ contractId: 'ui-region-request.v1', regionId }));
  assert.equal(region.disposition, 'AUTHORED', regionId); assert.equal(region.shapeConforms, true, regionId); assert(region.candidate, regionId);
  checks.push({ route: '/api/circuit/v1/region', regionId, disposition: region.disposition, provider: region.candidate.regionProviderId });
}
const unknownRegion = await fetch(config.origin + '/api/circuit/v1/region?' + new URLSearchParams({ contractId: 'ui-region-request.v1', regionId: 'banner' }), { redirect: 'error', signal: AbortSignal.timeout(90000) });
assert.equal(unknownRegion.status, 404); assert.equal((await unknownRegion.json()).findings?.[0]?.code, 'UI_REGION_UNKNOWN');
checks.push({ route: '/api/circuit/v1/region', regionId: 'banner', status: 404 });
```

**(c)** Keep the local-only region browser capture out of this batch's CI: its blueprint deck
(`outputs/capability-estate/landing-circuit/circuit-blueprint.json`) is not shipped, and the staging
browser gate already proves the declared header identity path end to end
(`ui-circuit-blueprint-strategy.md:208-214`, "source checks are not DOM proof"; `analysis/09` T4).
Record that limitation in the §3.9 receipts; do not add a CI step that would only run its
limitation branch.

**(d)** Source-check the lane:

```powershell
node --check live-circuit/circuit/verify-region.mjs
node --check live-circuit/circuit/verify-identity-session.mjs
node --check live-circuit/circuit/verify-objective.mjs
node --check live-circuit/circuit/verify-view.mjs
node --check tools/live-circuit/verify-regions-browser.mjs
node --check tools/live-circuit/verify-region-header-browser.mjs
node --check deploy/staging/accept.mjs
node --check deploy/staging/release.mjs
node --check deploy/sda-kernel/prepare-composite.mjs
node --check deploy/sda-kernel/verify-composite-package.mjs
```

### 3.4 Lane A — mount verification — DONE (`5eee1df`); re-run green 2026-10-09

Source: `ui-explorer-region-blueprint.md` §1.2 (operation chain), §2.2/§2.4 (left/right region
circuits, slots and failure terminals), §5.2–5.3; `live-circuit/circuit/README.md` "Declared region
mounts" (in this batch).

```powershell
$laneA = @(
  'live-circuit/circuit/region-runtime.js','live-circuit/circuit/explorer-shell.js','live-circuit/circuit/footer.js',
  'live-circuit/circuit/explorer.js','live-circuit/circuit/home.js','live-circuit/circuit/login.js','live-circuit/circuit/page.js',
  'live-circuit/circuit/site.js','live-circuit/circuit/circuit-runtime.js','live-circuit/circuit/run-context.js',
  'live-circuit/circuit/view-runtime.js','live-circuit/circuit/region-host.mjs','live-circuit/dispatch-pair/observe-server.mjs')
foreach ($f in $laneA) { node --check $f; if ($LASTEXITCODE) { throw "SYNTAX: $f" } }

$env:SFX_UI_PROVIDER_DIR = 'C:\lab\repos\sfx-providers\providers'
node live-circuit/circuit/verify-region.mjs
```

Required result: source checks pass, and with the sibling provider checkout the provider checks
run — `region-read-authored:{header,left-sidebar,middle,right-sidebar,footer}` all `AUTHORED`,
`region-candidate-vocabulary` all `valid`, `region-tamper-refused` all
`UI_REGION_ASSET_DIGEST_MISMATCH`, `region-refusals` `404/UI_REGION_UNKNOWN` +
`400/UI_REGION_REQUEST_INVALID`, and `region-blueprint-deck` all `match` when the local deck is
present (`verify-region.mjs:157-243`). A missing provider checkout is a stop: the mount is not
proven (`ui-explorer-region-blueprint.md:442-445`).

### 3.5 Local checks suite — the `checks` job replicated — not re-run in full this pass

Source: `implementation-strategy.md` §9.1; `.github/workflows/staging.yml:35-48`. Run in this
order; any failure stops the batch before commit.

```powershell
node --test deploy/staging/policy.test.mjs
node deploy/sda-kernel/verify-composite-package.mjs
node live-circuit/circuit/verify-identity-session.mjs
node live-circuit/circuit/verify-run-api.mjs
node live-circuit/circuit/verify-objective.mjs
node live-circuit/circuit/verify-provider-profile.mjs
node live-circuit/circuit/verify-view.mjs
node live-circuit/circuit/verify-region.mjs
node live-circuit/circuit/verify-pages.mjs --fixtures
node live-circuit/circuit/verify-components.mjs
node live-circuit/circuit/verify-claims.mjs --fixtures
node tools/live-circuit/verify-kind-tooling.mjs
node live-circuit/dispatch-pair/verify-run-scoped-sse.mjs
node deploy/sda-kernel/verify-observer-bridge.mjs
```

`verify-region.mjs` must be run with `$env:SFX_UI_PROVIDER_DIR` set (as in §3.4); without it CI
records the provider checks as a limitation (`verify-region.mjs:240-242`), and that limitation is
acceptable on CI only because §3.9 runs the real-browser acceptance on staging.

### 3.6 Observer restart and local browser captures — regions capture green (02:05:59Z); signed-in pending

Source: `analysis/09` §1.3 (`capture_live_ui` is the visual source of truth; U1 deck from real
captures), §2 T3 (publish→capture), §4 (credentials manual); `ui-circuit-blueprint-strategy.md`
§6.3 (acceptance is click-path and screenshot based); `implementation-strategy.md` §9.2 WP0.6–WP0.7.

Install the pinned browser and restart the observer against the provider checkout:

```powershell
npm ci --prefix deploy/staging/test-tools
& deploy/staging/test-tools/node_modules/.bin/playwright.cmd install chromium

$env:SFX_BROWSER_TEST_MODULE = "$PWD/deploy/staging/test-tools/node_modules/playwright/index.mjs"
$env:SFX_BROWSER_ORIGIN = 'http://127.0.0.1:8788'
$env:SFX_UI_PROVIDER_DIR = 'C:\lab\repos\sfx-providers\providers'
# The declared-page capture additionally needs the local estate host used for the
# Phase 0/U1 captures (implementation-strategy.md:155-159); the region capture does not.
$env:SDA_ESTATE_DIR = 'C:\lab\repos\sfx-embody'
$observer = Start-Process node -ArgumentList 'live-circuit/dispatch-pair/observe-server.mjs' -NoNewWindow -PassThru
Invoke-WebRequest http://127.0.0.1:8788/health -UseBasicParsing | Out-Null

node tools/live-circuit/verify-regions-browser.mjs
node tools/live-circuit/verify-browser-captures.mjs http://127.0.0.1:8788 --out artifacts/browser-captures-local

Stop-Process -Id $observer.Id
```

Required results:

- `artifacts/regions-local/capture.json` (`contractId: regions-capture.v1`) with every
  `explorer-<region>-declared`, `-slots-filled`, `-style-figure`, `-no-old-chrome` check passing
  for `header`, `left-sidebar`, `middle`, `right-sidebar` and `footer`; `regions-digests-verified`;
  `failure-<region>-named` = `UI_REGION_PROVIDER_UNREADABLE`; `tamper-<region>-named` =
  `UI_REGION_ASSET_DIGEST_MISMATCH`; `regions-blueprint-diff` clean; `console-clean`
  (`tools/live-circuit/verify-regions-browser.mjs:112-316`).
- `artifacts/regions-local/blueprint-diff.json` (the four Explorer regions against the local deck;
  the footer records its shell-chrome revision note).
- `artifacts/browser-captures-local/capture.json` with the signed-in captures marked
  `pending: true`, `reason: TEST_PRINCIPAL_CREDENTIALS_UNAVAILABLE` — the EXTERNAL GATE of §2,
  proven again on staging in §3.9.

### 3.7 Commits (four commits) and the single push — three lane commits done; push outstanding

Source: `implementation-strategy.md` §4.6 (change classes: exactly one class (a)/(b) release);
`ui-circuit-blueprint-strategy.md` §5 (module by module, no big-bang);
`docs/automatic-staging-deployment.md:4-12` (push on watched paths starts the release).

Lane C's `sfx-providers` commit is already pushed in §3.1. In `sfx-platform`, commit the three
lanes separately (message style follows the recent history), then push **once**:

```powershell
git add deploy/staging/identity-sources.json deploy/staging/release.mjs deploy/sda-kernel/prepare-composite.mjs deploy/sda-kernel/Dockerfile.composite deploy/sda-kernel/verify-composite-package.mjs
git commit -m "Ship the declared region provider packages in the composite release"

git add .github/workflows/staging.yml deploy/staging/accept.mjs live-circuit/circuit/verify-region.mjs live-circuit/circuit/verify-identity-session.mjs live-circuit/circuit/verify-objective.mjs live-circuit/circuit/verify-view.mjs tools/live-circuit/verify-regions-browser.mjs tools/live-circuit/verify-region-header-browser.mjs
git commit -m "Wire declared-region verification into checks and public acceptance"

git add live-circuit/circuit/explorer.html live-circuit/circuit/explorer.js live-circuit/circuit/explorer-shell.js live-circuit/circuit/region-runtime.js live-circuit/circuit/region-host.mjs live-circuit/circuit/footer.js live-circuit/circuit/home.html live-circuit/circuit/home.js live-circuit/circuit/login.html live-circuit/circuit/login.js live-circuit/circuit/page.html live-circuit/circuit/page.js live-circuit/circuit/site.js live-circuit/circuit/circuit-runtime.js live-circuit/circuit/run-context.js live-circuit/circuit/view-runtime.js live-circuit/circuit/view.html live-circuit/circuit/circuit-host.json live-circuit/circuit/README.md .gitignore live-circuit/dispatch-pair/observe-server.mjs
git commit -m "Mount the Explorer and shared chrome from declared regions"

git status --porcelain   # only untracked docs/outputs may remain
git log --oneline -4
git push origin main     # THE SINGLE BATCH DEPLOY
```

If any lane file is still unstaged or any unrelated file was staged, stop and amend before the
push — after the push the deploy cannot be un-sent, only rolled back.

### 3.8 Watch the batch deploy (EXTERNAL GATE)

Source: `AGENTS.md` (staging deploys automatically on watched paths; acceptance evidence is real);
`docs/automatic-staging-deployment.md:102-144` (sequence and gates).

```powershell
$run = (gh run list --workflow staging.yml --branch main --limit 1 --json databaseId,headSha,url | ConvertFrom-Json)[0]
$run.url
gh run watch $run.databaseId --exit-status
```

Gate order and what each failing gate means (deploy job is EXTERNAL, ~15–20 min per
`analysis/04:393-398`):

1. `checks` — the §3.5 suite on the pushed commit. Failing here never binds the slot.
2. `deploy` — installs the composite image; the new public region pins in §3.3(b) fail closed if
   Lane C did not actually place the packages (`accept.mjs public`). Auto-rollback on failure
   (`staging.yml:221-226`).
3. `accept.mjs browser` — real sign-in through the declared header (`#identity` lives in the
   `header` region, `explorer-shell.js:175-185`; asserted at
   `verify-browser-session.mjs:108-111,168-170,192`). This is WP0.6 and, with the capture bundle,
   WP0.7's DOM proof (`implementation-strategy.md:875-881`).
4. `windows-cli` and `finish` — CLI regression, restart/vault checks, `accepted.json`.

### 3.9 Staging receipts and the capture artifact (EXTERNAL GATE — CI credentials)

Source: `analysis/09` §1.4 (signed-in evidence only through the CI principal, artifact retention),
T4 (acceptance evidence is the browser receipt plus artifact; no secret in logs);
`implementation-strategy.md` §9.2 WP0.6–WP0.7.

```powershell
gh run download $run.databaseId -n staging-browser-captures -D artifacts/staging-browser-captures
gh run download $run.databaseId -n staging-release -D artifacts/staging-release
gh run download $run.databaseId -n staging-final -D artifacts/staging-final
```

Retained evidence (do not fabricate alternatives):

| Receipt | Content | Retention |
| --- | --- | --- |
| `staging-browser-captures/capture.json` + PNGs | signed-out and **signed-in** home captures, sections, digests, DOM-safety checks | 30 days (`staging.yml:108-115`) |
| `staging-release/browser-receipt.json`, `scene.json`, `capture.sse`, `run.json`, `frames.json`, `observe.png` | sign-in, live Observe, provider/outcome visits, attribution, no-secret scan | 30 days (`staging.yml:122-129`) |
| `staging-release/public.json` | the new region pins: five `AUTHORED` candidates + `UI_REGION_UNKNOWN` 404 | 30 days |
| `staging-release/deployed.json`, `restart.json`, `durable-*` | manifest/vault identity, restart proof | 30 days |
| `staging-final/accepted.json` | accepted release id/digest | 90 days (`staging.yml:227-234`) |

Record the run URL and these artifact names in the final report. Locally retained:
`artifacts/regions-local/{capture.json,blueprint-diff.json}`, `artifacts/browser-captures-local/`
(the signed-in `pending` entries are the honest local result).

### 3.10 Rollback

Source: `implementation-strategy.md` §9.3 (shell/registry uses the existing release rollback);
`docs/automatic-staging-deployment.md:224-241`; `AGENTS.md` (a failed gate rolls the slot back).

- **Automatic.** Any `deploy`/`windows-cli`/`finish` gate failure makes `finish` run
  `node deploy/staging/release.mjs rollback`, restoring the prior exact digest and waiting for
  readiness (`staging.yml:221-226`). Do nothing but confirm the `rollback.json` artifact and the
  `staging-final` receipt.
- **Manual, if the workflow is interrupted after binding.** With the `staging-release` artifact
  downloaded and Azure CLI authenticated:

  ```powershell
  $env:SFX_RELEASE_EVIDENCE = (Resolve-Path artifacts/staging-release).Path
  node deploy/staging/release.mjs rollback
  ```

  `rollbackAllowed` refuses if another deployment owns the slot (`policy.mjs:30-32`). Never
  force-push or edit the bound image.
- **Data rollback is not in this batch.** No declaration was published, so no
  `promote_ui_page`/`rollback_ui_page` path is involved (`implementation-strategy.md` §4.6, §9.3).
  A later provider-package revision is a new pinned commit and a new class (b) deploy
  (`ui-circuit-blueprint-strategy.md:173-193`), never a live-image edit.

---

## 4. Stop conditions

Stop before committing if: any §3.4–§3.6 gate fails, the provider checkout is absent, a lane file
is owned by two lanes, or the working tree contains files outside §1's ownership. Stop before the
push if any §3.5 command fails. After the push, the only recovery is §3.10 rollback plus a new
forward commit; do not cancel an active release to accelerate a newer push
(`docs/automatic-staging-deployment.md:236-241`).
