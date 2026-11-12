// Server-side Python Workflow Generation API
// Handles Python workflow code generation on the server

import type { RequestHandler } from './$types';
import { apiFail, apiOk, apiServerError, readJsonObject } from '$lib/server/apiResponse';
import { pythonDaprWorkflowGenerator } from '$lib/services/pythonDaprWorkflowGenerator';

const MAX_WORKFLOW_BODY_BYTES = 1024 * 1024;

export const POST: RequestHandler = async ({ request }) => {
  const parsed = await readJsonObject(request, MAX_WORKFLOW_BODY_BYTES);
  if ('failure' in parsed) return parsed.failure;
  const { workflowDefinition } = parsed.body;
  if (!workflowDefinition) return apiFail('Workflow definition is required', 400);

  try {
    // Generate Python-based Dapr workflow on the server
    const generated = await pythonDaprWorkflowGenerator.generatePythonDaprWorkflow(workflowDefinition as never);
    const pythonWorkflow = {
      pythonScript: generated.pythonScript,
      requirements: generated.requirements,
      workflowCode: generated.workflowCode,
      activityCode: generated.activityCode,
      appCode: generated.appCode,
      workflowPattern: generated.workflowPattern,
      executionOrder: generated.executionOrder,
      workflowName: generated.workflowName
    };
    return apiOk(pythonWorkflow, { pythonWorkflow });
  } catch (err) {
    return apiServerError('POST /api/generate-python-workflow', err, 'Failed to generate Python workflow');
  }
};
