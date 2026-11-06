import { describe, it, expect, vi, beforeEach } from 'vitest';

const createWorkspace = vi.hoisted(() => vi.fn());

vi.mock('$lib/services/projectsDb', () => ({ projectsDb: { createWorkspace } }));

import { POST } from './+server';

const call = (body: unknown, user: { email: string } | null) =>
  POST({
    request: new Request('http://localhost/api/workspaces', { method: 'POST', body: JSON.stringify(body) }),
    locals: { user }
  } as unknown as Parameters<typeof POST>[0]);

beforeEach(() => {
  createWorkspace.mockReset();
  createWorkspace.mockResolvedValue({ id: 4 });
});

describe('POST /api/workspaces', () => {
  it('records the signed-in user as creator', async () => {
    await call({ project_id: 1, name: 'w' }, { email: 'ada@example.com' });

    expect(createWorkspace).toHaveBeenCalledWith(expect.objectContaining({ created_by: 'ada@example.com' }));
  });

  it('ignores a created_by supplied by the client', async () => {
    await call({ project_id: 1, name: 'w', created_by: 'someone-else@example.com' }, { email: 'ada@example.com' });

    expect(createWorkspace).toHaveBeenCalledWith(expect.objectContaining({ created_by: 'ada@example.com' }));
  });

  it('still requires a project', async () => {
    const response = await call({ name: 'w' }, { email: 'ada@example.com' });

    expect(response.status).toBe(400);
  });
});
