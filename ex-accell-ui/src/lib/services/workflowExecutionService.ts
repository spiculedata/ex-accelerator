// Workflow Execution Service
// Handles publishing, running, and monitoring workflows within the webapp
// Integrates with Dapr workflow runtime and unified database

import { unifiedDb } from './duckdb';
import { daprWorkflowGenerator, type GeneratedWorkflow } from './daprWorkflowGenerator';
import { databaseInit } from './databaseInit';

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
  definition: any; // Original workflow definition
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
  logs: WorkflowLog[];
  metadata: {
    triggeredBy: 'manual' | 'scheduled' | 'api';
    priority: 'low' | 'medium' | 'high';
    retryCount: number;
    maxRetries: number;
  };
}

export interface WorkflowLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  stepId?: string;
  stepName?: string;
  data?: any;
}

export interface WorkflowSchedule {
  id: string;
  workflowId: string;
  name: string;
  schedule: string; // Cron expression
  enabled: boolean;
  nextRun: string;
  lastRun?: string;
  timezone: string;
  input: any;
  createdAt: string;
  updatedAt: string;
}

class WorkflowExecutionService {
  private daprHost = '127.0.0.1'; // Default for client-side
  private daprPort = '3500'; // Default Dapr HTTP port
  private baseUrl = `http://${this.daprHost}:${this.daprPort}`;

