# 16b — Per-provider UI contract

Prepared 2026-10-09; §10 updated 2026-10-10 with the model-provider trace; §11 added 2026-10-10
mapping the design onto the `SFX.Semantics` read slice. As a design
specification only: no code, declaration, estate, provider or workflow file was changed by this
document. Every normative statement is a **`[proposal]`** unless
it cites a deployed artefact as **Observed**. The provider writer and reader are Observed
(`../../live-circuit-provider-details.md`); the drill-down view and hosted provider API are Observed
(`live-circuit/circuit/view-runtime.js`, `sfx-providers/docs/ui-provider-hosting.md`); the
`SFX.Semantics` slice is Observed but its contract remains a non-authoritative draft (§11.1).
Nothing here
authorises SDA, `sfx-embody` or `sfx-dal` changes (`AGENTS.md`); SDA behaviour changes only by
request to `scenario-driven-architecture`.

This lane answers a gap recorded as outstanding: `provider-profile.js` per-row editors and
per-engagement staging have no declared form scope (`analysis/14-remaining-work-inventory.md:198`
H11; `analysis/13a-explorer-runtime.md:84-93,384`). It proposes that each provider declares its own
UI contract, so one generic profile view, one hosted drill-down provider and one staged-document
mechanism serve every provider kind, and no provider-specific UI code is written.

---

## 1. The problem, stated from what is deployed

**Observed.**

- The provider drill-down is one declared `ui-view.v1` at `/circuit/views/provider-profile`; it
  binds the `provider-inspection` source by pointer, renders with the shared page projector and the
  deployed 21 `ui-component.v1` kinds, and stages nothing
  (`live-circuit/circuit/README.md:174-198`;
  `live-circuit/circuit/fixtures/pages/provider-profile.json:14-87`;
  `live-circuit/circuit/view-runtime.js:19-21,101-113`). Its change form carries provider-specific **literals** — the
  `google/gemini-select` namespace, path, template and digest appear as `props`/literal values, not
  as read-selected fields (`declare-provider-profile-view.sql:68`,
  `"sectionId":"profile-change-form"` block).
- The behind-it reader is a provider-shape reader, not a screen reader: `analysis.read_provider_details`
  emits eight sets and always walks instructions for every engaged port
  (`live-circuit-provider-details.md:29-47`); the screen wave grows it with projections including
  `provider_update_targets` and a redacted `provider_credentials`
  (`sfx-embody/sql/migrations/declare-provider-details-screen-read.sql:6-40`).
- The costs of "read everything" are named: platform catalogs can name the same provider from
  1,047 selected port generations and exceed the 30 s read timeout; the canonical-body reader is
  *selected* for `canonicalProviders`, never used as a fallback
  (`live-circuit-provider-details.md:276-294`; `circuit-host.json:12-15`;
  `live-circuit/circuit/README.md:178-185`).
- The editor surface already exists in two halves: the read half (`provider_invocations`,
  `provider_engagements`, `provider_instructions`, and the screen wave's `provider_update_targets`)
  and the write half: the atomic writer `model.install_provider_details_change` consumes exactly one
  change document — `provider`, `engagements[]`, `instructions[]` — with per-target `expectedDigest`
  guards (`live-circuit-provider-details.md:120-207`;
  `sfx-embody/sql/migrations/install-provider-details-change.sql:7-51`). The browser stages that
  document and applies nothing; the writer is never in `retrieval-policy.json`
  (`live-circuit-provider-details.md:120-126,240-241`).
- The hosting half exists: the UI provider API serves index, manifest, assets and one READ_ONLY
  `invoke` per provider; the drill-down provider `sfx-ui-provider-drilldown` (`ui.view.prepare`)
  validates a supplied `ui-page.v1` read carrying `ui-view.v1` identity, binds selection and never
  synthesizes a profile (`sfx-providers/docs/ui-provider-hosting.md:21,34-36,40-49`;
  `sfx-providers/providers/sfx-ui-provider-drilldown/README.md:6-16`).

What is missing is **declared data locating the four edit intents on the read rows**: which set,
which row, which field is editable, which digest guards it, and which writer section it becomes.
Today those choices are hand-coded literals in one view (Observed) or implicit in the reader.

---

## 2. The contract document `provider-ui-contract.v1` `[proposal]`

One declaration per provider, or per provider kind, carrying identity, display sections, read scope
and edit intents. It is meaning, so it lives in the estate (class (c)); the browser and the hosted
provider package only project it.

```json
{
  "document": "provider-ui-contract.v1",
  "contractId": "ui-contract-google-gemini-select",
  "scope": { "providerKind": "model-overlay", "providerId": "google/gemini-select" },
  "revision": 1,
  "digest": "sha256:<64 hex>",
  "identity": { "title": "Provider involvement", "badges": ["kind", "role", "provider_state"] },
  "readScope": {
    "identityResultSet": "provider_identity",
    "sets": ["provider_identity", "provider_configuration", "provider_engagements", "provider_instructions"],
    "rowLimits": { "provider_engagements": 20, "provider_instructions": 40 }
  },
  "sections": [
    { "sectionId": "provider-identity", "order": 1,
      "component": { "kind": "field-list", "version": 1 },
      "selection": { "rows": { "set": "provider_identity", "row": 0 },
                     "columns": ["provider_state", "definition_digest", "namespace_id"] },
      "presentation": "read-only" },
    { "sectionId": "provider-model", "order": 2,
      "component": { "kind": "field-list", "version": 1 },
      "selection": { "rows": { "set": "provider_configuration", "row": 0 },
                     "columns": ["name", "role", "configuration_json"] },
      "presentation": "editable", "intentRefs": ["set-api-label"] },
    { "sectionId": "provider-request-shaping", "order": 3,
      "component": { "kind": "field-list", "version": 1 },
      "selection": { "rows": { "set": "provider_engagements", "row": "selected" },
                     "columns": ["capability_id", "port_id", "url_prefixes", "endpoint_template"] },
      "presentation": "editable", "intentRefs": ["set-request-url"] },
    { "sectionId": "provider-instructions", "order": 4,
      "component": { "kind": "table", "version": 1 },
      "selection": { "rows": { "set": "provider_instructions" },
                     "columns": ["instruction_kind", "scope_id", "declared_id", "json_path", "definition_digest"] },
      "presentation": "editable", "intentRefs": ["edit-instruction"] }
  ],
  "editIntents": [
    { "intentId": "edit-instruction", "label": "Edit declared instruction",
      "documentSection": "instructions",
      "target": { "namespace": { "from": { "set": "provider_instructions", "row": "selected", "column": "namespace_id" } },
                  "declaredId": { "from": { "set": "provider_instructions", "row": "selected", "column": "declared_id" } },
                  "path": { "from": { "set": "provider_instructions", "row": "selected", "column": "json_path" } } },
      "valueKind": "text",
      "guard": { "documentMember": "expectedDigest",
                 "from": { "set": "provider_instructions", "row": "selected", "column": "definition_digest" } } }
  ]
}
```

Closed vocabularies `[proposal]` (a value outside the list refuses by name, never drops):

| Vocabulary | Admitted values |
| --- | --- |
| `presentation` | `read-only`, `editable` |
| `editIntents[].documentSection` | `provider`, `engagements`, `instructions` |
| `editIntents[].valueKind` | `text`, `json` |
| `scope.providerKind` | `model-overlay`, `http-overlay`, `platform-capability`, `slot-bound`, `generic` (§6) |

`selection` is a pointer, not a transform: it names a result set, a row (index, `selected`, or an
`all` iterator) and the columns to carry; it never names SQL, never renames a column and never
synthesizes a field — the same rule the browser already obeys
(`implementation-strategy.md:258-265`). `editable` means "the field participates in a staged
document"; it never means the render may apply — both presentations are reads (D8,
`implementation-strategy.md:256`). The example above is an excerpt, and its column names are
illustrative: the admitted contract must use the reader's declared column names exactly, and a
mismatch refuses by name (§3, item 1).

