// Python-based Dapr Workflow Execution Service
// Manages execution of Python workflows through Dapr runtime

import type { PublishedWorkflow, WorkflowExecution } from './serverWorkflowService';
import { pythonDaprWorkflowGenerator, type PythonDaprWorkflow } from './pythonDaprWorkflowGenerator';
import { DaprClient, CommunicationProtocolEnum } from '@dapr/dapr';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { access, writeFile } from 'fs/promises';
import { constants } from 'fs';

/**
 * Helper function to safely extract error messages
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

const execAsync = promisify(exec);
export interface PythonWorkflowDeployment {
  workflowId: string;
  pythonScriptPath: string;
  venvPath: string;
  generatedWorkflow: PythonDaprWorkflow;
}

export class PythonDaprWorkflowExecutor {
  private daprClient: DaprClient;
  private daprHttpPort = 3500;
  private deployments = new Map<string, PythonWorkflowDeployment>();

  constructor() {
    this.daprClient = new DaprClient({
      daprHost: 'localhost',
      daprPort: this.daprHttpPort.toString(),
      communicationProtocol: CommunicationProtocolEnum.HTTP
    });
  }

  /**
   * Execute Python-based Dapr workflow
   */
  async executeWorkflow(
    workflow: PublishedWorkflow, 
    execution: WorkflowExecution,
    input: any
  ): Promise<void> {
    try {
      execution.logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Starting Python-based Dapr workflow: ${workflow.name}`
      });

      // Generate and deploy Python workflow
      const deployment = await this.deployPythonWorkflow(workflow, execution);
      
      // Start Dapr workflow with Python integration
      await this.startPythonDaprWorkflow(workflow, execution, input, deployment);
      
    } catch (error) {
      console.error('Python Dapr workflow execution failed:', error);
      execution.status = 'failed';
      execution.error = getErrorMessage(error);
      execution.completedAt = new Date().toISOString();
      execution.logs.push({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `Python workflow execution failed: ${getErrorMessage(error)}`
      });
      throw error;
    }
  }

  /**
   * Deploy Python workflow with Dapr integration
   */
  private async deployPythonWorkflow(
    workflow: PublishedWorkflow, 
    execution: WorkflowExecution
  ): Promise<PythonWorkflowDeployment> {
    try {
      execution.logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Generating Python workflow with Dapr integration'
      });

      // Generate Python-based Dapr workflow
      const generatedWorkflow = await pythonDaprWorkflowGenerator.generatePythonDaprWorkflow(workflow.definition);
      
      const workflowId = `${workflow.id}_${execution.id}`;
      
      execution.logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Deploying Python workflow and virtual environment'
      });

      // Deploy pure Python Dapr workflow with virtual environment
      const pythonScriptPath = await pythonDaprWorkflowGenerator.deployPythonDaprWorkflow(
        workflowId, 
        generatedWorkflow
      );

      const deployment: PythonWorkflowDeployment = {
        workflowId,
        pythonScriptPath,
        venvPath: generatedWorkflow.virtualEnvPath,
        generatedWorkflow
      };

      this.deployments.set(workflow.id, deployment);

      execution.logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Python workflow deployed successfully: ${pythonScriptPath}`
      });

      return deployment;

    } catch (error) {
      throw new Error(`Failed to deploy Python workflow: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Start Python-based Dapr workflow
   */
  private async startPythonDaprWorkflow(
    workflow: PublishedWorkflow,
    execution: WorkflowExecution,
    input: any,
    deployment: PythonWorkflowDeployment
  ): Promise<void> {
    try {
      execution.logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Starting Dapr workflow runtime for Python integration'
      });

      execution.logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Pure Python Dapr workflow deployed successfully'
      });

      // Execute the pure Python workflow via Dapr shell command
      await this.executePurePythonDaprWorkflow(workflow, execution, input, deployment);

    } catch (error) {
      throw new Error(`Failed to start Python Dapr workflow: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Execute pure Python Dapr workflow
   */
  private async executePurePythonDaprWorkflow(
    workflow: PublishedWorkflow,
    execution: WorkflowExecution,
    input: any,
    deployment: PythonWorkflowDeployment
  ): Promise<void> {
    try {
      execution.logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Executing pure Python Dapr workflow'
      });

      // Generate unique app ID and ports to avoid conflicts
      const appId = `python-workflow-${deployment.workflowId}`;
      const daprHttpPort = 3500 + Math.floor(Math.random() * 1000); // Random port to avoid conflicts
      const daprGrpcPort = 50001 + Math.floor(Math.random() * 1000);

      execution.logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Using Dapr configuration: HTTP=${daprHttpPort}, gRPC=${daprGrpcPort}`
      });

      // Construct pure Python Dapr run command similar to Python SDK examples
      const pythonExecutable = join(deployment.venvPath, 'bin', 'python');
      const inputJson = JSON.stringify(input);
      
      const daprCommand = `dapr run ` +
        `--app-id "${appId}" ` +
        `--dapr-http-port ${daprHttpPort} ` +
        `--dapr-grpc-port ${daprGrpcPort} ` +
        `-- "${pythonExecutable}" "${deployment.pythonScriptPath}" '${inputJson}'`;

      execution.logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Executing command: ${daprCommand}`
      });

      // Set environment variables for the Python script
      const env = {
        ...process.env,
        DAPR_HTTP_ENDPOINT: `http://localhost:${daprHttpPort}`,
        DAPR_GRPC_ENDPOINT: `http://localhost:${daprGrpcPort}`,
        PYTHONPATH: deployment.venvPath
      };

      // Execute the Dapr command
      const { stdout, stderr } = await execAsync(daprCommand, {
        cwd: join(process.cwd(), 'python-workflows', deployment.workflowId),
        env: env,
        timeout: 600000, // 10 minute timeout
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      // Log execution output
      if (stdout) {
        execution.logs.push({
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `Workflow execution output: ${stdout}`
        });
      }

      if (stderr) {
        execution.logs.push({
          timestamp: new Date().toISOString(),
          level: 'warn',
          message: `Workflow execution warnings: ${stderr}`
        });
      }

      // Mark as completed successfully
      execution.status = 'completed';
      execution.completedAt = new Date().toISOString();
      execution.output = {
        success: true,
        workflowId: deployment.workflowId,
        pythonScriptPath: deployment.pythonScriptPath,
        venvPath: deployment.venvPath,
        appId: appId,
        daprHttpPort: daprHttpPort,
        daprGrpcPort: daprGrpcPort,
        executionOutput: stdout,
        message: 'Pure Python Dapr workflow executed successfully'
      };

      execution.logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Pure Python Dapr workflow execution completed successfully'
      });

    } catch (error) {
      // Handle execution failure
      execution.status = 'failed';
      execution.error = getErrorMessage(error);
      execution.completedAt = new Date().toISOString();
      
      execution.logs.push({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `Pure Python Dapr workflow execution failed: ${getErrorMessage(error)}`
      });

      throw new Error(`Failed to execute pure Python Dapr workflow: ${getErrorMessage(error)}`);
    }
  }

  // Removed complex runtime and monitoring methods - simplified to file deployment only


  /**
   * Cancel Python workflow execution
   */
  async cancelWorkflow(instanceId: string): Promise<void> {
    try {
      await this.daprClient.workflow.terminate(instanceId, 'Cancelled by user');
      console.log(`Python Dapr workflow ${instanceId} cancelled`);
    } catch (error) {
      console.error('Failed to cancel Python Dapr workflow:', error);
      throw new Error(`Failed to cancel workflow: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Estimate workflow progress
   */
  private estimateProgress(status: any): number {
    if (status.customStatus) {
      const progressMatch = status.customStatus.match(/(\d+)%/);
      if (progressMatch) {
        return parseInt(progressMatch[1]);
      }
    }
    
    const elapsed = new Date().getTime() - new Date(status.createdTime).getTime();
    const estimatedTotal = 8 * 60 * 1000; // 8 minutes estimated for Python workflows
    return Math.min(90, Math.round((elapsed / estimatedTotal) * 100));
  }

  /**
   * Clean up workflow deployment
   */
  async cleanupWorkflow(workflowId: string): Promise<void> {
    const deployment = this.deployments.get(workflowId);
    if (deployment) {
      // TODO: Implement cleanup of virtual environment and files
      this.deployments.delete(workflowId);
      console.log(`Cleaned up Python workflow deployment: ${workflowId}`);
    }
  }
}

// Export singleton instance
export const pythonDaprWorkflowExecutor = new PythonDaprWorkflowExecutor();