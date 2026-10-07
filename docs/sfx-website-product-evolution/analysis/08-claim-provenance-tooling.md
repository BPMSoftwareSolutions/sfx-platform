# 08 — Public-claim provenance tooling for gate G9

Prepared 2026-10-07. Status: **research and design only; not started.** Lane 2 (tooling).
Every claim about current behaviour cites `path:line`; every design element is labelled
`[proposal]`. Nothing in this document has been implemented, published or committed.

**Question.** G9 asks for “a public-claim provenance model (statement, basis, sourceRefs,
observedAt, effectiveAt, classification, status) for Standards/Research/current-development
content” (`implementation-strategy.md:971`), sequenced before the Standards/Research waves of
Phase 2 (`implementation-strategy.md:898-908`) so the website can say what is *in force*, what is
*proposed*, what SFX *claims*, and what it *can and cannot prove* (`intent.md:243-245`) without
inventing evidence. The strategy already refuses universal integration, unqualified compliance and
formal verification (`implementation-strategy.md:764-773`; `intent.md:227-241,685-701,894-923`) and
requires Lab/Preview labelling for architecture and research until gates close
(`intent.md:1414-1430`). What is missing is the declared model, the attachment mechanism and the
gate that make those refusals mechanical rather than editorial.

**What exists today.** The declarative-page stack is real: page definitions, layouts and component
contracts are versioned, digest-addressed rows (`sfx-embody/sql/migrations/declare-ui-page-reading.sql:73-111`),
one `read-ui-page` reader returns the composed page (`declare-ui-page-reading.sql:227`), the shell
validates it at read time (`live-circuit/circuit/live-store.mjs:247-302`) and render time
(`live-circuit/circuit/page-runtime.js:173`), and publication is a governed
stage → verify → CAS-promote → verify → receipt/rollback workflow
(`C:\lab\repos\sfx-embody\tools\publish-ui-page.mjs:100-147`) with receipts
(`docs/sfx-website-product-evolution/evidence/WP0-publish-rev3.json:35-47`). The home declaration
already carries a hand-written honesty precedent: `contentAuthority` propositions plus a note that
the page makes no compliance, coverage or availability claim
(`declare-ui-page-reading.sql:160-170,183`; `live-circuit/circuit/fixtures/pages/home.json:318-329`).
There is no claim table, no claim contract, no wording validator and no review export.

---

## 1. Claim model `[proposal]`

A claim is estate data admitted through the same migration-pair lifecycle as pages
(`implementation-strategy.md:602-621`) and published through the same governed path. It is a
reading, never a receipt: showing a claim with sources is not evidence the claim is true
(`implementation-strategy.md:775-779`; D8 at `:194`).

### 1.1 `ui-claim.v1` document `[proposal]`

```json
{
  "document": "ui-claim.v1",
  "claimId": "claim-hipaa-capability-mapping",
  "revision": 3,
  "statement": "SFX provides capability-level authority, execution evidence, traceability and control surfaces that organizations and assessors can map to applicable regulatory obligations.",
  "classification": "product-claim",
  "status": "current",
  "basis": "SFX declares capability authority, provider bindings and execution receipts as estate data. No assessor attestation exists, so the statement stops at mapping support; the mapping is performed by the customer's assessors.",
  "sourceRefs": [
    { "kind": "estate-declaration", "locator": "sidefx_ui.ui_page_definition/ui-page-home@r4", "digest": "sha256:<64 hex>", "observedAt": "2026-10-07T00:00:00.000Z" },
    { "kind": "repo-path", "locator": "docs/sfx-website-product-evolution/implementation-strategy.md:775-779" },
    { "kind": "external-url", "locator": "https://www.hhs.gov/hipaa/for-professionals/regulatory-initiatives/index.html", "observedAt": "2026-10-07T00:00:00.000Z" }
  ],
  "limits": "No certification, attestation or assessor report is claimed; nothing here discharges a regulatory obligation.",
  "observedAt": "2026-10-07T00:00:00.000Z",
  "effectiveAt": "2026-10-07T00:00:00.000Z",
  "supersedes": null,
  "supersededBy": null
}
```

