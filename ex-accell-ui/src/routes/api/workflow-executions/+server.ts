// Workflow Executions API
// Handles querying and managing workflow executions

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { serverWorkflowService } from '$lib/services/serverWorkflowService';

/**
 * GET /api/workflow-executions
 * Get all workflow executions with optional filters
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    const workflowId = url.searchParams.get('workflowId') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined;

    const executions = await serverWorkflowService.getWorkflowExecutions({
      workflowId,
      status,
      limit
    });

    return json({
      success: true,
      executions,
      count: executions.length
    });
  } catch (err) {
    console.error('Error getting workflow executions:', err);
    return error(500, 'Failed to get workflow executions');
  }
};