> **Semantic addressing `[proposal]`.** When a semantic projection covers the reader (§11),
> `selection` addresses typed snapshot fields and digests instead of raw result-set columns; the
> semantic contract's mapping is then the only place column names appear, and a selection naming an
> absent entity, entity field or digest refuses by name like an absent column. Until the
> provider-root projection lands, the reader-column rule above governs.

> **Caveat (proposal).** The `editIntents` shown is one entry; the model kind's full set is the §4
> table. `intentRefs` in a section is a list of `intentId`s the section's fields feed.

---

## 3. Display sections: field selection and presentation kinds `[proposal]`

1. **Field selection is declared, not coded.** A section selects columns from the reader's result
   sets; a section whose selection names an absent set or column refuses visibly
   (`UI_CONTRACT_SELECTION_INVALID`) rather than rendering empty. This replaces the current
   provider-specific literals in the `provider-profile` view (`declare-provider-profile-view.sql`,
   `profile-change-form` block) with pointers into `provider_identity`, `provider_configuration`,
   `provider_engagements`, `provider_instructions`, `provider_invocations` and — where the screen
   wave is installed — `provider_credentials` (reference only), `provider_update_targets` and
   `provider_reference_joins`
   (`declare-provider-details-screen-read.sql:6-40`).
2. **Presentation kinds.** `read-only` renders values as returned. `editable` renders a field card
   whose initial value and guard are read-selected; the assembled document is staged, copied or
   downloaded, never applied (`implementation-strategy.md:339-340`; `landing-blueprint.md:351-353`).
3. **State-scoped sections reuse the deployed `when` mechanism** for signed-in variants and for
   provider state (`DECLARED` / `ENGAGED_UNDECLARED` / `ABSENT`), so an absent declaration shows an
   explicit absent state, never a bare null (`implementation-strategy.md:513-517`;
   `declare-provider-details-screen-read.sql:35-40`).
4. **Unknown kind or role refuses visibly.** Sections use the deployed registry kinds only; an
   unknown kind is `UI_COMPONENT_NOT_SUPPORTED`, a role outside the contract is
   `UI_COMPONENT_ROLE_UNSUPPORTED` (`implementation-strategy.md:303-316`; `landing-blueprint.md:381-388`).
   No new component kind is required by this design; the existing `form`, `code`, `field-list`,
   `table`, `disclosure`, `notice`, `badge` and `status-chip` cover the profile's sections
   (`circuit-host.json:17`; `live-circuit/circuit/fixtures/pages/provider-profile.json:40-86`).
5. **Raw sets stay one disclosure away.** As the deployed view already does, the untouched result
   sets remain visible in a `disclosure` section; the contract interprets nothing
   (`live-circuit/circuit/fixtures/pages/provider-profile.json:63-73`;
   `live-circuit-provider-details.md:276-285`).

---

## 4. Edit intents map to the change-document writer `[proposal]`

Four named intent families (five writer rows — API label and request URL are the two halves of the
provider-identity/request-shaping intent), each expanding into exactly one change document for
`model.install_provider_details_change`; the writer composes already-installed layer writers in one
transaction (`live-circuit-provider-details.md:128-164`;
`install-provider-details-change.sql:7-44`).

| Intent | Document section written | Layer writer | Guard read from | Refusal on stale |
| --- | --- | --- | --- | --- |
| **Instruction edit** | `instructions[]` (`namespace`, `declaredId`, `path`, `valueJson`) | `model.update_definition_member` | `provider_instructions.definition_digest` | `PROVIDER_DETAILS_STALE_DIGEST` / `*_STALE_DIGEST` |
| **Model version** (model overlay) | `instructions[]` on the conveyor entry's model member, or `provider.configuration` where the provider carries its own model | `model.update_definition_member` or `model.configure_provider` | conveyor transformation `definition_digest` or `provider_identity.definition_digest` | as above |
| **Provider switch** (generic LLM connector) | `engagements[]` patch of the port's provider authority + `instructions[]` literal of the request's provider authority id | `model.patch_port_configuration` + `model.update_definition_member` | `provider_engagements.generation_digest` + transformation `definition_digest` | `PROVIDER_DETAILS_ENGAGEMENT_*` / stale digest |
| **API label** | `provider { name }` | `model.configure_provider` | `provider_identity.definition_digest` | `PROVIDER_DETAILS_STALE_DIGEST` |
| **Request URL** | `engagements[]` patch of the url prefix / endpoint member | `model.patch_port_configuration` | `provider_engagements.generation_digest` | `PROVIDER_DETAILS_ENGAGEMENT_*` |

