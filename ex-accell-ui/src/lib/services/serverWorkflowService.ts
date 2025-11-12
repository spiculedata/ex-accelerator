// Server-side Workflow Service
// Handles workflow operations on the server without fetch dependencies

import { daprWorkflowGenerator, type GeneratedWorkflow } from './daprWorkflowGenerator';
import { daprWorkflowExecutor } from './daprWorkflowExecutor';
import { hybridDaprWorkflowExecutor } from './hybridDaprWorkflowExecutor';
import { pythonDaprWorkflowGenerator } from './pythonDaprWorkflowGenerator';

/**
 * Helper function to safely extract error messages
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export interface PublishedWorkflow {
  id: string;
  name: string;
  description: string;
  version: string;
  status: 'draft' | 'published' | 'archived';
  pattern: string;
  definition: any;
  generatedCode: GeneratedWorkflow;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  tags: string[];
  metadata: {
    stepCount: number;
    estimatedDuration: number;
    datasetRequirements: string[];
  };
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  currentStep: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  input: any;
  output?: any;
  error?: string;
  logs: Array<{
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    stepId?: string;
    stepName?: string;
    data?: any;
  }>;
  metadata: {
    triggeredBy: 'manual' | 'scheduled' | 'api';
    priority: 'low' | 'medium' | 'high';
    retryCount: number;
    maxRetries: number;
  };
}

class ServerWorkflowService {
  // In-memory storage for demo purposes
  // In production, this would use a proper database
  private workflows = new Map<string, PublishedWorkflow>();
  private executions = new Map<string, WorkflowExecution>();

  /**
   * Publish a workflow
   */
  async publishWorkflow(
    workflowDefinition: any,
    metadata: {
      name: string;
      description: string;
      version?: string;
      tags?: string[];
      createdBy: string;
    }
  ): Promise<PublishedWorkflow> {
    try {
      // Generate Dapr workflow code
      const generatedCode = daprWorkflowGenerator.generateWorkflowCode(workflowDefinition);
      
      // Create published workflow record
      const publishedWorkflow: PublishedWorkflow = {
        id: `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: metadata.name,
        description: metadata.description,
        version: metadata.version || '1.0.0',
        status: 'published',
        pattern: generatedCode.workflowPattern,
        definition: workflowDefinition,
        generatedCode,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: metadata.createdBy,
        tags: metadata.tags || [],
        metadata: {
          stepCount: workflowDefinition.steps.length,
          estimatedDuration: this.estimateWorkflowDuration(workflowDefinition),
          datasetRequirements: this.extractDatasetRequirements(workflowDefinition)
        }
      };

      // Store in memory
      this.workflows.set(publishedWorkflow.id, publishedWorkflow);

      console.log(`Workflow "${publishedWorkflow.name}" published with ID: ${publishedWorkflow.id}`);
      return publishedWorkflow;
    } catch (error) {
      console.error('Error publishing workflow:', error);
      throw new Error(`Failed to publish workflow: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get all published workflows
   */
  async getPublishedWorkflows(filters: {
    status?: string;
    pattern?: string;
    search?: string;
  } = {}): Promise<PublishedWorkflow[]> {
    let workflows = Array.from(this.workflows.values());

    if (filters.status) {
      workflows = workflows.filter(w => w.status === filters.status);
    }

    if (filters.pattern) {
      workflows = workflows.filter(w => w.pattern === filters.pattern);
    }

    if (filters.search) {
      const search = filters.search.toLowerCase();
      workflows = workflows.filter(w => 
        w.name.toLowerCase().includes(search) || 
        w.description.toLowerCase().includes(search)
      );
    }

    return workflows.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  /**
   * Get a specific workflow
   */
  async getPublishedWorkflow(workflowId: string): Promise<PublishedWorkflow | null> {
    return this.workflows.get(workflowId) || null;
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(
    workflowId: string,
    input: any,
    options: {
      priority?: 'low' | 'medium' | 'high';
      triggeredBy?: 'manual' | 'scheduled' | 'api';
      maxRetries?: number;
    } = {}
  ): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // Create execution record
    const execution: WorkflowExecution = {
      id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      workflowId: workflow.id,
      workflowName: workflow.name,
      status: 'queued',
      progress: 0,
      currentStep: '',
      startedAt: new Date().toISOString(),
      input,
      logs: [],
      metadata: {
        triggeredBy: options.triggeredBy || 'manual',
        priority: options.priority || 'medium',
        retryCount: 0,
        maxRetries: options.maxRetries || 3
      }
    };

    // Store execution
    this.executions.set(execution.id, execution);

    // Start real workflow execution using Dapr
    this.executeRealWorkflow(execution, workflow);

    return execution;
  }

  /**
   * Get workflow executions
   */
  async getWorkflowExecutions(filters: {
    workflowId?: string;
    status?: string;
    limit?: number;
  } = {}): Promise<WorkflowExecution[]> {
    let executions = Array.from(this.executions.values());

    if (filters.workflowId) {
      executions = executions.filter(e => e.workflowId === filters.workflowId);
    }

    if (filters.status) {
      executions = executions.filter(e => e.status === filters.status);
    }

    executions = executions.sort((a, b) => 
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );

    if (filters.limit) {
      executions = executions.slice(0, filters.limit);
    }

    return executions;
  }

  /**
   * Get specific execution
   */
  async getWorkflowExecution(executionId: string): Promise<WorkflowExecution | null> {
    return this.executions.get(executionId) || null;
  }

  /**
   * Cancel workflow execution
   */
  async cancelWorkflowExecution(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (execution && (execution.status === 'queued' || execution.status === 'running')) {
      try {
        // Cancel in hybrid Dapr workflow runtime (JS SDK management)
        await hybridDaprWorkflowExecutor.cancelWorkflow(executionId);
        
        execution.status = 'cancelled';
        execution.completedAt = new Date().toISOString();
        execution.logs.push({
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'Workflow execution cancelled by user via Dapr JS SDK'
        });
        this.executions.set(executionId, execution);
      } catch (error) {
        console.error('Failed to cancel workflow in Dapr:', error);
        // Still mark as cancelled locally
        execution.status = 'cancelled';
        execution.completedAt = new Date().toISOString();
        execution.error = `Cancellation error: ${getErrorMessage(error)}`;
        execution.logs.push({
          timestamp: new Date().toISOString(),
          level: 'warn',
          message: `Workflow marked as cancelled locally, Dapr cancellation failed: ${getErrorMessage(error)}`
        });
        this.executions.set(executionId, execution);
      }
    }
  }

  /**
   * Execute real workflow using hybrid approach (Python registration + JS SDK execution)
   */
  private async executeRealWorkflow(execution: WorkflowExecution, workflow: PublishedWorkflow): Promise<void> {
    try {
      execution.status = 'running';
      execution.currentStep = 'Initializing hybrid Dapr workflow';
      execution.logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Starting hybrid Dapr workflow execution: ${workflow.name} (Python registration + JS SDK execution)`
      });

      // Update execution in storage
      this.executions.set(execution.id, execution);

      // Execute using hybrid Dapr workflow executor
      await hybridDaprWorkflowExecutor.executeWorkflow(workflow, execution, execution.input);

      // The hybridDaprWorkflowExecutor will update the execution status during monitoring
      
    } catch (error) {
      console.error(`Hybrid workflow execution ${execution.id} failed:`, error);
      execution.status = 'failed';
      execution.error = getErrorMessage(error);
      execution.completedAt = new Date().toISOString();
      execution.logs.push({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `Hybrid workflow execution failed: ${getErrorMessage(error)}`
      });
      this.executions.set(execution.id, execution);
    }
  }

  private estimateWorkflowDuration(workflowDefinition: any): number {
    const steps = workflowDefinition.steps;
    let estimatedSeconds = 0;
    
    steps.forEach(step => {
      switch (step.type) {
        case 'dataset_input':
        case 'dataset_output':
          estimatedSeconds += 5;
          break;
        case 'text_preprocessing':
        case 'sentiment_analysis':
        case 'topic_modeling':
          estimatedSeconds += 30;
          break;
        case 'clustering':
        case 'feature_extraction':
          estimatedSeconds += 45;
          break;
        default:
          estimatedSeconds += 15;
      }
    });
    
    return estimatedSeconds;
  }

  private extractDatasetRequirements(workflowDefinition: any): string[] {
    const requirements: string[] = [];

    workflowDefinition.steps.forEach((step: any) => {
      if (step.type === 'dataset_input' && step.config.dataset_id) {
        requirements.push(step.config.dataset_id);
      }
    });

    return requirements;
  }
}

// Export singleton instance
export const serverWorkflowService = new ServerWorkflowService();