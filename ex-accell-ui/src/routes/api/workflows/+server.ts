// Workflow Management API
// Handles publishing, executing, and managing workflows

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { serverWorkflowService } from '$lib/services/serverWorkflowService';
import { BodyTooLargeError, readJsonLimited } from '$lib/server/requestBody';

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

    return json({
      success: true,
      workflows,
      count: workflows.length
    });
  } catch (err) {
    console.error('Error getting workflows:', err);
    return error(500, 'Failed to get workflows');
  }
};

/**
 * POST /api/workflows
 * Publish a new workflow
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    let body: any;
    try {
      body = await readJsonLimited(request, MAX_WORKFLOW_BODY_BYTES);
    } catch (error) {
      if (error instanceof BodyTooLargeError) return json({ success: false, error: error.message }, { status: 413 });
      return json({ success: false, error: 'Send a JSON body' }, { status: 400 });
    }
    if (!body || typeof body !== 'object') return json({ success: false, error: 'Send a JSON object' }, { status: 400 });
    const { workflowDefinition, metadata, draftId } = body;

    if (!workflowDefinition || !metadata) {
      return json({ success: false, error: 'Missing workflowDefinition or metadata' }, { status: 400 });
    }

    if (!metadata.name) {
      return json({ success: false, error: 'Missing required metadata: name' }, { status: 400 });
    }

    // The creator is the signed-in user, never a name typed into the form
    const publishedWorkflow = await serverWorkflowService.publishWorkflow(workflowDefinition, {
      ...metadata,
      createdBy: locals.user?.email ?? 'unknown',
      ...(typeof draftId === 'string' && draftId ? { draftId } : {})
    });

    return json({
      success: true,
      workflow: publishedWorkflow
    });
  } catch (err) {
    // Detail stays in the server log; the client gets a generic message
    console.error('Error publishing workflow:', err);
    return json({ success: false, error: 'Failed to publish workflow' }, { status: 500 });
  }
};