Grounding:

- **Instruction edit** is the deployed, verified shape: `instructions[]` entries with
  `namespace`/`declaredId`/`path`/`valueJson`/`expectedDigest`
  (`live-circuit-provider-details.md:136,153-164`), the verified `google/gemini-select` document
  staged from exactly that reading (`:170-194`), and the deployed change form already shows that
  shape (`declare-provider-profile-view.sql`, `profile-change-code` block).
- **Model version** for the generic LLM connector is a declared member, not a kernel fact: the
  conveyor authority carries `providers[].models[].alias/resolvedModel` and lives inside a
  transformation's `expression.bindings.conveyor` member
  (`order-model-protocol-transformation-bindings.sql:27`;
  `repair-model-step-provider-binding.sql:33-46`). The contract's selection decides which path is
  editable; both paths still resolve to the writer's `instructions[]` or `provider` sections.
- **Provider switch** has a lived precedent: routing the objective-v3 summary step to
  `secondary-cognitive-provider`/`openai/gpt` wrote the request transformation's
  `providerAuthorityId` literal, the port configuration, and (a declared revision, outside the
  atomic writer) the provider catalog identity
  (`route-objective-v3-summary-through-secondary-provider.sql:1-33`). The atomic writer covers the
  first two writes; a provider the estate has never declared remains a declaration revision, not a
  UI edit — the contract must say so.
- **API label / request URL**: provider name is `provider.name` (`model.configure_provider`); request
  shaping is the engagement configuration the details read already projects — url prefixes, endpoint
  digest, credential reference and injection rule, carrier shaping
  (`live-circuit-provider-details.md:37`; `provider_engagements` set), patched one member at a time
  with `model.patch_port_configuration` (`:134`).

**Guard rules.** The document-level `expectedDigest` initialises from the newest selected provider
definition digest (`provider_identity.definition_digest`); every engagement guard
initialises from `provider_engagements.generation_digest`; every instruction guard from
`provider_instructions.definition_digest` (`live-circuit-provider-details.md:153-164`). A guard is
omitted only when the operator explicitly intends a whole-configuration replacement, which the
contract must surface as a distinct, additional confirmation field — never as a silent default
(`:201-203`). Re-applying an unchanged document must produce `already_set` rows with unchanged
digests; that is the idempotence test, not an apply convention (`:148-151`).

**Staging path.** `editable` sections populate a `form`, large values use the `code` kind, and the
only actions are `stage-change`, `copy`/`download` — all `local` dispatch, none reaching a server
(`implementation-strategy.md:328-341,355-357`; `landing-blueprint.md:114-119`). The staged document
is presented for review exactly as §3 of the writer document describes, and the result receipt
(`provider_details_change`, `provider_details_change_summary`) remains the only apply evidence
(`live-circuit-provider-details.md:243-255`).

---

## 5. Scoped read requests `[proposal]`

The contract's `readScope` is the query plan for the profile:

1. **Which sets to fetch.** `readScope.sets` restricts the read to the declared sets; a
   `slot-bound` or `platform-capability` contract may omit `provider_instructions` entirely. This is
   the principled version of the current `canonicalProviders` selection: a platform catalog should
   not walk 1,047 port generations to render an identity card
   (`live-circuit-provider-details.md:276-294`; `circuit-host.json:12-15`).
2. **Which rows.** `rowLimits` bound the engagement and instruction walks; the read remains one
   request, under the host's 30 s timeout and 16 MiB cap
   (`circuit-host.json:7-10`; `live-circuit-provider-details.md:286-294`).
3. **Which columns reach the page.** Section selections name columns; the composed view carries only
   declared pointers, so the browser receives no more than the sections use — the browser never
   names result sets (`implementation-strategy.md:258-265`).
4. **The mechanism.** The observer's `provider-inspection` request grows an optional, declared
   `scope` parameter passed through to a new optional reader parameter (e.g. `@scope`/`@sets`) —
   an SDA behaviour change and therefore a request to `scenario-driven-architecture`, not a silent
   shell change (`AGENTS.md`; `live-circuit-provider-details.md:92-100`). Until that lands,
   `readScope` is enforced at **compose time** only (the profile view drops undeclared sets), the
   full read still executes, and the canonical selection rule remains for the named providers. The
   contract must publish which behaviour is in force (`scopeEnforced: "compose" | "reader"`) so a
   capture can tell the two apart.
5. **Read policy.** The scope parameter is validated server-side and can only narrow; a scope
   naming an undeclared set refuses (`PROVIDER_DETAILS_SCOPE_INVALID` `[proposal]`). Reads keep the
   existing queue, cache, timeout and size limits (`implementation-strategy.md:628-644`).
6. **Semantic home.** The scope profile belongs on the provider-root semantic contract when it
   lands (§11.3; `sfx-dal/docs/semantic-object-projection-strategy.md:126,181`); the reader
   parameter and the compose-time fallback remain the transport until then.

---

## 6. Per-kind defaults with per-provider overrides `[proposal]`

| Kind | Detected from | Default sections | Default intents | Notes |
| --- | --- | --- | --- | --- |
| `model-overlay` | provider engaged by model ports; `provider_kind`/provider authorities (`provider_engagements` columns; `live-circuit-provider-details.md:37`) | identity, configuration, instruction table, invocation list | `edit-instruction`, `set-model-version`, `switch-provider` | the first slice (§10) |
| `http-overlay` | HTTP exchange engagements (`rapidapi/yahoo-finance-real-time1` example, `live-circuit-provider-details.md:42-43`) | identity, configuration, request-shaping, bindings | `set-api-label`, `set-request-url` | credential shown by reference only |
| `platform-capability` | `PLATFORM` engagements (`platformCapabilityId`; `:37`) | identity, summary, reference joins | none | read-only by default |
| `slot-bound` | `provider_bindings` rows (`:36`) | identity, bindings, mechanics | none | read-only by default |
| `generic` | no kind row and no provider row | today's deployed profile sections | none | byte-compatible fallback to `live-circuit/circuit/fixtures/pages/provider-profile.json` |

