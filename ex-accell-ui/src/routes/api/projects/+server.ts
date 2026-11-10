// Projects API Endpoint
// CRUD operations for projects and workspaces

import { canManageProject, parseResourceId } from '$lib/server/auth/access';
import { refuseIfNoAccess, visibleProjectIds } from '$lib/server/auth/accessGuard';
import { loadProjectAccessInfo } from '$lib/server/auth/accessRepo';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { projectsDb } from '$lib/services/projectsDb';

/**
 * GET /api/projects
 * Get all projects or a specific project by ID
 */
export const GET: RequestHandler = async ({ url, locals }) => {
  try {
    const projectId = url.searchParams.get('id');

    if (projectId) {
      const project = await projectsDb.getProjectById(parseInt(projectId));
      return json({ success: true, project });
    }

    // Only the projects this person may see
    const visible = locals.user ? await visibleProjectIds(locals.user) : new Set<number>();
    const all = await projectsDb.getAllProjects();
    const projects = visible === null ? all : all.filter((project) => visible.has(Number(project.id)));
    return json({ success: true, projects });
  } catch (error) {
    console.error('GET /api/projects error:', error instanceof Error ? error.message : String(error));
    return json({ success: false, data: null, error: 'Could not load the projects. Try again.' }, { status: 500 });
  }
};

/**
 * POST /api/projects
 * Create a new project
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const data = await request.json();

    const project = await projectsDb.createProject({
      name: data.name,
      description: data.description || '',
      project_type: data.project_type || 'social-media',
      // Creator comes from the session, never from the request body
      created_by: locals.user?.email ?? 'unknown',
      team_members: data.team_members || []
    });

    return json({ success: true, project });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('POST /api/projects error:', msg);

    // A duplicate name is the person's to fix, so it is said plainly; anything else stays in the log
    if (msg.includes('already exists')) return json({ success: false, error: msg }, { status: 400 });
    return json({ success: false, data: null, error: 'Could not create the project. Try again.' }, { status: 500 });
  }
};

/**
 * PUT /api/projects
 * Update an existing project
 */
export const PUT: RequestHandler = async ({ request, locals }) => {
  try {
    const data = await request.json();
    const { id, ...updates } = data;

    if (!id) {
      return json({ success: false, error: 'Project ID required' }, { status: 400 });
    }
    const refused = await refuseIfNoAccess(locals.user, { projects: [id] });
    if (refused) return refused;

    const project = await projectsDb.updateProject(id, updates);

    if (!project) {
      return json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    return json({ success: true, project });
  } catch (error) {
    console.error('PUT /api/projects error:', error instanceof Error ? error.message : String(error));
    return json({ success: false, data: null, error: 'Could not update the project. Try again.' }, { status: 500 });
  }
};

/**
 * DELETE /api/projects
 * Delete a project. Members can see a project but only its creator or an admin can delete it.
 */
export const DELETE: RequestHandler = async ({ url, locals }) => {
  const projectId = parseResourceId(url.searchParams.get('id'));
  if (typeof projectId !== 'number') {
    return json({ success: false, error: projectId === null ? 'Project ID required' : 'Project ID must be a whole number' }, { status: 400 });
  }
  if (!locals.user) return json({ success: false, error: 'Authentication required' }, { status: 401 });

  try {
    const info = await loadProjectAccessInfo(projectId);
    if (!info) return json({ success: false, error: 'Project not found' }, { status: 404 });
    if (!canManageProject(locals.user, info)) {
      return json({ success: false, error: 'Only the person who created this project, or an admin, can delete it.' }, { status: 403 });
    }

    const success = await projectsDb.deleteProject(projectId);

    if (!success) {
      return json({ success: false, error: 'Failed to delete project' }, { status: 500 });
    }

    return json({ success: true });
  } catch (error) {
    console.error('DELETE /api/projects error:', error instanceof Error ? error.message : String(error));
    return json({ success: false, data: null, error: 'Could not delete the project. Try again.' }, { status: 500 });
  }
};
