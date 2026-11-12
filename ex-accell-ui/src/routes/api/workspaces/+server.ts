// Workspaces API Endpoint
// CRUD operations for workspaces within projects

import { canManageProject, parseResourceId } from '$lib/server/auth/access';
import { refuseIfNoAccess } from '$lib/server/auth/accessGuard';
import { loadProjectAccessInfo } from '$lib/server/auth/accessRepo';
import { apiFail, apiOk, apiServerError, readJsonObject } from '$lib/server/apiResponse';
import type { RequestHandler } from './$types';
import { projectsDb } from '$lib/services/projectsDb';

const MAX_BODY_BYTES = 256 * 1024;

/**
 * GET /api/workspaces
 * Get workspaces by project ID or specific workspace by ID
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const workspaceId = url.searchParams.get('id');
    const projectId = url.searchParams.get('project_id');
    if ((workspaceId && Number.isNaN(parseInt(workspaceId))) || (projectId && Number.isNaN(parseInt(projectId)))) {
      return apiFail('id and project_id must be whole numbers', 400);
    }

    if (workspaceId) {
      const workspace = await projectsDb.getWorkspaceById(parseInt(workspaceId));
      if (!workspace) return apiFail('Workspace not found', 404);
      const dataSources = await projectsDb.getWorkspaceDataSources(parseInt(workspaceId));
      const detailed = { ...workspace, dataSources };
      return apiOk(detailed, { workspace: detailed });
    }

    if (projectId) {
      const workspaces = await projectsDb.getWorkspacesByProject(parseInt(projectId));
      return apiOk(workspaces, { workspaces });
    }

    return apiFail('workspace_id or project_id required', 400);
  } catch (error) {
    return apiServerError('GET /api/workspaces', error, 'Failed to load workspaces');
  }
};

/**
 * POST /api/workspaces
 * Create a new workspace within a project
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  const parsed = await readJsonObject(request, MAX_BODY_BYTES);
  if ('failure' in parsed) return parsed.failure;
  const data = parsed.body as Record<string, any>;

  try {
    if (!data.project_id) {
      return apiFail('project_id required', 400);
    }
    // A workspace can only be added to a project the person belongs to
    const refused = await refuseIfNoAccess(locals.user, { projects: [data.project_id] });
    if (refused) return refused;

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
      return apiFail('Failed to create workspace', 500);
    }

    return apiOk(workspace, { workspace });
  } catch (error) {
    return apiServerError('POST /api/workspaces', error, 'Failed to create the workspace');
  }
};

/**
 * PUT /api/workspaces
 * Update an existing workspace
 */
export const PUT: RequestHandler = async ({ request, locals }) => {
  const parsed = await readJsonObject(request, MAX_BODY_BYTES);
  if ('failure' in parsed) return parsed.failure;
  const { id, ...updates } = parsed.body as Record<string, any>;

  try {

    if (!id) {
      return apiFail('Workspace ID required', 400);
    }
    const refused = await refuseIfNoAccess(locals.user, { workspaces: [id] });
    if (refused) return refused;

    const workspace = await projectsDb.updateWorkspace(id, updates);

    if (!workspace) {
      return apiFail('Workspace not found', 404);
    }

    return apiOk(workspace, { workspace });
  } catch (error) {
    return apiServerError('PUT /api/workspaces', error, 'Failed to update the workspace');
  }
};

/**
 * DELETE /api/workspaces
 * Delete a workspace. Members can use a workspace, but only the person who made it, the project's creator or an admin can
 * delete it.
 */
export const DELETE: RequestHandler = async ({ url, locals }) => {
  const workspaceId = parseResourceId(url.searchParams.get('id'));
  if (typeof workspaceId !== 'number') {
    return apiFail(workspaceId === null ? 'Workspace ID required' : 'Workspace ID must be a whole number', 400);
  }
  const user = locals.user;
  if (!user) return apiFail('Authentication required', 401);

  try {
    const workspace = await projectsDb.getWorkspaceById(workspaceId);
    if (!workspace) return apiFail('Workspace not found', 404);

    const madeIt = !!workspace.created_by && workspace.created_by.toLowerCase() === user.email.toLowerCase();
    if (!madeIt && user.role !== 'admin') {
      const project = await loadProjectAccessInfo(Number(workspace.project_id));
      if (!project || !canManageProject(user, project)) {
        return apiFail('Only the person who made this workspace, the project creator or an admin can delete it.', 403);
      }
    }

    const success = await projectsDb.deleteWorkspace(workspaceId);

    if (!success) {
      return apiFail('Failed to delete workspace', 500);
    }

    return apiOk(null);
  } catch (error) {
    return apiServerError('DELETE /api/workspaces', error, 'Could not delete the workspace. Try again.');
  }
};