Fields and their rules are in §3. The vocabularies are closed (the `review.md` tree,
`review.md:582-601`):

- `classification`: `external-fact`, `sfx-interpretation`, `product-claim`,
  `proposed-architecture`.
- `status`: `current`, `superseded`, `proposed`, `historical`.
- `sourceRefs[].kind` `[proposal]`: `external-url`, `repo-path`, `estate-declaration`,
  `reader-observation` (a registered reader read, e.g. a coverage count, with reader name, digest
  and `observedAt`), `evidence-receipt` (a retained receipt with optional `sourceTag` such as
  `attestation` or `proof-discharge`).

### 1.2 Storage and reading `[proposal]`

- `sidefx_ui.ui_claim_definition(claim_id, revision, document_json, digest, basis, published_at,
  published_by)` and `sidefx_ui.ui_current_claim(claim_id, revision)` as a CAS pointer table,
  append-only like the page tables (`declare-ui-page-reading.sql:73-115`). Revisions are immutable;
  supersession appends, never edits.
- The `read-ui-page` reader joins the page's pinned claim refs and returns the resolved claim
  documents inside the served `ui-page.v1` under `claims`. One page render stays one kernel invoke
  (`implementation-strategy.md:578-582`); the shell never fetches claims per section.
- A second declared read, `GET /api/circuit/v1/claims`, exposes the catalogue for review tooling
  and acceptance `[proposal]`, class (b) alongside `ui-registry`
  (`live-circuit/circuit/live-store.mjs:357-382,392`).

### 1.3 Rules as data `[proposal]`

The wording and classification rules live in one versioned data file, `claims-rules.v1`
(classification list, status list, source-kind list, trigger patterns, admitted-wording allowlist,
freshness windows). Its digest is published in the `ui-registry` manifest and recorded in every
publish receipt. Estate, server, client and publisher consume the same file; unknown rules version
refuses exactly like an unknown contract version (`implementation-strategy.md:530-541`). This is how
the design keeps one vocabulary: data plus dependency-free verify scripts, no framework.

---

## 2. How claims attach to page sections and copy `[proposal]`

Two additive members, no new component kind required for attachment:

1. **Page pin.** The `ui-page-definition.v1` document gains
   `"claims": [ { "claimId": "...", "revision": 3, "digest": "sha256:..." } ]` naming every claim the
   page uses. Unused claims may not be pinned (used-by rule, `implementation-strategy.md:206-210`).
2. **Section/prop attachment.** A section gains
   `"claims": [ { "claimId": "...", "revision": 3, "digest": "sha256:...", "props": ["lede","cards[0].body"] } ]`.
   `props` names the declared text units the claim covers. `ui-component.v1` contracts gain an
   optional `claimable` role list so the validator walks text generically instead of hard-coding
   prop names.

Claim-bound copy is a new prop form `[proposal]`: a claimable role may declare either a plain
string (free copy; the wording scan still runs) or
`{ "text": "...", "claims": ["claim-hipaa-capability-mapping@3"] }`. **The copy rule** makes
overclaiming impossible rather than merely detected: for every claim-bound text unit the declared
text must equal the claim's `statement` or a wording variant the claim itself carries with its own
basis; otherwise publication refuses `CLAIM_TEXT_MISMATCH`. The gate can therefore approve a claim
once and every placement of it anywhere is the approved text. Conversely, copy that triggers a
wording rule with no attachment refuses `CLAIM_REQUIRED`.

The existing `contentAuthority` block (`declare-ui-page-reading.sql:160-170`) is reused for page
posture rather than prose: `"claimsPosture": "current-offer" | "research"` `[proposal]`. Research
pages must render a Research/Lab banner and may host `proposed` claims; current-offer pages may not
(`CLAIM_PROPOSED_POSTURE_MISMATCH`). The Phase 0 hand-written basis note becomes a claim-bound
`text`/`note` once that page migrates.

---

## 3. Validation rules and refusal codes `[proposal]`

Authoring-time and read-time validation is one dependency-free script plus one data file (no
framework), mirroring `verify-pages.mjs` (`verify-pages.mjs:1-7,31-35`).

### 3.1 Structural and basis rules

