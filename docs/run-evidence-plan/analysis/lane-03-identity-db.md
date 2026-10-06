# Lane 03: sfx-dal, identity database and migration 002

Read-only recon + deep dive, 2026-10-06. Repo: sfx-dal `6883c75`, with
read-only references to sfx-platform and sfx-providers.
Scope: [plan](../../run-evidence-implementation-plan.md) §3 D1/D2/D5/D8/D10,
§5.2–§5.3, §6 W2.1 and W0.5, §7 L0–L10, §4 B15/B16.

## Current state

- `002` does not exist. sfx-dal has one branch `main`, head `6883c75` ("Add
  generated identity DAL and verified login persistence").
  `verify-trust-ledger`/`002-trust-ledger` appear only in the plan.
- The `identity` schema is 7 tables / 8 procedures (`identity/README.md:15-32`;
  plan B15).
- Plan count correction: §5.2 lists **19** `ledger.*`/`evidence.*` tables
  (15 + 4), not ~12; procedures named: 8 plus W2.2 evidence ops.

## Migration pipeline (the 001 pattern)

- Twin pair `identity/sql/migrations/001-login-identity.commit.sql` /
  `.rollback.sql`; the only textual difference is line 356
  `COMMIT TRANSACTION;` vs `ROLLBACK TRANSACTION;`.
- Commit structure: `SET NOCOUNT/XACT_ABORT`, database guard, no-outer-transaction
  guard, `BEGIN TRANSACTION` (`:3-7`); idempotent `IF OBJECT_ID(...) IS NULL
  CREATE TABLE` for 7 tables (`:10-67`); singleton seed `login_policy`
  (`:19-20`); 8 procedures emitted as `EXEC(N'CREATE OR ALTER PROCEDURE ...')`
  (`:68-334`); roles/grants (`:336-348`); exact count/FK assertions (`:349-354`);
  terminal receipt `SELECT` (`:352-354`); TRY/CATCH rollback (`:357-361`).
- Procedures own transactions with `@owns_transaction`
  (`:74-75,118-123`); input validation + `THROW 51000,'IDENTITY_*'` (`:82-84`);
  applock throttling precedent (`:96-101`).
- Tool `tools/identity-database/Program.cs`: hardcoded file mapping `:9-13`;
  preflight injects `sql/verify-login-contract.sql` before the unique terminal
  `\nROLLBACK TRANSACTION;\nEND TRY` marker `:15-22`; DB must be `sfx-identity`
  `:25`; single no-outer-transaction command `:29-31`; requires ≥1 result row
  `:44`; receipt JSON `:45-47`.
- Checks `identity/sql/verify-login-contract.sql`: 10 in-transaction assertions
  (enroll→attempt→resolve→verify→session→validate→revoke→audit count) ending in
  a pass row `:42`.
- `identity/regenerate.ps1`: refuses embedded connection `:14-16`; runs
  `inspect` `:19`; parses **only** `001-login-identity.commit.sql` `:29-31`;
  requires every configured procedure body hash to match `:34-48`; class-name
  prefix hardcoded `'Identity'` `:51-58`; builds, verifies manifest hashes
  `:59-65`; writes generation receipt `:66-88`.
- `identity/SFX.Identity.DAL.Config.json`: `"SchemaFilter": "TABLE_SCHEMA =
  'identity'"` `:9`; 8 procedure entries `:17-50`.
- `identity/sql/inspect-schema.sql`: procedure-hash query filters
  `s.name=N'identity'` `:35`; permission query filters only the two roles
  `:39-40`; typed counts `:3-7,41-43`.

## 002 work breakdown by artifact

1. New `identity/sql/migrations/002-trust-ledger.commit.sql` + `.rollback.sql`
   (twins). Create `ledger`/`evidence` schemas guarded like `001:9`; tables;
   closed-vocabulary seeding from the W0.6 digest; procedures; grants; own
   count/role assertions.
2. New `identity/sql/verify-trust-ledger-contract.sql` — privileged
   in-transaction fixtures for L2/L3/L5/L7/L8/L9 (accepted/refused bases, digest
   mismatch, assumptions NULL vs `[]`, append-only denial, admit-only).
3. `tools/identity-database/Program.cs` — parameterize migration/checks
   selection; the current hardcoding cannot run 002; 90 s timeout may be tight.
4. `identity/regenerate.ps1` — read all migration files; make class prefix
   schema-aware; keep `matchedProcedureBodies == config.Procedures.Count`.
5. `identity/SFX.Identity.DAL.Config.json` — widen `SchemaFilter` to include
   `ledger`, `evidence`; add every configured procedure.
6. `identity/sql/inspect-schema.sql` — widen procedure-hash and role filters;
   keep result-set order for `regenerate.ps1` `resultSets[6]`.
7. Regenerate `SFX.Identity.DAL`: new Models/Procedures/repositories + catalog
   manifest. Generated files must not be hand-edited; only `.Custom.cs` and
   maintained files.
8. Consumer rebuild: `sfx-providers/providers/cli-login/LoginProviders.csproj`
   references `SFX.Identity.DAL.csproj`; estate `SFX.DAL` is isolated by
   `Directory.Build.props:3-8`.
9. W2.2/W2.4 are separate, but the procedure set/param shapes must be fixed now.
- Note: no `ledger.rule`/rules table exists in §5.2 although `rule_digest`, I2
  and D8 require prerequisite data.

## Invariant enforcement notes

- **I1**: schema/procedure review only; no entity trust column; vocabulary
  tables are names only.
- **I2/I4/L2/L4**: hardest data gap — target-rule prerequisites must be
  queryable; closed-vocabulary FKs are easy (FK, CHECK ranges), but prerequisite
  completeness is procedural over JSON/rows; idempotent identical replay needs a
  decision-equality digest.
- **I3**: `attach_evidence` non-null/equal `subject_digest`; add `NOT NULL` +
  composite FK; cross-schema FKs to `identity.principal`/`session` fit 001
  conventions (`001...commit.sql:33,53`).
- **I5**: CHECK `scope` non-empty; `assumptions` NOT NULL, distinguish `'[]'`
  from NULL; certificate/checker refs required for `PROVEN`.
- **I6**: needs producer/lineage columns and checks; SQL can only enforce
  recorded facts, not material independence.
- **I7**: `NOT_OBSERVABLE` as outcome and polarity; `decide_disposition` must
  exclude it from support and append a limitation.
- **I8/L8**: no append-only/tombstone pattern exists anywhere in sfx-dal.
  Enforce with `DENY UPDATE,DELETE` (+`SELECT/INSERT`) on `SCHEMA::ledger` and
  procedure ownership chaining, mirroring `001:338-348`; retention purge of
  `evidence` bytes must be a controlled procedure; no tombstone table is
  specified.
- **I9/L9**: mirror the runtime/enrollment split (`001:336-348`): new admission
  role granted only `ledger.admit`, runtime denied it. Tension: D2 says one
  identity host with one `SFX_IDENTITY_CONNECTION_STRING`, so DB-role separation
  needs a second credential or an admission-principal table check — the hardest
  invariant to make real.
- **I10/L10**: required refs/digests + replay fixtures; purge must leave digests
  and produce `NOT_OBSERVABLE`.

## Grants/roles/connection custody

- Roles created idempotently; receipt captures every DENY/GRANT
  (`identity/verification/latest-schema.json` permission result set).
- Custody: `deploy/sda-kernel/gateway.mjs:13-16` captures then deletes the env
  var; identity child launched with it `:90-103`; kernel child strips it
  (`sfx-providers/.../KernelRun.cs:47`); documented in `identity-login.md:55-65`;
  setting is direct/non-sticky. Generated `DatabaseHelper` caches it per process
  (`identity/Helpers/DatabaseHelper.cs:8-22`).

## W0.5 spike prerequisites

- No `az sql` usage, tier, max-size, or latency measurement exists in sfx-dal or
  sfx-platform. No SQL server name recorded; `infra/azure.json:1-8` gives
  subscription `878efc24-...`, rg `sidefx_group`, app `sidefx`, location
  `eastus2`.
- Reusable pattern: `deploy/staging/common.mjs:32-38` `az()` wrapper; read-only
  diagnostics guidance `docs/live-circuit-staging-deployment.md:532-533`;
  app-setting read pattern `identity/README.md:53-62`.
- E09 needs a new script/query: `az sql server list -g sidefx_group` +
  `az sql db show` (tier/max size), and a 10-run 85 KB `varbinary` insert timing
  harness executed from the identity host region; no existing harness.

## Receipt/verification plan

- 001 set: `2026-10-03-before-schema.json`, `first-rollback.json`,
  `preflight.json` (7/8 + revoked + check row), `install-idempotence.json`,
  `generation.json` (config/catalog/manifest/DLL digests), `live-providers.json`
  (10 checks), `latest-schema.json` (full PK/FK/signature/body hashes +
  permissions).
- 002 must add the equivalent: preflight, install, second-install idempotence,
  generation receipts under `identity/verification/`, plus L8 permission-denial
  and L9 admit-only live role tests and an L0 vocabulary-drift digest.
- `verify-trust-ledger.mjs` (L0/L10/A2.7) is not in any repo. Precedent places
  gate scripts in sfx-platform with receipts like
  `deploy/sda-kernel/identity-acceptance-2026-10-04.json`; it needs both estate
  declaration and identity DB, so a new sfx-dal or sfx-platform `tools/...`
  script loading `SFX_IDENTITY_CONNECTION_STRING` via az plus estate inspect
  lanes is the fit. Open question.

## Deep dive decisions

### 1. I9 admission separation

**Recommendation: an in-procedure admission-principal table is the enforcing
mechanism; DB roles are defense-in-depth, not the primary control.**

- 001's precedent is per-deployment grants plus a separate operator token, not
  per-caller DB roles: `001-login-identity.commit.sql:340-341` (runtime DENY /
  enrollment GRANT) and `providers/cli-login/host/README.md:87-91`; the operator
  bearer is `SFX_IDENTITY_ENROLLMENT_TOKEN` (`host/README.md:3-5`), checked at
  `host/LoginApplication.cs:25-26`.
- Put `ledger.admission_principal(principal_id PK FK identity.principal, scope,
  granted_by, granted_at, active)` + `ledger.admission_audit`.
  `ledger.admit(@claim_id,@scope,@principal_id,@evidence_package_digest,…)`
  requires an active row and appends the state-8 disposition;
  `ledger.decide_disposition` refuses target state 8. The host resolves the
  caller's service key to a principal and never trusts a body-supplied id.
- Grants mirror 001: DENY `EXECUTE` on `ledger.admit` to `sfx_ledger_runtime`,
  GRANT to `sfx_ledger_admission`. With D2's single connection a single process
  login would need `sfx_ledger_admission` membership to call admit; gate that
  with the operator bearer exactly as enrollment does.
- End-state option if true role isolation is required: add
  `SFX_IDENTITY_ADMISSION_CONNECTION_STRING` to the same identity child and open
  a second `SqlConnection` only for the admit route (gateway launch list
  `gateway.mjs:90-103`; Key Vault pattern `identity-login.md:61-65`). Do this in
  addition to, never instead of, the table check.
- W2.2 host work implied: service-key→principal registry, operator admission
  bearer, `POST /ledger/v1/admit` grouped separately from producer endpoints,
  and typed DAL calls after regeneration.

### 2. Rules and tombstone tables

Minimal rules model, seeded from the W0.6 declaration digest:

- `ledger.vocabulary_declaration(declaration_id tinyint PK CHECK=1,
  semantic_address nvarchar, definition_digest binary(32) NOT NULL, declared_at)`
  — singleton, L0 compares it.
- `ledger.rule(rule_id uniqueidentifier PK, claim_kind FK→ledger.claim_kind,
  target_state tinyint FK→ledger.trust_state, scope nvarchar(256), rule_version
  int, rule_digest binary(32) NOT NULL, canonical_json nvarchar(max) NOT NULL
  CHECK(ISJSON(canonical_json)=1), declaration_ref FK→ledger.authority_ref,
  active bit, created_at datetimeoffset(7))`.
- `ledger.rule_prerequisite(rule_id FK, ordinal tinyint, evidence_class
  FK→ledger.evidence_class, min_count int CHECK(min_count>=1), required_outcome
  varchar(16), independence_required bit, PK(rule_id,ordinal))`.
- `ledger.decide_disposition` loads the active rule for
  (claim_kind,target_state), counts qualifying links (polarity/count/outcome
  from `ledger.claim_evidence` + `ledger.verification`/`proof_result`), refuses
  contradictions and unmet limitations, throws `LEDGER_RULE_MISSING`/
  `LEDGER_PREREQUISITE_UNMET`, and inserts the disposition with basis +
  `rule_digest`. No numeric comparison. Author using 001 idioms; seed
  idempotently like `login_policy`, never UPDATE — a digest change is a new
  migration.
- **Tombstone for I8** (no table exists in §5.2):
  `evidence.tombstone(tombstone_id bigint IDENTITY PK, run_id uniqueidentifier
  NULL FK, trace_chunk_id …NULL FK, evidence_object_id …NULL FK, CHECK exactly
  one non-null, content_digest binary(32) NOT NULL, removed_bytes bigint,
  purge_reason varchar(32), purge_rule_digest binary(32) NULL, purged_by
  uniqueidentifier NULL FK identity.principal, purged_at datetimeoffset(7) NOT
  NULL)`; nullable-FK style follows `identity.authentication_audit(:64-65)`.
- `evidence.purge_content` inserts the tombstone and nulls/removes only content
  bytes; runtime role denied direct UPDATE/DELETE, procedure executes via
  ownership chaining (`001` grants pattern `:336-348`). Tombstone rows are
  insert-only.

### 3. Split 002 into 002a + 002b

**Recommendation: split.**

- `002a-trust-ledger-core`: 17 tables (15 plan + rule + rule_prerequisite;
  8 procedures + `read_rules_for_claim`; vocabulary/admission seeds).
- `002b-evidence-store`: 5 tables (run, run_trace_chunk, evidence_object,
  access_audit, tombstone; 4 procedures: register/append/complete/purge).
- Rationale: different blockers (002a needs W0.6; 002b needs W0.5/W0.3/W0.4 and
  the W2.3 trace design), smaller preflights under the 90 s command, and
  parallel authoring. Cost: `Program.cs` and `regenerate.ps1` must learn
  migration selection/globbing anyway.
- Rough LOC (001 commit is 362 lines for 7 tables + 8 procedures):
  002a commit ~700-800; rollback twin same; core checks ~250-350.
  002b commit ~280-350; rollback twin; checks ~120-180.
  One receipt set per pair, plus a generation receipt after both.

### 4. Tooling edits and generator availability

- `Program.cs`: add migration argument; map preflight→`<m>.rollback.sql`,
  install→`<m>.commit.sql`; select a checks file per migration; make timeout
  configurable.
- `regenerate.ps1`: parse all `sql/migrations/*.commit.sql`; derive class prefix
  from `$procedure.Schema`; keep the body-hash count check; receipt
  `migrationSha256` becomes a list.
- `SFX.Identity.DAL.Config.json`: widen `SchemaFilter`; add every new procedure
  with its schema. Expect identity artifacts to regenerate byte-identically; any
  change is a red flag.
- `inspect-schema.sql`: widen procedure-hash and role filters; preserve
  result-set order (`regenerate.ps1` reads `resultSets[6]`).
- **Generator availability: not in this workspace and is an external/blocked
  step.** `regenerate.ps1:9-10` requires
  `$CodeLightlyRoot\platform\apps\console\DALComparisonTestApp\DALComparisonTestApp.csproj`;
  no such checkout exists under `C:\lab\repos` or `C:\`. `.tmp\identity-inspect`
  is an ad hoc inspector, not the generator. The pin is `1.0.0+744d283c…`
  (`catalog-manifest.v1.json:6-8`; `verification/2026-10-03-generation.json`).
- Real constraint: DAL regeneration cannot run locally until (a) the external
  CodeLightly checkout at `744d283c` is available, (b) the connection string
  resolves to the migrated DB, and (c) the drift gate passes. Hand-editing
  generated files is prohibited.

### 5. Timeout and execution size

- Keep one transaction per preflight (atomicity). Do not batch checks into a
  second command.
- Raise the tool timeout to a configurable 300 s and treat 002a as the ceiling
  (17 tables + core fixtures). If the 002a preflight exceeds ~120 s on staging,
  move the exhaustive L2/L4 matrix out of preflight.
- Put exhaustive rule-matrix, append-only and admit-only fixtures in post-install
  scripts with their own transactions and cleanup, producing `live-*` receipts
  (precedent `verification/2026-10-03-live-providers.json`). Preflight keeps only
  schema/contract checks like `verify-login-contract.sql`.

### 6. What can start before W0.6

- **Can be written/preflighted now (rolled back):** both schemas, all
  tables/columns/CHECKs/FKs, roles/grants, tombstone/purge, procedures whose
  error paths refuse missing rules, the evidence schema, the W0.5 harness, all
  tooling edits.
- **Must wait for W0.6:** vocabulary seed rows,
  `vocabulary_declaration.definition_digest`, rule/prerequisite rows, L0 drift
  pass, L2/L4/L10 decision fixtures, evaluator rule set v1. Admission-principal
  seeding waits on D10 naming but not W0.6.
- Committing 002a before the W0.6 digest is recorded would violate I2/L0; W0.6 is
  a Phase 0 exit criterion.

### 7. Effort

- 002a SQL twins 4-6 eng-days; 002a preflight checks 3-4; 002b SQL twins 2-3;
  002b checks 1-2; tooling edits 1-2; DAL regeneration + consumer rebuild +
  receipts 1-2; W0.5 harness/E09 1-2; `verify-trust-ledger.mjs` 4-6; post-install
  L1-L9 fixtures 3-5. **Total ~19-30 eng-days.**
- Turn A: 002a DDL/procedures + `Program.cs` migration argument +
  `inspect-schema.sql`. Turn B: 002b evidence/tombstone/purge + W0.5 harness.
  Turn C: checks/fixtures + `regenerate.ps1`/config edits +
  `verify-trust-ledger.mjs` + receipts.
- Hard dependencies: W0.6 digest; W0.5 sizing; external CodeLightly checkout +
  identity DB rights; Azure CLI/staging access; D10 naming.

## Plan corrections from this lane

- Table count is 19 (15 `ledger.*` + 4 `evidence.*`) plus proposed rule(2) and
  tombstone(1) = 22, not "~12".
- No rules table and no tombstone table exist in §5.2 despite I2/I8; no
  vocabulary-digest row despite L0.
- The 8 named procedures omit evidence operations required by W2.2 (append
  trace, complete, read, purge).
- Tooling hardcodes 001 in four places: `Program.cs:9-13`, `regenerate.ps1:29,52`,
  `inspect-schema.sql:35`, plus the role filter `:39-40`.
- I9's "procedure check plus role" cannot be satisfied by roles alone with D2's
  single connection; the admission-principal table is mandatory.
- `ledger.lineage.from_id/to_id` is polymorphic and cannot carry FKs; add a
  subject/kind discriminator or per-relation nullable FKs.
- `Program.cs:29` 90 s timeout is unvalidated for a 17-table migration plus
  fixtures.
- Naming: `ledger.evidence` table vs `evidence` schema is confusing;
  `content_ref` cross-schema FKs are fine but should be documented.
- 001's count assertions are identity-scoped; 002a/002b each need their own
  assertions or the drift gate will not cover new procedures.

## Confidence

High on 001 mechanics, tooling constraints, receipts, custody (read directly).
Medium on CodeLightly multi-schema behavior (generator checkout not in repo;
presumed via `SchemaFilter` widening). Medium on effort ranges.
