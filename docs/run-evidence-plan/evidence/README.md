# Run evidence plan: retained evidence

Produced 2026-10-06 for [the implementation plan](../../run-evidence-implementation-plan.md) (Appendix A).
No file holds a credential: provider bodies are redacted by the kernel and evidence content is not retrievable (E03).
Checksums are of the files as committed (LF line endings).

| File | SHA-256 |
| --- | --- |
| `E01-equity-cli-observation.txt` | `b5fafbab92aa9f9ef6a6861059ef3e8e5c7a3ecf703d5db40743ece1064e7f89` |
| `E02-telemetry-authority.json` | `ba7eb1422bde0514c45f40a7a086bddd30755e0b1be3d3b623bc6f066eb6b897` |
| `E03-local-gemini-run.json` | `c040877f4906c36c928ab27a554983fa41cbd7124c92e54b3d9893128277c5f0` |
| `E04-local-equity-run.json` | `3667cd4653c5b08730dc8f78fabcddf8ac7e67c5b3e61476595b58b76179210f` |
| `E05-trace-sizes.json` | `d824d5aa0d747d4de576421d934715addda8079b17bda9f9066dcb019e64f37f` |
| `E10-local-store-acceptance.json` | `f9f4c61ae28947218f5fb6e3500a3cb21a584b0d19a6c7329bd4208c1e947b30` |
| `E11-retained-capture-acceptance.json` | `77523f6fc43bb3e3d4b73dc3979839c6d012d1cc4262f93dab0f16b9496a47c1` |
| `E12-fresh-execution-acceptance.json` | `8c8bc9e1f18fc65e4d4948439c775cbbe2a750f65ad7b8dc3b2c411f72a2b5e0` |
| `E13-trust-authority-private-api.json` | `6f76bd30a8c2c7c9398d2a00d79a9db31446ba4d127503b524ca42b0df7287df` |
| `E14-staging-restart-acceptance.json` | `43ff573b0bcfe3b9f7e44e7f821ba4f6ef86bb0f48e9862424b94e596abe6803` |

E13 covers the pinned authority reference through generated DAL and the private
identity API. It does not establish a persisted trust disposition. Estate
evaluator fixtures and the incomplete E12-basis check are retained in
`sfx-embody/sql/inspect/run-evidence-trust/`; 32 evaluator fixtures pass, and the
incomplete basis yields `NOT_OBSERVABLE` without an eligible state.

E14 is the accepted staging rollout and full-container restart proof. It also
records a live browser check of the missing-run controls and all 12 Windows CLI
checks. The captured capability outcome remains distinct from trust evaluation.
