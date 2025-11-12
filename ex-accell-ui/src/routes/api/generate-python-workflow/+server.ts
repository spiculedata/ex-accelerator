// Server-side Python Workflow Generation API
// Handles Python workflow code generation on the server

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pythonDaprWorkflowGenerator } from '$lib/services/pythonDaprWorkflowGenerator';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { workflowDefinition } = await request.json();
    
    if (!workflowDefinition) {
      return error(400, 'Workflow definition is required');
    }

    // Generate Python-based Dapr workflow on the server
    const pythonWorkflow = await pythonDaprWorkflowGenerator.generatePythonDaprWorkflow(workflowDefinition);
    
    return json({
      success: true,
      pythonWorkflow: {
        pythonScript: pythonWorkflow.pythonScript,
        requirements: pythonWorkflow.requirements,
        workflowCode: pythonWorkflow.workflowCode,
        activityCode: pythonWorkflow.activityCode,
        appCode: pythonWorkflow.appCode,
        workflowPattern: pythonWorkflow.workflowPattern,
        executionOrder: pythonWorkflow.executionOrder,
        workflowName: pythonWorkflow.workflowName
      }
    });

  } catch (err) {
    console.error('Error generating Python workflow:', err);
    return error(500, `Failed to generate Python workflow: ${err instanceof Error ? err.message : String(err)}`);
  }
};