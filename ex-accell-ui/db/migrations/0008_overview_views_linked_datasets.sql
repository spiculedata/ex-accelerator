-- Count linked datasets in the project and workspace overview views.
--
-- 0002 counted only workspace_data_sources, but dashboards are scoped by the datasets linked to a
-- workspace (workspace_datasets), so those views under-reported sources and records. The API
-- (src/lib/server/workspaceSources.ts) already unions both; workspace_sources is the same union
-- as a view, and the overview views are rebuilt on top of it.
--
-- Behaviour change from 0002: like the API, only active sources count in the totals (0002 counted
-- every captured source whatever its status). A linked dataset reports 'active' while it is
-- 'available'; paused, processing and error sources are still listed on the workspace page but
-- are left out of the counters. The old workspace_members join (w.id = wm.id) matched member rows to workspace ids,
-- so member_count was wrong; members are now counted by workspace_id. The column names, order and
-- types of both views are unchanged.

CREATE OR REPLACE VIEW workspace_sources AS
SELECT 'capture' AS kind, id, workspace_id, source_type, source_name, status,
       record_count::bigint AS record_count, last_sync, created_at
FROM workspace_data_sources
UNION ALL
SELECT 'dataset' AS kind, d.id, wd.workspace_id, COALESCE(d.source_platform, d.dataset_type) AS source_type,
       d.name AS source_name, CASE WHEN d.status = 'available' THEN 'active' ELSE d.status END AS status,
       COALESCE(d.record_count, 0)::bigint AS record_count, d.last_updated AS last_sync, wd.added_at AS created_at
FROM workspace_datasets wd
JOIN datasets d ON d.id = wd.dataset_id
WHERE wd.status = 'active';

CREATE OR REPLACE VIEW project_overview AS
SELECT
  p.id,
  p.name,
  p.description,
  p.project_type,
  p.status,
  p.created_by,
  p.created_at,
  p.updated_at,
  (SELECT COUNT(*) FROM workspaces w WHERE w.project_id = p.id)::integer AS workspace_count,
  (SELECT COUNT(DISTINCT pm.email) FROM project_members pm WHERE pm.project_id = p.id)::integer AS member_count,
  (SELECT COUNT(*)
     FROM workspace_sources s
     JOIN workspaces w ON w.id = s.workspace_id
    WHERE w.project_id = p.id AND s.status = 'active')::integer AS total_data_sources
FROM projects p
ORDER BY p.created_at DESC;

CREATE OR REPLACE VIEW workspace_overview AS
SELECT
  w.id,
  w.project_id,
  p.name AS project_name,
  w.name,
  w.description,
  w.workspace_type,
  w.status,
  w.created_by,
  w.created_at,
  (SELECT COUNT(*) FROM workspace_sources s WHERE s.workspace_id = w.id AND s.status = 'active')::integer AS data_source_count,
  (SELECT COUNT(DISTINCT wm.email) FROM workspace_members wm WHERE wm.workspace_id = w.id)::integer AS member_count,
  COALESCE((SELECT SUM(s.record_count) FROM workspace_sources s WHERE s.workspace_id = w.id AND s.status = 'active'), 0)::integer AS total_records
FROM workspaces w
JOIN projects p ON w.project_id = p.id
ORDER BY w.created_at DESC;
