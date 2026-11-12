import type { WorkflowExecution } from '$lib/services/serverWorkflowService';

/** What a person is told when a workflow step or the Dapr runtime failed. The cause is in the server log. */
export const GENERIC_EXECUTION_ERROR = 'The workflow run failed. Ask an administrator to check the server log.';
const GENERIC_LOG_MESSAGE = 'A problem occurred in this step. Ask an administrator to check the server log.';

/**
 * An execution as the API sends it. The service records the raw cause of a failure (Dapr hostnames, ports, stack text) in
 * `error` and in warn/error log lines; those are replaced here and info/debug lines pass through untouched.
 */
export function toPublicExecution<T extends Pick<WorkflowExecution, 'error' | 'logs'>>(execution: T): T {
  const view = { ...execution };
  if (view.error) view.error = GENERIC_EXECUTION_ERROR;
  if (Array.isArray(view.logs)) {
    view.logs = view.logs.map((entry) =>
      entry.level === 'error' || entry.level === 'warn' ? { ...entry, message: GENERIC_LOG_MESSAGE, data: undefined } : entry
    );
  }
  return view;
}

/** The part of a Dapr workflow state that is safe to show: where it is, not why it failed. */
export function toPublicDaprStatus(status: unknown): Record<string, unknown> | null {
  if (!status || typeof status !== 'object') return null;
  const { instanceId, workflowName, name, runtimeStatus, createdAt, lastUpdatedAt } = status as Record<string, unknown>;
  return { instanceId, workflowName: workflowName ?? name, runtimeStatus, createdAt, lastUpdatedAt };
}
