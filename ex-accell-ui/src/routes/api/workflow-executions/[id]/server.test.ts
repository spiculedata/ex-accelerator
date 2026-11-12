import { describe, it, expect, vi, beforeEach } from 'vitest';

const service = vi.hoisted(() => ({ getWorkflowExecution: vi.fn(), cancelWorkflowExecution: vi.fn() }));
vi.mock('$lib/services/serverWorkflowService', () => ({ serverWorkflowService: service }));

import { DELETE, GET } from './+server';

const event = { params: { id: 'exec_1' } } as never;

beforeEach(() => {
  Object.values(service).forEach((fn) => fn.mockReset());
  service.getWorkflowExecution.mockResolvedValue({ id: 'exec_1', status: 'running' });
  service.cancelWorkflowExecution.mockResolvedValue(undefined);
});

describe('GET /api/workflow-executions/[id]', () => {
  it('returns the execution in data and the legacy key', async () => {
    const response = await GET(event);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, execution: { id: 'exec_1', status: 'running' }, data: { id: 'exec_1', status: 'running' } });
  });

  it('replaces the stored failure cause and error log text with generic text', async () => {
    service.getWorkflowExecution.mockResolvedValue({
      id: 'exec_1',
      status: 'failed',
      error: 'connect ECONNREFUSED 10.0.0.5:3500',
      logs: [{ timestamp: 't', level: 'error', message: 'Hybrid workflow execution failed: ECONNREFUSED 10.0.0.5' }]
    });

    const body = await (await GET(event)).json();

    expect(JSON.stringify(body)).not.toContain('10.0.0.5');
    expect(body.execution.status).toBe('failed');
    expect(body.data.error).toBeTruthy();
  });

  it('reports a missing execution as a 404 envelope, not a SvelteKit error', async () => {
    service.getWorkflowExecution.mockResolvedValue(null);

    const response = await GET(event);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ success: false, data: null, error: 'Workflow execution not found' });
  });

  it('returns a generic 500 envelope on failure', async () => {
    service.getWorkflowExecution.mockRejectedValue(new Error('connection refused 10.0.0.5'));

    const response = await GET(event);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, data: null, error: 'Failed to get workflow execution' });
  });
});

describe('DELETE /api/workflow-executions/[id]', () => {
  it('cancels an existing execution', async () => {
    const response = await DELETE(event);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, data: null, message: 'Workflow execution cancelled' });
    expect(service.cancelWorkflowExecution).toHaveBeenCalledWith('exec_1');
  });

  it('reports a missing execution as 404 without trying to cancel it', async () => {
    service.getWorkflowExecution.mockResolvedValue(null);

    const response = await DELETE(event);

    expect(response.status).toBe(404);
    expect(service.cancelWorkflowExecution).not.toHaveBeenCalled();
  });

  it('returns a generic 500 envelope when cancelling fails', async () => {
    service.cancelWorkflowExecution.mockRejectedValue(new Error('sidecar down at 10.0.0.5'));

    const response = await DELETE(event);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, data: null, error: 'Failed to cancel workflow execution' });
  });
});
