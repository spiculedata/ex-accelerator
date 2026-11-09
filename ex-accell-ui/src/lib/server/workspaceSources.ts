// Everything that feeds a workspace: sources added through Data Capture (workspace_data_sources)
// and catalog datasets linked to it (workspace_datasets). Dashboards are scoped by the linked
// datasets, so the project, workspace and home counters must count both.
//
// Columns: kind, id, workspace_id, source_type, source_name, status, record_count, last_sync, created_at.
// A linked dataset reports 'active' while it is 'available' so one status filter covers both kinds.
export const WORKSPACE_SOURCES_SQL = `
  SELECT 'capture' AS kind, id, workspace_id, source_type, source_name, status,
         record_count::bigint AS record_count, last_sync, created_at
  FROM workspace_data_sources
  UNION ALL
  SELECT 'dataset' AS kind, d.id, wd.workspace_id, COALESCE(d.source_platform, d.dataset_type) AS source_type,
         d.name AS source_name, CASE WHEN d.status = 'available' THEN 'active' ELSE d.status END AS status,
         COALESCE(d.record_count, 0)::bigint AS record_count, d.last_updated AS last_sync, wd.added_at AS created_at
  FROM workspace_datasets wd
  JOIN datasets d ON d.id = wd.dataset_id
  WHERE wd.status = 'active'`;
