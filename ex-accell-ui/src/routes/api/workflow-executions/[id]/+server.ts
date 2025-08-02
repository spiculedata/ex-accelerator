// Individual Workflow Execution API
// Handles operations on specific workflow executions

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { serverWorkflowService } from '$lib/services/serverWorkflowService';

/**
 * GET /api/workflow-executions/[id]
 * Get a specific workflow execution by ID
 */
export const GET: RequestHandler = async ({ params }) => {
  try {
    const { id } = params;
    
    const execution = await serverWorkflowService.getWorkflowExecution(id);
    
    if (!execution) {
      return error(404, 'Workflow execution not found');
    }

    return json({
      success: true,
      execution
    });
  } catch (err) {
    console.error('Error getting workflow execution:', err);
    return error(500, 'Failed to get workflow execution');
  }
};

/**
 * DELETE /api/workflow-executions/[id]
 * Cancel a running workflow execution
 */
export const DELETE: RequestHandler = async ({ params }) => {
  try {
    const { id } = params;
    
    await serverWorkflowService.cancelWorkflowExecution(id);

    return json({
      success: true,
      message: 'Workflow execution cancelled'
    });
  } catch (err) {
    console.error('Error cancelling workflow execution:', err);
    return error(500, 'Failed to cancel workflow execution');
  }
};