| Rule | Refusal code |
| --- | --- |
| `claimRef` resolves to a published `ui_claim_definition` revision whose digest matches | `CLAIM_NOT_DECLARED`, `CLAIM_DIGEST_MISMATCH` |
| Classification and status are admitted values | `CLAIM_CLASSIFICATION_INVALID`, `CLAIM_STATUS_INVALID` |
| `basis` is present, ≥ 40 non-boilerplate characters, and differs from `statement` | `CLAIM_BASIS_MISSING` |
| `sourceRefs` non-empty; every kind admitted; estate/observation/receipt refs carry a digest | `CLAIM_SOURCE_REQUIRED`, `CLAIM_SOURCE_KIND_UNSUPPORTED` |
| `observedAt` present and not in the future | `CLAIM_DATE_MISSING`, `CLAIM_OBSERVEDAT_FUTURE` |
| `effectiveAt` may be future only when status is `proposed` | `CLAIM_EFFECTIVE_FUTURE_STATUS` |
| Classification-specific source requirements (below) | `CLAIM_SOURCE_REQUIRED` |
| Rules-file version known to shell and estate | `CLAIM_RULES_VERSION_UNSUPPORTED` |

Classification-specific source requirements:

| Classification | Required sourceRef evidence | Admitted statuses |
| --- | --- | --- |
| `external-fact` | ≥ 1 `external-url` or `repo-path`; attribute the source in `basis` | `current`, `historical` |
| `sfx-interpretation` | ≥ 1 sourceRef of any kind; basis names the external facts interpreted | `current`, `proposed`, `historical` |
| `product-claim` | ≥ 1 `reader-observation`, `evidence-receipt` or `estate-declaration`, fresh | `current` (or `proposed` without availability wording) |
| `proposed-architecture` | ≥ 1 `repo-path` or `estate-declaration`; mandatory Lab/Preview label | `proposed`, `historical` |

Freshness windows `[proposal]`, stored in `claims-rules.v1`: coverage observations 30 days,
product observations 180 days, release/availability receipts 90 days. A stale ref at publish
refuses `CLAIM_OBSERVATION_STALE` / `CLAIM_COVERAGE_STALE`; growing stale after publication
degrades the read and renders a visible stale marker rather than failing the whole page, matching
the degraded-read rule (`implementation-strategy.md:538-541,786-789`).

### 3.2 Classification versus wording (the refusal engine)

The wording scan runs over every declared text unit of claim-bearing pages. Trigger classes and
what admits them:

| Trigger class | Detected examples | Admitted only when | Refusal code |
| --- | --- | --- | --- |
| Compliance attestation | “HIPAA compliant”, “PCI DSS certified”, “audited against SOX”, “attested” | `external-fact` + `evidence-receipt` tagged `attestation` | `CLAIM_COMPLIANCE_UNSUPPORTED` |
| Universal/coverage | “all providers”, “every model”, “universal integration”, “227+”, “3M+”, “thousands” | `external-fact`/`product-claim` + fresh `reader-observation` of the same measure | `CLAIM_COVERAGE_UNSOURCED`, `CLAIM_COVERAGE_STALE` |
| Formal verification | “formally verified”, “proven correct”, “machine-checked proof” | `external-fact` + `evidence-receipt` tagged `proof-discharge` | `CLAIM_VERIFICATION_UNSUPPORTED` |
| Availability | “generally available”, “GA”, “in production”, “available today” | `product-claim` + `current` + fresh release receipt | `CLAIM_AVAILABILITY_UNSUPPORTED` |
| Absolutes/guarantees | “never”, “always”, “guarantees”, “eliminates risk” | `external-fact` quoting a source, or `limits` that explicitly softens | `CLAIM_ABSOLUTE_UNSUPPORTED` |
| Standard state | “HIPAA requires …”, “the proposed rule is in force”, standard version/date assertions | `external-url` ref with declared lifecycle (`in-force`/`proposed`/`final`) and `effectiveAt` | `CLAIM_STANDARD_STATE_UNSOURCED` |
| Architecture as product | `proposed-architecture` content without a visible Lab/Preview label | status `proposed` + visible label + posture `research` | `CLAIM_LAB_LABEL_MISSING`, `CLAIM_PROPOSED_POSTURE_MISMATCH` |

