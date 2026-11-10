import { beforeEach, describe, expect, it, vi } from 'vitest';

const check = vi.hoisted(() => ({ checkAccess: vi.fn() }));
const repo = vi.hoisted(() => ({ listProjectAccessInfo: vi.fn() }));
vi.mock('./accessCheck', () => check);
vi.mock('./accessRepo', () => repo);

import { filterByWorkspaceAccess, refuseIfNoAccess, visibleProjectIds } from './accessGuard';

const bob = { id: '2', email: 'bob@example.com', name: 'B', role: 'user' as const };

beforeEach(() => {
  check.checkAccess.mockReset();
  repo.listProjectAccessInfo.mockReset();
});

describe('refuseIfNoAccess', () => {
  it('is null when the user may see what the route is about', async () => {
    check.checkAccess.mockResolvedValue({ allowed: true });
    expect(await refuseIfNoAccess(bob, { workspaces: [3] })).toBeNull();
    expect(check.checkAccess).toHaveBeenCalledWith(bob, { projects: [], workspaces: [3], malformed: [] });
  });

  it('is a 403 with the resource named when they may not', async () => {
    check.checkAccess.mockResolvedValue({ allowed: false, what: 'project' });
    const response = await refuseIfNoAccess(bob, { projects: [1] });
    expect(response?.status).toBe(403);
    expect((await response!.json()).error).toContain('project');
  });

  it('is a 503, not a refusal, when membership cannot be checked', async () => {
    check.checkAccess.mockRejectedValue(new Error('db down'));
    expect((await refuseIfNoAccess(bob, { projects: [1] }))?.status).toBe(503);
  });

  it('refuses a caller who is not signed in', async () => {
    expect((await refuseIfNoAccess(null, { projects: [1] }))?.status).toBe(401);
  });

  it('ignores ids that are missing, so a route\'s own required-field check answers', async () => {
    check.checkAccess.mockResolvedValue({ allowed: true });
    expect(await refuseIfNoAccess(bob, { projects: [undefined, null, '', 4] })).toBeNull();
    expect(check.checkAccess).toHaveBeenCalledWith(bob, { projects: [4], workspaces: [], malformed: [] });
  });

  it.each([' 9', '9 ', '+9', '09', '9abc', '9.5', 0, -1, 1.5, '1e3', {}, true])('refuses with 400, without checking, an id like %j that a route could read more loosely than the check does', async (bad) => {
    for (const ids of [{ projects: [bad] }, { workspaces: [bad] }]) {
      const response = await refuseIfNoAccess(bob, ids as never);
      expect(response?.status).toBe(400);
    }
    expect(check.checkAccess).not.toHaveBeenCalled();
  });
});

describe('visibleProjectIds', () => {
  it('is every project for an admin, without asking who the members are', async () => {
    expect(await visibleProjectIds({ ...bob, role: 'admin' })).toBeNull();
    expect(repo.listProjectAccessInfo).not.toHaveBeenCalled();
  });

  it('is only the projects the person may see', async () => {
    repo.listProjectAccessInfo.mockResolvedValue(
      new Map([
        [1, { createdBy: 'ada@example.com', memberEmails: ['ada@example.com'] }],
        [2, { createdBy: 'bob@example.com', memberEmails: ['bob@example.com'] }],
        [3, { createdBy: 'default_user', memberEmails: ['default_user'] }]
      ])
    );
    expect(await visibleProjectIds(bob)).toEqual(new Set([2, 3]));
  });
});

describe('filterByWorkspaceAccess', () => {
  const rows = [{ id: 1, workspace_id: 10 }, { id: 2, workspace_id: 20 }, { id: 3, workspace_id: null }, { id: 4, workspace_id: 10 }];

  it('keeps everything for an admin, without asking', async () => {
    expect(await filterByWorkspaceAccess({ ...bob, role: 'admin' }, rows, (r) => r.workspace_id)).toEqual(rows);
    expect(check.checkAccess).not.toHaveBeenCalled();
  });

  it('keeps the rows whose workspace the person may see, and rows that belong to no workspace', async () => {
    check.checkAccess.mockImplementation(async (_u: unknown, r: { workspaces: number[] }) => (r.workspaces[0] === 10 ? { allowed: true } : { allowed: false, what: 'workspace' }));
    expect((await filterByWorkspaceAccess(bob, rows, (r) => r.workspace_id)).map((r) => r.id)).toEqual([1, 3, 4]);
    expect(check.checkAccess).toHaveBeenCalledTimes(2); // each workspace asked once, however many rows it has
  });
});
