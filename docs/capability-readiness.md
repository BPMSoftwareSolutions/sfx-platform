# Capability readiness: why capabilities are held, and how to clear them

Of the current generation's 219 capabilities, 94 prepare and execute; **125 are held**. This
records what each hold actually means, where its fix lives, and how to rank the work from the
database rather than by guesswork.

The central finding: **the holds are not one problem, and only some of them are fixable in the
database.** Sorting them by where the repair belongs is what makes the remaining work tractable.

## Held is not a preparation artifact

Preparation memoizes the resolver walk and fixture proof so invocation costs ~3s instead of
~130s. It did not create these failures — every one of them would fail at invocation too.
Preparation surfaces them earlier, cheaply, and names them. The coverage number is a fact about
the estate, not about the cache.

## The taxonomy that matters: where the fix lives

| Class | Codes | Held | Fix belongs to | Database-fixable |
| --- | --- | ---: | --- | --- |
| **Authority/binding gap** | `PORT_IMPLEMENTATION_NOT_RESOLVED`, `SOURCE_REFERENCE`, `MECHANIC_ARGUMENT_MISSING`, `CONTRACT_SCHEMA_SOURCE` | 48 | Retained authority documents | Partly |
| **Contract projection defect** | `DATABASE_INVOCATION_FAILED`, `SCHEMA_TYPE_UNION_NOT_SUPPORTED` | 32 | Contract schema authoring | **Yes** |
| **Resolver capability gap** | `NATIVE_TRANSITION_TRANSLATION_NOT_AVAILABLE`, `NODE_BINDINGS_HELD` | 24 | The Node lowering provider | No |
| **Real capability failure** | `PREPARATION_FIXTURE_FAILED` | 19 | The capability itself | No |

Full distribution, from a diagnostic pass that re-ran all 125 holds capturing complete messages:

| Code | Count |
| --- | ---: |
| `PORT_IMPLEMENTATION_NOT_RESOLVED` | 39 |
| `DATABASE_INVOCATION_FAILED` | 30 |
| `NATIVE_TRANSITION_TRANSLATION_NOT_AVAILABLE` | 20 |
| `PREPARATION_FIXTURE_FAILED` | 19 |
| `NODE_BINDINGS_HELD` | 4 |
| `CONTRACT_SCHEMA_SOURCE` | 4 |
| `MECHANIC_ARGUMENT_MISSING` | 3 |
| `SOURCE_REFERENCE` | 2 |
| `SCHEMA_TYPE_UNION_NOT_SUPPORTED` | 2 |
| `CAPABILITY_ROOT_SCENARIO_UNRESOLVED` | 1 |
| `PATH_ARGUMENT_DOMAIN_NOT_SUPPORTED` | 1 |

Each class is established from where the error is raised, not inferred from its name.

### Contract projection defect — `DATABASE_INVOCATION_FAILED`

The name is misleading: nothing about the database failed. These are raised by SDA's contract
type projection, `tools/src/projection/ir/json-schema-type-graph-builder.ts`, which refuses JSON
Schema constructs it cannot turn into typed contracts:

| Rule | Message | Line |
| --- | --- | --- |
| `type: array` must have `items` as a non-array object | *Array schema at '…' has no admitted item schema* | 133 |
| `const`/`enum` values must be string, number or boolean | *Unsupported literal at '…'* | 52 |
| `oneOf` must match an admitted reference-or-stub shape | *Unsupported oneOf shape at '…'* | 125 |

Of the 30 holds under this code, the diagnostic pass attributes **13** to an array without an
admitted item schema, **11** to an unsupported literal and **1** to an unsupported `oneOf`. The
remaining 5 are not projection rules at all and matter separately: 2 are **malformed JSON in
retained schema content** (parse errors at byte offsets), 1 is a transition referencing an unknown
scenario, 1 is unsupported schema mechanics, and 1 is a toolchain crash
(`Cannot read properties of undefined (reading 'split')`) — a defect in the projector rather than
in the data.

