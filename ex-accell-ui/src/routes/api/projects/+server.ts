// Projects API Endpoint
// CRUD operations for projects and workspaces

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { projectsDb } from '$lib/services/projectsDb';

/**
 * GET /api/projects
 * Get all projects or a specific project by ID
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const projectId = url.searchParams.get('id');

    if (projectId) {
      const project = await projectsDb.getProjectById(parseInt(projectId));
      return json({ success: true, project });
    }

    const projects = await projectsDb.getAllProjects();
    return json({ success: true, projects });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('GET /api/projects error:', msg);
    return json({ success: false, error: msg }, { status: 500 });
  }
};

/**
 * POST /api/projects
 * Create a new project
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const data = await request.json();

    const project = await projectsDb.createProject({
      name: data.name,
      description: data.description || '',
      project_type: data.project_type || 'social-media',
      created_by: data.created_by || 'default_user',
      data_sources: data.data_sources || [],
      team_members: data.team_members || []
    });

    if (!project) {
      return json({ success: false, error: 'Failed to create project' }, { status: 500 });
    }

    return json({ success: true, project });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('POST /api/projects error:', msg);
    return json({ success: false, error: msg }, { status: 500 });
  }
};

/**
 * PUT /api/projects
 * Update an existing project
 */
export const PUT: RequestHandler = async ({ request }) => {
  try {
    const data = await request.json();
    const { id, ...updates } = data;

    if (!id) {
      return json({ success: false, error: 'Project ID required' }, { status: 400 });
    }

    const project = await projectsDb.updateProject(id, updates);

    if (!project) {
      return json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    return json({ success: true, project });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('PUT /api/projects error:', msg);
    return json({ success: false, error: msg }, { status: 500 });
  }
};

/**
 * DELETE /api/projects
 * Delete a project
 */
export const DELETE: RequestHandler = async ({ url }) => {
  try {
    const projectId = url.searchParams.get('id');

    if (!projectId) {
      return json({ success: false, error: 'Project ID required' }, { status: 400 });
    }

    const success = await projectsDb.deleteProject(parseInt(projectId));

    if (!success) {
      return json({ success: false, error: 'Failed to delete project' }, { status: 500 });
    }

    return json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('DELETE /api/projects error:', msg);
    return json({ success: false, error: msg }, { status: 500 });
  }
};
