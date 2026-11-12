// Workflow Execution Management API
// Handles pause, resume, status, and purge operations for workflow executions

import type { RequestHandler } from './$types';
import { apiFail, apiOk, apiServerError, readJsonObject } from '$lib/server/apiResponse';
import { hybridDaprWorkflowExecutor } from '$lib/services/hybridDaprWorkflowExecutor';
import { serverWorkflowService } from '$lib/services/serverWorkflowService';

const MAX_MANAGE_BODY_BYTES = 16 * 1024;
const ACTIONS = ['pause', 'resume', 'purge', 'status'] as const;
type ManageAction = (typeof ACTIONS)[number];

const isAction = (value: unknown): value is ManageAction => ACTIONS.includes(value as ManageAction);

/**
 * POST /api/workflow-executions/[id]/manage
 * Manage workflow execution (pause, resume, purge, status)
 */
export const POST: RequestHandler = async ({ params, request }) => {
  const parsed = await readJsonObject(request, MAX_MANAGE_BODY_BYTES);
  if ('failure' in parsed) return parsed.failure;
  const { action } = parsed.body;
  if (!isAction(action)) return apiFail(`Invalid action. Supported actions: ${ACTIONS.join(', ')}`, 400);

  const { id } = params;
  try {
    const execution = await serverWorkflowService.getWorkflowExecution(id);
    if (!execution) return apiFail('Execution not found', 404);

    let result: Record<string, unknown>;
    if (action === 'pause') {
      await hybridDaprWorkflowExecutor.pauseWorkflow(id);
      result = { message: 'Workflow paused successfully' };
    } else if (action === 'resume') {
      await hybridDaprWorkflowExecutor.resumeWorkflow(id);
      result = { message: 'Workflow resumed successfully' };
    } else if (action === 'purge') {
      await hybridDaprWorkflowExecutor.purgeWorkflow(id);
      result = { message: 'Workflow purged successfully' };
    } else {
      result = { status: await hybridDaprWorkflowExecutor.getWorkflowStatus(id) };
    }

    return apiOk(result, { action, executionId: id, ...result });
  } catch (err) {
    return apiServerError(`POST /api/workflow-executions/[id]/manage (${action})`, err, `Failed to ${action} workflow`);
  }
};

/**
 * GET /api/workflow-executions/[id]/manage?action=status
 * Get detailed workflow execution status from Dapr
 */
export const GET: RequestHandler = async ({ params, url }) => {
  if (url.searchParams.get('action') !== 'status') return apiFail('Only status action is supported for GET requests', 400);

  const { id } = params;
  try {
    const execution = await serverWorkflowService.getWorkflowExecution(id);
    if (!execution) return apiFail('Execution not found', 404);

    const daprStatus = await hybridDaprWorkflowExecutor.getWorkflowStatus(id);
    return apiOk({ localExecution: execution, daprStatus }, { executionId: id, localExecution: execution, daprStatus });
  } catch (err) {
    return apiServerError('GET /api/workflow-executions/[id]/manage', err, 'Failed to get workflow status');
  }
};
