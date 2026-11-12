// Individual Workflow Execution API
// Handles operations on specific workflow executions

import type { RequestHandler } from './$types';
import { apiFail, apiOk, apiServerError } from '$lib/server/apiResponse';
import { toPublicDaprStatus, toPublicExecution } from '$lib/server/workflowExecutionView';
import { serverWorkflowService } from '$lib/services/serverWorkflowService';

/**
 * GET /api/workflow-executions/[id]
 * Get a specific workflow execution by ID
 */
export const GET: RequestHandler = async ({ params }) => {
  try {
    const execution = await serverWorkflowService.getWorkflowExecution(params.id);
    if (!execution) return apiFail('Workflow execution not found', 404);

    const view = toPublicExecution(execution);
    return apiOk(view, { execution: view });
  } catch (err) {
    return apiServerError('GET /api/workflow-executions/[id]', err, 'Failed to get workflow execution');
  }
};

/**
 * DELETE /api/workflow-executions/[id]
 * Cancel a running workflow execution
 */
export const DELETE: RequestHandler = async ({ params }) => {
  try {
    const execution = await serverWorkflowService.getWorkflowExecution(params.id);
    if (!execution) return apiFail('Workflow execution not found', 404);

    await serverWorkflowService.cancelWorkflowExecution(params.id);
    return apiOk(null, { message: 'Workflow execution cancelled' });
  } catch (err) {
    return apiServerError('DELETE /api/workflow-executions/[id]', err, 'Failed to cancel workflow execution');
  }
};
