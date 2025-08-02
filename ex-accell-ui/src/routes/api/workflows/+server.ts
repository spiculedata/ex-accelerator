// Workflow Management API
// Handles publishing, executing, and managing workflows

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { serverWorkflowService } from '$lib/services/serverWorkflowService';

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
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { workflowDefinition, metadata } = body;

    if (!workflowDefinition || !metadata) {
      return error(400, 'Missing workflowDefinition or metadata');
    }

    if (!metadata.name || !metadata.createdBy) {
      return error(400, 'Missing required metadata: name, createdBy');
    }

    const publishedWorkflow = await serverWorkflowService.publishWorkflow(
      workflowDefinition,
      metadata
    );

    return json({
      success: true,
      workflow: publishedWorkflow
    });
  } catch (err) {
    console.error('Error publishing workflow:', err);
    return error(500, `Failed to publish workflow: ${err.message}`);
  }
};