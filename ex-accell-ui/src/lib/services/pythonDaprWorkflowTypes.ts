// Shared types for the Python Dapr workflow generator

export interface WorkflowStep {
  id: string;
  type: string;
  name: string;
  description: string;
  config: Record<string, any>;
  position: { x: number; y: number };
}

export interface WorkflowDefinition {
  name: string;
  description: string;
  steps: WorkflowStep[];
  connections: any[];
}

/** What a generator returns. The *Code fields are empty: workflows run as a single Python script. */
export interface GeneratedWorkflow {
  workflowName: string;
  workflowCode: string;
  activityCode: string;
  appCode: string;
  workflowPattern: string;
  executionOrder: string[];
}

export interface PythonDaprWorkflow extends GeneratedWorkflow {
  pythonScript: string;
  requirements: string;
  virtualEnvPath: string;
  activationScript: string;
}
