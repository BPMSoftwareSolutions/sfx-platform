# Live Circuit provider details: the DAL read and write procedures

How to read and write provider information from the Live Circuit Explorer using
the estate's provider-details procedures.

This document is current for the platform after the 2026-10-07 revamp. It covers:

- `analysis.read_provider_details` — the complete provider reading (DAL-registered;
  admitted by the retrieval policy).
- `model.install_provider_details_change` — the atomic provider-details writer
  (installed in the estate; DAL registration is a one-time step below).
- The layer writers it composes, which are already DAL-registered:
  `model.configure_provider`, `model.patch_port_configuration` /
  `model.replace_port_configuration`, `model.update_definition_member`.

Source of truth for both procedures is the estate:

- `sfx-embody/sql/migrations/declare-provider-details-read.sql` (+ `.commit.sql`)
- `sfx-embody/sql/migrations/install-provider-details-change.sql` (+ `.commit.sql`)

## 1. The reading: `analysis.read_provider_details`

```
EXEC analysis.read_provider_details @provider_id = N'google/gemini-select';
-- optional second parameter: @estate_model_pk (defaults to the current model)
```

It returns eight result sets, in emission order:

| set | what it carries |
| --- | --- |
| `provider_identity` | provider state (`DECLARED` / `ENGAGED_UNDECLARED` / `ABSENT`), id, namespace, newest selected `definition_digest`, engagement kinds |
| `provider_configuration` | declared name, role, runtime/package/type/method, execution location, operations, candidate capabilities, conformance claims, raw configuration JSON |
| `provider_mechanics` | declared entrypoint, implemented ports, implemented mechanics |
| `provider_bindings` | slot bindings (slot, context target/environment, roles, policies) |
| `provider_engagements` | every selected port generation naming the provider: `OVERLAY` (`configuration.providerId`) or `PLATFORM` (`platformCapabilityId`), with bindingId, authority, endpoint digest, credential reference + injection rule, url prefixes, application ref, carrier shaping |
| `provider_instructions` | every SYSTEM/USER instruction declaration with its path and value: kind `DECLARED_TEMPLATE` (declared message template), `DECLARED_LITERAL`, `PROJECTED`, `MAPPING`, `FIXTURE`, `INVOCATION` |
| `provider_invocations` | one row per declared invocation (fixture) and per instruction-bearing transformation: `fixture_id`, `system_texts`, `user_texts`, `system_template_values` |
| `provider_summary` | one measure row per state (counts included) |

The read is model-agnostic: AI overlays, HTTP overlays (for example
`rapidapi/yahoo-finance-real-time1`), platform capabilities and slot-bound
providers all resolve through the same rows. Instruction extraction walks the
engaged ports' newest instruction-bearing generation and the engaged
capabilities' instruction-bearing transformations; it stays under the host's
30 s read timeout for the model providers it has been verified against.

## 2. Reading provider details in the Explorer

The Explorer's **Provider database inspection** panel is the read surface:

1. Select a declared provider (click its circuit label, or **Explore component**).
2. The panel calls
   `GET /api/circuit/v1/provider-inspection?capabilityId=…&namespaceId=…&scenarioId=…&detailId=…&expectedSnapshotDigest=…`.
3. The observer (`live-circuit/circuit/live-store.mjs`, `readProviderInspection`)
   revalidates the selection against the database scene, then calls the
   procedure-extract service at `PROCEDURE_EXTRACT_ENDPOINT` with
   `{"procedure": "<configured reader>", "parameters": {"provider_id": …, "estate_model_pk": …}}`.
4. The panel renders every returned set generically (`name · rows`), so a reader
   change needs no UI change.

**Which procedure the panel calls is declared data** in
`live-circuit/circuit/circuit-host.json`:

```json
"retrieval": {
  "provider": { "procedure": "analysis.read_provider_canonical_body", "identityResultSet": "provider_canonical_body" }
}
```

Both the canonical-body reader and the details reader are admitted by
`deploy/sda-kernel/retrieval-policy.json`, which already lists:

```json
"analysis.read_provider_details"
```

To show the complete provider details in the panel, change the two values:

```json
"retrieval": {
  "provider": { "procedure": "analysis.read_provider_details", "identityResultSet": "provider_identity" }
}
```

The observer checks `identityResultSet`: exactly one row, with `provider_id`
equal to the selected provider and `definition_digest` equal to the digest the
scene snapshot carries. A mismatch is refused as `PROVIDER_DEFINITION_CHANGED`
(409), never shown as stale data. `provider_identity` carries both columns, so
the details reader satisfies the check.

Operational requirements:

- `PROCEDURE_EXTRACT_ENDPOINT` must point at a retrieval service built from the
  current `sfx-dal` (the service uses the generated DAL). On Azure it is the
  colocated loopback service `http://127.0.0.1:8791`; a local observer may point
  at a local service or the hosted `/procedure-extract` URL.
