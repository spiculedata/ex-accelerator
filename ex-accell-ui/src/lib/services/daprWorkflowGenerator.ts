// Dapr Workflow Code Generator Service
// Generates JavaScript/TypeScript Dapr workflow code from visual workflow definitions
// Based on Dapr JavaScript SDK workflow patterns

interface WorkflowStep {
  id: string;
  type: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  inputs: string[];
  outputs: string[];
  config: Record<string, any>;
  position: { x: number; y: number };
  status: string;
}

interface WorkflowConnection {
  id: string;
  from: string;
  fromPort: number;
  to: string;
  toPort: number;
}

interface WorkflowDefinition {
  name: string;
  description: string;
  steps: WorkflowStep[];
  connections: WorkflowConnection[];
}

export interface GeneratedWorkflow {
  workflowCode: string;
  activityCode: string;
  appCode: string;
  workflowPattern: string;
  executionOrder: string[];
}

export class DaprWorkflowGenerator {
  
  /**
   * Generate complete Dapr workflow code from visual workflow definition
   */
  generateWorkflowCode(workflow: WorkflowDefinition): GeneratedWorkflow {
    const pattern = this.detectWorkflowPattern(workflow);
    const executionOrder = this.calculateExecutionOrder(workflow);
    
    return {
      workflowCode: this.generateWorkflowFunction(workflow, pattern, executionOrder),
      activityCode: this.generateActivities(workflow),
      appCode: this.generateApplicationCode(workflow),
      workflowPattern: pattern,
      executionOrder
    };
  }

  /**
   * Detect the workflow pattern based on connections and step structure
   */
  private detectWorkflowPattern(workflow: WorkflowDefinition): string {
    const { steps, connections } = workflow;
    
    // Check for parallel execution (fan-out/fan-in)
    const hasParallelBranches = this.hasParallelExecution(workflow);
    if (hasParallelBranches) {
      return 'fan-out-fan-in';
    }
    
    // Check for monitoring pattern (has loops or external events)
    const hasExternalEvents = steps.some(step => 
      step.type === 'wait_for_event' || step.type === 'monitor'
    );
    if (hasExternalEvents) {
      return 'monitor';
    }
    
    // Check for human interaction
    const hasHumanInteraction = steps.some(step => 
      step.type === 'human_approval' || step.type === 'manual_task'
    );
    if (hasHumanInteraction) {
      return 'human-interaction';
    }
    
    // Default to activity sequence
    return 'activity-sequence';
  }

  /**
   * Check if workflow has parallel execution paths
   */
  private hasParallelExecution(workflow: WorkflowDefinition): boolean {
    const { connections } = workflow;
    
    // Find steps that have multiple outgoing connections
    const stepOutputCounts = new Map<string, number>();
    connections.forEach(conn => {
      const count = stepOutputCounts.get(conn.from) || 0;
      stepOutputCounts.set(conn.from, count + 1);
    });
    
    // If any step has multiple outputs, we have parallel execution
    return Array.from(stepOutputCounts.values()).some(count => count > 1);
  }

  /**
   * Calculate the execution order of steps
   */
  private calculateExecutionOrder(workflow: WorkflowDefinition): string[] {
    const { steps, connections } = workflow;
    const visited = new Set<string>();
    const order: string[] = [];
    
    // Find input steps (no incoming connections)
    const incomingCounts = new Map<string, number>();
    connections.forEach(conn => {
      const count = incomingCounts.get(conn.to) || 0;
      incomingCounts.set(conn.to, count + 1);
    });
    
    const startSteps = steps.filter(step => !incomingCounts.has(step.id));
    
    // Topological sort
    const visit = (stepId: string) => {
      if (visited.has(stepId)) return;
      visited.add(stepId);
      
      // Visit dependencies first
      connections
        .filter(conn => conn.to === stepId)
        .forEach(conn => visit(conn.from));
      
      order.push(stepId);
    };
    
    startSteps.forEach(step => visit(step.id));
    
    // Add any remaining steps
    steps.forEach(step => {
      if (!visited.has(step.id)) {
        order.push(step.id);
      }
    });
    
    return order;
  }

