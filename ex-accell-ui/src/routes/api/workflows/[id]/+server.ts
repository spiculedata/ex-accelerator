// Individual Workflow API
// Handles operations on specific workflows

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { canModifyOwned } from '$lib/server/ownership';
import { BodyTooLargeError, readJsonLimited } from '$lib/server/requestBody';
import { serverWorkflowService } from '$lib/services/serverWorkflowService';

const MAX_UPDATE_BODY_BYTES = 1024 * 1024;
const STATUSES = new Set(['draft', 'published', 'archived']);

const failure = (message: string, status: number) => json({ success: false, error: message }, { status });

/**
 * GET /api/workflows/[id]
 * Get a specific workflow by ID
 */
export const GET: RequestHandler = async ({ params }) => {
  try {
    const workflow = await serverWorkflowService.getPublishedWorkflow(params.id);
    if (!workflow) return failure('Workflow not found', 404);
    return json({ success: true, workflow });
  } catch (err) {
    console.error('Error getting workflow:', err);
    return failure('Failed to get workflow', 500);
  }
};

/**
 * PUT /api/workflows/[id]
 * Update a workflow. Only its creator or an admin may.
 */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
  try {
    let body: any;
    try {
      body = await readJsonLimited(request, MAX_UPDATE_BODY_BYTES);
    } catch (err) {
      if (err instanceof BodyTooLargeError) return failure(err.message, 413);
      return failure('Send a JSON body', 400);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return failure('Send a JSON object', 400);
    if (body.status !== undefined && !STATUSES.has(body.status)) return failure('status must be draft, published or archived', 400);
    if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) return failure('name must be text', 400);
    if (body.description !== undefined && typeof body.description !== 'string') return failure('description must be text', 400);
    if (body.metadata !== undefined && (typeof body.metadata !== 'object' || body.metadata === null || Array.isArray(body.metadata))) {
      return failure('metadata must be an object', 400);
    }

    const existing = await serverWorkflowService.getPublishedWorkflow(params.id);
    if (!existing) return failure('Workflow not found', 404);
    if (!canModifyOwned(locals.user, existing.createdBy)) {
      return failure('Only the person who created this workflow, or an admin, can change it.', 403);
    }

    const updated = await serverWorkflowService.updateWorkflow(params.id, {
      name: body.name,
      description: body.description,
      status: body.status,
      metadata: body.metadata
    });
    if (!updated) return failure('Workflow not found', 404);

    return json({ success: true, workflow: updated });
  } catch (err) {
    console.error('Error updating workflow:', err);
    return failure('Failed to update workflow', 500);
  }
};

/**
 * DELETE /api/workflows/[id]
 * Delete a workflow and its executions. Only its creator or an admin may.
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
  try {
    const existing = await serverWorkflowService.getPublishedWorkflow(params.id);
    if (!existing) return failure('Workflow not found', 404);
    if (!canModifyOwned(locals.user, existing.createdBy)) {
      return failure('Only the person who created this workflow, or an admin, can delete it.', 403);
    }

    const deleted = await serverWorkflowService.deleteWorkflow(params.id);
    if (!deleted) return failure('Workflow not found', 404);

    return json({ success: true });
  } catch (err) {
    console.error('Error deleting workflow:', err);
    return failure('Failed to delete workflow', 500);
  }
};
