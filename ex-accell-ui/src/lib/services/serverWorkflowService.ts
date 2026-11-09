// Server-side Workflow Service
// Handles workflow operations on the server with PostgreSQL persistence

import { hybridDaprWorkflowExecutor } from './hybridDaprWorkflowExecutor';
import { pythonDaprWorkflowGenerator, type GeneratedWorkflow } from './pythonDaprWorkflowGenerator';
import { postgresPool } from './postgres';

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

  /**
   * Map a database row from published_workflows to a PublishedWorkflow object
   */
  private mapRowToWorkflow(row: any): PublishedWorkflow {
    const definition = typeof row.workflow_definition === 'string'
      ? JSON.parse(row.workflow_definition)
      : row.workflow_definition;
    const generatedCode = typeof row.generated_code === 'string'
      ? JSON.parse(row.generated_code)
      : row.generated_code;
    const metadata = typeof row.metadata === 'string'
      ? JSON.parse(row.metadata)
      : row.metadata;

    return {
      id: row.id,
      name: row.name,
      description: row.description || '',
      version: row.version || '1.0.0',
      status: row.status || 'published',
      pattern: generatedCode?.workflowPattern || '',
      definition,
      generatedCode,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
      createdBy: row.created_by || '',
      tags: metadata?.tags || [],
      metadata: {
        stepCount: metadata?.stepCount || 0,
        estimatedDuration: metadata?.estimatedDuration || 0,
        datasetRequirements: metadata?.datasetRequirements || []
      }
    };
  }

  /**
   * Map a database row from workflow_executions to a WorkflowExecution object
   */
  private mapRowToExecution(row: any): WorkflowExecution {
    const input = typeof row.input === 'string' ? JSON.parse(row.input) : row.input;
    const output = typeof row.output === 'string' ? JSON.parse(row.output) : row.output;
    const logs = typeof row.logs === 'string' ? JSON.parse(row.logs) : row.logs;

    return {
      id: row.id,
      workflowId: row.workflow_id,
      workflowName: row.workflow_name || '',
      status: row.status || 'queued',
      progress: row.progress || 0,
      currentStep: row.current_step || '',
      startedAt: row.started_at instanceof Date ? row.started_at.toISOString() : (row.started_at || row.created_at),
      completedAt: row.completed_at instanceof Date ? row.completed_at.toISOString() : row.completed_at,
      duration: row.duration,
      input: input || {},
      output: output || undefined,
      error: row.error || undefined,
      logs: logs || [],
      metadata: {
        triggeredBy: row.triggered_by || 'manual',
        priority: row.priority || 'medium',
        retryCount: row.retry_count || 0,
        maxRetries: row.max_retries || 3
      }
    };
  }

  /**
   * Save a workflow as a draft. Drafts skip code generation, so a half-built workflow can be saved and
   * reopened. Passing the id of an existing draft updates it; a published workflow is never overwritten,
   * so saving over one creates a new draft instead.
   */
  async saveDraft(
    workflowDefinition: any,
    metadata: { name: string; description: string; createdBy: string },
    existingId?: string
  ): Promise<{ id: string; name: string; status: 'draft'; updatedAt: string }> {
    try {
      const now = new Date().toISOString();
      const workflowMetadata = { stepCount: workflowDefinition.steps.length, tags: [] as string[] };

      if (existingId) {
        const found = await postgresPool.query('SELECT id, status FROM published_workflows WHERE id = $1', [existingId]);
        if (found[0]?.status === 'draft') {
          await postgresPool.query(
            `UPDATE published_workflows
             SET name = $1, description = $2, workflow_definition = $3, metadata = $4, updated_at = $5, status = 'draft'
             WHERE id = $6`,
            [metadata.name, metadata.description, JSON.stringify(workflowDefinition), JSON.stringify(workflowMetadata), now, existingId]
          );
          return { id: existingId, name: metadata.name, status: 'draft', updatedAt: now };
        }
      }

      const id = `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await postgresPool.query(
        `INSERT INTO published_workflows
          (id, name, description, version, status, workflow_definition, generated_code, metadata, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [id, metadata.name, metadata.description, '0.1.0', 'draft', JSON.stringify(workflowDefinition), JSON.stringify({}), JSON.stringify(workflowMetadata), metadata.createdBy, now, now]
      );
      return { id, name: metadata.name, status: 'draft', updatedAt: now };
    } catch (error) {
      console.error('Error saving workflow draft:', error);
      throw new Error(`Failed to save workflow draft: ${getErrorMessage(error)}`);
    }
  }

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
      // Keep a snapshot of the generated Python for display. Runs regenerate from the definition (they
      // do not execute this copy), and the generator's server-side paths are not worth storing or exposing.
      const { virtualEnvPath: _venv, activationScript: _activation, ...generatedCode } =
        await pythonDaprWorkflowGenerator.generatePythonDaprWorkflow(workflowDefinition);

      const id = `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();
      const version = metadata.version || '1.0.0';
      const tags = metadata.tags || [];
      const workflowMetadata = {
        stepCount: workflowDefinition.steps.length,
        estimatedDuration: this.estimateWorkflowDuration(workflowDefinition),
        datasetRequirements: this.extractDatasetRequirements(workflowDefinition),
        tags
      };

      await postgresPool.query(
        `INSERT INTO published_workflows
          (id, name, description, version, status, workflow_definition, generated_code, metadata, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          id,
          metadata.name,
          metadata.description,
          version,
          'published',
          JSON.stringify(workflowDefinition),
          JSON.stringify(generatedCode),
          JSON.stringify(workflowMetadata),
          metadata.createdBy,
          now,
          now
        ]
      );

      const publishedWorkflow: PublishedWorkflow = {
        id,
        name: metadata.name,
        description: metadata.description,
        version,
        status: 'published',
        pattern: generatedCode.workflowPattern,
        definition: workflowDefinition,
        generatedCode,
        createdAt: now,
        updatedAt: now,
        createdBy: metadata.createdBy,
        tags,
        metadata: {
          stepCount: workflowMetadata.stepCount,
          estimatedDuration: workflowMetadata.estimatedDuration,
          datasetRequirements: workflowMetadata.datasetRequirements
        }
      };

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
    try {
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (filters.status) {
        conditions.push(`status = $${paramIndex++}`);
        params.push(filters.status);
      }

      if (filters.search) {
        conditions.push(`(LOWER(name) LIKE $${paramIndex} OR LOWER(description) LIKE $${paramIndex})`);
        params.push(`%${filters.search.toLowerCase()}%`);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const sql = `SELECT * FROM published_workflows ${whereClause} ORDER BY updated_at DESC`;

      const rows = await postgresPool.query(sql, params);
      let workflows = rows.map((row: any) => this.mapRowToWorkflow(row));

      // Filter by pattern in-memory since it's derived from generated_code JSONB
      if (filters.pattern) {
        workflows = workflows.filter(w => w.pattern === filters.pattern);
      }

      return workflows;
    } catch (error) {
      console.error('Error fetching published workflows:', error);
      throw new Error(`Failed to fetch workflows: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get a specific workflow
   */
  async getPublishedWorkflow(workflowId: string): Promise<PublishedWorkflow | null> {
    try {
      const rows = await postgresPool.query(
        'SELECT * FROM published_workflows WHERE id = $1',
        [workflowId]
      );

      if (rows.length === 0) {
        return null;
      }

      return this.mapRowToWorkflow(rows[0]);
    } catch (error) {
      console.error('Error fetching workflow:', error);
      throw new Error(`Failed to fetch workflow: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Update a published workflow
   */
  async updateWorkflow(
    workflowId: string,
    updates: {
      name?: string;
      description?: string;
      status?: 'draft' | 'published' | 'archived';
      metadata?: Record<string, any>;
    }
  ): Promise<PublishedWorkflow | null> {
    try {
      const setClauses: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        setClauses.push(`name = $${paramIndex++}`);
        params.push(updates.name);
      }

      if (updates.description !== undefined) {
        setClauses.push(`description = $${paramIndex++}`);
        params.push(updates.description);
      }

      if (updates.status !== undefined) {
        setClauses.push(`status = $${paramIndex++}`);
        params.push(updates.status);
      }

      if (updates.metadata !== undefined) {
        setClauses.push(`metadata = $${paramIndex++}`);
        params.push(JSON.stringify(updates.metadata));
      }

      if (setClauses.length === 0) {
        return this.getPublishedWorkflow(workflowId);
      }

      setClauses.push(`updated_at = $${paramIndex++}`);
      params.push(new Date().toISOString());

      params.push(workflowId);
      const sql = `UPDATE published_workflows SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

      const rows = await postgresPool.query(sql, params);

      if (rows.length === 0) {
        return null;
      }

      return this.mapRowToWorkflow(rows[0]);
    } catch (error) {
      console.error('Error updating workflow:', error);
      throw new Error(`Failed to update workflow: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Delete a published workflow
   */
  async deleteWorkflow(workflowId: string): Promise<boolean> {
    try {
      const rows = await postgresPool.query(
        'DELETE FROM published_workflows WHERE id = $1 RETURNING id',
        [workflowId]
      );

      return rows.length > 0;
    } catch (error) {
      console.error('Error deleting workflow:', error);
      throw new Error(`Failed to delete workflow: ${getErrorMessage(error)}`);
    }
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
    const workflow = await this.getPublishedWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // Create execution record
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    const logs: WorkflowExecution['logs'] = [];

    try {
      await postgresPool.query(
        `INSERT INTO workflow_executions
          (id, workflow_id, status, input, logs, error, started_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          executionId,
          workflow.id,
          'queued',
          JSON.stringify(input),
          JSON.stringify(logs),
          null,
          now,
          now
        ]
      );
    } catch (error) {
      console.error('Error creating execution record:', error);
      throw new Error(`Failed to create execution record: ${getErrorMessage(error)}`);
    }

    const execution: WorkflowExecution = {
      id: executionId,
      workflowId: workflow.id,
      workflowName: workflow.name,
      status: 'queued',
      progress: 0,
      currentStep: '',
      startedAt: now,
      input,
      logs,
      metadata: {
        triggeredBy: options.triggeredBy || 'manual',
        priority: options.priority || 'medium',
        retryCount: 0,
        maxRetries: options.maxRetries || 3
      }
    };

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
    try {
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (filters.workflowId) {
        conditions.push(`e.workflow_id = $${paramIndex++}`);
        params.push(filters.workflowId);
      }

      if (filters.status) {
        conditions.push(`e.status = $${paramIndex++}`);
        params.push(filters.status);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limitClause = filters.limit ? `LIMIT $${paramIndex++}` : '';
      if (filters.limit) {
        params.push(filters.limit);
      }

      const sql = `SELECT e.*, w.name AS workflow_name FROM workflow_executions e LEFT JOIN published_workflows w ON w.id = e.workflow_id ${whereClause} ORDER BY e.started_at DESC ${limitClause}`;

      const rows = await postgresPool.query(sql, params);
      return rows.map((row: any) => this.mapRowToExecution(row));
    } catch (error) {
      console.error('Error fetching workflow executions:', error);
      throw new Error(`Failed to fetch executions: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get specific execution
   */
  async getWorkflowExecution(executionId: string): Promise<WorkflowExecution | null> {
    try {
      const rows = await postgresPool.query(
        'SELECT e.*, w.name AS workflow_name FROM workflow_executions e LEFT JOIN published_workflows w ON w.id = e.workflow_id WHERE e.id = $1',
        [executionId]
      );

      if (rows.length === 0) {
        return null;
      }

      return this.mapRowToExecution(rows[0]);
    } catch (error) {
      console.error('Error fetching execution:', error);
      throw new Error(`Failed to fetch execution: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Cancel workflow execution
   */
  async cancelWorkflowExecution(executionId: string): Promise<void> {
    const execution = await this.getWorkflowExecution(executionId);
    if (execution && (execution.status === 'queued' || execution.status === 'running')) {
      const now = new Date().toISOString();
      try {
        // Cancel in hybrid Dapr workflow runtime (JS SDK management)
        await hybridDaprWorkflowExecutor.cancelWorkflow(executionId);

        execution.status = 'cancelled';
        execution.completedAt = now;
        execution.logs.push({
          timestamp: now,
          level: 'info',
          message: 'Workflow execution cancelled by user via Dapr JS SDK'
        });

        await postgresPool.query(
          `UPDATE workflow_executions
           SET status = $1, completed_at = $2, logs = $3
           WHERE id = $4`,
          ['cancelled', now, JSON.stringify(execution.logs), executionId]
        );
      } catch (error) {
        console.error('Failed to cancel workflow in Dapr:', error);
        // Still mark as cancelled in database
        execution.status = 'cancelled';
        execution.completedAt = now;
        execution.error = `Cancellation error: ${getErrorMessage(error)}`;
        execution.logs.push({
          timestamp: now,
          level: 'warn',
          message: `Workflow marked as cancelled locally, Dapr cancellation failed: ${getErrorMessage(error)}`
        });

        await postgresPool.query(
          `UPDATE workflow_executions
           SET status = $1, completed_at = $2, error = $3, logs = $4
           WHERE id = $5`,
          ['cancelled', now, execution.error, JSON.stringify(execution.logs), executionId]
        ).catch(dbErr => console.error('Failed to update cancelled execution in DB:', dbErr));
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

      // Update execution status in database
      await postgresPool.query(
        `UPDATE workflow_executions
         SET status = $1, logs = $2
         WHERE id = $3`,
        ['running', JSON.stringify(execution.logs), execution.id]
      ).catch(err => console.error('Failed to update execution status to running:', err));

      // Execute using hybrid Dapr workflow executor
      await hybridDaprWorkflowExecutor.executeWorkflow(workflow, execution, execution.input);

      // Update completion status in database
      const completedAt = new Date().toISOString();
      await postgresPool.query(
        `UPDATE workflow_executions
         SET status = $1, output = $2, logs = $3, completed_at = $4
         WHERE id = $5`,
        [execution.status, JSON.stringify(execution.output || null), JSON.stringify(execution.logs), completedAt, execution.id]
      ).catch(err => console.error('Failed to update execution completion in DB:', err));

    } catch (error) {
      console.error(`Hybrid workflow execution ${execution.id} failed:`, error);
      const now = new Date().toISOString();
      execution.status = 'failed';
      execution.error = getErrorMessage(error);
      execution.completedAt = now;
      execution.logs.push({
        timestamp: now,
        level: 'error',
        message: `Hybrid workflow execution failed: ${getErrorMessage(error)}`
      });

      await postgresPool.query(
        `UPDATE workflow_executions
         SET status = $1, error = $2, logs = $3, completed_at = $4
         WHERE id = $5`,
        ['failed', execution.error, JSON.stringify(execution.logs), now, execution.id]
      ).catch(dbErr => console.error('Failed to update failed execution in DB:', dbErr));
    }
  }

  private estimateWorkflowDuration(workflowDefinition: any): number {
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
export const serverWorkflowService = new ServerWorkflowService();