  /**
   * Generate the main workflow function
   */
  private generateWorkflowFunction(
    workflow: WorkflowDefinition, 
    pattern: string, 
    executionOrder: string[]
  ): string {
    const workflowName = this.toFunctionName(workflow.name);
    const activities = workflow.steps.filter(step => step.type !== 'dataset_input' && step.type !== 'dataset_output');
    
    let workflowBody = '';
    
    switch (pattern) {
      case 'fan-out-fan-in':
        workflowBody = this.generateFanOutFanInWorkflow(workflow, executionOrder);
        break;
      case 'monitor':
        workflowBody = this.generateMonitorWorkflow(workflow, executionOrder);
        break;
      case 'human-interaction':
        workflowBody = this.generateHumanInteractionWorkflow(workflow, executionOrder);
        break;
      default:
        workflowBody = this.generateSequenceWorkflow(workflow, executionOrder);
    }
    
    return `
/**
 * ${workflow.description || 'Generated Dapr workflow'}
 * Pattern: ${pattern}
 * Generated from visual workflow builder
 */
const ${workflowName}: TWorkflow = async function* (ctx: WorkflowContext, input: any): any {
  try {
    console.log('Starting workflow: ${workflow.name}');
    console.log('Input data:', input);
    
    ${workflowBody}
    
    console.log('Workflow completed successfully');
    return result;
  } catch (error) {
    console.error('Workflow error:', error);
    throw error;
  }
};`;
  }

  /**
   * Generate activity sequence workflow
   */
  private generateSequenceWorkflow(workflow: WorkflowDefinition, executionOrder: string[]): string {
    const steps = workflow.steps.filter(step => 
      step.type !== 'dataset_input' && step.type !== 'dataset_output'
    );
    
    let code = '    let result = input;\n    let stepResults = {};\n\n';
    
    steps.forEach((step, index) => {
      const activityName = this.toFunctionName(step.name);
      const stepConfig = JSON.stringify(step.config, null, 6);
      
      code += `    // Step ${index + 1}: ${step.name}\n`;
      code += `    console.log('Executing step: ${step.name}');\n`;
      code += `    const ${activityName}Result = yield ctx.callActivity(${activityName}Activity, {\n`;
      code += `      data: result,\n`;
      code += `      config: ${stepConfig},\n`;
      code += `      stepId: '${step.id}'\n`;
      code += `    });\n`;
      code += `    stepResults['${step.id}'] = ${activityName}Result;\n`;
      code += `    result = ${activityName}Result;\n\n`;
    });
    
    return code;
  }

  /**
   * Generate fan-out/fan-in workflow
   */
  private generateFanOutFanInWorkflow(workflow: WorkflowDefinition, executionOrder: string[]): string {
    const steps = workflow.steps.filter(step => 
      step.type !== 'dataset_input' && step.type !== 'dataset_output'
    );
    
    let code = '    let result = input;\n    let stepResults = {};\n\n';
    
    // Find parallel execution groups
    const parallelGroups = this.findParallelGroups(workflow);
    
    if (parallelGroups.length > 0) {
      code += '    // Fan-out: Execute parallel activities\n';
      code += '    const parallelTasks = [];\n\n';
      
      parallelGroups.forEach((group, groupIndex) => {
        group.forEach(step => {
          const activityName = this.toFunctionName(step.name);
          const stepConfig = JSON.stringify(step.config, null, 6);
          
          code += `    // Parallel task: ${step.name}\n`;
          code += `    parallelTasks.push(ctx.callActivity(${activityName}Activity, {\n`;
          code += `      data: result,\n`;
          code += `      config: ${stepConfig},\n`;
          code += `      stepId: '${step.id}'\n`;
          code += `    }));\n\n`;
        });
      });
      
      code += '    // Fan-in: Wait for all parallel tasks to complete\n';
      code += '    const parallelResults = yield ctx.whenAll(parallelTasks);\n';
      code += '    \n';
      code += '    // Aggregate results\n';
      code += '    result = {\n';
      code += '      originalInput: input,\n';
      code += '      parallelResults: parallelResults,\n';
      code += '      aggregatedData: parallelResults.reduce((acc, curr) => ({ ...acc, ...curr }), {})\n';
      code += '    };\n\n';
    }
    
    return code;
  }

  /**
   * Generate monitor workflow
   */
  private generateMonitorWorkflow(workflow: WorkflowDefinition, executionOrder: string[]): string {
    return `    let result = input;
    let stepResults = {};
    let isMonitoring = true;
    
    // Monitor loop
    while (isMonitoring) {
      try {
        // Execute monitoring activities
        ${this.generateSequenceWorkflow(workflow, executionOrder).trim()}
        
        // Wait for next check interval (configurable)
        const monitorInterval = input.monitorInterval || 30000; // 30 seconds default
        yield ctx.createTimer(new Date(Date.now() + monitorInterval));
        
        // Check if monitoring should continue
        if (result.shouldContinueMonitoring === false) {
          isMonitoring = false;
        }
      } catch (error) {
        console.error('Monitor workflow error:', error);
        // Decide whether to continue or stop based on error type
        if (error.isFatal) {
          throw error;
        }
        // Wait before retrying
        yield ctx.createTimer(new Date(Date.now() + 5000));
      }
    }`;
  }

