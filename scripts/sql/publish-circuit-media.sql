-- publish-circuit-media.sql
--
-- The website visual publication's component-shape mappings, read directly from the media
-- base tables. One scenario circuit bundle per declared scenario definition: the bundle
-- revision the media subject selects, its published member files (the topology viewer, the
-- scenario entry, the per-view graphs, textures and shared runtime) and the bundle catalog
-- that carries the scenario label and the view count. Catalog bytes are returned as hex so
-- the UTF-8 document decodes in the caller, not through a database code page.
--
-- Deliberately ROLLBACK-only and read-only: the file runs through the SDA kernel runner
-- (`run-migration.mjs`) and never writes. Every read is TOP-bounded, joins on the media
-- identity columns and stays off the heavy estate-wide objects.
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET LOCK_TIMEOUT 30000;
BEGIN TRANSACTION;
GO

WITH ranked AS (
  SELECT s.definition_pk, sub.object_pk, r.revision_id AS bundle_revision,
    ROW_NUMBER() OVER (PARTITION BY s.definition_pk ORDER BY r.created_at DESC, r.revision_id DESC) AS rn
  FROM media.asset a
  JOIN media.asset_revision r ON r.asset_id=a.asset_id
  JOIN media.asset_semantic_source s ON s.revision_id=r.revision_id AND s.role=N'SUBJECT'
  JOIN media.subject sub ON sub.definition_pk=s.definition_pk AND sub.object_kind=N'SCENARIO'
  WHERE a.kind=N'CIRCUIT_BUNDLE'
)
SELECT N'circuit_bundles' AS result_set, (
  SELECT TOP (2000) definition_pk, object_pk, bundle_revision
  FROM ranked WHERE rn=1 ORDER BY definition_pk
  FOR JSON PATH
) AS json_value;
GO

WITH ranked AS (
  SELECT s.definition_pk, r.revision_id AS bundle_revision,
    ROW_NUMBER() OVER (PARTITION BY s.definition_pk ORDER BY r.created_at DESC, r.revision_id DESC) AS rn
  FROM media.asset a
  JOIN media.asset_revision r ON r.asset_id=a.asset_id
  JOIN media.asset_semantic_source s ON s.revision_id=r.revision_id AND s.role=N'SUBJECT'
  JOIN media.subject sub ON sub.definition_pk=s.definition_pk AND sub.object_kind=N'SCENARIO'
  WHERE a.kind=N'CIRCUIT_BUNDLE'
), selected AS (
  SELECT definition_pk, bundle_revision FROM ranked WHERE rn=1
)
SELECT N'circuit_files' AS result_set, (
  SELECT TOP (40000) sel.definition_pk, b.bundle_revision_id, b.relative_path, bl.media_type
  FROM selected sel
  JOIN media.bundle_member b ON b.bundle_revision_id=sel.bundle_revision
  JOIN media.asset_revision mr ON mr.revision_id=b.member_revision_id
  JOIN media.blob bl ON bl.digest=mr.blob_digest
  WHERE (b.relative_path LIKE N'outputs/estate-topology/%' OR b.relative_path LIKE N'outputs/estate-circuits/%'
      OR b.relative_path=N'samples/scl/circuit-flow.js' OR b.relative_path LIKE N'templates/estate-topology/%')
    AND (b.relative_path LIKE N'%.js' OR b.relative_path LIKE N'%.html'
      OR b.relative_path LIKE N'%.css' OR b.relative_path LIKE N'%.webp')
  ORDER BY sel.definition_pk, b.relative_path
  FOR JSON PATH
) AS json_value;
GO

WITH ranked AS (
  SELECT s.definition_pk, r.revision_id AS bundle_revision,
    ROW_NUMBER() OVER (PARTITION BY s.definition_pk ORDER BY r.created_at DESC, r.revision_id DESC) AS rn
  FROM media.asset a
  JOIN media.asset_revision r ON r.asset_id=a.asset_id
  JOIN media.asset_semantic_source s ON s.revision_id=r.revision_id AND s.role=N'SUBJECT'
  JOIN media.subject sub ON sub.definition_pk=s.definition_pk AND sub.object_kind=N'SCENARIO'
  WHERE a.kind=N'CIRCUIT_BUNDLE'
), selected AS (
  SELECT definition_pk, bundle_revision FROM ranked WHERE rn=1
)
SELECT N'circuit_catalogs' AS result_set, (
  SELECT TOP (2000) sel.definition_pk,
    CONVERT(varchar(max), bl.bytes, 2) AS document_hex
  FROM selected sel
  JOIN media.bundle_member b ON b.bundle_revision_id=sel.bundle_revision
  JOIN media.asset_revision mr ON mr.revision_id=b.member_revision_id
  JOIN media.blob bl ON bl.digest=mr.blob_digest
  WHERE b.relative_path LIKE N'outputs/estate-topology/%/catalog.js'
  ORDER BY sel.definition_pk
  FOR JSON PATH
) AS json_value;
GO

ROLLBACK TRANSACTION;
