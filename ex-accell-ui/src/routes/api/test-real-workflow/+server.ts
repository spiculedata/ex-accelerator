// Test Real Workflow Execution API
// For testing the real Dapr workflow execution system

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { serverWorkflowService } from '$lib/services/serverWorkflowService';

/**
 * POST /api/test-real-workflow
 * Test real workflow execution with a simple workflow
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    // Create a simple test workflow
    const testWorkflowDefinition = {
      name: 'Test Real Workflow',
      description: 'Simple test workflow for real execution',
      steps: [
        {
          id: 'input_1',
          type: 'dataset_input',
          name: 'Load Test Data',
          position: { x: 100, y: 100 },
          config: { dataset_id: 'test_data' },
          inputs: [],
          outputs: [{ name: 'data', type: 'dataset' }]
        },
        {
          id: 'preprocess_1',
          type: 'text_preprocessing',
          name: 'Preprocess Text',
          position: { x: 300, y: 100 },
          config: { text_columns: 'content' },
          inputs: [{ name: 'data', type: 'dataset' }],
          outputs: [{ name: 'clean_data', type: 'dataset' }]
        },
        {
          id: 'sentiment_1',
          type: 'sentiment_analysis',
          name: 'Analyze Sentiment',
          position: { x: 500, y: 100 },
          config: { text_column: 'content', model: 'vader' },
          inputs: [{ name: 'clean_data', type: 'dataset' }],
          outputs: [{ name: 'sentiment_data', type: 'dataset' }]
        },
        {
          id: 'output_1',
          type: 'dataset_output',
          name: 'Save Results',
          position: { x: 700, y: 100 },
          config: { output_name: 'sentiment_results' },
          inputs: [{ name: 'sentiment_data', type: 'dataset' }],
          outputs: []
        }
      ],
      connections: [
        { id: 'conn_1', from: 'input_1', to: 'preprocess_1', fromPort: 0, toPort: 0 },
        { id: 'conn_2', from: 'preprocess_1', to: 'sentiment_1', fromPort: 0, toPort: 0 },
        { id: 'conn_3', from: 'sentiment_1', to: 'output_1', fromPort: 0, toPort: 0 }
      ]
    };

    // Publish the test workflow
    const publishedWorkflow = await serverWorkflowService.publishWorkflow(
      testWorkflowDefinition,
      {
        name: 'Test Real Workflow',
        description: 'Automated test of real workflow execution',
        version: '1.0.0',
        tags: ['test', 'real-execution'],
        createdBy: 'test-system'
      }
    );

    // Execute the workflow
    const execution = await serverWorkflowService.executeWorkflow(
      publishedWorkflow.id,
      {
        dataset: 'test_data',
        parameters: {
          text_column: 'content',
          sentiment_model: 'vader'
        }
      },
      {
        priority: 'high',
        triggeredBy: 'api',
        maxRetries: 1
      }
    );

    return json({
      success: true,
      message: 'Test workflow execution started',
      workflow: {
        id: publishedWorkflow.id,
        name: publishedWorkflow.name
      },
      execution: {
        id: execution.id,
        status: execution.status,
        startedAt: execution.startedAt
      }
    });

  } catch (err) {
    console.error('Error testing real workflow execution:', err);
    return error(500, `Failed to test real workflow execution: ${err.message}`);
  }
};

/**
 * GET /api/test-real-workflow
 * Get status of test workflow executions
 */
export const GET: RequestHandler = async () => {
  try {
    const executions = await serverWorkflowService.getWorkflowExecutions({
      limit: 5
    });

    const testExecutions = executions.filter(e => 
      e.workflowName.includes('Test Real Workflow')
    );

    return json({
      success: true,
      testExecutions: testExecutions.map(e => ({
        id: e.id,
        workflowName: e.workflowName,
        status: e.status,
        progress: e.progress,
        startedAt: e.startedAt,
        completedAt: e.completedAt,
        logs: e.logs.slice(-3) // Last 3 log entries
      }))
    });

  } catch (err) {
    console.error('Error getting test workflow status:', err);
    return error(500, `Failed to get test workflow status: ${err.message}`);
  }
};