**This class is pure data, and it is the most tractable.** A scan of all 630 contract schemas
retained in `source.content_object`, applying those exact rules:

| Defect | Contracts | Sites |
| --- | ---: | ---: |
| Array without an admitted item schema | 60 | 168 |
| Unsupported literal | 24 | 29 |
| **At least one blocking defect** | **81 of 630** | **197** |
| `oneOf` present (held only in unadmitted shapes) | 79 | 94 |

They are not 81 unrelated bugs. The defective arrays cluster on a few repeated property names:

| Property | Sites |
| --- | ---: |
| `findings` | 38 |
| `runResults` | 18 |
| `unresolvedReferenceRefs` | 10 |
| `effectLineage` | 10 |
| `results` | 7 |
| `observations` | 6 |

`findings` alone is 38 of the 168 array sites and appears in 42% of affected contracts. These are
the same shape authored repeatedly without an item schema. **One reviewed `$defs` item schema per
recurring shape, referenced from each site, clears most of this class** — and because the schemas
are retained content addressed by digest, the fix is authored once and republished rather than
patched per capability.

**Read the two numbers correctly.** 81 contracts carry a blocking defect, but only 25 capabilities
are currently held by one: most defective contracts are not on a held capability's root-scenario
path, or its capability fails earlier for another reason. Repairing all 81 unblocks 25 now — the
rest is future-proofing that stops the defect resurfacing as other capabilities become reachable.
Never quote the contract count as a capability count.

### Authority/binding gap — `PORT_IMPLEMENTATION_NOT_RESOLVED`

Raised at `sfx-embody/src/resolvers/node/consumer-object-provider.mjs:164` when an `invoke-port`
operation has no matching entry in the retained interface authority, no provenance, or a binding
carrying no `configuration.expression`.

**It is not a missing provider implementation.** Two checks establish that:

- `model.provider_port_implementation` and `model.binding_port_implementation` are **empty** — 0
  rows across all 1,013 ports. Port implementations are not declared in those tables at all, so
  "unimplemented ports" is not a meaningful measure here.
- Every `platformCapabilityId` that ports require **does** have a declared node implementation:
  the gap query returns **0**. Node declares 38 platform implementations (csharp 20, python 18).

So the missing thing is the port's retained **binding document** — the
`application-binding.node.json` its definition references — or an expression within it. That is
authority content, repairable where the authority is authored, and only visible in the database
as the absence it is.

**This class has almost no leverage, and that is the important finding.** The 39 holds name **34
distinct ports**, of which **31 block exactly one capability each**; the worst blocks three. There
is no cluster to exploit and no ranking that helps — it is 34 separate authority repairs for 39
capabilities. It is the largest class by count and the smallest by leverage, which is precisely
the conclusion that ranking from data is for.

### Resolver capability gap — `NATIVE_TRANSITION_TRANSLATION_NOT_AVAILABLE`

The provider says so itself, at `sfx-embody/src/materialize-node.mjs:98`:

> `// This provider currently lowers ordered invocations. Other topology remains held.`

A capability whose semantic transition graph carries a transition from one of its own scenarios is
held. Branching, parallel and returning topology are not lowered yet. **No database change fixes
this** — it is work in the Node lowering provider, and it is the class where a data-driven
approach can only tell you how much it is worth.

`NODE_BINDINGS_HELD` belongs to the same family: the planner holding rather than guessing.

### Real capability failure — `PREPARATION_FIXTURE_FAILED`

The body was built and its retained fixtures ran and failed, naming the fixture and the
assertion — for example `single-query-operation`, expecting disposition `terminated` and observing
`failed`. This is the estate reporting that a capability does not do what its own fixtures say it
does. It is neither a projection defect nor a resolver gap, and preparation refusing to publish it
is correct: an unproven body must not become an executable claim.

## The data-driven approach

The principle: **let the database rank the work, and only do the work the database says is
shared.** Three queries carry it.

