// Workspace Overview API Endpoint
// Returns workspace details, data sources, investigations, and summary in one round trip

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { postgresPool } from '$lib/services/postgres';
import { WORKSPACE_SOURCES_SQL } from '$lib/server/workspaceSources';

export const GET: RequestHandler = async ({ url }) => {
  const workspaceId = url.searchParams.get('id');

  if (!workspaceId) {
    return json({ success: false, error: 'Missing required parameter: id' }, { status: 400 });
  }

  const id = parseInt(workspaceId, 10);
  if (isNaN(id)) {
    return json({ success: false, error: 'Invalid workspace id' }, { status: 400 });
  }

  try {
    // 1. Get workspace details with project name
    const workspaces = await postgresPool.query(
      `SELECT w.id, w.name, w.description, w.workspace_type, w.project_id, w.status, w.created_at,
              p.name AS project_name
       FROM workspaces w
       LEFT JOIN projects p ON p.id = w.project_id
       WHERE w.id = $1`,
      [id]
    );

    if (!workspaces.length) {
      return json({ success: false, error: 'Workspace not found' }, { status: 404 });
    }

    const workspace = workspaces[0];

    // 2. Get data sources for this workspace: captured sources plus linked datasets
    const dataSources = await postgresPool.query(
      `SELECT kind, id, source_type, source_name, status, record_count, last_sync, created_at
       FROM (${WORKSPACE_SOURCES_SQL}) s
       WHERE workspace_id = $1
       ORDER BY created_at DESC`,
      [id]
    );

    // 3. Get investigations for this workspace
    const investigations = await postgresPool.query(
      `SELECT id, name, description, query_config, created_at, updated_at
       FROM investigations
       WHERE workspace_id = $1
       ORDER BY updated_at DESC`,
      [id]
    );

    // 4. Build summary
    // Like the project and home rollups, only active sources count towards the totals
    const activeSources = dataSources.filter((ds: any) => ds.status === 'active');
    const totalRecords = activeSources.reduce(
      (sum: number, ds: any) => sum + (Number(ds.record_count) || 0),
      0
    );

    return json({
      success: true,
      workspace: {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        workspace_type: workspace.workspace_type,
        project_id: workspace.project_id,
        project_name: workspace.project_name,
        status: workspace.status,
        created_at: workspace.created_at
      },
      data_sources: dataSources.map((ds: any) => ({
        kind: ds.kind,
        id: ds.id,
        source_type: ds.source_type,
        source_name: ds.source_name,
        status: ds.status,
        record_count: Number(ds.record_count) || 0,
        last_sync: ds.last_sync,
        created_at: ds.created_at
      })),
      investigations: investigations.map((inv: any) => ({
        id: inv.id,
        name: inv.name,
        description: inv.description,
        query_config: inv.query_config,
        created_at: inv.created_at,
        updated_at: inv.updated_at
      })),
      summary: {
        total_records: totalRecords,
        total_data_sources: activeSources.length,
        total_investigations: investigations.length
      }
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('GET /api/workspace-overview error:', msg);
    return json({ success: false, error: msg }, { status: 500 });
  }
};