`claims-rules.v1` also carries an **admitted-wording allowlist** so the honest alternatives are
easy to author, not merely punished: “designed for verification” and “can generate deterministic
proof obligations” (`intent.md:695-699`) map to `proposed-architecture`; “map to applicable
regulatory obligations” (`intent.md:233`) maps to `sfx-interpretation`/`product-claim`. The scan
is an allowlist gate, not an NLP judge; it is honest about that limit in its receipt.

### 3.3 Status handling (superseded, proposed, historical)

- **Superseded.** A successor revision sets its own `supersedes` and a new predecessor revision
  appends status `superseded` + `supersededBy`. Nothing is deleted. A page pinned to a superseded
  revision refuses publication `CLAIM_SUPERSEDED_REFERENCED` unless the section declares
  `claimContext: "historical"`, in which case the renderer must show both dates and the successor
  link. At read time a superseded claim served as current degrades with reason
  `CLAIM_SUPERSEDED_REFERENCED` and renders a visible marker.
- **Proposed.** Requires `proposed-architecture` or a `product-claim` with no availability
  wording; must render the Proposed/Lab chip; may only appear on `research`-posture pages
  (`CLAIM_PROPOSED_POSTURE_MISMATCH`).
- **Historical.** Requires `effectiveAt` and `supersededAt`; may render only inside a historical
  context section; presented as “As of <effectiveAt>–<supersededAt>”
  (`CLAIM_HISTORICAL_WITHOUT_WINDOW`, `CLAIM_HISTORICAL_RENDERED_CURRENT`).
- **Current.** Must not carry `supersededBy`.

### 3.4 Where enforcement runs

1. **Author-local:** `verify-claims.mjs --fixtures` spawns the observer over the file-backed
   fixture source, exactly like `verify-pages.mjs:94-100` (`live-store.mjs:279-293`), and prints
   PASS/FAIL per rule with the refusal code.
2. **Publish gate:** `publish-claims.mjs` publishes claim revisions; `publish-ui-page.mjs` gains
   claim checks before `stage_ui_page` alongside `checkRegistry`
   (`tools/publish-ui-page.mjs:66-81`), records a `claims` section in its receipt
   (`publish-ui-page.mjs:38-51`), and keeps the same stage → candidate verify → CAS promote →
   post-verify → automatic rollback discipline (`publish-ui-page.mjs:100-147`).
3. **Read time:** server `validatePage` (`live-store.mjs:247-266`) and client `validatePage`
   (`page-runtime.js:173-249`) validate refs, digests, roles and text; served HTTP keeps the
   existing `422 UI_DECLARATION_INVALID` envelope (`verify-pages.mjs:148-159`) with an additive
   `refusals: [{ code, claimId, sectionId }]` detail array `[proposal]`.
4. **Acceptance:** `verify-pages.mjs` gains a `claims` group (`verify-pages.mjs:31-35`) and
   `accept.mjs` pins the new route and refusal fixtures
   (`implementation-strategy.md:823-826`).

---

## 4. Rendering semantics `[proposal]`

- **Status and classification are visible and verbatim.** Every claim-bearing section renders the
  classification (External fact / SFX interpretation / Product claim / Proposed architecture) and
  status (Current / Superseded / Proposed / Historical) chips plus `observedAt`/`effectiveAt`,
  using the Phase 1 `badge`/`status-chip` kinds (`implementation-strategy.md:233-235,1015-1020`),
  with basis, limits and sourceRefs in a `disclosure` “Basis and limits”. This is the reader-facing
  answer to “what is in force / proposed / what can SFX prove” (`intent.md:243-245`).
- **Never recomputed.** The adapter prints the declared fields; it derives no status from
  statement content, reorders claims, or turns sourceRefs into a “verified” badge. The layout
  honesty rule — “status and meaning are rendered, never recomputed”
  (`implementation-strategy.md:411-416`) — extends to claims.
- **Contractual data attributes** `[proposal]` for acceptance parity:
  `data-claim-id`, `data-claim-classification`, `data-claim-status`, `data-observed-at`,
  `data-effective-at`, mirroring the state-attribute rule (`implementation-strategy.md:237-239`).
