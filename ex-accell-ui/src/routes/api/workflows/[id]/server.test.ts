import { describe, it, expect, vi, beforeEach } from 'vitest';

const service = vi.hoisted(() => ({
  getPublishedWorkflow: vi.fn(),
  updateWorkflow: vi.fn(),
  deleteWorkflow: vi.fn()
}));
vi.mock('$lib/services/serverWorkflowService', () => ({ serverWorkflowService: service }));

import { GET, PUT, DELETE } from './+server';

const owner = { email: 'ada@example.com', role: 'user' };
const stranger = { email: 'bob@example.com', role: 'user' };
const admin = { email: 'root@example.com', role: 'admin' };

const put = (user: unknown, body: unknown, id = 'wf_1') =>
  PUT({ params: { id }, request: new Request('http://localhost/api/workflows/wf_1', { method: 'PUT', body: typeof body === 'string' ? body : JSON.stringify(body) }), locals: { user } } as any);
const del = (user: unknown, id = 'wf_1') => DELETE({ params: { id }, locals: { user } } as any);

beforeEach(() => {
  service.getPublishedWorkflow.mockReset();
  service.updateWorkflow.mockReset();
  service.deleteWorkflow.mockReset();
  service.getPublishedWorkflow.mockResolvedValue({ id: 'wf_1', createdBy: 'ada@example.com' });
  service.updateWorkflow.mockResolvedValue({ id: 'wf_1', name: 'x' });
  service.deleteWorkflow.mockResolvedValue(true);
});

describe('PUT /api/workflows/[id]', () => {
  it('refuses someone who did not create the workflow, before changing it', async () => {
    const response = await put(stranger, { name: 'Taken over' });
    expect(response.status).toBe(403);
    expect(service.updateWorkflow).not.toHaveBeenCalled();
  });

  it('lets the creator and an admin change it', async () => {
    expect((await put(owner, { name: 'Mine' })).status).toBe(200);
    expect((await put(admin, { name: 'Admin edit' })).status).toBe(200);
  });

  it('reports a missing workflow as 404, not 500', async () => {
    service.getPublishedWorkflow.mockResolvedValue(null);
    expect((await put(owner, { name: 'x' })).status).toBe(404);
  });

  it('refuses a body that is not JSON or is too large', async () => {
    expect((await put(owner, 'not json')).status).toBe(400);
    expect((await put(owner, { metadata: 'x'.repeat(1024 * 1024 + 1) })).status).toBe(413);
    expect(service.updateWorkflow).not.toHaveBeenCalled();
  });

  it.each([[{ name: 123 }], [{ name: '' }], [{ description: ['x'] }], [{ metadata: 'text' }], [{ metadata: [1] }]])('refuses %j instead of failing in the database', async (body) => {
    expect((await put(owner, body)).status).toBe(400);
    expect(service.updateWorkflow).not.toHaveBeenCalled();
  });

  it('refuses an unknown status', async () => {
    expect((await put(owner, { status: 'hacked' })).status).toBe(400);
  });
});

describe('DELETE /api/workflows/[id]', () => {
  it('refuses someone who did not create the workflow, before deleting it', async () => {
    expect((await del(stranger)).status).toBe(403);
    expect(service.deleteWorkflow).not.toHaveBeenCalled();
  });

  it('lets the creator and an admin delete it', async () => {
    expect((await del(owner)).status).toBe(200);
    expect((await del(admin)).status).toBe(200);
  });

  it('reports a missing workflow as 404, not 500', async () => {
    service.getPublishedWorkflow.mockResolvedValue(null);
    expect((await del(owner)).status).toBe(404);
  });

  it('refuses when nobody is signed in', async () => {
    expect((await del(null)).status).toBe(403);
  });
});

describe('GET /api/workflows/[id]', () => {
  it('reports a missing workflow as 404, not 500', async () => {
    service.getPublishedWorkflow.mockResolvedValue(null);
    expect((await GET({ params: { id: 'nope' } } as any)).status).toBe(404);
  });
});

describe('envelope shape', () => {
  it('GET returns data and the legacy workflow key', async () => {
    const body = await (await GET({ params: { id: 'wf_1' } } as any)).json();

    expect(body).toEqual({ success: true, workflow: { id: 'wf_1', createdBy: 'ada@example.com' }, data: { id: 'wf_1', createdBy: 'ada@example.com' } });
  });

  it('PUT returns the updated workflow in data and the legacy key', async () => {
    const body = await (await put(owner, { name: 'x' })).json();

    expect(body).toEqual({ success: true, workflow: { id: 'wf_1', name: 'x' }, data: { id: 'wf_1', name: 'x' } });
  });

  it('DELETE returns success with null data', async () => {
    expect(await (await del(owner)).json()).toEqual({ success: true, data: null });
  });

  it('failures carry success false, null data and the message', async () => {
    service.getPublishedWorkflow.mockResolvedValue(null);

    expect(await (await del(owner)).json()).toEqual({ success: false, data: null, error: 'Workflow not found' });
  });

  it('GET and DELETE return a generic 500 without the internal error text', async () => {
    service.getPublishedWorkflow.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:5432'));

    const get = await GET({ params: { id: 'wf_1' } } as any);
    const remove = await del(owner);

    expect([get.status, remove.status]).toEqual([500, 500]);
    expect(await get.json()).toEqual({ success: false, data: null, error: 'Failed to get workflow' });
    expect(await remove.json()).toEqual({ success: false, data: null, error: 'Failed to delete workflow' });
  });
});
