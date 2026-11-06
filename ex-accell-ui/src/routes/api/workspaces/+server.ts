// Workspaces API Endpoint
// CRUD operations for workspaces within projects

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { projectsDb } from '$lib/services/projectsDb';

/**
 * GET /api/workspaces
 * Get workspaces by project ID or specific workspace by ID
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const workspaceId = url.searchParams.get('id');
    const projectId = url.searchParams.get('project_id');

    if (workspaceId) {
      const workspace = await projectsDb.getWorkspaceById(parseInt(workspaceId));
      const dataSources = await projectsDb.getWorkspaceDataSources(parseInt(workspaceId));
      return json({ success: true, workspace: { ...workspace, dataSources } });
    }

    if (projectId) {
      const workspaces = await projectsDb.getWorkspacesByProject(parseInt(projectId));
      return json({ success: true, workspaces });
    }

    return json({ success: false, error: 'workspace_id or project_id required' }, { status: 400 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('GET /api/workspaces error:', msg);
    return json({ success: false, error: msg }, { status: 500 });
  }
};

/**
 * POST /api/workspaces
 * Create a new workspace within a project
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const data = await request.json();

    if (!data.project_id) {
      return json({ success: false, error: 'project_id required' }, { status: 400 });
    }

    const workspace = await projectsDb.createWorkspace({
      project_id: data.project_id,
      name: data.name,
      description: data.description || '',
      workspace_type: data.workspace_type || 'general',
      // The creator is the signed-in user, never a name from the request
      created_by: locals.user?.email ?? 'unknown',
      data_sources: data.data_sources || []
    });

    if (!workspace) {
      return json({ success: false, error: 'Failed to create workspace' }, { status: 500 });
    }

    return json({ success: true, workspace });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('POST /api/workspaces error:', msg);
    return json({ success: false, error: msg }, { status: 500 });
  }
};

/**
 * PUT /api/workspaces
 * Update an existing workspace
 */
export const PUT: RequestHandler = async ({ request }) => {
  try {
    const data = await request.json();
    const { id, ...updates } = data;

    if (!id) {
      return json({ success: false, error: 'Workspace ID required' }, { status: 400 });
    }

    const workspace = await projectsDb.updateWorkspace(id, updates);

    if (!workspace) {
      return json({ success: false, error: 'Workspace not found' }, { status: 404 });
    }

    return json({ success: true, workspace });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('PUT /api/workspaces error:', msg);
    return json({ success: false, error: msg }, { status: 500 });
  }
};

/**
 * DELETE /api/workspaces
 * Delete a workspace
 */
export const DELETE: RequestHandler = async ({ url }) => {
  try {
    const workspaceId = url.searchParams.get('id');

    if (!workspaceId) {
      return json({ success: false, error: 'Workspace ID required' }, { status: 400 });
    }

    const success = await projectsDb.deleteWorkspace(parseInt(workspaceId));

    if (!success) {
      return json({ success: false, error: 'Failed to delete workspace' }, { status: 500 });
    }

    return json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('DELETE /api/workspaces error:', msg);
    return json({ success: false, error: msg }, { status: 500 });
  }
};