- **Safety.** Claim text renders through `textContent`; source URLs pass `safeUrl`
  (`page-runtime.js:14-16,82-96`); a refused scheme renders as inert text. The rendering-safety
  gate covers claims (`implementation-strategy.md:791-797`; `verify-pages.mjs:187-192`).
- **Failure is content.** A missing/stale/degraded claim renders a named notice, never a blank
  section and never a silent fallback (`implementation-strategy.md:584-591,786-789`).
- A claim render remains a reading, not a receipt; sourceRefs carry the evidence role
  (`implementation-strategy.md:194,775-779`).

---

## 5. Deck and capture review surfaces `[proposal]`

The design surface already has the right shape: the deck evidence drawer is a claim-plus-locator
list, `claims: list of (claim, locator)` (`analysis/05-prior-art-design-surface.md:95-96`); slide
sources carry explicit `claim`/`limit` pairs (`:299,307`); the standing rules are “every claim has
a locator and a state” (`:362-366`) and “measured claims over marketing” (`:382-383`). The deck is
a design artifact, not runtime (`:15-16,142-159`), so it must consume a generated artifact rather
than duplicate logic.

- `verify-claims.mjs --review <wave> --out <path>` emits `claims-review.json` plus a deterministic
  `claims-review.md`: one row per claim with `claimId`, statement, classification, status,
  sourceRefs, `observedAt`, `effectiveAt`, page/section attachment, gate disposition, and rules
  digest. It is generated from the same declarations and rules the gate uses.
- The deck pipeline renders that JSON into the evidence drawer; capture review annotates each
  screenshot’s claim IDs, status chips and visible dates. A capture showing a claim absent from
  the export fails the review (`CLAIM_REVIEW_MISSING`; process check, not runtime).
- The browser acceptance gate asserts the date and status text is present in the DOM (WP2.6).

---

## 6. Authoring flow

1. Author drafts `ui-claim.v1` documents with classification, status, basis and sourceRefs; runs
   `node live-circuit/circuit/verify-claims.mjs --fixtures` for immediate named refusals.
2. Author attaches claims to sections/props and sets page `claims` pins and `claimsPosture`; any
   copy that triggers a wording rule now needs a claim or refuses `CLAIM_REQUIRED`.
3. `publish-claims.mjs` publishes claim revisions; `publish-ui-page.mjs` re-validates the page and
   its attachments, stages, verifies the candidate, CAS-promotes, re-verifies and records the
   receipt or rolls back (`tools/publish-ui-page.mjs:100-147`; receipt shape
   `evidence/WP0-publish-rev3.json`).
4. On refusal the author reads the specific code (claim, section, prop), fixes the claim or the
   wording, and republishes; the prior revision is retained by construction.
5. The review export feeds the deck and capture review before the Standards/Research wave ships.

Authoring stays on the estate's governed publish path; no browser CMS
(`implementation-strategy.md:964-966`; G4).

---

## 7. Integration points

| Point | Current behaviour (cited) | Change `[proposal]` |
| --- | --- | --- |
| Estate schema/reader | page/layout/component tables and reader (`declare-ui-page-reading.sql:73-111,227`) | add claim tables, `ui_current_claim`, claim join in the reader, claim contracts and `claims-rules.v1` install |
| Page definition | `ui-page-definition.v1` shape (`implementation-strategy.md:377-399`; fixture `home.json:1-391`) | page `claims` pins, `claimsPosture`, claim-bound prop form, `claimable` roles in `ui-component.v1` |
| Registry manifest | `uiRegistry` (`live-store.mjs:357-382,392`); client copy (`page-runtime.js:22-54`) | add claim contract/rules versions; unknown version refuses |
| Server read validation | `validatePage`/`readPage` (`live-store.mjs:247-302`) | ref/digest/status checks; stale degradation; `claims` in served document |
| Client validation/render | `page-runtime.js:173-249`; adapters in `ui-components.js` | attachment/text-mismatch refusals; chips and disclosure; data-* attributes |
| Publish gate | `publish-ui-page.mjs:66-81,100-147` | claim checks + `publish-claims.mjs`; receipt `claims` section |
| Acceptance | `verify-pages.mjs:31-35,148-159`; `accept.mjs` public pins (`implementation-strategy.md:823-826`) | `--claims` group, `/api/circuit/v1/claims` 200, refusal fixtures |
| Deck/capture | evidence drawer (`analysis/05-prior-art-design-surface.md:95-96,362`) | consume generated `claims-review.json` |

