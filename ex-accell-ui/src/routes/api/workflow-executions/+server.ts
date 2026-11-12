// Workflow Executions API
// Handles querying and managing workflow executions

import type { RequestHandler } from './$types';
import { apiFail, apiOk, apiServerError } from '$lib/server/apiResponse';
import { serverWorkflowService } from '$lib/services/serverWorkflowService';

const MAX_LIST_LIMIT = 500;

/**
 * GET /api/workflow-executions
 * Get all workflow executions with optional filters
 */
export const GET: RequestHandler = async ({ url }) => {
  const rawLimit = url.searchParams.get('limit');
  const limit = rawLimit === null ? undefined : Number(rawLimit);
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIST_LIMIT)) {
    return apiFail(`limit must be a whole number from 1 to ${MAX_LIST_LIMIT}`, 400);
  }

  try {
    const executions = await serverWorkflowService.getWorkflowExecutions({
      workflowId: url.searchParams.get('workflowId') || undefined,
      status: url.searchParams.get('status') || undefined,
      limit
    });
    return apiOk(executions, { executions, count: executions.length });
  } catch (err) {
    return apiServerError('GET /api/workflow-executions', err, 'Failed to get workflow executions');
  }
};
