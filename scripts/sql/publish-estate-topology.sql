-- publish-estate-topology.sql
--
-- ROLLBACK read: the live authored circuit topology for the pinned generation, read from the
-- direct base tables. One row per selected CIRCUIT binding (never a view, never a heavy
-- analysis object), plus the blueprint cells the model declares for the same generation.
--
-- The publisher resolves each capability's renderer from these rows:
--   SCENARIO  bundle -> the scenario face's authored circuit
--   CAPABILITY bundle -> the capability's authored circuit
--   BLUEPRINT bundle -> the capability's authored blueprint circuit (via blueprint_version)
-- A selected binding that is not a resolvable CIRCUIT_BUNDLE is a publication failure, not a
-- boundary substitute. The generation is read from source.current_model, never hardcoded.
-- TOP-bounded; every join is on the media/model identity columns.
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET LOCK_TIMEOUT 30000;
BEGIN TRANSACTION;
GO

SELECT N'topology_summary' AS result_set, (
  SELECT TOP (10)
    (SELECT COUNT_BIG(*) FROM model.estate_capability ec
       WHERE EXISTS (SELECT 1 FROM source.current_model cm WHERE cm.estate_model_pk=ec.estate_model_pk)) AS selected_capabilities,
    (SELECT COUNT_BIG(*) FROM model.estate_definition ed
       JOIN model.semantic_object_definition d ON d.semantic_object_definition_pk=ed.semantic_object_definition_pk
       WHERE d.object_kind=N'SCENARIO'
         AND EXISTS (SELECT 1 FROM source.current_model cm WHERE cm.estate_model_pk=ed.estate_model_pk)) AS selected_scenario_definitions,
    (SELECT COUNT_BIG(*) FROM model.estate_definition ed
       JOIN model.semantic_object_definition d ON d.semantic_object_definition_pk=ed.semantic_object_definition_pk
       WHERE d.object_kind=N'BLUEPRINT'
         AND EXISTS (SELECT 1 FROM source.current_model cm WHERE cm.estate_model_pk=ed.estate_model_pk)) AS selected_blueprint_definitions,
    (SELECT COUNT_BIG(*) FROM model.blueprint_node n
       WHERE EXISTS (SELECT 1 FROM model.blueprint_version bv JOIN model.estate_definition ed
         ON ed.semantic_object_definition_pk=bv.semantic_object_definition_pk
         WHERE bv.blueprint_version_pk=n.blueprint_version_pk
           AND EXISTS (SELECT 1 FROM source.current_model cm WHERE cm.estate_model_pk=ed.estate_model_pk))) AS selected_blueprint_cells,
    (SELECT COUNT_BIG(*) FROM model.blueprint_edge e
       WHERE EXISTS (SELECT 1 FROM model.blueprint_version bv JOIN model.estate_definition ed
         ON ed.semantic_object_definition_pk=bv.semantic_object_definition_pk
         WHERE bv.blueprint_version_pk=e.blueprint_version_pk
           AND EXISTS (SELECT 1 FROM source.current_model cm WHERE cm.estate_model_pk=ed.estate_model_pk))) AS selected_blueprint_edges,
    (SELECT COUNT_BIG(*) FROM model.estate_definition ed
       JOIN media.visual_requirement vr ON vr.definition_pk=ed.semantic_object_definition_pk AND vr.purpose=N'CIRCUIT'
       WHERE EXISTS (SELECT 1 FROM source.current_model cm WHERE cm.estate_model_pk=ed.estate_model_pk)
         AND NOT EXISTS (SELECT 1 FROM media.visual_selection vs WHERE vs.requirement_id=vr.requirement_id)) AS circuit_requirements_without_selection
  FOR JSON PATH
) AS json_value;
GO

SELECT N'topology_bundles' AS result_set, (
  SELECT TOP (1200) d.object_kind, ed.semantic_object_definition_pk, vr.definition_pk,
    a.kind AS asset_kind, r.revision_id AS bundle_revision,
    c.capability_id, sc.scenario_id, bp.blueprint_id,
    (SELECT TOP (1) bm.relative_path FROM media.bundle_member bm
      WHERE bm.bundle_revision_id=r.revision_id
        AND bm.relative_path LIKE N'outputs/estate-topology/%/scenario/%/index.html'
      ORDER BY bm.relative_path) AS scenario_entry,
    (SELECT TOP (1) bm.relative_path FROM media.bundle_member bm
      WHERE bm.bundle_revision_id=r.revision_id
        AND bm.relative_path LIKE N'outputs/estate-topology/%/index.html'
        AND bm.relative_path NOT LIKE N'%/scenario/%'
      ORDER BY bm.relative_path) AS capability_entry,
    (SELECT TOP (1) bm.relative_path FROM media.bundle_member bm
      WHERE bm.bundle_revision_id=r.revision_id
        AND bm.relative_path LIKE N'outputs/estate-topology/%/catalog.js'
      ORDER BY bm.relative_path) AS catalog_entry,
    (SELECT COUNT_BIG(*) FROM media.bundle_member bm
      WHERE bm.bundle_revision_id=r.revision_id
        AND bm.relative_path LIKE N'outputs/estate-topology/%/n-%.js') AS view_count
  FROM model.estate_definition ed
  JOIN model.semantic_object_definition d ON d.semantic_object_definition_pk=ed.semantic_object_definition_pk
  JOIN media.visual_requirement vr ON vr.definition_pk=ed.semantic_object_definition_pk AND vr.purpose=N'CIRCUIT'
  JOIN media.visual_selection vs ON vs.requirement_id=vr.requirement_id
  JOIN media.entity_visual_binding b ON b.binding_id=vs.binding_id
  JOIN media.asset_revision r ON r.revision_id=b.revision_id
  JOIN media.asset a ON a.asset_id=r.asset_id
  LEFT JOIN model.capability_version cv ON cv.semantic_object_definition_pk=ed.semantic_object_definition_pk
  LEFT JOIN model.capability c ON c.capability_pk=cv.capability_pk
  LEFT JOIN model.scenario_version sv ON sv.semantic_object_definition_pk=ed.semantic_object_definition_pk
  LEFT JOIN model.scenario sc ON sc.scenario_pk=sv.scenario_pk
  LEFT JOIN model.blueprint_version bv ON bv.semantic_object_definition_pk=ed.semantic_object_definition_pk
  LEFT JOIN model.blueprint bp ON bp.blueprint_pk=bv.blueprint_pk
  WHERE EXISTS (SELECT 1 FROM source.current_model cm WHERE cm.estate_model_pk=ed.estate_model_pk)
  ORDER BY d.object_kind, ed.semantic_object_definition_pk
  FOR JSON PATH
) AS json_value;
GO

SELECT N'topology_cells' AS result_set, (
  SELECT TOP (2500) c.capability_id, bv.blueprint_version_pk, bv.semantic_object_definition_pk,
    n.node_id, n.node_kind, n.altitude, n.projection_ordinal, n.terminal_disposition
  FROM model.blueprint_node n
  JOIN model.blueprint_version bv ON bv.blueprint_version_pk=n.blueprint_version_pk
  JOIN model.capability c ON c.capability_pk=bv.capability_pk
  WHERE EXISTS (SELECT 1 FROM model.estate_definition ed
    WHERE ed.estate_model_pk IN (SELECT cm.estate_model_pk FROM source.current_model cm)
      AND ed.semantic_object_definition_pk=bv.semantic_object_definition_pk)
  ORDER BY c.capability_id, bv.blueprint_version_pk, n.projection_ordinal
  FOR JSON PATH
) AS json_value;
GO

ROLLBACK TRANSACTION;
