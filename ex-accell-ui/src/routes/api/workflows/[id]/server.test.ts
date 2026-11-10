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
