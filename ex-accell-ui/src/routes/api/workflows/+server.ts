// Workflow Management API
// Handles publishing, executing, and managing workflows

import { apiFail, apiOk, apiServerError, readJsonObject } from '$lib/server/apiResponse';
import type { RequestHandler } from './$types';
import { serverWorkflowService } from '$lib/services/serverWorkflowService';

const MAX_WORKFLOW_BODY_BYTES = 1024 * 1024; // far more than any real workflow definition

/**
 * GET /api/workflows
 * Get all published workflows with optional filters
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const status = url.searchParams.get('status') || undefined;
    const pattern = url.searchParams.get('pattern') || undefined;
    const search = url.searchParams.get('search') || undefined;
    const tags = url.searchParams.get('tags')?.split(',') || undefined;

    const workflows = await serverWorkflowService.getPublishedWorkflows({
      status,
      pattern,
      search
    });

    return apiOk(workflows, { workflows, count: workflows.length });
  } catch (err) {
    return apiServerError('GET /api/workflows', err, 'Failed to get workflows');
  }
};

/**
 * POST /api/workflows
 * Publish a new workflow
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const parsed = await readJsonObject(request, MAX_WORKFLOW_BODY_BYTES);
    if ('failure' in parsed) return parsed.failure;
    const { workflowDefinition, metadata, draftId } = parsed.body as any;

    if (!workflowDefinition || !metadata) return apiFail('Missing workflowDefinition or metadata', 400);
    if (!metadata.name) return apiFail('Missing required metadata: name', 400);

    // The creator is the signed-in user, never a name typed into the form
    const publishedWorkflow = await serverWorkflowService.publishWorkflow(workflowDefinition, {
      ...metadata,
      createdBy: locals.user?.email ?? 'unknown',
      ...(typeof draftId === 'string' && draftId ? { draftId } : {})
    });

    return apiOk(publishedWorkflow, { workflow: publishedWorkflow });
  } catch (err) {
    return apiServerError('POST /api/workflows', err, 'Failed to publish workflow');
  }
};