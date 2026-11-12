import { describe, it, expect, vi, beforeEach } from 'vitest';

const service = vi.hoisted(() => ({ getWorkflowExecutions: vi.fn() }));
vi.mock('$lib/services/serverWorkflowService', () => ({ serverWorkflowService: service }));

import { GET } from './+server';

const list = (query = '') => GET({ url: new URL(`http://localhost/api/workflow-executions${query}`) } as never);

beforeEach(() => {
  service.getWorkflowExecutions.mockReset();
  service.getWorkflowExecutions.mockResolvedValue([{ id: 'exec_1' }, { id: 'exec_2' }]);
});

describe('GET /api/workflow-executions', () => {
  it('returns executions in data and the legacy key, passing the filters on', async () => {
    const response = await list('?workflowId=wf_1&status=failed&limit=10');

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ success: true, count: 2, executions: [{ id: 'exec_1' }, { id: 'exec_2' }], data: [{ id: 'exec_1' }, { id: 'exec_2' }] });
    expect(service.getWorkflowExecutions).toHaveBeenCalledWith({ workflowId: 'wf_1', status: 'failed', limit: 10 });
  });

  it.each([['abc'], ['0'], ['501']])('refuses limit=%s with 400 before querying', async (limit) => {
    const response = await list(`?limit=${limit}`);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ success: false, data: null });
    expect(service.getWorkflowExecutions).not.toHaveBeenCalled();
  });

  it('returns a generic 500 envelope on failure', async () => {
    service.getWorkflowExecutions.mockRejectedValue(new Error('password authentication failed'));

    const response = await list();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, data: null, error: 'Failed to get workflow executions' });
  });
});
