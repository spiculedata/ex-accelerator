import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
  checkUserAccess: vi.fn(),
  linkDatasetToWorkspace: vi.fn(),
  grantDatasetPermission: vi.fn(),
  getDatasets: vi.fn(),
  getWorkspaceDatasets: vi.fn(),
  unlinkDatasetFromWorkspace: vi.fn(),
  revokeDatasetPermission: vi.fn()
}));

vi.mock('$lib/services/datasetsDb', () => ({ datasetsDb: db }));
const access = vi.hoisted(() => ({ checkAccess: vi.fn() }));
vi.mock('$lib/server/auth/accessCheck', () => access);

import { DELETE, GET, POST } from './+server';

type Role = 'admin' | 'user' | 'viewer';
const user = (role: Role, email = 'ada@example.com') => ({ id: '1', email, name: 'Ada', role });

const call = (body: unknown, sessionUser: ReturnType<typeof user> | null) =>
  POST({
    request: new Request('http://localhost/api/datasets', { method: 'POST', body: JSON.stringify(body) }),
    locals: { user: sessionUser }
  } as unknown as Parameters<typeof POST>[0]);

beforeEach(() => {
  access.checkAccess.mockReset();
  access.checkAccess.mockResolvedValue({ allowed: true });
  Object.values(db).forEach((fn) => fn.mockReset());
  db.checkUserAccess.mockResolvedValue({ hasAccess: false, accessLevel: null });
  db.linkDatasetToWorkspace.mockResolvedValue({ id: 1 });
  db.grantDatasetPermission.mockResolvedValue({ id: 1 });
});

describe('POST /api/datasets action=link', () => {
  const link = { action: 'link', workspace_id: 4, dataset_id: 2 };

  it('checks access for, and records, the signed-in user rather than a name from the request', async () => {
    db.checkUserAccess.mockResolvedValue({ hasAccess: true, accessLevel: 'read' });

    const response = await call({ ...link, added_by: 'someone-else@example.com' }, user('user'));

    expect(response.status).toBe(200);
    expect(db.checkUserAccess).toHaveBeenCalledWith(2, 'ada@example.com');
    expect(db.linkDatasetToWorkspace).toHaveBeenCalledWith(4, 2, 'ada@example.com', {});
  });

  it('lets an admin link any dataset without an explicit permission', async () => {
    const response = await call(link, user('admin'));

    expect(response.status).toBe(200);
    expect(db.linkDatasetToWorkspace).toHaveBeenCalled();
  });

  it('refuses a member who has no access to the dataset', async () => {
    const response = await call(link, user('user'));

    expect(response.status).toBe(403);
    expect(db.linkDatasetToWorkspace).not.toHaveBeenCalled();
  });

  it('requires a workspace and a dataset', async () => {
    expect((await call({ action: 'link', workspace_id: 4 }, user('admin'))).status).toBe(400);
  });
});

describe('POST /api/datasets action=grant_permission', () => {
  const grant = { action: 'grant_permission', dataset_id: 2, user_email: 'bob@example.com', access_level: 'read' };

  it('lets an admin grant access, recorded as granted by the admin (not a name from the request)', async () => {
    const response = await call({ ...grant, granted_by: 'forged@example.com' }, user('admin', 'root@example.com'));

    expect(response.status).toBe(200);
    expect(db.grantDatasetPermission).toHaveBeenCalledWith(2, 'bob@example.com', 'read', 'root@example.com', null);
  });

  it('refuses a non-admin, so a member cannot give anyone access to any dataset', async () => {
    const response = await call(grant, user('user'));

    expect(response.status).toBe(403);
    expect(db.grantDatasetPermission).not.toHaveBeenCalled();
  });
});

describe('POST /api/datasets action=link and project membership', () => {
  it('refuses to link a dataset into a workspace of a project the person is not a member of', async () => {
    access.checkAccess.mockResolvedValue({ allowed: false, what: 'workspace' });
    const response = await call({ action: 'link', workspace_id: 3, dataset_id: 5 }, user('user', 'bob@example.com'));
    expect(response.status).toBe(403);
    expect(db.linkDatasetToWorkspace).not.toHaveBeenCalled();
  });
});

describe('datasets envelope', () => {
  const get = (query = '') => GET({ url: new URL(`http://localhost/api/datasets${query}`) } as never);
  const del = (query: string) => DELETE({ url: new URL(`http://localhost/api/datasets${query}`) } as never);

  it('GET returns the datasets in data and the legacy keys', async () => {
    db.getDatasets.mockResolvedValue([{ id: 1 }]);

    expect(await (await get()).json()).toEqual({ success: true, datasets: [{ id: 1 }], count: 1, data: [{ id: 1 }] });
  });

  it('GET with a workspace reads that workspace and refuses a non-numeric id', async () => {
    db.getWorkspaceDatasets.mockResolvedValue([]);

    expect((await get('?workspace_id=4')).status).toBe(200);
    expect(db.getWorkspaceDatasets).toHaveBeenCalledWith(4);

    const bad = await get('?workspace_id=abc');
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ success: false, data: null });
  });

  it('GET returns a generic 500 without the database message', async () => {
    db.getDatasets.mockRejectedValue(new Error('password authentication failed for user postgres'));

    const response = await get();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, data: null, error: 'Failed to fetch datasets' });
  });

  it('POST link returns the link in data and the legacy key, and a failure is a generic 500', async () => {
    const ok = await (await call({ action: 'link', workspace_id: 4, dataset_id: 2 }, user('admin'))).json();
    expect(ok).toMatchObject({ success: true, workspace_dataset: { id: 1 }, data: { id: 1 } });

    db.linkDatasetToWorkspace.mockRejectedValue(new Error('duplicate key at 10.0.0.5'));
    const failed = await call({ action: 'link', workspace_id: 4, dataset_id: 2 }, user('admin'));
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ success: false, data: null, error: 'Failed to process request' });
  });

  it.each([['not json'], ['[1]']])('POST refuses the body %s with 400', async (raw) => {
    const response = await POST({ request: new Request('http://localhost/api/datasets', { method: 'POST', body: raw }), locals: { user: user('admin') } } as never);

    expect(response.status).toBe(400);
  });

  it('POST refuses an unknown action with a failure envelope', async () => {
    const response = await call({ action: 'explode' }, user('admin'));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ success: false, data: null });
  });

  it('DELETE unlinks and revokes, and validates the ids and action', async () => {
    expect(await (await del('?action=unlink&dataset_id=2&workspace_id=4')).json()).toMatchObject({ success: true, data: null });
    expect(db.unlinkDatasetFromWorkspace).toHaveBeenCalledWith(4, 2);

    expect(await (await del('?action=revoke_permission&dataset_id=2&user_email=a@b.c')).json()).toMatchObject({ success: true });
    expect(db.revokeDatasetPermission).toHaveBeenCalledWith(2, 'a@b.c');

    for (const query of ['', '?action=unlink&dataset_id=x', '?action=unlink&dataset_id=2', '?action=unlink&dataset_id=2&workspace_id=x', '?action=nope&dataset_id=2']) {
      const response = await del(query);
      expect(response.status, query).toBe(400);
      expect(await response.json()).toMatchObject({ success: false, data: null });
    }
  });

  it('DELETE returns a generic 500 when the database fails', async () => {
    db.revokeDatasetPermission.mockRejectedValue(new Error('boom 10.0.0.5'));

    const response = await del('?action=revoke_permission&dataset_id=2&user_email=a@b.c');

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('10.0.0.5');
  });
});
