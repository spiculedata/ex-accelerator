import type { WorkflowExecution } from '$lib/services/serverWorkflowService';

/** What a person is told when a workflow step or the Dapr runtime failed. The cause is in the server log. */
export const GENERIC_EXECUTION_ERROR = 'The workflow run failed. Ask an administrator to check the server log.';
export const GENERIC_CANCEL_ERROR = 'The workflow was cancelled, but the runtime did not confirm it. Ask an administrator to check the server log.';
export const HIDDEN_LOG_MESSAGE = 'Details are visible to administrators.';

export interface ExecutionViewer {
  isAdmin: boolean;
}

/**
 * An execution as the API sends it. Administrators, who run workflows, get it whole. Everyone else (read-only members can list
 * executions) gets the progress but not the internals the service records: the failure cause (Dapr addresses, stack text), log
 * lines (script paths, ports, subprocess output), and the run's input and output, which can hold secrets.
 */
export function toPublicExecution<T extends Pick<WorkflowExecution, 'error' | 'logs' | 'status'>>(execution: T, viewer: ExecutionViewer): T {
  if (viewer.isAdmin) return execution;

  const view: Partial<WorkflowExecution> & T = { ...execution };
  if (view.error) view.error = view.status === 'cancelled' ? GENERIC_CANCEL_ERROR : GENERIC_EXECUTION_ERROR;
  if (Array.isArray(view.logs)) {
    view.logs = view.logs.map(({ timestamp, level, stepId, stepName }) => ({ timestamp, level, stepId, stepName, message: HIDDEN_LOG_MESSAGE }));
  }
  delete view.input;
  delete view.output;
  return view;
}

const DAPR_RUNTIME_STATUS: Record<number, string> = { 0: 'RUNNING', 1: 'COMPLETED', 2: 'CONTINUED_AS_NEW', 3: 'FAILED', 4: 'CANCELED', 5: 'TERMINATED', 6: 'PENDING', 7: 'SUSPENDED' };

/** The part of a Dapr workflow state that is safe to show: where it is, not why it failed or what it carried. */
export function toPublicDaprStatus(status: unknown): Record<string, unknown> | null {
  if (!status || typeof status !== 'object') return null;
  const { instanceId, workflowName, name, runtimeStatus, createdAt, lastUpdatedAt } = status as Record<string, unknown>;
  return {
    instanceId,
    workflowName: workflowName ?? name,
    runtimeStatus: typeof runtimeStatus === 'number' ? (DAPR_RUNTIME_STATUS[runtimeStatus] ?? runtimeStatus) : runtimeStatus,
    createdAt,
    lastUpdatedAt
  };
}
