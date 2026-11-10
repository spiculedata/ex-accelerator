import { describe, it, expect, vi, beforeEach } from 'vitest';

const createProject = vi.hoisted(() => vi.fn());
const getAllProjects = vi.hoisted(() => vi.fn());
const updateProject = vi.hoisted(() => vi.fn());
const guard = vi.hoisted(() => ({ visibleProjectIds: vi.fn(), refuseIfNoAccess: vi.fn() }));
const deleteProject = vi.hoisted(() => vi.fn());
const repo = vi.hoisted(() => ({ loadProjectAccessInfo: vi.fn() }));

vi.mock('$lib/services/projectsDb', () => ({ projectsDb: { createProject, getAllProjects, updateProject, deleteProject } }));
vi.mock('$lib/server/auth/accessRepo', () => repo);
vi.mock('$lib/server/auth/accessGuard', () => guard);

import { DELETE, GET, POST, PUT } from './+server';

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

describe('DELETE /api/projects', () => {
  const del = (user: unknown, id = '4') => DELETE({ url: new URL(`http://localhost/api/projects?id=${id}`), locals: { user } } as any);

  beforeEach(() => {
    deleteProject.mockReset().mockResolvedValue(true);
    repo.loadProjectAccessInfo.mockReset().mockResolvedValue({ createdBy: 'ada@example.com', memberEmails: ['ada@example.com', 'bob@example.com'] });
  });

  it('lets the creator and an admin delete it', async () => {
    expect((await del({ email: 'ada@example.com', role: 'user' })).status).toBe(200);
    expect((await del({ email: 'root@example.com', role: 'admin' })).status).toBe(200);
    expect(deleteProject).toHaveBeenCalledWith(4);
  });

  it('refuses an ordinary member, who may see the project but not destroy it', async () => {
    const response = await del({ email: 'bob@example.com', role: 'user' });
    expect(response.status).toBe(403);
    expect(deleteProject).not.toHaveBeenCalled();
  });

  it('says 404 for a project that does not exist', async () => {
    repo.loadProjectAccessInfo.mockResolvedValue(null);
    expect((await del({ email: 'root@example.com', role: 'admin' })).status).toBe(404);
  });

  it('refuses an id that is not a plain whole number', async () => {
    expect((await del({ email: 'root@example.com', role: 'admin' }, '4abc')).status).toBe(400);
    expect(deleteProject).not.toHaveBeenCalled();
  });

  it('answers a failure with a generic message, not the database text', async () => {
    deleteProject.mockRejectedValue(new Error('connection to 10.0.0.5 refused'));
    const response = await del({ email: 'ada@example.com', role: 'user' });
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('10.0.0.5');
  });
});

describe('project API failures', () => {
  it('keeps the database text out of a 500 on list and update', async () => {
    getAllProjects.mockReset().mockRejectedValue(new Error('connection to 10.0.0.5 refused'));
    guard.visibleProjectIds.mockReset().mockResolvedValue(null);
    const listed = await GET({ url: new URL('http://localhost/api/projects'), locals: { user: { email: 'root@example.com', role: 'admin' } } } as any);
    expect(listed.status).toBe(500);
    expect(JSON.stringify(await listed.json())).not.toContain('10.0.0.5');

    guard.refuseIfNoAccess.mockReset().mockResolvedValue(null);
    updateProject.mockReset().mockRejectedValue(new Error('connection to 10.0.0.5 refused'));
    const updated = await PUT({ request: new Request('http://localhost/api/projects', { method: 'PUT', body: JSON.stringify({ id: 4, name: 'x' }) }), locals: { user: { email: 'ada@example.com', role: 'user' } } } as any);
    expect(updated.status).toBe(500);
    expect(JSON.stringify(await updated.json())).not.toContain('10.0.0.5');
  });
});
