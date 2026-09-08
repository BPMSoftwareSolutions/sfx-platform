# Media publication and recovery

The media worker lives in `C:/lab/sidefx-database/src/media/`. The Python compiler and Nano Banana transport live in `C:/lab/repos/content-creation-mission/scripts/`. The web container consumes immutable exported bytes and has no SQL credentials or Python runtime.

## Import and publication

Use the existing database connection resolver; do not put connection strings or Gemini credentials into command lines or website environment variables.

From the database repository:

```powershell
node src/media/cli.mjs migrate
node src/media/cli.mjs seed
node src/media/inventory.mjs
node src/media/import-lab.mjs
```

From the content lab, compile the frozen SCL with its existing renderer. Four independent local worker processes may run the four parts; they do not call a generative API.

```powershell
.venv/Scripts/python.exe scripts/compile_estate_media.py --inventory C:/lab/sidefx-database/data/media/inventory.json --shards 4 --part 0
# Repeat for --part 1, 2 and 3, then:
.venv/Scripts/python.exe scripts/merge_estate_media.py
```

Back in the database repository:

```powershell
node src/media/import-circuits.mjs
node src/media/select-circuits.mjs
node src/media/archive-catalogs.mjs
node src/media/export-website.mjs
node src/media/verify.mjs
node src/media/restore-website.mjs --verify-only
```

Originals are hash-checked before import. The SQL byte table checks every digest and length; immutable revisions and exact foreign keys protect the mapping. Circuit imports reject stale capsule lineage and unresolved scenario ownership. Selection retains the reviewed authored edition when it exists. Source-only views never acquire an invented playback trace.

The import catalogs and website media publication are themselves stored in SQL. `export-website.mjs` reads these SQL catalogs, then retrieves selected bytes from SQL. The content lab is not required for export or recovery. The website artifact manifest records the precise bytes of delivery adaptations such as iframe sizing; their original revisions remain stored separately.

From the website repository, with the development server stopped during publication:

```powershell
npm run publish:estate
npm run select:estate
npm run build
npm run check
```

The release manifest pins the estate, boundary circuits and visual publication together. `public/media/**` and `generated/*.json` disable Git newline conversion because their exact bytes are verified in the Linux container. CI checks and deploys the same image to staging by digest.

## Nano Banana jobs

`node src/media/generate.mjs --prepare` creates deterministic SQL request identities from the exact definition, source generation, prompt, model and style-reference digest. Execution requires explicit `--limit`, `--budget-usd` and a bounded `--concurrency`; the budget argument is a conservative per-run reservation check, not a provider-enforced billing limit. Do not relaunch ambiguous requests or silently substitute a different image model.

Successful calls store provider originals, receipts and WebP derivatives in SQL and stop at `REVIEW_REQUIRED`. Inspect the original image against its subject before using `review.mjs --job <request-sha> --approve --reason <review>`. Reviews are attributed to the actual reviewing process. An approved shared material does not satisfy a subject's dedicated image requirement.

Confirmed transient HTTP failures can be requeued with `review.mjs --retry-transient`; uncertain network results require reconciliation. Existing generated receipts are reused only after checking the original digest. The remaining full-estate batch needs a spending cap before execution.

## Recovery

`node src/media/restore-website.mjs --verify-only` reads the published media catalog from SQL and rehashes every delivery artifact without reading content-lab files or making provider calls. To reconstruct its delivery tree, pass `--output <recovery-directory>` instead. The command creates `public/media/` and `generated/visual-publication.json` under that directory and rejects path traversal.

`npm run validate:media -- --require-complete` is the complete-production gate. It must fail while any current visual requirement remains open. Ordinary staging builds verify the integrity of available work and do not imply that this completion gate has passed.
