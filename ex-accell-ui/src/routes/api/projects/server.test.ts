import { describe, it, expect, vi, beforeEach } from 'vitest';

const createProject = vi.hoisted(() => vi.fn());
const getAllProjects = vi.hoisted(() => vi.fn());
const updateProject = vi.hoisted(() => vi.fn());
const guard = vi.hoisted(() => ({ visibleProjectIds: vi.fn(), refuseIfNoAccess: vi.fn() }));

vi.mock('$lib/services/projectsDb', () => ({ projectsDb: { createProject, getAllProjects, updateProject } }));
vi.mock('$lib/server/auth/accessGuard', () => guard);

import { GET, POST, PUT } from './+server';

const call = (body: unknown, user: { email: string } | null) =>
  POST({
    request: new Request('http://localhost/api/projects', {
      method: 'POST',
      body: JSON.stringify(body)
    }),
    locals: { user }
  } as unknown as Parameters<typeof POST>[0]);

describe('POST /api/projects', () => {
  beforeEach(() => {
    createProject.mockReset();
    createProject.mockResolvedValue({ id: 1 });
    guard.visibleProjectIds.mockReset();
    guard.refuseIfNoAccess.mockReset();
    guard.refuseIfNoAccess.mockResolvedValue(null);
  });

  it('records the signed-in user as creator', async () => {
    await call({ name: 'p' }, { email: 'ada@example.com' });

    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({ created_by: 'ada@example.com' })
    );
  });

  it('ignores a created_by supplied by the client', async () => {
    await call({ name: 'p', created_by: 'someone-else@example.com' }, { email: 'ada@example.com' });

    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({ created_by: 'ada@example.com' })
    );
  });
});

describe('project membership', () => {
  beforeEach(() => {
    guard.visibleProjectIds.mockReset();
    guard.refuseIfNoAccess.mockReset();
    guard.refuseIfNoAccess.mockResolvedValue(null);
    getAllProjects.mockReset();
    updateProject.mockReset();
  });

  it('lists only the projects the person may see', async () => {
    getAllProjects.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
    guard.visibleProjectIds.mockResolvedValue(new Set([2, 3]));
    const response = await GET({ url: new URL('http://localhost/api/projects'), locals: { user: { email: 'bob@example.com', role: 'user' } } } as any);
    expect((await response.json()).projects.map((p: { id: number }) => p.id)).toEqual([2, 3]);
  });

  it('lists everything for an admin', async () => {
    getAllProjects.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    guard.visibleProjectIds.mockResolvedValue(null);
    const response = await GET({ url: new URL('http://localhost/api/projects'), locals: { user: { email: 'root@example.com', role: 'admin' } } } as any);
    expect((await response.json()).projects).toHaveLength(2);
  });

  it('refuses to change a project the person is not a member of, changing nothing', async () => {
    guard.refuseIfNoAccess.mockResolvedValue(new Response(JSON.stringify({ success: false }), { status: 403 }));
    const response = await PUT({ request: new Request('http://localhost/api/projects', { method: 'PUT', body: JSON.stringify({ id: 4, name: 'x' }) }), locals: { user: { email: 'bob@example.com', role: 'user' } } } as any);
    expect(response.status).toBe(403);
    expect(updateProject).not.toHaveBeenCalled();
  });
});