Resolution order: **provider row → kind row → `generic` built-in**, first match wins. Every served
contract carries the resolved `scope`, the winning row's `revision`/`digest`, and a
`resolution: { source: "provider" | "kind" | "builtin" }` marker so a capture proves which row was
used. A kind row can only declare sections/intents the built-in vocabulary admits; a provider row
can add intent paths but cannot add new intent kinds, new component kinds or new writer sections —
those are contract-vocabulary revisions and therefore class (c) decisions, never a per-provider
free-for-all (`AGENTS.md`; `implementation-strategy.md:388-395`).

---

## 7. Where the contract is declared `[proposal]`

- **Estate rows, class (c), keyed by kind and id.** A `sidefx_ui` table
  `ui_provider_ui_contract` mirroring the page tables: `provider_kind` (never null), `provider_id`
  (nullable for a kind default), `revision`, `document_json`, `digest`, `published_at`,
  `published_by`; one pointer row selects the newest revision, exactly as
  `sidefx_ui.ui_page_definition`/`ui_layout_definition` already work
  (`declare-provider-profile-view.sql:7-27,53-80`).
- **A declared reader**: `analysis.read_provider_ui_contract(@provider_id, @provider_kind)` returns
  the effective contract, the resolution marker and the candidate digests. It is registered as a
  reader (new `readers` entry / source, K5 pattern, `analysis/07-kind-and-reader-tooling.md:179-219`)
  so the shell fetches it like every other source; the browser still never runs SQL.
- **Bound by a semantic contract.** The same reader is the source of a semantic projection
  contract following `sfx.capability-details` (§11): the compose step then consumes a typed,
  digest-addressed snapshot with provenance and named refusals instead of raw result sets, and the
  contract's `contractDigest`/`resolution` members are projections of that snapshot.
- **Publication** is a migration pair that appends a revision and moves the pointer; a contract
  change needs no shell deploy and no provider release, matching the data-only publication rule for
  class (c) (`implementation-strategy.md:388-395`). Digest-addressing makes the pair's no-op proof
  the same shape as the writer's (`install-provider-details-change.sql:46-51`).
- **The view stays one generic declaration.** `provider-profile` remains the single `ui-view.v1`
  instance; the observer resolves the contract and composes the declared sections into it before
  the drill-down provider receives it. The served view gains optional `contractDigest`,
  `providerDefinitionDigest` and `resolution` members, following the existing `viewId`/
  `viewContractId` extension precedent (`declare-provider-profile-view.sql:18-27`), so the
  drill-down can refuse `PROVIDER_UI_CONTRACT_STALE` `[proposal]` when its bound guard no longer
  matches.
- **The provider definition digest and the contract digest stay separate.** The former pins
  semantics (the writer's guard), the latter pins presentation; a contract edit must not force a
  provider re-declaration, and a provider re-declaration must not silently keep a stale section map
  — the per-provider contract's `providerDefinitionDigest` binding is checked at compose time
  (`live-circuit-provider-details.md:243-255`).

---

## 8. How the hosted `sfx-ui-*` provider API renders and edits it `[proposal]`

The hosted API is implementation, not meaning (`analysis/15-provider-deployment-boundary.md:33-44`;
`analysis/12-ui-runtime-providers.md:212-218`). Nothing in this design adds a route to it.

1. **Resolve (platform).** The observer reads `provider-inspection` (scoped, §5) and
   `provider-ui-contract`, then composes the `provider-profile` view: sections from the contract,
   pointers bound to the reading, `contractDigest`/`resolution` in the document. Read-only and
   `editable` sections are composed the same way; only their rendered affordance differs.
2. **Prepare (hosted).** `sfx-ui-provider-drilldown` (`ui.view.prepare`) receives that
   `ui-page.v1` result, validates it, binds the Explorer selection, and returns it unchanged
   otherwise (`sfx-ui-provider-drilldown.mjs:11-35`; `README.md:6-16`). It still synthesizes
   nothing; the contract crossing its boundary is already resolved, validated data.
3. **Render (browser).** The drill-down browser module mounts with the shared page projector and
   adapters (`sfx-providers/docs/ui-provider-hosting.md:34-36`); `editable` fields initialise from
   selected read columns; `expectedDigest` fields initialise from the guard columns; unknown
   component, role, action or set renders its named refusal (`implementation-strategy.md:303-316`).
4. **Edit (browser, local only).** `stage-change` assembles the document; `copy`/`download` export
   it; the form's submit label says stage, and the `notice` states the apply state
   (`declare-provider-profile-view.sql`, `profile-apply-notice` block;
   `implementation-strategy.md:339-340`). No hosted route, no platform route and no browser script
   applies it; the only apply paths remain the estate migration pair and the server-side DAL
   repository (`live-circuit-provider-details.md:209-242`).
5. **Publish (manifest).** The hosted manifest (`GET /ui-providers/{providerId}/manifest`) gains a
   `uiContract` reference — contract id and digest, never contract meaning — beside the existing
   identity, contracts, operations, entrypoint and asset digests
   (`sfx-providers/docs/ui-provider-hosting.md:40-49`; `analysis/15-provider-deployment-boundary.md:104-133`).
   The platform's parity gate compares it to the estate contract; a mismatch is a deployment
   finding, not a silent override.

---

## 9. Security boundaries

1. **Browser stages, never applies.** The only browser writes remain session and observe/objective
   (`implementation-strategy.md:347-357`; `landing-blueprint.md:390-396`); `stage-change` mints no
   run, claim or trust state (`implementation-strategy.md:256,339-340`).
2. **The retrieval service stays read-only.** No writer is ever added to
   `retrieval-policy.json`; the contract repository is a read like every other source
   (`live-circuit-provider-details.md:120-126,240-241`).
3. **No credentials, anywhere in the path.** The contract and view carry credential *names* and
   injection rules only; `provider_credentials` is emitted `REDACTED` by construction
   (`declare-provider-details-screen-read.sql:23-25`); the SDA token stays server-side and never
   reaches the browser (`live-circuit-provider-details.md:96-97`; `implementation-strategy.md:821-822`);
   provider browser assets carry no credential (`analysis/15-provider-deployment-boundary.md:210-214`).
4. **No new authority.** The contract cannot invent a route, method, header or credential, cannot
   name an action outside the closed twelve-kind vocabulary, and cannot widen a `dispatchClass`
   (`implementation-strategy.md:343-357`). Validation runs before render, server and client
   (`implementation-strategy.md:584-603`).
5. **Digest guards are concurrency control, not authorisation.** They reject stale writers; they
   grant no apply right, and the caller still needs the writer's own environment (`AGENTS.md`:
   SDA behaviour by request; estate changes by migration pair).
