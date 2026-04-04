// Workflow Execution API
// Handles executing workflows and managing executions

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { serverWorkflowService } from '$lib/services/serverWorkflowService';

/**
 * POST /api/workflows/[id]/execute
 * Execute a workflow with given input
 */
export const POST: RequestHandler = async ({ params, request }) => {
  try {
    const { id } = params;
    const body = await request.json();
    const { input, options = {} } = body;

    // Execute the workflow
    const execution = await serverWorkflowService.executeWorkflow(id, input, options);

    return json({
      success: true,
      execution
    });
  } catch (err: any) {
    console.error('Error executing workflow:', err);
    return error(500, `Failed to execute workflow: ${err.message}`);
  }
};

/**
 * GET /api/workflows/[id]/execute
 * Get executions for a specific workflow
 */
export const GET: RequestHandler = async ({ params, url }) => {
  try {
    const { id } = params;
    const status = url.searchParams.get('status') || undefined;
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined;

    const executions = await serverWorkflowService.getWorkflowExecutions({
      workflowId: id,
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