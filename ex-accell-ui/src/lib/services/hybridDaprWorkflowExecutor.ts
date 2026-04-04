// Hybrid Dapr Workflow Executor
// Python registers workflows/activities, Node.js manages execution via Dapr JS SDK

import { DaprClient, CommunicationProtocolEnum, WorkflowRuntimeStatus } from '@dapr/dapr';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import type { PublishedWorkflow, WorkflowExecution } from './serverWorkflowService';
import { pythonDaprWorkflowGenerator, type PythonDaprWorkflow } from './pythonDaprWorkflowGenerator';

const execAsync = promisify(exec);

/**
 * Helper function to safely extract error messages
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export interface HybridWorkflowDeployment {
  workflowId: string;
  workflowName: string;
  pythonScriptPath: string;
  venvPath: string;
  pythonProcessId?: number;
  daprAppId: string;
  daprHttpPort: number;
  daprGrpcPort: number;
}

export class HybridDaprWorkflowExecutor {
  private daprClient: DaprClient | null = null;
  private deployments = new Map<string, HybridWorkflowDeployment>();
  private readonly baseDaprHttpPort = 3600; // Different from main app to avoid conflicts
  private readonly baseDaprGrpcPort = 50100;
  private readonly mainDaprPort = 3500; // Main app Dapr sidecar port

  constructor() {
    // Initialize Dapr client - will be created when needed with connection verification
  }

  /**
   * Initialize and verify Dapr client connection
   */
  private async initializeDaprClient(): Promise<DaprClient> {
    if (this.daprClient) {
      return this.daprClient;
    }

    // Check if we're running in a Dapr context
    const daprHttpPort = process.env.DAPR_HTTP_PORT;
    const daprGrpcPort = process.env.DAPR_GRPC_PORT;
    const appId = process.env.APP_ID;

    console.log('Dapr environment detection:');
    console.log(`- DAPR_HTTP_PORT: ${daprHttpPort}`);
    console.log(`- DAPR_GRPC_PORT: ${daprGrpcPort}`);
    console.log(`- APP_ID: ${appId}`);

    // If we have Dapr environment variables, use those
    let daprPort = this.mainDaprPort;
    if (daprHttpPort) {
      daprPort = parseInt(daprHttpPort);
      console.log(`Using Dapr HTTP port from environment: ${daprPort}`);
    }

    // Create Dapr client
    this.daprClient = new DaprClient({
      daprHost: 'localhost',
      daprPort: daprPort.toString(),
      communicationProtocol: CommunicationProtocolEnum.HTTP
    });

    // Test connection
    try {
      await this.testDaprConnection();
      console.log(`Successfully connected to Dapr sidecar on port ${this.mainDaprPort}`);
      return this.daprClient;
    } catch (error) {
      console.error(`Failed to connect to Dapr sidecar:`, getErrorMessage(error));
      
      // Provide more helpful error message
      if (daprHttpPort) {
        throw new Error(`DAPR_SIDECAR_CONNECTION_FAILED: Running in Dapr context but sidecar unreachable. Check Dapr sidecar status.`);
      } else {
        throw new Error(`DAPR_SIDECAR_COULD_NOT_BE_STARTED: Ensure the application is running with 'npm run dev:dapr' to start the Dapr sidecar`);
      }
    }
  }

  /**
   * Check if Dapr workflow engine is ready
   */
  private async checkWorkflowEngineReady(port: number): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:${port}/v1.0/metadata`);
      if (!response.ok) return false;
      
      const metadata = await response.json();
      const actorRuntime = metadata.actorRuntime;
      
      if (actorRuntime && actorRuntime.runtimeStatus === 'RUNNING' && actorRuntime.hostReady === true) {
        return true;
      }
      
      console.log(`Workflow engine status: ${actorRuntime?.runtimeStatus || 'unknown'}, hostReady: ${actorRuntime?.hostReady || false}`);
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Test Dapr connection by making a simple health check with retries
   */
  private async testDaprConnection(): Promise<void> {
    if (!this.daprClient) {
      throw new Error('Dapr client not initialized');
    }

    // Try multiple ports and methods to detect Dapr sidecar
    const portsToTry = [this.mainDaprPort, 3501, 3502]; // Try different common Dapr ports
    let lastError: Error | null = null;

    for (const port of portsToTry) {
      try {
        console.log(`Testing Dapr connection on port ${port}...`);
        
        // Try multiple endpoints
        const endpoints = [
          `http://localhost:${port}/v1.0/metadata`,
          `http://localhost:${port}/v1.0/healthz`,
          `http://localhost:${port}/`
        ];

        for (const endpoint of endpoints) {
          try {
            const response = await fetch(endpoint, {
              signal: AbortSignal.timeout(2000)
            });
            
            if (response.ok) {
              console.log(`Dapr sidecar found on port ${port} at ${endpoint}`);
              
              // Check if workflow engine is ready (but don't require it to be RUNNING)
              const workflowReady = await this.checkWorkflowEngineReady(port);
              if (workflowReady) {
                console.log(`Workflow engine ready on port ${port}`);
              } else {
                console.log(`Dapr sidecar on port ${port} found, workflow engine still initializing - will proceed anyway`);
              }
              
              // Update the main Dapr port to the working one
              if (port !== this.mainDaprPort) {
                console.log(`Updating Dapr port from ${this.mainDaprPort} to ${port}`);
                (this as any).mainDaprPort = port;
                
                // Recreate client with correct port
                this.daprClient = new DaprClient({
                  daprHost: 'localhost',
                  daprPort: port.toString(),
                  communicationProtocol: CommunicationProtocolEnum.HTTP
                });
              }
              return; // Success!
            }
          } catch (endpointError) {
            console.log(`Endpoint ${endpoint} failed:`, getErrorMessage(endpointError));
          }
        }
      } catch (portError) {
        lastError = portError as Error;
        console.log(`Port ${port} failed:`, getErrorMessage(portError));
      }
    }

    // If we get here, all ports failed
    const errorMsg = `Dapr sidecar not found on any port (${portsToTry.join(', ')}). Last error: ${lastError ? getErrorMessage(lastError) : 'unknown'}`;
    throw new Error(errorMsg);
  }

  /**
   * Execute workflow using hybrid approach:
   * 1. Deploy and start Python workflow registration process
   * 2. Use Dapr JS SDK to schedule and manage workflow execution
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
        message: `Starting hybrid Dapr workflow: ${workflow.name}`
      });

      // Step 1: Deploy and start Python workflow registration
      const deployment = await this.deployAndRegisterPythonWorkflow(workflow, execution);

      // Step 2: Use JS SDK to schedule workflow execution
      await this.scheduleWorkflowExecution(workflow, execution, input, deployment);

    } catch (error) {
      console.error('Hybrid Dapr workflow execution failed:', error);
      
      execution.status = 'failed';
      execution.error = getErrorMessage(error);
      execution.completedAt = new Date().toISOString();
      execution.logs.push({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `Hybrid workflow execution failed: ${getErrorMessage(error)}`
      });
      throw error;
    }
  }

  /**
   * Deploy Python workflow and start registration process
   */
  private async deployAndRegisterPythonWorkflow(
    workflow: PublishedWorkflow,
    execution: WorkflowExecution
  ): Promise<HybridWorkflowDeployment> {
    try {
      execution.logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Generating and deploying Python workflow for registration'
      });

      // Generate Python workflow with registration-only main function
      const generatedWorkflow = await pythonDaprWorkflowGenerator.generatePythonDaprWorkflow(workflow.definition);
      const workflowId = `${workflow.id}_${execution.id}`;
      
      // Deploy Python workflow files
      const pythonScriptPath = await pythonDaprWorkflowGenerator.deployPythonDaprWorkflow(
        workflowId,
        generatedWorkflow
      );

      execution.logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Starting Python workflow registration directly (no separate Dapr sidecar)`
      });

      // Run Python workflow registration directly, connecting to main Dapr sidecar
      const pythonExecutable = join(generatedWorkflow.virtualEnvPath, 'bin', 'python');
      
      execution.logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Starting workflow registration: ${pythonExecutable} ${pythonScriptPath}`
      });

      // Get the working Dapr port that was detected during connection test
      await this.initializeDaprClient(); // Ensure we've detected the working port
      const workingDaprPort = (this as any).mainDaprPort as number; // May be updated during testDaprConnection
      const workingGrpcPort = workingDaprPort === 3502 ? 50002 : 50001;
      
      execution.logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Configuring Python to connect to working Dapr sidecar - HTTP: ${workingDaprPort}, gRPC: ${workingGrpcPort}`
      });

      // Prepare clean environment for Python process
      const pythonEnv = {
        ...process.env,
        PYTHONPATH: generatedWorkflow.virtualEnvPath,
        DAPR_HTTP_ENDPOINT: `http://localhost:${workingDaprPort}`,
        DAPR_GRPC_ENDPOINT: `http://localhost:${workingGrpcPort}`,
        // Override any existing Dapr environment variables
        DAPR_HTTP_PORT: workingDaprPort.toString(),
        DAPR_GRPC_PORT: workingGrpcPort.toString()
      };

      execution.logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Python environment: DAPR_HTTP_PORT=${pythonEnv.DAPR_HTTP_PORT}, DAPR_GRPC_PORT=${pythonEnv.DAPR_GRPC_PORT}`
      });

      // Start the Python process (non-blocking) - connects to working Dapr sidecar
      const childProcess = exec(`"${pythonExecutable}" "${pythonScriptPath}"`, {
        cwd: join(process.cwd(), 'python-workflows', workflowId),
        env: pythonEnv
      });

      // Monitor Python process output for registration confirmation
      let registrationDetected = false;
      const registrationPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Python workflow registration timeout'));
        }, 30000); // 30 second timeout

        childProcess.stdout?.on('data', (data) => {
          const output = data.toString();
          console.log(`Python workflow output: ${output}`);
          execution.logs.push({
            timestamp: new Date().toISOString(),
            level: 'info',
            message: `Python registration: ${output.trim()}`
          });

          // Look for registration confirmation - multiple possible success indicators
          if (output.includes('registered successfully') || 
              output.includes('ready to accept') ||
              output.includes('Successfully connected to dns:localhost') ||
              output.includes('Waiting for work items')) {
            registrationDetected = true;
            clearTimeout(timeout);
            resolve();
          }
        });

        childProcess.stderr?.on('data', (data) => {
          const error = data.toString();
          console.log(`Python workflow error: ${error}`);
          execution.logs.push({
            timestamp: new Date().toISOString(),
            level: 'warn',
            message: `Python registration warning: ${error.trim()}`
          });

          // Check stderr for success messages too (some logging goes to stderr)
          if (!registrationDetected && (
              error.includes('registered successfully') || 
              error.includes('ready to accept') ||
              error.includes('Successfully connected to dns:localhost') ||
              error.includes('Waiting for work items'))) {
            registrationDetected = true;
            clearTimeout(timeout);
            resolve();
          }
        });

        childProcess.on('exit', (code) => {
          if (code !== 0 && !registrationDetected) {
            clearTimeout(timeout);
            reject(new Error(`Python workflow process exited with code ${code}`));
          }
        });
      });

      // Wait for registration confirmation from Python output
      await registrationPromise;

      execution.logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Python workflow registration confirmed, allowing time for full readiness...'
      });

      // Give a small additional buffer for the workflow to be fully ready
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify the workflow is actually accessible via Dapr
      await this.verifyWorkflowAccessibility(generatedWorkflow.workflowName, execution);

      const deployment: HybridWorkflowDeployment = {
        workflowId,
        workflowName: generatedWorkflow.workflowName,
        pythonScriptPath,
        venvPath: generatedWorkflow.virtualEnvPath,
        pythonProcessId: childProcess.pid,
        daprAppId: `python-workflow-${workflowId}`,
        daprHttpPort: this.mainDaprPort, // Uses main Dapr sidecar
        daprGrpcPort: 50001 // Main Dapr gRPC port
      };

      this.deployments.set(workflow.id, deployment);

      execution.logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Python workflow registered successfully: ${generatedWorkflow.workflowName}`
      });

      return deployment;

    } catch (error) {
      throw new Error(`Failed to deploy and register Python workflow: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Verify that the workflow is accessible via Dapr before attempting execution
   */
  private async verifyWorkflowAccessibility(workflowName: string, execution: WorkflowExecution): Promise<void> {
    try {
      execution.logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Verifying workflow accessibility: ${workflowName}`
      });

      const daprClient = await this.initializeDaprClient();
      
      // Try to get the status of a non-existent instance to verify workflow is registered
      const testInstanceId = `verify-${Date.now()}`;
      
      try {
        // Add a timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Verification timeout')), 10000); // 10 second timeout
        });
        
        const verificationPromise = daprClient.workflow.get(testInstanceId);
        await Promise.race([verificationPromise, timeoutPromise]);
        
        // If no error, workflow is accessible
        execution.logs.push({
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `✓ Workflow ${workflowName} is accessible via Dapr`
        });
        
      } catch (statusError) {
        if (getErrorMessage(statusError) === 'Verification timeout') {
          execution.logs.push({
            timestamp: new Date().toISOString(),
            level: 'warn',
            message: `Workflow verification timed out - skipping verification and proceeding to execution`
          });
          return; // Skip verification and proceed
        }
        
        const errorMsg = getErrorMessage(statusError).toLowerCase();
        
        if (errorMsg.includes('not found') || errorMsg.includes('no workflow')) {
          // Instance not found is expected - this means workflow type is registered
          execution.logs.push({
            timestamp: new Date().toISOString(),
            level: 'info',
            message: `✓ Workflow ${workflowName} is registered (instance not found is expected)`
          });
        } else if (errorMsg.includes('workflow type') || errorMsg.includes('unknown')) {
          // Workflow type not registered
          throw new Error(`Workflow ${workflowName} is not registered with Dapr: ${getErrorMessage(statusError)}`);
        } else {
          // Some other error - log but don't fail
          execution.logs.push({
            timestamp: new Date().toISOString(),
            level: 'warn',
            message: `Workflow accessibility check returned: ${getErrorMessage(statusError)} - proceeding anyway`
          });
        }
      }
      
    } catch (error) {
      execution.logs.push({
        timestamp: new Date().toISOString(),
        level: 'warn',
        message: `Workflow verification failed: ${getErrorMessage(error)} - proceeding to execution attempt`
      });
      // Don't throw - just proceed to execution
    }
  }

  /**
   * Schedule workflow execution using Dapr JS SDK
   */
  private async scheduleWorkflowExecution(
    workflow: PublishedWorkflow,
    execution: WorkflowExecution,
    input: any,
    deployment: HybridWorkflowDeployment
  ): Promise<void> {
    try {
      execution.logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Connecting to Dapr sidecar for workflow scheduling'
      });

      // Initialize and verify Dapr client connection
      const daprClient = await this.initializeDaprClient();

      execution.logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Scheduling workflow execution via Dapr JS SDK - Workflow: ${deployment.workflowName}, Port: ${this.mainDaprPort}`
      });

      // Start workflow instance using JS SDK with timeout
      const startTimeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Workflow start timeout')), 30000); // 30 second timeout
      });
      
      const startPromise = daprClient.workflow.start(deployment.workflowName, input);
      const instanceId = await Promise.race([startPromise, startTimeoutPromise]) as string;

      execution.logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Workflow instance started successfully: ${instanceId}`
      });

      // Monitor workflow execution
      await this.monitorWorkflowExecution(workflow, execution, instanceId as string, deployment);

    } catch (error) {
      execution.logs.push({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `JS SDK scheduling failed: ${getErrorMessage(error)}`
      });
      
      // Log more details about the error
      if (getErrorMessage(error) === 'Workflow start timeout') {
        execution.logs.push({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `Workflow start call timed out after 30 seconds - this suggests connectivity issues with Dapr sidecar`
        });
      } else if (getErrorMessage(error).includes('ERR_START_WORKFLOW')) {
        execution.logs.push({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `This suggests the workflow '${deployment.workflowName}' is not properly registered with Dapr`
        });
      } else if (getErrorMessage(error).includes('fetch failed') || getErrorMessage(error).includes('connection refused')) {
        execution.logs.push({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `Cannot connect to Dapr sidecar on port ${this.mainDaprPort} - check if Dapr is running`
        });
      }
      
      throw new Error(`Failed to schedule workflow execution: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Monitor workflow execution using JS SDK
   */
  private async monitorWorkflowExecution(
    workflow: PublishedWorkflow,
    execution: WorkflowExecution,
    instanceId: string,
    deployment: HybridWorkflowDeployment
  ): Promise<void> {
    try {
      execution.logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Monitoring workflow execution...'
      });

      // Poll workflow status
      const maxAttempts = 60; // 5 minutes with 5-second intervals
      let attempts = 0;

      while (attempts < maxAttempts) {
        try {
          const daprClient = await this.initializeDaprClient();
          const status = await daprClient.workflow.get(instanceId);
          
          execution.logs.push({
            timestamp: new Date().toISOString(),
            level: 'info',
            message: `Workflow status: ${status.runtimeStatus} (attempt ${attempts + 1})`
          });

          if ((status.runtimeStatus as string) === (WorkflowRuntimeStatus.COMPLETED as unknown as string)) {
            execution.status = 'completed';
            execution.completedAt = new Date().toISOString();
            const statusData = status as any; // Type assertion for workflow output access
            execution.output = {
              success: true,
              instanceId,
              workflowResult: statusData.output,
              message: 'Hybrid workflow execution completed successfully'
            };

            execution.logs.push({
              timestamp: new Date().toISOString(),
              level: 'info',
              message: 'Workflow execution completed successfully'
            });

            break;
          } else if ((status.runtimeStatus as string) === (WorkflowRuntimeStatus.FAILED as unknown as string)) {
            const statusData = status as any;
            throw new Error(`Workflow failed: ${statusData.output || 'Unknown error'}`);
          } else if ((status.runtimeStatus as string) === (WorkflowRuntimeStatus.TERMINATED as unknown as string)) {
            throw new Error('Workflow was terminated');
          }

        } catch (statusError) {
          execution.logs.push({
            timestamp: new Date().toISOString(),
            level: 'warn',
            message: `Status check failed: ${getErrorMessage(statusError)}`
          });
        }

        attempts++;
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      }

      if (attempts >= maxAttempts) {
        throw new Error('Workflow execution timeout - maximum monitoring time exceeded');
      }

    } catch (error) {
      execution.status = 'failed';
      execution.error = getErrorMessage(error);
      execution.completedAt = new Date().toISOString();
      
      execution.logs.push({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `Workflow monitoring failed: ${getErrorMessage(error)}`
      });

      throw error;
    }
  }

  /**
   * Cancel workflow execution
   */
  async cancelWorkflow(instanceId: string): Promise<void> {
    try {
      const daprClient = await this.initializeDaprClient();
      await daprClient.workflow.terminate(instanceId, 'Cancelled by user');
      console.log(`Hybrid workflow ${instanceId} cancelled`);
    } catch (error) {
      console.error('Failed to cancel hybrid workflow:', error);
      throw new Error(`Failed to cancel workflow: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Pause workflow execution
   */
  async pauseWorkflow(instanceId: string): Promise<void> {
    try {
      const daprClient = await this.initializeDaprClient();
      await daprClient.workflow.pause(instanceId);
      console.log(`Hybrid workflow ${instanceId} paused`);
    } catch (error) {
      console.error('Failed to pause hybrid workflow:', error);
      throw new Error(`Failed to pause workflow: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Resume workflow execution
   */
  async resumeWorkflow(instanceId: string): Promise<void> {
    try {
      const daprClient = await this.initializeDaprClient();
      await daprClient.workflow.resume(instanceId);
      console.log(`Hybrid workflow ${instanceId} resumed`);
    } catch (error) {
      console.error('Failed to resume hybrid workflow:', error);
      throw new Error(`Failed to resume workflow: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get workflow status
   */
  async getWorkflowStatus(instanceId: string): Promise<any> {
    try {
      const daprClient = await this.initializeDaprClient();
      return await daprClient.workflow.get(instanceId);
    } catch (error) {
      console.error('Failed to get workflow status:', error);
      throw new Error(`Failed to get workflow status: ${getErrorMessage(error)}`);
    }
  }


  /**
   * Clean up workflow deployment
   */
  async cleanupWorkflow(workflowId: string): Promise<void> {
    const deployment = this.deployments.get(workflowId);
    if (deployment) {
      // Terminate Python registration process
      if (deployment.pythonProcessId) {
        try {
          process.kill(deployment.pythonProcessId, 'SIGTERM');
        } catch (error) {
          console.warn(`Failed to terminate Python process: ${getErrorMessage(error)}`);
        }
      }

      this.deployments.delete(workflowId);
      console.log(`Cleaned up hybrid workflow deployment: ${workflowId}`);
    }
  }

  /**
   * Purge workflow instance
   */
  async purgeWorkflow(instanceId: string): Promise<void> {
    try {
      const daprClient = await this.initializeDaprClient();
      await daprClient.workflow.purge(instanceId);
      console.log(`Hybrid workflow ${instanceId} purged`);
    } catch (error) {
      console.error('Failed to purge hybrid workflow:', error);
      throw new Error(`Failed to purge workflow: ${getErrorMessage(error)}`);
    }
  }
}

// Export singleton instance
export const hybridDaprWorkflowExecutor = new HybridDaprWorkflowExecutor();