6. **Unknowns refuse by name.** Unknown provider, kind, set, column, component, intent or writer
   section is a visible named refusal with no fallback renderer (`ui-circuit-blueprint-strategy.md:203-207`;
   `landing-blueprint.md:381-388`).

---

## 10. First slice: the model provider drill-down `[proposal]`

**Scope.** A `model-overlay` kind default plus per-provider overrides (`google/gemini-select`,
`google/gemini-summary`), exercised
against the generic LLM connector's `request-capability-from-objective-v3` (the verified
reader/writer example, `live-circuit-provider-details.md:25,166-194`), whose two resolved model
providers are `google/gemini-select` and `google/gemini-summary` (trace below); the provider-switch
intent's lived precedent is `route-objective-v3-summary-through-secondary-provider.sql:1-33`.

**Established facts (Observed, model-provider trace).** The local trace
`sfx-dal/.tmp/model-provider/model-resolution.json` (ignored under `sfx-dal/.tmp/`, not committed;
captured 2026-10-10T00:02:42Z) resolved the identity `request-capability-from-objective-v3` (estate
model pk 34, capability definition pk 221960, execution authority version pk 113320) from stored
definitions. `runtimeInvocationPerformed` and `expandedRuntimePromptsCaptured` are both `false`.
The trace's capability reads ran through `SFX.Semantics`
(`SemanticReadClient.ReadCapabilitySourceAsync`, `sfx-dal/.tmp/model-provider/Program.cs:11,20`);
its model and instruction fields required ad-hoc extraction SQL — the gap and the opportunity §11
records.

- **The configured model** (`model`): resolved model `gemini-3.8-flash`
  (`configuredModel`/`endpointModel`; the conveyor member's `alias`/`resolvedModel`, §4), endpoint
  template `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`,
  binding `gemini-generate-content.v1`, source transformation `compose-governed-model-invocation.v1`
  (definition pk 217358, `sourceDefinitionDigest`
  `e5073fe05083c57c3c5048c285bd29bc1400d7c5b226b1375cd0fb1aeda95518`), namespace
  `sidefx:capability:request-capability-from-objective-v3`, expression path
  `semantics.expression.fields.payload.fields.attemptPlan.fields.payload.value.fields`.
- **Three active instruction sources** (`stages`), each a declared procedure whose system text is
  the instruction. The historical templates `build-agent-model-request` and
  `build-agent-summary-request` are excluded as inactive (`historicalTemplatesExcluded`).

| # | Stage | Declared procedure id (operation id) | Port / provider | Instruction source |
| ---: | --- | --- | --- | --- |
| 2 | Select capability | `analysis.prepare_objective_selection` (`request-capability-from-objective-v3.select`) | `select-capability-model-port` / `google/gemini-select` | `sfx-dal/.tmp/model-provider/prepare_objective_selection.sql:31` |
| 5 | Construct request | `analysis.prepare_objective_capability_request` (…`construct-request`) | `select-capability-model-port` / `google/gemini-select` | `sfx-dal/.tmp/model-provider/prepare_objective_capability_request.sql:31` |
| 10 | Summarize result | `analysis.prepare_objective_summary` (…`summarize`) | `summarize-results-model-port` / `google/gemini-summary` | `sfx-dal/.tmp/model-provider/prepare_objective_summary.sql:9` |

  The trace records each source's `procedureDefinitionUtf16LeSha256` (`85f7efa7…`, `a15e533c…`,
  `25f57757…`) and the message assembly `analysis.compose_objective_model_request`
  (`sfx-dal/.tmp/model-provider/compose_objective_model_request.sql:8,12`; assembly digest
  `54ed883f…`), which names the provider authority `primary-cognitive-provider`. The trace's
  `interpretation` is explicit: configured model and instruction construction are stored-definition
  facts; dynamic context and a vendor-reported runtime model version require evidence from a
  specific invocation. The drill-down displays configured values and never labels them runtime.

**10.1 Display `[proposal]`.** Identity/digest read-only; a **model section** rendering the resolved
model and the endpoint with its `{model}` placeholder substituted (the raw template beside it), the
binding id, and the source transformation id/pk/digest; an **instruction-source table** listing the
three declared rows above by ordinal, stage, declared id, operation id, port/provider and source
path, keeping their provenance digests distinct from the writer's guard fields; an **engagement
table** naming `google/gemini-select` on `select-capability-model-port` (port version pk 6089) and
`google/gemini-summary` on `summarize-results-model-port` (pk 6090). Every rendered field is a
selection pointer into 10.3's read fields, never a literal (§2-§3).

**10.2 Edit intents and `expectedDigest` guards `[proposal]`.** Three intents; each stages exactly
one change document for `model.install_provider_details_change` and applies nothing (§9).

