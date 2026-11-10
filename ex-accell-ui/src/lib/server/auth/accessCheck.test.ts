import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({ loadProjectAccessInfo: vi.fn(), projectIdOfWorkspace: vi.fn() }));
vi.mock('./accessRepo', () => repo);

import { checkAccess, resetAccessCacheForTests } from './accessCheck';

const user = (email: string, role: 'admin' | 'user' | 'viewer' = 'user') => ({ id: 'u', email, name: 'N', role });
const members = { createdBy: 'ada@example.com', memberEmails: ['ada@example.com'] };

beforeEach(() => {
  repo.loadProjectAccessInfo.mockReset();
  repo.projectIdOfWorkspace.mockReset();
  resetAccessCacheForTests();
});

describe('checkAccess', () => {
  it('allows a request that names no project or workspace without touching the database', async () => {
    expect(await checkAccess(user('bob@example.com'), { projects: [], workspaces: [] })).toEqual({ allowed: true });
    expect(repo.loadProjectAccessInfo).not.toHaveBeenCalled();
  });

  it('allows a member and refuses someone else, for a project', async () => {
    repo.loadProjectAccessInfo.mockResolvedValue(members);
    expect((await checkAccess(user('ada@example.com'), { projects: [1], workspaces: [] })).allowed).toBe(true);
    expect(await checkAccess(user('bob@example.com'), { projects: [1], workspaces: [] })).toEqual({ allowed: false, what: 'project' });
  });

  it('decides a workspace by its project', async () => {
    repo.projectIdOfWorkspace.mockResolvedValue(1);
    repo.loadProjectAccessInfo.mockResolvedValue(members);
    expect((await checkAccess(user('ada@example.com'), { projects: [], workspaces: [9] })).allowed).toBe(true);
    expect(await checkAccess(user('bob@example.com'), { projects: [], workspaces: [9] })).toEqual({ allowed: false, what: 'workspace' });
  });

  it('refuses if any one of several named resources is off limits', async () => {
    repo.loadProjectAccessInfo.mockImplementation(async (id: number) => (id === 1 ? members : { createdBy: 'bob@example.com', memberEmails: ['bob@example.com'] }));
    expect((await checkAccess(user('bob@example.com'), { projects: [1, 2], workspaces: [] })).allowed).toBe(false);
  });

  it('leaves a resource that does not exist to the handler, which answers 404', async () => {
    repo.loadProjectAccessInfo.mockResolvedValue(null);
    repo.projectIdOfWorkspace.mockResolvedValue(null);
    expect((await checkAccess(user('bob@example.com'), { projects: [404], workspaces: [405] })).allowed).toBe(true);
  });

  it('lets an admin in without asking who the members are', async () => {
    expect((await checkAccess(user('root@example.com', 'admin'), { projects: [1], workspaces: [9] })).allowed).toBe(true);
    expect(repo.loadProjectAccessInfo).not.toHaveBeenCalled();
  });

  it('remembers membership for a short while, and forgets it when told', async () => {
    repo.loadProjectAccessInfo.mockResolvedValue(members);
    await checkAccess(user('ada@example.com'), { projects: [1], workspaces: [] });
    await checkAccess(user('ada@example.com'), { projects: [1], workspaces: [] });
    expect(repo.loadProjectAccessInfo).toHaveBeenCalledTimes(1);
  });

  it('raises the database error instead of guessing, so the caller can answer 503', async () => {
    repo.loadProjectAccessInfo.mockRejectedValue(new Error('db down'));
    await expect(checkAccess(user('bob@example.com'), { projects: [1], workspaces: [] })).rejects.toThrow('db down');
  });
});
