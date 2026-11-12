import { describe, it, expect } from 'vitest';
import { GENERIC_CANCEL_ERROR, GENERIC_EXECUTION_ERROR, HIDDEN_LOG_MESSAGE, toPublicDaprStatus, toPublicExecution } from './workflowExecutionView';

const log = (level: 'info' | 'warn' | 'error' | 'debug', message: string) => ({ timestamp: 't', level, message });
const member = { isAdmin: false };
const admin = { isAdmin: true };

const failed = () => ({
  id: 'exec_1',
  status: 'failed' as const,
  progress: 40,
  currentStep: 'Registering',
  error: 'connect ECONNREFUSED 10.0.0.5:3500',
  input: { token: 'secret-token' },
  output: { workflowResult: 'secret-result' },
  logs: [
    log('info', 'Python registration: Traceback at /srv/app/register.py, DAPR_HTTP_PORT=3500'),
    { ...log('error', 'Hybrid workflow execution failed: ECONNREFUSED 10.0.0.5'), stepId: 's1', stepName: 'Fetch', data: { stack: 'at /srv/app' } }
  ]
});

describe('toPublicExecution for someone who is not an administrator', () => {
  it('hides the failure cause, every log line, and the input and output, keeping the progress', () => {
    const view = toPublicExecution(failed(), member);

    expect(view).toMatchObject({ id: 'exec_1', status: 'failed', progress: 40, currentStep: 'Registering', error: GENERIC_EXECUTION_ERROR });
    expect(view.logs).toEqual([
      { timestamp: 't', level: 'info', stepId: undefined, stepName: undefined, message: HIDDEN_LOG_MESSAGE },
      { timestamp: 't', level: 'error', stepId: 's1', stepName: 'Fetch', message: HIDDEN_LOG_MESSAGE }
    ]);
    expect('input' in view).toBe(false);
    expect('output' in view).toBe(false);
    expect(JSON.stringify(view)).not.toMatch(/10\.0\.0\.5|\/srv\/app|secret|3500/);
  });

  it('says a cancelled run was cancelled, not that it failed', () => {
    const view = toPublicExecution({ ...failed(), status: 'cancelled' as const, error: 'Cancellation error: dial tcp 10.0.0.5' }, member);

    expect(view.error).toBe(GENERIC_CANCEL_ERROR);
  });

  it('leaves a run without an error without one, and does not change the original', () => {
    const original = failed();
    const snapshot = JSON.stringify(original);

    expect(toPublicExecution({ ...original, error: undefined }, member).error).toBeUndefined();
    toPublicExecution(original, member);

    expect(JSON.stringify(original)).toBe(snapshot);
  });
});

describe('toPublicExecution for an administrator', () => {
  it('returns the execution whole, so the cause can be diagnosed', () => {
    const original = failed();

    expect(toPublicExecution(original, admin)).toBe(original);
  });
});

describe('toPublicDaprStatus', () => {
  it('keeps where the workflow is and drops failure details and payloads', () => {
    const status = toPublicDaprStatus({
      instanceId: 'exec_1',
      name: 'flow',
      runtimeStatus: 3,
      createdAt: 'c',
      lastUpdatedAt: 'u',
      serializedInput: '{"token":"x"}',
      workflowFailureDetails: { message: 'dial tcp 10.0.0.5', stackTrace: 'at x' }
    });

    expect(status).toEqual({ instanceId: 'exec_1', workflowName: 'flow', runtimeStatus: 'FAILED', createdAt: 'c', lastUpdatedAt: 'u' });
  });

  it('passes a text status through and returns null for nothing', () => {
    expect(toPublicDaprStatus({ runtimeStatus: 'RUNNING' })?.runtimeStatus).toBe('RUNNING');
    expect(toPublicDaprStatus(undefined)).toBeNull();
    expect(toPublicDaprStatus('x')).toBeNull();
  });
});
