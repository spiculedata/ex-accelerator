// Test Python-based Dapr Workflow API
// For testing the new Python + Dapr workflow execution system

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { serverWorkflowService } from '$lib/services/serverWorkflowService';

/**
 * POST /api/test-python-workflow
 * Test Python-based Dapr workflow execution with comprehensive data processing
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    // Create a comprehensive test workflow that showcases Python capabilities
    const testPythonWorkflowDefinition = {
      name: 'Python Data Processing Workflow',
      description: 'Comprehensive Python-based workflow with text processing, sentiment analysis, and topic modeling',
      steps: [
        {
          id: 'input_1',
          type: 'dataset_input',
          name: 'Load Dataset',
          description: 'Load social media posts for analysis',
          position: { x: 100, y: 100 },
          config: { dataset_id: 'social_posts' },
          inputs: [],
          outputs: [{ name: 'data', type: 'dataset' }]
        },
        {
          id: 'preprocess_1',
          type: 'text_preprocessing',
          name: 'Clean Text Data',
          description: 'Preprocess and clean text data for analysis',
          position: { x: 300, y: 100 },
          config: { 
            text_columns: ['content', 'title'],
            lowercase: true,
            remove_punctuation: true,
            remove_stopwords: true
          },
          inputs: [{ name: 'data', type: 'dataset' }],
          outputs: [{ name: 'clean_data', type: 'dataset' }]
        },
        {
          id: 'sentiment_1',
          type: 'sentiment_analysis',
          name: 'Sentiment Analysis',
          description: 'Analyze sentiment of processed text using TextBlob',
          position: { x: 500, y: 100 },
          config: { 
            text_column: 'processed_text',
            model: 'textblob',
            output_columns: ['sentiment', 'polarity', 'subjectivity']
          },
          inputs: [{ name: 'clean_data', type: 'dataset' }],
          outputs: [{ name: 'sentiment_data', type: 'dataset' }]
        },
        {
          id: 'topics_1',
          type: 'topic_modeling',
          name: 'Topic Discovery',
          description: 'Discover topics using TF-IDF and K-Means clustering',
          position: { x: 300, y: 300 },
          config: {
            text_column: 'processed_text',
            num_topics: 5,
            method: 'tfidf_kmeans',
            max_features: 1000
          },
          inputs: [{ name: 'clean_data', type: 'dataset' }],
          outputs: [{ name: 'topic_data', type: 'dataset' }]
        },
        {
          id: 'cluster_1',
          type: 'clustering',
          name: 'Data Clustering',
          description: 'Cluster data points based on features',
          position: { x: 700, y: 200 },
          config: {
            features: ['polarity', 'subjectivity'],
            algorithm: 'kmeans',
            n_clusters: 3
          },
          inputs: [{ name: 'sentiment_data', type: 'dataset' }],
          outputs: [{ name: 'clustered_data', type: 'dataset' }]
        },
        {
          id: 'output_1',
          type: 'dataset_output',
          name: 'Save Results',
          description: 'Save processed results to output dataset',
          position: { x: 900, y: 200 },
          config: { output_name: 'python_workflow_results' },
          inputs: [{ name: 'clustered_data', type: 'dataset' }],
          outputs: []
        }
      ],
      connections: [
        { id: 'conn_1', from: 'input_1', to: 'preprocess_1', fromPort: 0, toPort: 0 },
        { id: 'conn_2', from: 'preprocess_1', to: 'sentiment_1', fromPort: 0, toPort: 0 },
        { id: 'conn_3', from: 'preprocess_1', to: 'topics_1', fromPort: 0, toPort: 0 },
        { id: 'conn_4', from: 'sentiment_1', to: 'cluster_1', fromPort: 0, toPort: 0 },
        { id: 'conn_5', from: 'cluster_1', to: 'output_1', fromPort: 0, toPort: 0 }
      ]
    };

    // Publish the Python-based workflow
    const publishedWorkflow = await serverWorkflowService.publishWorkflow(
      testPythonWorkflowDefinition,
      {
        name: 'Python Data Processing Workflow',
        description: 'Advanced Python-based workflow with ML and NLP capabilities',
        version: '1.0.0',
        tags: ['python', 'ml', 'nlp', 'data-processing', 'test'],
        createdBy: 'python-test-system'
      }
    );

    // Execute the Python workflow with comprehensive input
    const execution = await serverWorkflowService.executeWorkflow(
      publishedWorkflow.id,
      {
        dataset: 'social_posts',
        parameters: {
          text_column: 'content',
          analysis_type: 'comprehensive',
          enable_topic_modeling: true,
          enable_clustering: true,
          sentiment_model: 'textblob'
        },
        python_config: {
          use_virtual_env: true,
          pip_requirements: [
            'pandas>=2.0.0',
            'numpy>=1.24.0',
            'scikit-learn>=1.3.0',
            'textblob>=0.17.1',
            'nltk>=3.8.1'
          ]
        }
      },
      {
        priority: 'high',
        triggeredBy: 'api',
        maxRetries: 2
      }
    );

    return json({
      success: true,
      message: 'Python-based Dapr workflow execution started',
      workflow: {
        id: publishedWorkflow.id,
        name: publishedWorkflow.name,
        pattern: publishedWorkflow.pattern,
        stepCount: publishedWorkflow.metadata.stepCount
      },
      execution: {
        id: execution.id,
        status: execution.status,
        startedAt: execution.startedAt,
        currentStep: execution.currentStep
      },
      pythonFeatures: {
        virtualEnvironment: true,
        daprIntegration: true,
        mlLibraries: ['scikit-learn', 'pandas', 'numpy'],
        nlpLibraries: ['textblob', 'nltk'],
        workflowPattern: 'python-activity-sequence'
      }
    });

  } catch (err) {
    console.error('Error testing Python-based workflow execution:', err);
    return error(500, `Failed to test Python workflow execution: ${err instanceof Error ? err.message : String(err)}`);
  }
};

/**
 * GET /api/test-python-workflow
 * Get status of Python-based workflow executions
 */
export const GET: RequestHandler = async () => {
  try {
    const executions = await serverWorkflowService.getWorkflowExecutions({
      limit: 10
    });

    const pythonExecutions = executions.filter(e => 
      e.workflowName.includes('Python') || 
      e.logs.some(log => log.message.includes('Python'))
    );

    return json({
      success: true,
      pythonExecutions: pythonExecutions.map(e => ({
        id: e.id,
        workflowName: e.workflowName,
        status: e.status,
        progress: e.progress,
        currentStep: e.currentStep,
        startedAt: e.startedAt,
        completedAt: e.completedAt,
        duration: e.duration,
        logs: e.logs.slice(-5), // Last 5 log entries
        output: e.output ? {
          success: e.output.success,
          processedRecords: e.output.processed_records || e.output.processedRecords,
          workflowResults: e.output.results ? Object.keys(e.output.results).length : 0,
          executionSummary: e.output.execution_summary || null
        } : null
      }))
    });

  } catch (err) {
    console.error('Error getting Python workflow status:', err);
    return error(500, `Failed to get Python workflow status: ${err instanceof Error ? err.message : String(err)}`);
  }
};