---

## 8. Acceptance evidence (G9 closure) `[proposal]`

| Gate | Passes when | Receipt |
| --- | --- | --- |
| WP2.1 | Claim fixtures: every structural/basis rule passes or refuses with its named code | `verify-claims.mjs --fixtures` report |
| WP2.2 | Overclaim drill: “HIPAA compliant” with no attestation receipt refuses `CLAIM_COMPLIANCE_UNSUPPORTED`; corrected wording publishes | refusal fixture + publish receipt |
| WP2.3 | Attachment drill: orphan ref refuses `CLAIM_NOT_DECLARED`; copy diverging from an approved statement refuses `CLAIM_TEXT_MISMATCH` | refusal fixture report |
| WP2.4 | Supersession drill: successor published; a page pinned to the superseded revision refuses or renders historical with both dates; no silent flip | publish receipt + served read |
| WP2.5 | Served document carries classification, status, `observedAt`/`effectiveAt`; served digest equals publish digest; no recomputation | browser gate + `verify-pages` |
| WP2.6 | Stale-observation degradation renders a visible marker; missing claims render a named notice | browser gate |
| WP2.7 | `claims-review.json` lists basis and dates for every claim in the wave; captures match | review export |

Evidence files follow the existing `evidence/WP0-*.json` convention
(`docs/sfx-website-product-evolution/evidence/WP0-publish-rev3.json`), e.g.
`evidence/WP2-claims-<date>.json`.

---

## 9. Effort and risk

**Effort `[estimate]`:** claim contract + migration pair + reader join, 3–4 person-days (estate);
`claims-rules.v1` + `verify-claims.mjs` + fixtures, 3–4; publisher and page-gate extension, 2–3;
runtime attachment/render/safety, 3–4; review export and deck consumption, 1–2; drills and
receipts, 2. Roughly **3 person-weeks**, all dependency-free data and `node` scripts, sequenced
inside the Phase 2 entry that already gates on G9 (`implementation-strategy.md:898-902`).

| # | Risk | Mitigation | Signal |
| --- | --- | --- | --- |
| R1 | Novel phrasing evades the lexicon, or false positives stall authors | Attachment requirement (claim-bound copy) plus human content review; admitted-wording allowlist; rules are an allowlist gate, never claimed as a semantic judge | refusal log, review notes |
| R2 | Rules drift between estate, shell, publisher | One `claims-rules.v1` digest in manifest and receipts; unknown version refuses | digest mismatch receipt |
| R3 | Source refs rot (links, standard dates) | `observedAt` freshness windows, declared lifecycle/`effectiveAt` for standards; dates rendered visibly | stale degradations |
| R4 | Copy drifts from approved claim text | `CLAIM_TEXT_MISMATCH` at publish and read; copy derives from claim documents | publish refusals |
| R5 | Supersession mistakes overwrite history | Append-only revisions, CAS pointer law (`implementation-strategy.md:351-357`), supersession drills | WP2.4 receipt |
| R6 | SourceRefs are asserted, not independently verified | Estate/reading/receipt refs are digest-checkable; external URLs stay human-reviewed with `observedAt`; nothing claims platform verification | basis/limits text |
| R7 | Tool becomes a CMS or framework | Claims ride the existing governed publish path; no browser writing, no build step | code review, G4 |

**Open questions (for G9 decision).** (a) Should claims publish independently of pages (proposal
here: yes, own pointer, page refs pin revision+digest) or only inside page publications?
(b) Freshness windows per classification — adopt 30/90/180 days or single window? (c) Does the
wording scan run only on declared copy at the gate (proposal) or also on served HTML at
acceptance? (d) Should Phase 0/1 pages migrate their existing `contentAuthority` prose to claims
before Phase 2, or only new claim-bearing pages?
