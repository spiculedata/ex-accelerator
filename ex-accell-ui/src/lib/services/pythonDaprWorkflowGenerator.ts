// Python-based Dapr Workflow Generator
// Generates Python scripts for data processing wrapped in Dapr workflow activities

import { writeFile, mkdir, access, readFile } from 'fs/promises';
import { join } from 'path';
import { assertSafeIdentifier } from '$lib/utils/pathSafety';
import { execFile } from 'child_process';
import { promisify } from 'util';

import { generateWorkflowName } from './pythonDaprNaming';
import { generatePythonWorkflowScript } from './pythonDaprScriptTemplate';
import type { GeneratedWorkflow, PythonDaprWorkflow, WorkflowDefinition } from './pythonDaprWorkflowTypes';

export type { GeneratedWorkflow, PythonDaprWorkflow };

const execFileAsync = promisify(execFile);

export class PythonDaprWorkflowGenerator {
  private workflowsDir = join(process.cwd(), 'python-workflows');
  private venvDir = join(process.cwd(), 'workflow-venvs');

  /**
   * Generate complete Python Dapr workflow using pure Python SDK
   */
  async generatePythonDaprWorkflow(workflow: WorkflowDefinition): Promise<PythonDaprWorkflow> {
    const workflowName = generateWorkflowName(workflow);
    const workflowId = `${workflowName}_${Date.now()}`;
    
    // Generate pure Python Dapr workflow script
    const pythonScript = generatePythonWorkflowScript(workflow);
    
    // Generate requirements.txt for dependencies (including Dapr SDK)
    const requirements = this.generateRequirements(workflow);
    
    const virtualEnvPath = join(this.venvDir, workflowId);
    const activationScript = this.generateVenvActivationScript(virtualEnvPath);
    
    return {
      workflowName,
      workflowCode: '',  // No longer using Node.js workflow code
      activityCode: '',  // No longer using Node.js activity code
      appCode: '',       // No longer using Node.js app code
      workflowPattern: 'pure-python-dapr-sdk',
      executionOrder: this.calculateExecutionOrder(workflow),
      pythonScript,
      requirements,
      virtualEnvPath,
      activationScript
    };
  }

  /**
   * Deploy pure Python Dapr workflow with virtual environment setup
   */
  async deployPythonDaprWorkflow(
    workflowId: string, 
    generatedWorkflow: PythonDaprWorkflow
  ): Promise<string> {
    assertSafeIdentifier(workflowId, 'workflowId');

    try {
      // Create directories
      await this.ensureDirectories(workflowId);
      
      // Deploy Python workflow script (contains everything now)
      const pythonScriptPath = await this.deployPythonScript(workflowId, generatedWorkflow.pythonScript);
      
      // Deploy requirements.txt (includes Dapr SDK)
      await this.deployRequirements(workflowId, generatedWorkflow.requirements);
      
      // Create and setup virtual environment with Dapr SDK
      await this.setupVirtualEnvironment(workflowId, generatedWorkflow.virtualEnvPath);
      
      return pythonScriptPath;
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to deploy Python Dapr workflow: ${errorMsg}`);
    }
  }

  /**
   * Generate requirements.txt for Python dependencies including Dapr SDK
   */
  private generateRequirements(workflow: WorkflowDefinition): string {
    const baseRequirements = [
      'dapr>=1.15.0',           // Python Dapr SDK  
      'dapr-ext-workflow>=1.15.0',  // Dapr Workflow Extension
      'pandas>=2.0.0',
      'numpy>=1.24.0',
      'polars>=0.20.0',         // High-performance DataFrame library
      'scikit-learn>=1.3.0',
      'textblob>=0.17.1',
      'nltk>=3.8.1'
    ];

    const steps = workflow.steps;
    const additionalRequirements: string[] = [];

    // Add step-specific requirements
    if (steps.some(s => s.type === 'sentiment_analysis')) {
      additionalRequirements.push('vaderSentiment>=3.3.2');
    }

    if (steps.some(s => s.type === 'topic_modeling')) {
      additionalRequirements.push('gensim>=4.3.0');
    }

    return [...baseRequirements, ...additionalRequirements].join('\n');
  }

  // === HELPER METHODS FOR PURE PYTHON DAPR WORKFLOW ===

  /**
   * Ensure all necessary directories exist
   */
  private async ensureDirectories(workflowId: string): Promise<void> {
    const dirs = [
      this.workflowsDir,
      this.venvDir,
      join(this.workflowsDir, workflowId),
      join(this.venvDir, workflowId)
    ];

    for (const dir of dirs) {
      try {
        await mkdir(dir, { recursive: true });
      } catch (error) {
        // Directory might already exist
      }
    }
  }

  /**
   * Deploy Python workflow script
   */
  private async deployPythonScript(workflowId: string, pythonScript: string): Promise<string> {
    const scriptPath = join(this.workflowsDir, workflowId, 'workflow.py');
    await writeFile(scriptPath, pythonScript);
    console.log(`Pure Python Dapr workflow script deployed: ${scriptPath}`);
    return scriptPath;
  }

  /**
   * Deploy requirements.txt
   */
  private async deployRequirements(workflowId: string, requirements: string): Promise<void> {
    const requirementsPath = join(this.workflowsDir, workflowId, 'requirements.txt');
    await writeFile(requirementsPath, requirements);
    console.log(`Requirements deployed: ${requirementsPath}`);
  }

  /**
   * Setup virtual environment with dependencies including Dapr SDK
   */
  private async setupVirtualEnvironment(workflowId: string, venvPath: string): Promise<void> {
    try {
      console.log(`Setting up virtual environment with Dapr SDK: ${venvPath}`);
      
      // Create virtual environment
      await execFileAsync('python3', ['-m', 'venv', venvPath]);
      
      // Upgrade pip
      const pipPath = join(venvPath, 'bin', 'pip');
      await execFileAsync(pipPath, ['install', '--upgrade', 'pip']);
      
      // Install requirements (includes Dapr SDK)
      const requirementsPath = join(this.workflowsDir, workflowId, 'requirements.txt');
      await execFileAsync(pipPath, ['install', '-r', requirementsPath]);
      
      console.log('Virtual environment with Dapr SDK setup completed');
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to setup virtual environment: ${errorMsg}`);
    }
  }

  /**
   * Generate virtual environment activation script
   */
  private generateVenvActivationScript(venvPath: string): string {
    return `#!/bin/bash
# Virtual environment activation script
source "${join(venvPath, 'bin', 'activate')}"
echo "Virtual environment activated: ${venvPath}"
`;
  }

  // Helper methods
  private calculateExecutionOrder(workflow: WorkflowDefinition): string[] {
    return workflow.steps
      .filter(step => step.type !== 'dataset_input' && step.type !== 'dataset_output')
      .map(step => step.id);
  }
}

// Export singleton instance
export const pythonDaprWorkflowGenerator = new PythonDaprWorkflowGenerator();
