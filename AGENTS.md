# sfx-platform agent notes

The SideFX Live Circuit Platform. The Next.js website this repository carried was removed under
the revamp's P5 (2026-10-07); see [`docs/live-circuit-platform-revamp.md`](docs/live-circuit-platform-revamp.md)
for the platform's shape and [`docs/automatic-staging-deployment.md`](docs/automatic-staging-deployment.md)
for releases.

- The Explorer and circuit host are dependency-free ES modules under `live-circuit/`. There is
  no build step: verification scripts (`verify-*.mjs`) run with plain `node` and are the tests.
- Staging deploys automatically on watched paths through `.github/workflows/staging.yml`
  (`live-circuit/**`, `deploy/sda-kernel/**`, `deploy/staging/**`, `tools/live-circuit/**`,
  `tools/sfx-api/**`, `infra/azure.json`, `infra/authorize-staging-release.ps1`, and the workflow
  itself). Keep acceptance evidence real: a failed gate rolls the slot back.
- SDA behaviour changes only by request to `scenario-driven-architecture`; capability meaning
  only through `sfx-embody` migration pairs; identity schema only through `sfx-dal` migrations
  and DAL regeneration.
- Website-era documents under `docs/` are historical records, marked as such; do not treat them
  as current behavior.
