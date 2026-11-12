import { describe, it, expect } from 'vitest';
import { GENERIC_EXECUTION_ERROR, toPublicDaprStatus, toPublicExecution } from './workflowExecutionView';

const log = (level: 'info' | 'warn' | 'error' | 'debug', message: string) => ({ timestamp: 't', level, message });

describe('toPublicExecution', () => {
  it('replaces the stored failure cause and warn/error log text, and keeps everything else', () => {
    const execution = {
      id: 'exec_1',
      status: 'failed',
      error: 'connect ECONNREFUSED 10.0.0.5:3500',
      logs: [
        log('info', 'Starting workflow'),
        log('warn', 'Dapr cancellation failed: sidecar at 10.0.0.5'),
        { ...log('error', 'Hybrid workflow execution failed: ECONNREFUSED 10.0.0.5'), data: { stack: 'at /srv/app' } }
      ]
    };

    const view = toPublicExecution(execution);

    expect(view.id).toBe('exec_1');
    expect(view.error).toBe(GENERIC_EXECUTION_ERROR);
    expect(view.logs[0].message).toBe('Starting workflow');
    expect(JSON.stringify(view)).not.toMatch(/10\.0\.0\.5|\/srv\/app/);
    expect(view.logs.map((entry) => entry.level)).toEqual(['info', 'warn', 'error']);
  });

  it('leaves a successful execution as it was and does not change the original', () => {
    const execution = { error: undefined, logs: [log('info', 'ok')] };

    expect(toPublicExecution(execution)).toEqual(execution);

    const failing = { error: 'secret', logs: [log('error', 'secret')] };
    toPublicExecution(failing);
    expect(failing.error).toBe('secret');
    expect(failing.logs[0].message).toBe('secret');
  });
});

describe('toPublicDaprStatus', () => {
  it('keeps the position of the workflow and drops failure details and payloads', () => {
    const status = toPublicDaprStatus({
      instanceId: 'exec_1',
      workflowName: 'flow',
      runtimeStatus: 'FAILED',
      createdAt: 'c',
      lastUpdatedAt: 'u',
      serializedInput: '{"token":"x"}',
      failureDetails: { message: 'dial tcp 10.0.0.5', stackTrace: 'at x' }
    });

    expect(status).toEqual({ instanceId: 'exec_1', workflowName: 'flow', runtimeStatus: 'FAILED', createdAt: 'c', lastUpdatedAt: 'u' });
  });

  it('returns null for nothing', () => {
    expect(toPublicDaprStatus(undefined)).toBeNull();
    expect(toPublicDaprStatus('x')).toBeNull();
  });
});