| Intent | Trace anchor | Writer document section | `expectedDigest` initialised from | Stale refusal |
| --- | --- | --- | --- | --- |
| **Instruction text edit** | the three active instruction sources | `instructions[]` `{namespace, declaredId, path, valueJson}` (§4) | `provider_instructions.definition_digest` of the selected row | `PROVIDER_DETAILS_STALE_DIGEST` |
| **Model version change** | resolved model `gemini-3.8-flash` / endpoint `{model}` in `compose-governed-model-invocation.v1` (pk 217358; trace `sourceDefinitionDigest` `e5073fe0…`) | `instructions[]` on the conveyor entry's model member, or `provider.configuration` where the provider carries its own model (§4) | the updated member's definition digest — the transformation's as recorded by the trace, otherwise `provider_identity.definition_digest` | as above |
| **Provider switch (generic LLM connector)** | `google/gemini-select` on `select-capability-model-port` (pk 6089) and `google/gemini-summary` on `summarize-results-model-port` (pk 6090) | `engagements[]` patch of the port's provider authority + `instructions[]` literal of the request's provider authority id (§4) | `provider_engagements.generation_digest` + transformation `definition_digest` | `PROVIDER_DETAILS_ENGAGEMENT_*` / stale digest |

An instruction source with no read row cannot render an editable field: the section refuses by the
named-refusal rule (§3.1, §9.6) rather than inventing a guard. Writer guard semantics and refusal
codes: `live-circuit-provider-details.md:201-207`; read-to-document mapping: `:153-164`.

**10.3 Scoped read fields to fetch `[proposal]`.** `readScope.sets` for the model-overlay default
names exactly these sets; enforced at compose time until the reader `@scope` parameter lands (§5).
The admitted contract must use the reader's declared field names exactly (§2).

| Result set | Fields | Serves |
| --- | --- | --- |
| `provider_identity` | `provider_state`, `provider_id`, namespace, `definition_digest` | identity; document-level guard |
| `provider_configuration` | `name`, `role`, `configuration_json`, `operations_json` | configured model, binding and source transformation (raw carriers, 16a §4) |
| `provider_engagements` | `capability_id`, `port_id`, provider authority, `generation_digest`, endpoint template/digest/state, `url_prefixes` | the two model ports/providers, the endpoint `{model}`, engagement guards |
| `provider_instructions` | `instruction_kind`, `scope_id`, `declared_id`, `json_path`, `value`, `definition_digest` | the three instruction sources and their guards; `FIXTURE`/`PROJECTED`/`MAPPING` copies excluded (`live-circuit-provider-details.md:282-285`) |
| `provider_update_targets` | `path_suffix`, `value_type`, `current_value`, `update_call` | scalar leaves of the engaged port definitions and endpoint templates (screen wave, 16a §2) |
| `provider_invocations` | `fixture_id`, `system_texts`, `user_texts`, `system_template_values` | instruction-bearing transformation attribution; the trace performed no invocation |

**10.4 Acceptance evidence (real signals, ordered; no sleep).**

1. **Estate pair proof:** the contract migration pair's in-transaction probes show the newest
   revision selected, provider-over-kind-over-builtin resolution, and a re-run no-op with unchanged
   digests — the writer pair's proof shape (`install-provider-details-change.sql:46-51`).
2. **Scoped read:** once the reader `@scope` parameter is admitted (§5), `analysis.read_provider_details`
   for the model providers returns exactly 10.3's sets, and the platform provider named in
   `canonicalProviders` excludes instructions and stays under the 30 s timeout; until then the
   compose-time fallback drops undeclared sets and keeps the canonical selection, and the receipt
   records which mode ran (`live-circuit-provider-details.md:257-274`; `circuit-host.json:12-15`).
3. **Panel parity:** `GET /api/circuit/v1/provider-inspection` set list equals `readScope.sets`; the
   model and instruction-source sections resolve their pointers against the returned columns; stale
   snapshot `409`; non-provider `422`; the header count matches the reader
   (`live-circuit/circuit/README.md:167-172,193-198`).
4. **Staged document, no apply:** the form stages the exact shape of the verified document
   (`live-circuit-provider-details.md:170-194`) with `expectedDigest` initialised from the read
   (identity, engagements and instructions per the §4 guard rules; the model-version guard as
   10.2). No writer call is made from the browser or the hosted API, and the writer stays out of
   `retrieval-policy.json` (`live-circuit-provider-details.md:120-126,209-217,240-241`).
5. **Before/after digest and rollback:** a rollback-only probe applying the staged document with one
   mutated digest refuses `PROVIDER_DETAILS_STALE_DIGEST`; re-applying the unmutated document yields
   `already_set` and changes no digest (`live-circuit-provider-details.md:148-151,201-207`).
   `provider_identity.definition_digest`, each `provider_engagements.generation_digest`, each
   `provider_instructions.definition_digest` and the model transformation digest (trace baseline
   `e5073fe0…`) are recorded before and after; the writer's `provider_details_change` /
   `provider_details_change_summary` carry the same before/after pairing (`:243-255`).
6. **Provider switch:** the switch document's two writer writes match the lived precedent, applied
   in a savepoint and rolled back with before/after digests recorded
   (`route-objective-v3-summary-through-secondary-provider.sql:23-33`).
7. **Hosted parity and render:** the manifest `uiContract` digest recomputes equal to the estate
   contract; a browser capture mounts the drill-down and renders the configured model (resolved
   `gemini-3.8-flash`, endpoint `{model}`), the source transformation identity and the three
   instruction sources with their declared ids/paths, labelled stored-definition (not runtime); an
   unknown intent or component renders its named refusal.
8. **Negative:** a contract naming a read column the reader does not emit refuses
   `UI_CONTRACT_SELECTION_INVALID` and renders the named state — the failure signal that the gate
   needs before the next expansion.

**Change surfaces.** The trace is read-only evidence; it changes no surface.

| Surface | Change | Class |
| --- | --- | --- |
| estate (`sfx-embody`) | `ui_provider_ui_contract` table + reader + model-overlay default + gemini provider contracts; optional reader `@scope` parameter (SDA request) | (c) data publish / SDA request |
| shell (`sfx-platform`) | `provider-ui-contract` source + compose step into the `provider-profile` view; refusal codes; acceptance pins | (b) |
| provider (`sfx-providers`) | `sfx-ui-provider-drilldown` manifest `uiContract` reference + package check | provider release |
| CI | contract-vs-reader-set parity check; the receipts of 1-8 retained under `evidence/` | gates |
| `sfx-dal` / `retrieval-policy.json` | none (writer already registered; policy read-only) | none |