- `SDA_API_TOKEN` (server side only) is sent to the service; the browser never
  receives it.
- The retrieval service admits only procedures named in `retrieval-policy.json`.
  Installing a new read in the estate is not enough; the policy and the service
  binary must carry it.

### Calling the reader without the panel

```bash
curl -sS -X POST "$PROCEDURE_EXTRACT/json" \
  -H "authorization: Bearer $SDA_API_TOKEN" -H "content-type: application/json" \
  -d '{"procedure":"analysis.read_provider_details","parameters":{"provider_id":"google/gemini-select"}}'
```

External clients use the gateway's machine bearer; the response is the same
array of `{name, columns, rows}` sets the panel displays. To produce a workbook,
run the packaged extractor (as used for the estate's evidence):

```
procedure-extract --procedure analysis.read_provider_details \
  --params "{\"provider_id\":\"google/gemini-select\"}" \
  --output provider-details-google-gemini-select.xlsx
```

## 3. The write: `model.install_provider_details_change`

The Explorer's inspection panel is **read-only by design**. It provides no edit
or writer action, and the retrieval service executes only declared read
procedures. A writer must never be added to `retrieval-policy.json`.

Provider information is changed through the atomic writer, which composes the
already-installed layer writers in one transaction:

| document section | writer used | effect |
| --- | --- | --- |
| `provider` {name, operations, configuration} | `model.configure_provider` | provider declaration; a no-op is detected by digest and never re-minted |
| `engagements[]` {capabilityId, portId, path, valueJson, expectedDigest?} | `model.patch_port_configuration` | one engagement configuration member (API request shaping), digest-guarded |
| `engagements[]` {capabilityId, portId, configuration} | `model.replace_port_configuration` | the whole port configuration |
| `instructions[]` {namespace, declaredId, path, valueJson, expectedDigest?} | `model.update_definition_member` | one declared member: SYSTEM/USER message templates, projections |

Call it from SQL inside one transaction:

```sql
BEGIN TRANSACTION;
EXEC model.install_provider_details_change @document = N'{ …change document… }';
-- review provider_details_change (one row per part) and
-- provider_details_change_summary (before/after digests, counts)
COMMIT TRANSACTION;   -- or ROLLBACK; nothing outside this transaction is touched
```

The writer joins the caller's transaction or owns one, takes the
`sidefx:model-write` app lock, and runs with `XACT_ABORT ON`: any refusal rolls
the whole change back. `already_set` parts prove idempotence — re-applying the
same document changes no digest.

### Building the change document from the reading

The reading's sets are the document's sources:

- `provider_configuration` → the `provider` section (name, operations,
  configuration).
- `provider_engagements` → `engagements[]` entries (`capabilityId` from the
  namespace suffix, `portId`, and the digest from `generation_digest` as
  `expectedDigest`).
- `provider_instructions` / `provider_invocations` → `instructions[]` entries
  (`namespace` + owner id, `path` from `json_path` with the leading `$.semantics`
  already stripped by the read, and `definition_digest` as `expectedDigest`).

Verified example for `google/gemini-select` (this exact document passed the
migration's acceptance as a no-op, and a variant applied a real change that was
read back and rolled back):

```json
{
  "providerId": "google/gemini-select",
  "expectedDigest": "6cc29f2dbc6ae7880c801ddb92d1261f3f1cd1001370e7cb300acf256734e7cc",
  "provider": { "name": "Google Gemini (Select)" },
  "engagements": [
    {
      "capabilityId": "request-capability-from-objective-v3",
      "portId": "select-capability-model-port",
      "path": "$.configuration.resultMode",
      "valueJson": "\"replace-carrier\"",
      "expectedDigest": "eb055ff2347149e6c5639e952f329b9b55ea7b1a904f8e939a1dcd3bff90e8d0"
    }
  ],
  "instructions": [
    {
      "namespace": "sidefx:capability:request-capability-from-objective-v3",
      "declaredId": "build-agent-model-request",
      "path": "$.expression.fields.modelRequest.fields.interaction.fields.messages.items[0].fields.content.template",
      "valueJson": "You map one user objective to exactly one governed capability request. …",
      "expectedDigest": "46ff5075521a64a5905f47d434e1a06c1dc22a256b17300d13ddd263d8a4a6b2"
    }
  ]
}
```

Notes:

- `valueJson` is a string holding the value or JSON fragment to apply: raw text
  for a template, `"\"replace-carrier\""` for a JSON string, `"0.2"` for a
  number, `"{\"…\":…}"` for an object.
- `expectedDigest` is the optimistic-concurrency guard: a stale value refuses
  the change (`PROVIDER_DETAILS_STALE_DIGEST` or the layer writers'
  `*_STALE_DIGEST`). Omit it only when a full replacement is intended.
- Refusals are typed: `PROVIDER_DETAILS_DOCUMENT_INVALID`,
  `PROVIDER_DETAILS_PROVIDER_REQUIRED`, `PROVIDER_DETAILS_PROVIDER_NOT_FOUND`,
  `PROVIDER_DETAILS_STALE_DIGEST`, `PROVIDER_DETAILS_ENGAGEMENT_*`,
  `PROVIDER_DETAILS_INSTRUCTION_*`.

### Where a write may run from

- **Estate lifecycle (today's norm):** the writer is used from an
  `sfx-embody/sql/migrations/` pair — preflight ends in `ROLLBACK`, the commit
  twin applies the document. See `install-provider-details-change.sql` for the
  no-op acceptance and digest checks to copy.
- **Platform service (server-side):** the atomic writer becomes a generated DAL
  repository after the one-time registration below; call it from a server-side
  tool, never from browser script, and keep the transaction at the caller.

### One-time DAL registration for the atomic writer

The layer writers are already in `sfx-dal/SFX.DAL.Config.json`; the atomic
writer needs one entry so platform services can call it through the generated
DAL:

1. In `sfx-dal/SFX.DAL.Config.json`, beside `configure_provider` and
   `update_definition_member`, add:

   ```json
   { "Schema": "model", "Name": "install_provider_details_change" }
   ```

2. Regenerate and build:

   ```
   dotnet run -c Release -- "C:\lab\repos\sfx-dal\SFX.DAL.Config.json" "C:\lab\repos\sfx-dal"
   dotnet build C:\lab\repos\sfx-dal\SFX.DAL.csproj -c Release
   ```

3. Publish the services that carry `SFX.DAL`.
4. Do **not** add it to `live-circuit/deploy/sda-kernel/retrieval-policy.json`;
   the retrieval service is read-only.

## 4. Seeing a change in the Explorer

1. Apply the document (SQL/migration or server-side DAL call) and commit.
2. Re-open the provider component in the Explorer. The panel re-reads with
   `refresh=true` on every selection; the header line shows
   `n result sets · Database read <readAt>`.
3. Compare `provider_identity.definition_digest`, the engagement
   `generation_digest`s, and the instruction `definition_digest`s with the
   values from before the change. The writer's own result sets
   (`provider_details_change`) carry the same before/after digests for pairing.
4. Sessions still holding the old scene snapshot receive
   `PROVIDER_DEFINITION_CHANGED` (409) until the scenario is refreshed; that is
   the stale-selection guard working, not a retrieval failure.

## 5. Verification and acceptance

- **Estate-side:** the writer's migration pair proves no-op application
  (`already_set`, digests unchanged) and net-unchanged declarations under a
  savepoint that rolls back. The real-change read-back and the unknown-provider
  refusal were verified by live probes at installation; repeat them through the
  lifecycle when changing the writer.
- **Host-side:** exercise the panel against a declared provider and confirm the
  set list matches the reader (the canonical-body reader returns eight sets; the
  details reader returns its eight; the header count must match). A reader or
  policy change is a deploy: `live-circuit/**` and `deploy/sda-kernel/**` are
  watched paths, and a failed gate rolls the slot back.
- **Evidence precedent:** the retrieval service's Azure acceptance for provider
  inspection (Gemini Select and Gemini Summary, exact definition digests, stale
  409, non-provider 422) is recorded in the estate's
  `evidence/retrieval-api-deployment-20261002/azure-acceptance.json`. Re-run the
  same shape of checks when switching the panel to `read_provider_details`, and
  retain the receipt under the estate's `evidence/`.

## 6. Boundaries

- The Explorer interprets nothing: sets are passed through unchanged, and a
  failed reading is shown as a failure, never as an empty workspace.
- Provider inspection is a current database read, not an execution receipt; it
  does not affect live flow or replay.
- The reading may include fixture-projected instruction copies alongside the
  declared templates; use `instruction_kind` (`DECLARED_TEMPLATE` versus
  `FIXTURE` / `PROJECTED` / `MAPPING`) and `provider_invocations` for
  attribution.
- Reads share the observer's queue, timeout, cache and response-size limits
  (`maximumConcurrentReads`, `timeoutMilliseconds`, `maximumResponseBytes` in
  `circuit-host.json`). The details read is heavier than the canonical-body
  read; keep the host limits in mind when switching the default reader.
- Platform capabilities can be engaged by hundreds of ports
  (`sda-authority-transformation-port.v1` is named by 1,047 selected port
  generations). The details read walks every engaged port's instruction-bearing
  generation, so such a selection can exceed the 30 s read timeout. Keep the
  canonical-body reader for platform catalogs until a scoped read exists.
