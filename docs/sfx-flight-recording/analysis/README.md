# Flight recording analysis: lane designs and adversarial review

Produced 2026-10-06. Status: **design record; no code changed.** Read-only lanes
except that each document listed below was authored in this folder and the plan
was authored/revised in `docs/sfx-flight-recording/`.

This folder retains the design work behind
[the flight-recording implementation plan](../implementation-plan.md). The plan
consolidates these documents; none of them is installed fact.

## Method

- **Design lanes (6, parallel).** One per workstream: triggers/windows, recorder
  runtime, storage/ledger, expected-vs-observed verification, evidence-microscope
  UX, assurance/operations. Each read `../intent.md`, `../research.md`, the
  relevant [run-evidence analysis](../../run-evidence-plan/analysis/README.md)
  documents, and code at the pinned commits; each wrote one file here.
- **Author lane.** Produced `../implementation-plan.md` (600-line draft,
  revision 1) from the six lane documents.
- **Adversarial review lane.** Audited the draft against the lane documents and
  the verified run-evidence facts; produced the review below (2 blockers,
  12 major, 12 minor corrections).
- **Revision lane.** Applied C01–C24 and the review's missing-item list to the
  plan (now 711 lines, revision 1, marked "adversarial review corrections
  applied").

## Documents

| File | Holds |
| --- | --- |
| [lane-01-triggers-and-windows.md](lane-01-triggers-and-windows.md) | Trigger sources by tier, declared trigger vocabulary, window geometry/horizon, evaluation and declaration delivery |
| [lane-02-recorder-runtime.md](lane-02-recorder-runtime.md) | Recorder placement in the circuit host, state machine, bounds, durable interface, recovery, local spike |
| [lane-03-storage-and-ledger.md](lane-03-storage-and-ledger.md) | `evidence.recording`/window/trigger/member object model, procedures, claims, retention, endpoints |
| [lane-04-expected-vs-observed.md](lane-04-expected-vs-observed.md) | The nine verification questions mapped, expected-trace descriptor, comparison operations and outcomes, producers |
| [lane-05-evidence-microscope-ux.md](lane-05-evidence-microscope-ux.md) | Eight microscope views, Explorer integration, honesty/volume handling, UI gates |
| [lane-06-assurance-and-operations.md](lane-06-assurance-and-operations.md) | Trigger authority, access/separation, privacy/redaction, retention/hold, cost, honest non-repudiation mapping |
| [review-implementation-plan.md](review-implementation-plan.md) | Adversarial review of the draft plan: C01–C24 corrections, do-not-regress list, missing items |

## Pinned revisions

| Repository | Commit |
| --- | --- |
| sfx-platform | `b9be6e8` (HEAD at design time; uncommitted Phase 1 UI files noted in the plan) |
| sfx-dal | `6883c75` |
| sfx-providers | `86a3084` |
| sfx-embody | `d9b1d3b` |
| scenario-driven-architecture | `7075bb6` |

Code facts in the lane documents are cited `file:line` at these revisions. Facts
already verified by the run-evidence reconnaissance are cited to that analysis
rather than re-derived.

## Reading order

1. [../intent.md](../intent.md) and [../research.md](../research.md) — the
   concept and the thesis.
2. The six lane documents.
3. [../implementation-plan.md](../implementation-plan.md) — the consolidated
   plan (start with the header, then §6 phases and §7 gates).
4. [review-implementation-plan.md](review-implementation-plan.md) — what the
   review changed and what must not regress.

## Maintenance

Corrections to a lane document should be appended as dated notes or as a
superseding document that links here; do not silently rewrite design findings.
The plan is revision 1 and remains proposed; decisions D11–D16 and the carried
lane decisions belong to the product owner and team.
