import { describe, it, expect, vi, beforeEach } from 'vitest';

const service = vi.hoisted(() => ({ getWorkflowExecution: vi.fn() }));
const executor = vi.hoisted(() => ({
  pauseWorkflow: vi.fn(),
  resumeWorkflow: vi.fn(),
  purgeWorkflow: vi.fn(),
  getWorkflowStatus: vi.fn()
}));
vi.mock('$lib/services/serverWorkflowService', () => ({ serverWorkflowService: service }));
vi.mock('$lib/services/hybridDaprWorkflowExecutor', () => ({ hybridDaprWorkflowExecutor: executor }));

import { GET, POST } from './+server';

const post = (body: unknown) =>
  POST({
    params: { id: 'exec_1' },
    request: new Request('http://localhost/x', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) })
  } as never);
const get = (query: string) => GET({ params: { id: 'exec_1' }, url: new URL(`http://localhost/x${query}`) } as never);

beforeEach(() => {
  [service.getWorkflowExecution, ...Object.values(executor)].forEach((fn) => fn.mockReset());
  service.getWorkflowExecution.mockResolvedValue({ id: 'exec_1' });
  executor.getWorkflowStatus.mockResolvedValue({ runtimeStatus: 'RUNNING' });
});

describe('POST /api/workflow-executions/[id]/manage', () => {
  it.each([
    ['pause', 'pauseWorkflow'],
    ['resume', 'resumeWorkflow'],
    ['purge', 'purgeWorkflow']
  ] as const)('%s calls the executor and returns the envelope with the legacy keys', async (action, method) => {
    const response = await post({ action });

    expect(response.status).toBe(200);
    expect(executor[method]).toHaveBeenCalledWith('exec_1');
    expect(await response.json()).toMatchObject({ success: true, action, executionId: 'exec_1', data: { message: expect.any(String) } });
  });

  it('status returns the Dapr status in data and the legacy key', async () => {
    executor.getWorkflowStatus.mockResolvedValue({ instanceId: 'exec_1', runtimeStatus: 'FAILED', failureDetails: { message: 'dial tcp 10.0.0.5:3500' } });

    const body = await (await post({ action: 'status' })).json();

    expect(body).toMatchObject({ success: true, status: { runtimeStatus: 'FAILED' }, data: { status: { runtimeStatus: 'FAILED' } } });
    expect(JSON.stringify(body)).not.toContain('10.0.0.5');
  });

  it.each([[{ action: 'explode' }], [{}], ['not json'], ['[1]']])('refuses %j with 400 before touching the executor', async (body) => {
    const response = await post(body);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ success: false, data: null });
    expect(service.getWorkflowExecution).not.toHaveBeenCalled();
  });

  it('reports a missing execution as 404', async () => {
    service.getWorkflowExecution.mockResolvedValue(null);

    const response = await post({ action: 'pause' });

    expect(response.status).toBe(404);
    expect(executor.pauseWorkflow).not.toHaveBeenCalled();
  });

  it('returns a generic 500 without the executor error text', async () => {
    executor.pauseWorkflow.mockRejectedValue(new Error('dapr at 10.0.0.5:3500 refused'));

    const response = await post({ action: 'pause' });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, data: null, error: 'Failed to pause workflow' });
  });
});

describe('GET /api/workflow-executions/[id]/manage', () => {
  it('returns local and Dapr status', async () => {
    service.getWorkflowExecution.mockResolvedValue({ id: 'exec_1', error: 'connect ECONNREFUSED 10.0.0.5', logs: [] });

    const body = await (await get('?action=status')).json();

    expect(body).toMatchObject({ success: true, localExecution: { id: 'exec_1' }, daprStatus: { runtimeStatus: 'RUNNING' }, data: { daprStatus: { runtimeStatus: 'RUNNING' } } });
    expect(JSON.stringify(body)).not.toContain('10.0.0.5');
  });

  it('refuses any action but status with 400', async () => {
    expect((await get('?action=purge')).status).toBe(400);
  });

  it('reports a missing execution as 404 and a failure as a generic 500', async () => {
    service.getWorkflowExecution.mockResolvedValueOnce(null);
    expect((await get('?action=status')).status).toBe(404);

    executor.getWorkflowStatus.mockRejectedValue(new Error('boom 10.0.0.5'));
    const response = await get('?action=status');
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, data: null, error: 'Failed to get workflow status' });
  });
});
