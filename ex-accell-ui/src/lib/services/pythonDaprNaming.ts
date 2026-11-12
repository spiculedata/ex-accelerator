// Name helpers for generated workflows and activities

import type { WorkflowDefinition } from './pythonDaprWorkflowTypes';

export function generateWorkflowName(workflow: WorkflowDefinition): string {
  const baseName = workflow.name || 'UntitledWorkflow';
  return baseName
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(' ')
    .map((word, index) => {
      if (index === 0) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join('') || 'defaultWorkflow';
}

export function toPythonMethodName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/^[0-9]/, '_$&')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}
