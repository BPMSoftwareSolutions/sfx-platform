# Run evidence and trust ledger: reconnaissance and 3-turn execution analysis

Produced 2026-10-06. Status: **reconnaissance record, no repositories changed.**

This folder retains the full output of a three-round, multi-lane reconnaissance of
[the run-evidence implementation plan](../../run-evidence-implementation-plan.md)
(revision 3, draft not started). It exists so the empirical findings, verified
plan corrections, decision register and 3-turn execution analysis are durable and
reviewable rather than living only in session transcripts.

## Method

- **Turn 1 (recon).** Six parallel research lanes, one per workstream: platform
  UI, platform host/gates, sfx-dal, sfx-providers, sfx-embody, SDA.
- **Turn 2 (deep dive).** The same six lanes resumed with targeted questions on
  gaps, dependencies, effort and contradictions.
- **Turn 3 (synthesis).** Three parallel synthesis lanes: 3-turn work matrix,
  decision/blocker register, gate/evidence map.
- All lanes were read-only: files were read, grepped and listed; no migrations,
  services, installs or state-changing commands were run. No file exists because
  a lane measured live state; live/staging state is marked where claimed.

## Pinned revisions

Every finding was read at these commits. Findings cite paths relative to each
repository root.

| Repository | Commit | Date |
| --- | --- | --- |
| sfx-platform | `327a2c2` | 2026-10-06 |
| sfx-dal | `6883c75` | 2026-10-03 |
| sfx-providers | `86a3084` | 2026-10-05 |
| sfx-embody | `d9b1d3b` | 2026-10-06 |
| scenario-driven-architecture | `7075bb6` | 2026-10-05 |

Repository roots: `C:\lab\repos\<name>`. Retained measurements referenced as
E01–E05 live in [`../evidence/`](../evidence/) with SHA-256 checksums in that
folder's `README.md`.

## Documents

| File | Holds |
| --- | --- |
| [lane-01-platform-ui.md](lane-01-platform-ui.md) | Explorer UI current state, work-item mapping, Phase 1 split, effort, risks |
| [lane-02-platform-host.md](lane-02-platform-host.md) | Circuit host, run API, observer bridge, gateway, retention, gates, effort |
| [lane-03-identity-db.md](lane-03-identity-db.md) | sfx-dal 001 pattern, 002 artifact design, admission separation, DAL tooling, effort |
| [lane-04-identity-host.md](lane-04-identity-host.md) | Identity host routes/middleware, caller keys, producers, B22 resolution, effort |
| [lane-05-estate.md](lane-05-estate.md) | W0.4/W0.6/W2.4/W3.2/W4.4 declaration work, fixtures, effort |
| [lane-06-sda.md](lane-06-sda.md) | S1/S2/S3 change points, request process, W0.3, parity probe, lead times |
| [synthesis-3-turn-plan.md](synthesis-3-turn-plan.md) | Lane x turn matrix, turn gates, critical path, feasibility verdict |
| [decisions-and-corrections.md](decisions-and-corrections.md) | Decision register, external dependencies, 17 verified plan corrections, go/no-go |
| [gates-and-evidence-map.md](gates-and-evidence-map.md) | Gate subsets per boundary, producing scripts, receipts, DoD per turn |

## Top-line verdict

Three parallel work turns (about 4 calendar weeks, 6–7 lanes) deliver Phase 0
fully, Phase 1 fully, Phase 2 at roughly 50–60% and Phase 3 at roughly 25–40%.
Phase 4 and 5 do not fit. The binding constraint is the external CodeLightly DAL
generator (not in the workspace): without it, Phase 2 is fixture-green code, not
a durable run. The recommended "3-turn done" definition and the list of what is
explicitly deferred are in [synthesis-3-turn-plan.md](synthesis-3-turn-plan.md).

## Reading the evidence

- File:line citations are directly checkable against the pinned commits.
- Claims needing live state (staging settings, Azure SQL tier, installed
  migrations) are marked and were **not** queried by this analysis.
- Confidence is stated per document; the lane documents distinguish
  directly-read facts (high) from inferred design implications (medium).
- Where a lane contradicts the plan, it is listed in that lane's "Plan
  corrections" section and consolidated in
  [decisions-and-corrections.md](decisions-and-corrections.md).

## Maintenance

This is a dated reconnaissance record, not a living document. Corrections
should be appended as dated notes or as a superseding document that links here;
do not silently rewrite findings. When implementation begins, new work should
cite the lane documents for context and the plan for authority.