  /**
   * Publish a workflow to make it available for execution
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
      // Initialize database tables if needed
      await databaseInit.initializeWorkflowTables();
      
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

      // Save to unified database
      await unifiedDb.connect();
      await unifiedDb.query(`
        INSERT INTO published_workflows (
          id, name, description, version, status, pattern, definition, 
          generated_code, created_at, updated_at, created_by, tags, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        publishedWorkflow.id,
        publishedWorkflow.name,
        publishedWorkflow.description,
        publishedWorkflow.version,
        publishedWorkflow.status,
        publishedWorkflow.pattern,
        JSON.stringify(publishedWorkflow.definition),
        JSON.stringify(publishedWorkflow.generatedCode),
        publishedWorkflow.createdAt,
        publishedWorkflow.updatedAt,
        publishedWorkflow.createdBy,
        JSON.stringify(publishedWorkflow.tags),
        JSON.stringify(publishedWorkflow.metadata)
      ]);

      // Register workflow with Dapr runtime (if available)
      await this.registerWorkflowWithDapr(publishedWorkflow);

      return publishedWorkflow;
    } catch (error) {
      console.error('Error publishing workflow:', error);
      throw new Error(`Failed to publish workflow: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Execute a published workflow
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
    try {
      // Get published workflow
      const workflow = await this.getPublishedWorkflow(workflowId);
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

      // Save execution record
      await this.saveWorkflowExecution(execution);

      // Start workflow execution
      await this.startWorkflowExecution(execution, workflow);

      return execution;
    } catch (error) {
      console.error('Error executing workflow:', error);
      throw new Error(`Failed to execute workflow: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get all published workflows
   */
  async getPublishedWorkflows(filters: {
    status?: string;
    pattern?: string;
    tags?: string[];
    search?: string;
  } = {}): Promise<PublishedWorkflow[]> {
    try {
      await unifiedDb.connect();
      
      let query = 'SELECT * FROM published_workflows WHERE 1=1';
      const params: any[] = [];

      if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }

      if (filters.pattern) {
        query += ' AND pattern = ?';
        params.push(filters.pattern);
      }

      if (filters.search) {
        query += ' AND (name LIKE ? OR description LIKE ?)';
        params.push(`%${filters.search}%`, `%${filters.search}%`);
      }

      query += ' ORDER BY updated_at DESC';

      const results = await unifiedDb.query(query, params);
      
      return results.map(row => ({
        ...row,
        definition: JSON.parse(row.definition),
        generatedCode: JSON.parse(row.generated_code),
        tags: JSON.parse(row.tags),
        metadata: JSON.parse(row.metadata)
      })) as PublishedWorkflow[];
    } catch (error) {
      console.error('Error getting published workflows:', error);
      return [];
    }
  }

  /**
   * Get a specific published workflow
   */
  async getPublishedWorkflow(workflowId: string): Promise<PublishedWorkflow | null> {
    try {
      await unifiedDb.connect();
      const results = await unifiedDb.query(
        'SELECT * FROM published_workflows WHERE id = ?',
        [workflowId]
      );

      if (results.length === 0) return null;

      const row = results[0];
      return {
        ...row,
        definition: JSON.parse(row.definition),
        generatedCode: JSON.parse(row.generated_code),
        tags: JSON.parse(row.tags),
        metadata: JSON.parse(row.metadata)
      } as PublishedWorkflow;
    } catch (error) {
      console.error('Error getting workflow:', error);
      return null;
    }
  }

  /**
   * Get workflow executions
   */
  async getWorkflowExecutions(filters: {
    workflowId?: string;
    status?: string;
    limit?: number;
  } = {}): Promise<WorkflowExecution[]> {
    try {
      await unifiedDb.connect();
      
      let query = 'SELECT * FROM workflow_executions WHERE 1=1';
      const params: any[] = [];

      if (filters.workflowId) {
        query += ' AND workflow_id = ?';
        params.push(filters.workflowId);
      }

      if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }

      query += ' ORDER BY started_at DESC';

      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);
      }

      const results = await unifiedDb.query(query, params);
      
      return results.map(row => ({
        ...row,
        input: JSON.parse(row.input || '{}'),
        output: row.output ? JSON.parse(row.output) : undefined,
        logs: JSON.parse(row.logs || '[]'),
        metadata: JSON.parse(row.metadata)
      })) as WorkflowExecution[];
    } catch (error) {
      console.error('Error getting workflow executions:', error);
      return [];
    }
  }

  /**
   * Cancel a running workflow execution
   */
  async cancelWorkflowExecution(executionId: string): Promise<void> {
    try {
      // Update execution status
      await unifiedDb.connect();
      await unifiedDb.query(`
        UPDATE workflow_executions 
        SET status = 'cancelled', completed_at = ? 
        WHERE id = ?
      `, [new Date().toISOString(), executionId]);

      // Cancel with Dapr if running
      await this.cancelDaprWorkflow(executionId);
    } catch (error) {
      console.error('Error cancelling workflow execution:', error);
      throw error;
    }
  }

  /**
   * Create a workflow schedule
   */
  async createWorkflowSchedule(schedule: Omit<WorkflowSchedule, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkflowSchedule> {
    try {
      const newSchedule: WorkflowSchedule = {
        ...schedule,
        id: `sch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await unifiedDb.connect();
      await unifiedDb.query(`
        INSERT INTO workflow_schedules (
          id, workflow_id, name, schedule, enabled, next_run, 
          timezone, input, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        newSchedule.id,
        newSchedule.workflowId,
        newSchedule.name,
        newSchedule.schedule,
        newSchedule.enabled,
        newSchedule.nextRun,
        newSchedule.timezone,
        JSON.stringify(newSchedule.input),
        newSchedule.createdAt,
        newSchedule.updatedAt
      ]);

      return newSchedule;
    } catch (error) {
      console.error('Error creating workflow schedule:', error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async registerWorkflowWithDapr(workflow: PublishedWorkflow): Promise<void> {
    try {
      // This would register the workflow with the Dapr runtime
      // For now, we'll store the registration info in our database
      console.log(`Registering workflow ${workflow.name} with Dapr runtime`);
      
      // In a real implementation, you would:
      // 1. Deploy the generated code to a Dapr app
      // 2. Register the workflow and activities
      // 3. Start the workflow runtime
    } catch (error) {
      console.warn('Could not register workflow with Dapr:', getErrorMessage(error));
    }
  }

  private async startWorkflowExecution(execution: WorkflowExecution, workflow: PublishedWorkflow): Promise<void> {
    try {
      // Update status to running
      execution.status = 'running';
      execution.currentStep = 'Starting workflow';
      await this.saveWorkflowExecution(execution);

      // Simulate workflow execution for now
      // In a real implementation, this would trigger the Dapr workflow
      await this.simulateWorkflowExecution(execution, workflow);
    } catch (error) {
      execution.status = 'failed';
      execution.error = getErrorMessage(error);
      execution.completedAt = new Date().toISOString();
      await this.saveWorkflowExecution(execution);
      throw error;
    }
  }

  private async simulateWorkflowExecution(execution: WorkflowExecution, workflow: PublishedWorkflow): Promise<void> {
    // This simulates workflow execution for demo purposes
    // In production, this would interface with the actual Dapr workflow runtime
    
    const steps = workflow.definition.steps.filter((s: any) => s.type !== 'dataset_input' && s.type !== 'dataset_output');
    const totalSteps = steps.length;
    
    for (let i = 0; i < totalSteps; i++) {
      const step = steps[i];
      
      // Update progress
      execution.currentStep = step.name;
      execution.progress = Math.round(((i + 1) / totalSteps) * 100);
      
      // Add log entry
      execution.logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Executing step: ${step.name}`,
        stepId: step.id,
        stepName: step.name
      });
      
      await this.saveWorkflowExecution(execution);
      
      // Simulate processing time (deterministic per step based on index)
      await new Promise(resolve => setTimeout(resolve, 1500 + (i % 3) * 500));
    }
    
    // Complete execution
    execution.status = 'completed';
    execution.progress = 100;
    execution.currentStep = 'Completed';
    execution.completedAt = new Date().toISOString();
    execution.duration = new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime();
    execution.output = {
      processedRecords: totalSteps * 500,
      resultDataset: `result_${execution.id}`,
      summary: `Workflow ${workflow.name} completed successfully`
    };
    
    execution.logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Workflow completed successfully',
      data: execution.output
    });
    
    await this.saveWorkflowExecution(execution);
  }

  private async saveWorkflowExecution(execution: WorkflowExecution): Promise<void> {
    try {
      await unifiedDb.connect();
      
      // Upsert execution record
      await unifiedDb.query(`
        INSERT OR REPLACE INTO workflow_executions (
          id, workflow_id, workflow_name, status, progress, current_step,
          started_at, completed_at, duration, input, output, error, logs, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        execution.id,
        execution.workflowId,
        execution.workflowName,
        execution.status,
        execution.progress,
        execution.currentStep,
        execution.startedAt,
        execution.completedAt,
        execution.duration,
        JSON.stringify(execution.input),
        execution.output ? JSON.stringify(execution.output) : null,
        execution.error,
        JSON.stringify(execution.logs),
        JSON.stringify(execution.metadata)
      ]);
    } catch (error) {
      console.error('Error saving workflow execution:', error);
    }
  }

  private async cancelDaprWorkflow(executionId: string): Promise<void> {
    try {
      // This would cancel the workflow in Dapr
      console.log(`Cancelling Dapr workflow execution: ${executionId}`);
    } catch (error) {
      console.warn('Could not cancel Dapr workflow:', getErrorMessage(error));
    }
  }

  private estimateWorkflowDuration(workflowDefinition: any): number {
    // Rough estimation based on step types and complexity
    const steps = workflowDefinition.steps;
    let estimatedSeconds = 0;
    
    steps.forEach((step: any) => {
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
export const workflowExecutionService = new WorkflowExecutionService();