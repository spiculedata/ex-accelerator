import { describe, it, expect, vi, beforeEach } from 'vitest';

const createWorkspace = vi.hoisted(() => vi.fn());
const getWorkspaceById = vi.hoisted(() => vi.fn());
const deleteWorkspace = vi.hoisted(() => vi.fn());
const updateWorkspace = vi.hoisted(() => vi.fn());
const getWorkspacesByProject = vi.hoisted(() => vi.fn());
const getWorkspaceDataSources = vi.hoisted(() => vi.fn());
const repo = vi.hoisted(() => ({ loadProjectAccessInfo: vi.fn() }));

vi.mock('$lib/services/projectsDb', () => ({ projectsDb: { createWorkspace, getWorkspaceById, deleteWorkspace, updateWorkspace, getWorkspacesByProject, getWorkspaceDataSources } }));
vi.mock('$lib/server/auth/accessRepo', () => repo);
const access = vi.hoisted(() => ({ checkAccess: vi.fn() }));
vi.mock('$lib/server/auth/accessCheck', () => access);

import { DELETE, GET, POST, PUT } from './+server';

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

describe('workspaces envelope', () => {
  const get = (query: string) => GET({ url: new URL(`http://localhost/api/workspaces${query}`) } as never);
  const put = (body: unknown) =>
    PUT({ request: new Request('http://localhost/api/workspaces', { method: 'PUT', body: typeof body === 'string' ? body : JSON.stringify(body) }), locals: { user: { email: 'ada@example.com' } } } as never);

  it('GET by id returns the workspace with its data sources in data and the legacy key', async () => {
    getWorkspaceById.mockResolvedValue({ id: 4 });
    getWorkspaceDataSources.mockResolvedValue([{ id: 'ds' }]);

    const body = await (await get('?id=4')).json();

    expect(body).toEqual({ success: true, workspace: { id: 4, dataSources: [{ id: 'ds' }] }, data: { id: 4, dataSources: [{ id: 'ds' }] } });
  });

  it('GET by project returns the list; no filter or a non-numeric one is a 400; unknown id is 404', async () => {
    getWorkspacesByProject.mockResolvedValue([{ id: 1 }]);
    expect(await (await get('?project_id=2')).json()).toMatchObject({ success: true, workspaces: [{ id: 1 }], data: [{ id: 1 }] });

    expect((await get('')).status).toBe(400);
    expect((await get('?id=abc')).status).toBe(400);

    getWorkspaceById.mockResolvedValue(null);
    expect(await (await get('?id=9')).json()).toEqual({ success: false, data: null, error: 'Workspace not found' });
  });

  it('GET returns a generic 500 without the database message', async () => {
    getWorkspacesByProject.mockRejectedValue(new Error('password authentication failed'));

    const response = await get('?project_id=2');

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, data: null, error: 'Failed to load workspaces' });
  });

  it('POST returns the new workspace in data, refuses a bad body with 400, and hides a database failure', async () => {
    expect(await (await call({ project_id: 1, name: 'w' }, { email: 'ada@example.com' })).json()).toEqual({ success: true, workspace: { id: 4 }, data: { id: 4 } });

    const bad = await POST({ request: new Request('http://localhost/x', { method: 'POST', body: 'not json' }), locals: { user: { email: 'a@b.c' } } } as never);
    expect(bad.status).toBe(400);

    createWorkspace.mockRejectedValue(new Error('duplicate key 10.0.0.5'));
    const failed = await call({ project_id: 1, name: 'w' }, { email: 'ada@example.com' });
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ success: false, data: null, error: 'Failed to create the workspace' });
  });

  it('PUT updates, needs an id, 404s an unknown workspace and refuses a bad body', async () => {
    updateWorkspace.mockResolvedValue({ id: 4, name: 'new' });
    expect(await (await put({ id: 4, name: 'new' })).json()).toMatchObject({ success: true, data: { id: 4, name: 'new' } });
    expect(updateWorkspace).toHaveBeenCalledWith(4, { name: 'new' });

    expect((await put({ name: 'x' })).status).toBe(400);
    expect((await put('not json')).status).toBe(400);

    updateWorkspace.mockResolvedValue(null);
    expect((await put({ id: 5, name: 'x' })).status).toBe(404);
  });

  it('PUT returns a generic 500 without the database message', async () => {
    updateWorkspace.mockRejectedValue(new Error('boom 10.0.0.5'));

    const response = await put({ id: 4, name: 'x' });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, data: null, error: 'Failed to update the workspace' });
  });
});
