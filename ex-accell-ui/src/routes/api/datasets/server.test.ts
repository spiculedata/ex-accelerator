import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
  checkUserAccess: vi.fn(),
  linkDatasetToWorkspace: vi.fn(),
  grantDatasetPermission: vi.fn()
}));

vi.mock('$lib/services/datasetsDb', () => ({ datasetsDb: db }));
const access = vi.hoisted(() => ({ checkAccess: vi.fn() }));
vi.mock('$lib/server/auth/accessCheck', () => access);

import { POST } from './+server';

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