**1. Coverage and reasons.** Preparation reports its own code; a pass over the estate yields the
distribution. Retain the *full* message, not a truncated one — the message names the port, the
schema pointer or the fixture, and without it a hold is unactionable. (The first pass here
truncated stderr at 200 characters and had to be re-run for exactly this reason.)

**2. Contract defects, from retained schema content.** One read, then apply the projector's rules:

```sql
SELECT ct.contract_id,
       CONVERT(nvarchar(max), CONVERT(varchar(max), co.content_bytes)
               COLLATE Latin1_General_100_BIN2_UTF8) AS schema_text
FROM model.contract_version cv
JOIN model.contract ct ON ct.contract_pk = cv.contract_pk
JOIN analysis.v_selected_semantic_definition d
  ON d.semantic_object_definition_pk = cv.semantic_object_definition_pk
JOIN source.content_object co
  ON LOWER(CONVERT(varchar(64), co.content_digest, 2))
   = JSON_VALUE(d.definition_json, '$.semantics.schema_digest');
```

630 rows in ~1.8s. Walk each schema for the three rules above and group defects by property name —
the grouping is what turns 197 sites into a handful of shared repairs.

**3. Confirm a suspected gap before acting on it.** Both port queries above returned results that
looked actionable and were not: 500+ "unimplemented" ports from empty tables, then 0 missing
platform implementations. Check that the table you are measuring has rows, and that a *passing*
capability does not exhibit the same pattern, before treating a count as a finding.

## Recommended order, by leverage rather than by count

Ranking by count puts ports first. Ranking by *capabilities unblocked per unit of work* inverts
that, which is the whole reason to measure before scheduling.

| Rank | Work | Unblocks | Why |
| ---: | --- | ---: | --- |
| 1 | **Node lowering for non-ordered topology** | 20 (+4) | **One provider investment** clears every `NATIVE_TRANSITION_TRANSLATION_NOT_AVAILABLE` at once, and likely the 4 `NODE_BINDINGS_HELD` with it. The highest ratio on the board |
| 2 | **Contract schema defects** | 25 | Data-only, no provider work, and clustered: a handful of recurring shapes (`findings`, `runResults`) covers most sites. Also future-proofs 56 further contracts |
| 3 | **Malformed retained schema content** | 2 | Trivially small but unambiguous — two schemas do not parse. Fix while in the same material |
| 4 | **Port binding documents** | 39 | Largest count, lowest leverage: 34 separate repairs, 31 of them for a single capability each. Grind, not strategy |
| 5 | **Fixture failures** | 19 | Each is a real defect in a real capability. Triage individually: is the fixture wrong, or the capability? Not schedulable as a batch |

Rank 1 before rank 2 is the counter-intuitive call and the one worth making deliberately: 20
capabilities behind a single, well-understood provider limitation that the code already names in a
comment, versus 25 behind a clustered but still multi-site authoring pass.

Note that ranks 4 and 5 together are 58 of the 125 — nearly half the estate's holds sit in classes
with no shared fix. Coverage will not approach 219 by clearing batches; it approaches it by
per-capability work, and any plan implying otherwise is wrong about this data.

## What the database cannot tell you

It can rank and cluster, and it can prove a gap is not where you assumed — twice here it showed a
promising direction was empty. It cannot decide whether a failing fixture means the capability is
wrong or the fixture is, and it cannot lower a topology the provider does not support. Two of the
four classes are code, not data, and one of the "database" failures turned out to be a crash in
the projector. Treating all of it as data is how a remediation plan quietly stops matching
reality.

Reproducing this analysis: the preparation pass and the diagnostic re-run are ordinary
`sfx capability prepare` invocations over the estate, retaining each full message; the schema scan
is the query above plus a walk applying the projector's three rules. Both are cheap — preparation
is ~8s per capability and the schema read is ~2s for all 630 — so this is worth re-running each
generation rather than trusting a stale plan.