  /**
   * Generate human interaction workflow
   */
  private generateHumanInteractionWorkflow(workflow: WorkflowDefinition, executionOrder: string[]): string {
    return `    let result = input;
    let stepResults = {};
    
    ${this.generateSequenceWorkflow(workflow, executionOrder).trim()}
    
    // Wait for human approval/interaction
    console.log('Waiting for human interaction...');
    const approvalEvent = yield ctx.waitForExternalEvent('approval', 3600000); // 1 hour timeout
    
    if (approvalEvent && approvalEvent.approved) {
      console.log('Human approval received');
      result = { ...result, approved: true, approvalData: approvalEvent };
    } else {
      console.log('Human approval timeout or rejected');
      result = { ...result, approved: false, reason: 'timeout_or_rejected' };
    }`;
  }

  /**
   * Find parallel execution groups in the workflow
   */
  private findParallelGroups(workflow: WorkflowDefinition): WorkflowStep[][] {
    const { steps, connections } = workflow;
    const groups: WorkflowStep[][] = [];
    
    // Find steps that branch out from the same source
    const outgoingConnections = new Map<string, WorkflowConnection[]>();
    connections.forEach(conn => {
      if (!outgoingConnections.has(conn.from)) {
        outgoingConnections.set(conn.from, []);
      }
      outgoingConnections.get(conn.from)!.push(conn);
    });
    
    // Group steps that execute in parallel
    outgoingConnections.forEach((conns, fromStep) => {
      if (conns.length > 1) {
        const parallelSteps = conns.map(conn => 
          steps.find(step => step.id === conn.to)!
        ).filter(Boolean);
        
        if (parallelSteps.length > 1) {
          groups.push(parallelSteps);
        }
      }
    });
    
    return groups;
  }

  /**
   * Generate activity functions
   */
  private generateActivities(workflow: WorkflowDefinition): string {
    const activities = workflow.steps.filter(step => 
      step.type !== 'dataset_input' && step.type !== 'dataset_output'
    );
    
    return activities.map(step => {
      const activityName = this.toFunctionName(step.name);
      const activityImplementation = this.generateActivityImplementation(step);
      
      return `
/**
 * Activity: ${step.name}
 * Type: ${step.type}
 * Description: ${step.description}
 */
const ${activityName}Activity = async (ctx: WorkflowActivityContext, input: any): Promise<any> => {
  try {
    console.log('Executing activity: ${step.name}');
    console.log('Input:', input);
    
    const { data, config, stepId } = input;
    
    ${activityImplementation}
    
    console.log('Activity completed: ${step.name}');
    return result;
  } catch (error) {
    console.error('Activity error in ${step.name}:', error);
    throw error;
  }
};`;
    }).join('\n');
  }

