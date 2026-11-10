import { describe, it, expect, vi, beforeEach } from 'vitest';

const createWorkspace = vi.hoisted(() => vi.fn());
const getWorkspaceById = vi.hoisted(() => vi.fn());
const deleteWorkspace = vi.hoisted(() => vi.fn());
const repo = vi.hoisted(() => ({ loadProjectAccessInfo: vi.fn() }));

vi.mock('$lib/services/projectsDb', () => ({ projectsDb: { createWorkspace, getWorkspaceById, deleteWorkspace } }));
vi.mock('$lib/server/auth/accessRepo', () => repo);
const access = vi.hoisted(() => ({ checkAccess: vi.fn() }));
vi.mock('$lib/server/auth/accessCheck', () => access);

import { DELETE, POST } from './+server';

const call = (body: unknown, user: { email: string } | null) =>
  POST({
    request: new Request('http://localhost/api/workspaces', { method: 'POST', body: JSON.stringify(body) }),
    locals: { user }
  } as unknown as Parameters<typeof POST>[0]);

beforeEach(() => {
  access.checkAccess.mockReset();
  access.checkAccess.mockResolvedValue({ allowed: true });
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

describe('POST /api/workspaces and project membership', () => {
  it('refuses to add a workspace to a project the person is not a member of, creating nothing', async () => {
    access.checkAccess.mockResolvedValue({ allowed: false, what: 'project' });
    const response = await call({ project_id: 1, name: 'w' }, { email: 'bob@example.com' });
    expect(response.status).toBe(403);
    expect(createWorkspace).not.toHaveBeenCalled();
    expect(access.checkAccess).toHaveBeenCalledWith(expect.anything(), { projects: [1], workspaces: [], malformed: [] });
  });
});

describe('DELETE /api/workspaces', () => {
  const del = (user: unknown, id = '4') => DELETE({ url: new URL(`http://localhost/api/workspaces?id=${id}`), locals: { user } } as any);
  const project = { createdBy: 'ada@example.com', memberEmails: ['ada@example.com', 'bob@example.com', 'cy@example.com'] };

  beforeEach(() => {
    getWorkspaceById.mockReset().mockResolvedValue({ id: 4, project_id: 1, created_by: 'bob@example.com' });
    deleteWorkspace.mockReset().mockResolvedValue(true);
    repo.loadProjectAccessInfo.mockReset().mockResolvedValue(project);
  });

  it('lets the workspace creator, the project creator and an admin delete it', async () => {
    for (const user of [{ email: 'bob@example.com', role: 'user' }, { email: 'ada@example.com', role: 'user' }, { email: 'root@example.com', role: 'admin' }]) {
      expect((await del(user)).status).toBe(200);
    }
    expect(deleteWorkspace).toHaveBeenCalledWith(4);
  });

  it('refuses another member, who may use the workspace but not destroy it', async () => {
    expect((await del({ email: 'cy@example.com', role: 'user' })).status).toBe(403);
    expect(deleteWorkspace).not.toHaveBeenCalled();
  });

  it('says 404 for a workspace that does not exist, and 400 for a malformed id', async () => {
    getWorkspaceById.mockResolvedValue(null);
    expect((await del({ email: 'ada@example.com', role: 'user' })).status).toBe(404);
    expect((await del({ email: 'ada@example.com', role: 'user' }, '4abc')).status).toBe(400);
  });

  it('answers a failure with a generic message', async () => {
    getWorkspaceById.mockRejectedValue(new Error('connection to 10.0.0.5 refused'));
    const response = await del({ email: 'ada@example.com', role: 'user' });
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('10.0.0.5');
  });
});
