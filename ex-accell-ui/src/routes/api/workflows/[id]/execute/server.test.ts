import { describe, it, expect, vi, beforeEach } from 'vitest';

const service = vi.hoisted(() => ({
  getPublishedWorkflow: vi.fn(),
  executeWorkflow: vi.fn(),
  getWorkflowExecutions: vi.fn()
}));
vi.mock('$lib/services/serverWorkflowService', () => ({ serverWorkflowService: service }));

import { GET, POST } from './+server';

const post = (body: unknown) =>
  POST({
    params: { id: 'wf_1' },
    request: new Request('http://localhost/api/workflows/wf_1/execute', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) })
  } as never);
const list = (query = '') => GET({ params: { id: 'wf_1' }, url: new URL(`http://localhost/api/workflows/wf_1/execute${query}`) } as never);

beforeEach(() => {
  Object.values(service).forEach((fn) => fn.mockReset());
  service.getPublishedWorkflow.mockResolvedValue({ id: 'wf_1', status: 'published' });
  service.executeWorkflow.mockResolvedValue({ id: 'exec_1', status: 'queued' });
  service.getWorkflowExecutions.mockResolvedValue([{ id: 'exec_1' }]);
});

describe('POST /api/workflows/[id]/execute', () => {
  it('runs a published workflow and returns the execution in data and the legacy key', async () => {
    const response = await post({ input: { a: 1 }, options: { priority: 'high' } });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, execution: { id: 'exec_1', status: 'queued' }, data: { id: 'exec_1', status: 'queued' } });
    expect(service.executeWorkflow).toHaveBeenCalledWith('wf_1', { a: 1 }, { priority: 'high' });
  });

  it('does not send stored failure causes back from a run or a list', async () => {
    const failed = { id: 'exec_1', status: 'failed', error: 'dial tcp 10.0.0.5:3500', logs: [{ timestamp: 't', level: 'error', message: 'refused 10.0.0.5' }] };
    service.executeWorkflow.mockResolvedValue(failed);
    service.getWorkflowExecutions.mockResolvedValue([failed]);

    expect(JSON.stringify(await (await post({})).json())).not.toContain('10.0.0.5');
    expect(JSON.stringify(await (await list()).json())).not.toContain('10.0.0.5');
  });

  it.each([['not json'], ['[1]']])('refuses a body that is not a JSON object (%s) with 400', async (raw) => {
    const response = await post(raw);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ success: false, data: null });
    expect(service.executeWorkflow).not.toHaveBeenCalled();
  });

  it('refuses options that are not an object', async () => {
    expect((await post({ options: 'fast' })).status).toBe(400);
    expect(service.executeWorkflow).not.toHaveBeenCalled();
  });

  it('reports a missing workflow as 404', async () => {
    service.getPublishedWorkflow.mockResolvedValue(null);

    const response = await post({});

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ success: false, data: null, error: 'Workflow not found' });
  });

  it('refuses to run a workflow that is not published with 409', async () => {
    service.getPublishedWorkflow.mockResolvedValue({ id: 'wf_1', status: 'draft' });

    expect((await post({})).status).toBe(409);
    expect(service.executeWorkflow).not.toHaveBeenCalled();
  });

  it('returns a generic 500 without the internal error text', async () => {
    service.executeWorkflow.mockRejectedValue(new Error('dapr sidecar at 10.0.0.5:3500 refused'));

    const response = await post({});

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ success: false, data: null, error: 'Failed to execute workflow' });
  });
});

describe('GET /api/workflows/[id]/execute', () => {
  it('lists executions in data and the legacy key', async () => {
    const response = await list('?status=running&limit=5');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, executions: [{ id: 'exec_1' }], count: 1, data: [{ id: 'exec_1' }] });
    expect(service.getWorkflowExecutions).toHaveBeenCalledWith({ workflowId: 'wf_1', status: 'running', limit: 5 });
  });

  it.each([['abc'], ['0'], ['-3'], ['1.5'], ['100000']])('refuses limit=%s with 400', async (limit) => {
    const response = await list(`?limit=${limit}`);

    expect(response.status).toBe(400);
    expect(service.getWorkflowExecutions).not.toHaveBeenCalled();
  });

  it('returns a generic 500 envelope on failure', async () => {
    service.getWorkflowExecutions.mockRejectedValue(new Error('relation "x" does not exist'));

    const response = await list();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, data: null, error: 'Failed to get workflow executions' });
  });
});