  /**
   * Generate specific activity implementation based on step type
   */
  private generateActivityImplementation(step: WorkflowStep): string {
    switch (step.type) {
      case 'remove_duplicates':
        return `
    // Remove duplicates from dataset
    const columns = config.columns || [];
    const keepStrategy = config.keep || 'first';
    
    // TODO: Implement duplicate removal logic
    // This would typically connect to your database service
    const result = await removeDuplicatesFromData(data, columns, keepStrategy);`;

      case 'handle_missing':
        return `
    // Handle missing values
    const strategy = config.strategy || 'drop';
    const fillValue = config.fill_value || '';
    const columns = config.columns || [];
    
    // TODO: Implement missing value handling
    const result = await handleMissingValues(data, strategy, fillValue, columns);`;

      case 'text_preprocessing':
        return `
    // Text preprocessing
    const options = {
      lowercase: config.lowercase || true,
      removePunctuation: config.remove_punctuation || true,
      removeStopwords: config.remove_stopwords || true,
      stem: config.stem || false,
      lemmatize: config.lemmatize || false,
      columns: config.columns || []
    };
    
    // TODO: Implement text preprocessing
    const result = await preprocessText(data, options);`;

      case 'sentiment_analysis':
        return `
    // Sentiment analysis
    const textColumn = config.text_column || 'text';
    const model = config.model || 'vader';
    const outputColumns = config.output_columns || ['sentiment', 'confidence'];
    
    // TODO: Implement sentiment analysis
    const result = await analyzeSentiment(data, textColumn, model, outputColumns);`;

      case 'topic_modeling':
        return `
    // Topic modeling
    const textColumn = config.text_column || 'text';
    const numTopics = config.num_topics || 10;
    const method = config.method || 'lda';
    const outputColumns = config.output_columns || ['topics', 'topic_weights'];
    
    // TODO: Implement topic modeling
    const result = await discoverTopics(data, textColumn, numTopics, method, outputColumns);`;

      case 'clustering':
        return `
    // Clustering
    const features = config.features || [];
    const algorithm = config.algorithm || 'kmeans';
    const nClusters = config.n_clusters || 5;
    const outputColumn = config.output_column || 'cluster';
    
    // TODO: Implement clustering
    const result = await performClustering(data, features, algorithm, nClusters, outputColumn);`;

      case 'filter_rows':
        return `
    // Filter rows based on conditions
    const conditions = config.conditions || [];
    
    // TODO: Implement row filtering
    const result = await filterRows(data, conditions);`;

      case 'feature_extraction':
        return `
    // Feature extraction
    const method = config.method || 'tfidf';
    const maxFeatures = config.max_features || 1000;
    const ngramRange = config.ngram_range || [1, 1];
    const columns = config.columns || [];
    
    // TODO: Implement feature extraction
    const result = await extractFeatures(data, method, maxFeatures, ngramRange, columns);`;

      default:
        return `
    // Generic step implementation
    // TODO: Implement custom logic for step type: ${step.type}
    const result = { ...data, processed: true, stepType: '${step.type}' };`;
    }
  }

  /**
   * Generate the main application code
   */
  private generateApplicationCode(workflow: WorkflowDefinition): string {
    const workflowName = this.toFunctionName(workflow.name);
    const activities = workflow.steps.filter(step => 
      step.type !== 'dataset_input' && step.type !== 'dataset_output'
    );
    
    const activityRegistrations = activities.map(step => {
      const activityName = this.toFunctionName(step.name);
      return `workflowRuntime.registerActivity(${activityName}Activity);`;
    }).join('\n  ');
    
    return `
import { 
  DaprWorkflowClient, 
  WorkflowRuntime, 
  WorkflowContext,
  WorkflowActivityContext,
  TWorkflow 
} from "@dapr/dapr";

// Import your data processing utilities
// import { removeDuplicatesFromData, handleMissingValues, preprocessText, ... } from './dataProcessingUtils';

// Workflow and activity definitions would be inserted here
${this.generateWorkflowFunction(workflow, this.detectWorkflowPattern(workflow), this.calculateExecutionOrder(workflow))}

${this.generateActivities(workflow)}

// Application setup and execution
async function main() {
  const daprHost = process.env.DAPR_HOST || "127.0.0.1";
  const daprPort = process.env.DAPR_HTTP_PORT || "3500";
  
  // Initialize workflow runtime
  const workflowRuntime = new WorkflowRuntime({
    daprHost,
    daprPort,
  });
  
  // Register workflow and activities
  workflowRuntime.registerWorkflow(${workflowName});
  ${activityRegistrations}
  
  // Start the workflow runtime
  await workflowRuntime.start();
  console.log('Workflow runtime started');
  
  // Initialize workflow client
  const workflowClient = new DaprWorkflowClient({
    daprHost,
    daprPort,
  });
  
  // Example: Schedule and run the workflow
  const workflowInput = {
    // Add your input data here
    dataset: 'your_dataset_id',
    parameters: {}
  };
  
  console.log('Scheduling workflow: ${workflow.name}');
  const instanceId = await workflowClient.scheduleNewWorkflow(${workflowName}, workflowInput);
  console.log('Workflow scheduled with ID:', instanceId);
  
  // Wait for completion (optional)
  const result = await workflowClient.waitForWorkflowCompletion(instanceId, undefined, 300000); // 5 minute timeout
  console.log('Workflow completed:', result);
  
  // Stop the runtime
  await workflowRuntime.stop();
}

// Run the application
if (require.main === module) {
  main().catch(console.error);
}

export { ${workflowName}, main };`;
  }

  /**
   * Convert display name to valid function name
   */
  private toFunctionName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^[0-9]/, '_$&')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase();
  }
}

// Export singleton instance
export const daprWorkflowGenerator = new DaprWorkflowGenerator();