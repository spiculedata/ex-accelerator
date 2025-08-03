// Workflow Execution Management API
// Handles pause, resume, status, and purge operations for workflow executions

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hybridDaprWorkflowExecutor } from '$lib/services/hybridDaprWorkflowExecutor';
import { serverWorkflowService } from '$lib/services/serverWorkflowService';

/**
 * POST /api/workflow-executions/[id]/manage
 * Manage workflow execution (pause, resume, purge)
 */
export const POST: RequestHandler = async ({ params, request }) => {
  try {
    const { id } = params;
    const body = await request.json();
    const { action } = body;

    const execution = await serverWorkflowService.getWorkflowExecution(id);
    if (!execution) {
      return error(404, 'Execution not found');
    }

    let result: any = {};

    switch (action) {
      case 'pause':
        await hybridDaprWorkflowExecutor.pauseWorkflow(id);
        result = { message: 'Workflow paused successfully' };
        break;

      case 'resume':
        await hybridDaprWorkflowExecutor.resumeWorkflow(id);
        result = { message: 'Workflow resumed successfully' };
        break;

      case 'purge':
        await hybridDaprWorkflowExecutor.purgeWorkflow(id);
        result = { message: 'Workflow purged successfully' };
        break;

      case 'status':
        const status = await hybridDaprWorkflowExecutor.getWorkflowStatus(id);
        result = { status };
        break;

      default:
        return error(400, `Invalid action: ${action}. Supported actions: pause, resume, purge, status`);
    }

    return json({
      success: true,
      action,
      executionId: id,
      ...result
    });

  } catch (err) {
    console.error(`Error performing ${body?.action || 'unknown'} action on workflow execution:`, err);
    return error(500, `Failed to ${body?.action || 'manage'} workflow: ${err.message}`);
  }
};

/**
 * GET /api/workflow-executions/[id]/manage?action=status
 * Get detailed workflow execution status from Dapr
 */
export const GET: RequestHandler = async ({ params, url }) => {
  try {
    const { id } = params;
    const action = url.searchParams.get('action');

    if (action !== 'status') {
      return error(400, 'Only status action is supported for GET requests');
    }

    const execution = await serverWorkflowService.getWorkflowExecution(id);
    if (!execution) {
      return error(404, 'Execution not found');
    }

    const status = await hybridDaprWorkflowExecutor.getWorkflowStatus(id);

    return json({
      success: true,
      executionId: id,
      localExecution: execution,
      daprStatus: status
    });

  } catch (err) {
    console.error('Error getting workflow execution status:', err);
    return error(500, `Failed to get workflow status: ${err.message}`);
  }
};