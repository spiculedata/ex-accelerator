// Workflow Execution API
// Handles executing workflows and managing executions

import type { RequestHandler } from './$types';
import { apiFail, apiOk, apiServerError, readJsonObject } from '$lib/server/apiResponse';
import { serverWorkflowService } from '$lib/services/serverWorkflowService';

const MAX_EXECUTE_BODY_BYTES = 1024 * 1024;
const MAX_LIST_LIMIT = 500;

/**
 * POST /api/workflows/[id]/execute
 * Execute a published workflow with the given input
 */
export const POST: RequestHandler = async ({ params, request }) => {
  const parsed = await readJsonObject(request, MAX_EXECUTE_BODY_BYTES);
  if ('failure' in parsed) return parsed.failure;
  const { input, options = {} } = parsed.body as { input?: unknown; options?: Record<string, unknown> };
  if (typeof options !== 'object' || options === null || Array.isArray(options)) return apiFail('options must be an object', 400);

  try {
    const workflow = await serverWorkflowService.getPublishedWorkflow(params.id);
    if (!workflow) return apiFail('Workflow not found', 404);
    if (workflow.status !== 'published') return apiFail('Only published workflows can be run: publish it first.', 409);

    const execution = await serverWorkflowService.executeWorkflow(params.id, input, options);
    return apiOk(execution, { execution });
  } catch (err) {
    return apiServerError('POST /api/workflows/[id]/execute', err, 'Failed to execute workflow');
  }
};

/**
 * GET /api/workflows/[id]/execute
 * Get executions for a specific workflow
 */
export const GET: RequestHandler = async ({ params, url }) => {
  const rawLimit = url.searchParams.get('limit');
  const limit = rawLimit === null ? undefined : Number(rawLimit);
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIST_LIMIT)) {
    return apiFail(`limit must be a whole number from 1 to ${MAX_LIST_LIMIT}`, 400);
  }

  try {
    const executions = await serverWorkflowService.getWorkflowExecutions({
      workflowId: params.id,
      status: url.searchParams.get('status') || undefined,
      limit
    });
    return apiOk(executions, { executions, count: executions.length });
  } catch (err) {
    return apiServerError('GET /api/workflows/[id]/execute', err, 'Failed to get workflow executions');
  }
};