**Non-goals.** No browser apply; no runtime model-version claim; no credential editing; no new
component kinds; no per-provider bespoke screens; no apply route on the hosted API; no SDA change
without the request.

---

## 11. Handling provider details through `SFX.Semantics`

**Why this section.** The scoped reads (§5), the field selections (§2-§3) and the guard rules (§4)
name result sets and columns of `analysis.read_provider_details`. `SFX.Semantics` is the declared
read slice above the estate: it projects installed readers into immutable, digest-addressed,
refusal-aware snapshots (`sfx-dal/semantic/README.md:1-13`). This section maps every contract
element to that layer, states what it provides today and what is missing, and names the flywheel
the mapping sets in motion (§11.4). The design rule it adds: selections and guards resolve to
typed semantic fields, never to ad-hoc SQL or unvalidated result-set columns.

### 11.1 What `SFX.Semantics` provides today — and what is missing (Observed)

The package is `sfx-dal/semantic/SFX.Semantics`, the first read slice of the semantic object
projection strategy: contract `sfx.capability-details` revision `0.1.0-draft`, explicitly a
non-authoritative draft whose estate-owned declaration is pending
(`sfx-dal/semantic/SFX.Semantics/Generated/CapabilityProjection.g.cs:4-5,26-34`). The strategy
records it as capabilities-only: "Provider and graph roots, S5-S9 and all mutation work are not
started" (`sfx-dal/docs/semantic-object-projection-strategy.md:5`), and `ProviderSnapshot` over
`provider_identity`, `provider_configuration`, `provider_mechanics`, `provider_bindings` and
`provider_engagements` is a proposed mapping, not generated code (`:126`).

| What this design needs | What the semantic layer provides today | Anchor |
| --- | --- | --- |
| A scoped read on one consistent basis | `SemanticReadClient.ReadCapabilityAsync(capabilityId, estateModelPk)`: one connection, one SNAPSHOT transaction, current-estate resolution when unpinned, reader-definition digest observed inside it, always rolled back; the projection binds the document SHA-256; the client has no write path | `SemanticReadClient.cs:70-75,107-158,160-185,187-197,30` |
| Typed provider references | `Provider` records (`provider_id`, `reference_kinds`, `provider_role`, `role_evidence_status`, overlay counts, `authority_closure_satisfied`, opaque `operation_references`) — "a declared provider is not evidence of runtime use" | `CapabilityProjection.g.cs:430-486` |
| Typed slots and bindings | `ProviderBinding` records (`slot_id`, `provider_id`, `provider_definition_pk`, `definition_digest`, `selection_policy`, `binding_role`, `binding_port_ids`) | `CapabilityProjection.g.cs:375-428` |
| Typed ports | `Port` records (`port_id`, `port_version_pk`, `definition_digest`, `platform_capability_id`, `provider_overlay_id`, `linked_is_newest`/`linked_selected`, `invocation_count`) | `CapabilityProjection.g.cs:329-373` |
| Exact joins without fetches | `ResolveProvider(ProviderBinding)`, `ResolvePort`, `ResolveScenario`: `Resolved`/`Dangling`/`NotApplicable` | `SemanticRuntime.g.cs:126-139`; `CapabilityProjection.g.cs:575-637` |
| Identity and provenance | `SemanticIdentity` (namespace, kind, declared id, revision locator); `SemanticProvenance` (contract id/revision/digest, bound arguments, procedure, document SHA-256, capture) | `SemanticRuntime.g.cs:141-145,204-216` |
| Named absence and refusal | `SemanticAvailability.Present`/`Absent`/`ContractMismatch`; declared refusals `CAPABILITY_NOT_FOUND`, `CAPABILITY_NOT_SELECTED`; availability "says nothing about admission, conformance or mutation eligibility" | `SemanticRuntime.g.cs:25-41`; `CapabilitySource.g.cs:75-96`; `CapabilityProjection.g.cs:533-552` |
| Stale and mismatch control | canonical payload `ProjectionDigest` (RFC 8785 ordering, capture time and generator excluded) and source-text SHA-256 for opaque fragments | `CapabilityProjection.g.cs:551-552`; `SemanticRuntime.g.cs:674-705` |
| Lossless reading | 7 typed sections, 38 retained verbatim of 45 expected; `ReconstructSourceDocument()`; bounded `ToInspectionJson()` | `CapabilityProjection.g.cs:36-85,1188-1251,1976` |
| Verification | CLI `read`/`inspect`/`verify`; 14 live checks pass for the capability slice | `SFX.Semantics.Cli/Program.cs:31-39,70-89`; `sfx-dal/semantic/README.md:62-71` |

**Missing, stated plainly.**

- **No provider root.** The only generated snapshot is `CapabilitySnapshot`; there is no
  `ProviderSnapshot`, no provider-details semantic contract, and no typing of
  `provider_engagements`, `provider_mechanics` or `provider_instructions`. `ProviderSnapshot` is
  planned (`sfx-dal/docs/semantic-object-projection-strategy.md:126`) and not started (`:5`).
- **No typed provider identity digest.** `Provider` carries no `definition_digest`; digests exist
  on `ProviderBinding`, `Port` and `ScenarioContract` only
  (`CapabilityProjection.g.cs:430-486,402,347,203`). The contract's document guard
  (`provider_identity.definition_digest`, §4) has no direct semantic field today.
- **No typed instructions.** No instruction section or entity exists in `sfx.capability-details`;
  `provider_overlays` is an expected-but-retained opaque section
  (`CapabilityProjection.g.cs:36-85`). The §10.3 fields (direction, `instruction_kind`,
  `json_path`, value, digest) have no semantic counterpart.
- **No typed model resolution.** Nothing names a configured model, endpoint template, binding id
  or source transformation; the trace's `model` block (`sfx-dal/.tmp/model-provider/model-resolution.json:9-19`)
  required ad-hoc extraction SQL.
- **No mutation surface, by design.** Semantic availability is not authority
  (`SemanticRuntime.g.cs:22-24`). Edit intents cannot map to semantic services; they map to the
  writer through read-selected guards, exactly as §4 states.

### 11.2 The model-provider trace proves the pattern and the gap (Observed)

