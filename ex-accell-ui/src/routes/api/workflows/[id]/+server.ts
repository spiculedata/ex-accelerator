// Individual Workflow API
// Handles operations on specific workflows

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { serverWorkflowService } from '$lib/services/serverWorkflowService';

/**
 * GET /api/workflows/[id]
 * Get a specific workflow by ID
 */
export const GET: RequestHandler = async ({ params }) => {
  try {
    const { id } = params;
    
    const workflow = await serverWorkflowService.getPublishedWorkflow(id);
    
    if (!workflow) {
      return error(404, 'Workflow not found');
    }

    return json({
      success: true,
      workflow
    });
  } catch (err) {
    console.error('Error getting workflow:', err);
    return error(500, 'Failed to get workflow');
  }
};

/**
 * PUT /api/workflows/[id]
 * Update a workflow
 */
export const PUT: RequestHandler = async ({ params, request }) => {
  try {
    const { id } = params;
    const body = await request.json();

    const updated = await serverWorkflowService.updateWorkflow(id, {
      name: body.name,
      description: body.description,
      status: body.status,
      metadata: body.metadata
    });

    if (!updated) {
      return error(404, 'Workflow not found');
    }

    return json({ success: true, workflow: updated });
  } catch (err) {
    console.error('Error updating workflow:', err);
    return error(500, 'Failed to update workflow');
  }
};

/**
 * DELETE /api/workflows/[id]
 * Delete a workflow and its executions
 */
export const DELETE: RequestHandler = async ({ params }) => {
  try {
    const { id } = params;

    const deleted = await serverWorkflowService.deleteWorkflow(id);

    if (!deleted) {
      return error(404, 'Workflow not found');
    }

    return json({ success: true });
  } catch (err) {
    console.error('Error deleting workflow:', err);
    return error(500, 'Failed to delete workflow');
  }
};