The trace used the semantic client where it fits — `SemanticReadClient.ReadCapabilitySourceAsync`
for the capability and helper roots (`sfx-dal/.tmp/model-provider/Program.cs:11,20`; the saved
sources are serialized `SemanticRead` records) — and ad-hoc SQL where it does not: the
transformation composition, preparation procedures and definitions came from
`sfx-dal/.tmp/model-provider/read-composition.sql:1-18`, `read-preparation-procedures.sql:1-7` and
`read-definitions.sql:1-10`, the provider rows from `read-provider.sql:1`, assembled by
`Export-Resolution.ps1:4-45`. Its fields map one-to-one onto the contract's proposed sections: the
`model` block (`model-resolution.json:9-19`) is §10.1's model section; the three `stages`
(`:20-60`) are the instruction-source table; the resolved providers and `portVersionPk` 6089/6090
are §10.1's engagement rows. It also exercised the semantic refusal path: the requested
(misspelled) identity resolved `CAPABILITY_NOT_FOUND`, the corrected identity resolved (`:3-5`) —
the same refuse-by-name behaviour §9.6 requires.

### 11.3 Scoped reads and edit intents mapped to semantic types `[proposal]`

The contract keeps its declared shape; what changes is where its selections point. The target is a
provider-details semantic contract — the strategy's `ProviderSnapshot`
(`sfx-dal/docs/semantic-object-projection-strategy.md:126`) — reading `analysis.read_provider_details`
row-mode, pairing section labels with a pinned descriptor per the strategy's provider-transport rule
(`:119`), with declared summary/detail profiles, a facility the strategy already requires because
filtering after retrieval does not reduce SQL cost (`:181`). Until it lands, only the
capability-root types above exist, and the trace's ad-hoc SQL is the honest description of
model/instruction resolution.

| Contract element | Semantic type or service it maps to | Status |
| --- | --- | --- |
| `readScope.sets` / `rowLimits` (§5) | declared read profile on the provider-root contract, generated `ProviderSource`/`ProviderSnapshot`, one SNAPSHOT basis, digest and capture as `CapabilitySnapshot` has | missing (planned root) |
| identity section and document guard (§2, §4) | provider-root `SemanticIdentity` and provenance; a typed provider definition digest (today only bindings, ports and contracts carry digests) | partial |
| model section (§10.1) | typed provider-root model entity carrying the trace's `model` fields (`configuredModel`, `endpointTemplate`, `endpointModel`, `bindingId`, source transformation pk/digest/expression) | missing |
| instruction-source table (§10.1) | typed instruction entity preserving direction, kind, path, value and digest, excluding `FIXTURE`/`PROJECTED`/`MAPPING` copies (`live-circuit-provider-details.md:282-285`) | missing |
| engagement rows (§10.3) | provider-root `provider_engagements` entity; capability-root `Provider`/`ProviderBinding`/`Port` are capability-scoped references, not the engagement read | missing |
| `selection` pointers (§2-§3) | field paths on snapshot entities (`ProviderBinding.DefinitionDigest`, `Port.DefinitionDigest`, future provider-root fields) instead of raw result-set columns or literals | partial: types exist, provider-root fields do not |
| edit intents and `expectedDigest` guards (§4, §10.2) | read-selected digest fields on the typed entities; the estate writer stays the only apply path; the semantic layer stages and applies nothing | by design |

Every section selection therefore becomes a path into a snapshot — a typed field, its source row
and its digest — and the compose step (§8.1) resolves the snapshot instead of issuing ad-hoc
queries. An absent entity, field or digest refuses by name at the same boundary as an absent
set/column (§3.1); a `ContractMismatch` propagates as a named read state, never a partial render.

### 11.4 The flywheel

**The flywheel.** The estate declares semantic objects; CodeLightly projects them into
`SFX.Semantics` snapshot types (capability root today, provider root next); the provider UI
contract is declared as estate data whose sections and intents select typed semantic fields and
digests rather than ad-hoc queries (§7, §11.3); the platform composes that contract against a
semantic read into the one generic `provider-profile` view; the hosted `sfx-ui-provider-drilldown`
prepares it and the browser renders and stages it; the drill-down's gaps and the slice's acceptance
evidence become the next semantic contract revision (provider root, then instruction and model
entities), which sharpens the contract, the hosted provider and the drill-down in turn. The
model-provider slice is the first turn of that wheel: it proves the capability-root round trip
(one pinned read, typed providers/bindings/ports, digests, named refusal) and exposes exactly the
provider-root fields the contract now declares — configured model, endpoint, binding and the three
instruction sources — which the trace could resolve only with ad-hoc SQL
(`sfx-dal/.tmp/model-provider/read-*.sql`).

---

## 12. Open questions `[proposal]`

- **Kind taxonomy admission.** `model-overlay`/`http-overlay`/`platform-capability`/`slot-bound` is
  this document's vocabulary; it becomes authority only as admitted estate data, with detection
  grounded in the details read's `engagement_kinds`, `provider_kind` and binding sets
  (`live-circuit-provider-details.md:33-40`).
- **Model-version path variance.** Whether the model member is reached through the conveyor
  transformation or the provider configuration is provider-specific today
  (`repair-model-step-provider-binding.sql:33-46`); the kind default must pick one, and the other
  stays a declared override.
- **Reader-side scope** is an SDA behaviour change: file it as a request, keep compose-time
  enforcement until admitted, and record which behaviour ran in every capture.
- **Contract/provider coupling.** The per-provider contract binds the provider definition digest it
  was authored against; a provider re-declaration whose sections still resolve should re-pin rather
  than refuse — the re-pin rule needs decision before the second provider kind.
- **Editor limits.** Instruction templates are large; whether `code` or a future long-text kind
  carries them is a kind decision (`implementation-strategy.md:267-301`); values must remain text,
  never executable markup (`implementation-strategy.md:851-857`).
- **Where the contract is surfaced.** Estate reader first; the hosted manifest carries the
  reference only. If evidence later needs the contract inside provider bytes, that is a manifest
  contract revision (P1, `analysis/15-provider-deployment-boundary.md:95-144`), not a paste.
