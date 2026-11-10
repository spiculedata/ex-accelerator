import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({ loadProjectAccessInfo: vi.fn(), projectIdOfWorkspace: vi.fn() }));
vi.mock('./accessRepo', () => repo);

import { checkAccess, forgetProjectAccess, resetAccessCacheForTests } from './accessCheck';

const user = (email: string, role: 'admin' | 'user' | 'viewer' = 'user') => ({ id: 'u', email, name: 'N', role });
const members = { createdBy: 'ada@example.com', memberEmails: ['ada@example.com'] };

beforeEach(() => {
  repo.loadProjectAccessInfo.mockReset();
  repo.projectIdOfWorkspace.mockReset();
  resetAccessCacheForTests();
});

describe('checkAccess', () => {
  it('allows a request that names no project or workspace without touching the database', async () => {
    expect(await checkAccess(user('bob@example.com'), { projects: [], workspaces: [], malformed: [] })).toEqual({ allowed: true });
    expect(repo.loadProjectAccessInfo).not.toHaveBeenCalled();
  });

  it('allows a member and refuses someone else, for a project', async () => {
    repo.loadProjectAccessInfo.mockResolvedValue(members);
    expect((await checkAccess(user('ada@example.com'), { projects: [1], workspaces: [], malformed: [] })).allowed).toBe(true);
    expect(await checkAccess(user('bob@example.com'), { projects: [1], workspaces: [], malformed: [] })).toEqual({ allowed: false, what: 'project' });
  });

  it('decides a workspace by its project', async () => {
    repo.projectIdOfWorkspace.mockResolvedValue(1);
    repo.loadProjectAccessInfo.mockResolvedValue(members);
    expect((await checkAccess(user('ada@example.com'), { projects: [], workspaces: [9], malformed: [] })).allowed).toBe(true);
    expect(await checkAccess(user('bob@example.com'), { projects: [], workspaces: [9], malformed: [] })).toEqual({ allowed: false, what: 'workspace' });
  });

  it('refuses if any one of several named resources is off limits', async () => {
    repo.loadProjectAccessInfo.mockImplementation(async (id: number) => (id === 1 ? members : { createdBy: 'bob@example.com', memberEmails: ['bob@example.com'] }));
    expect((await checkAccess(user('bob@example.com'), { projects: [1, 2], workspaces: [], malformed: [] })).allowed).toBe(false);
  });

  it('leaves a resource that does not exist to the handler, which answers 404', async () => {
    repo.loadProjectAccessInfo.mockResolvedValue(null);
    repo.projectIdOfWorkspace.mockResolvedValue(null);
    expect((await checkAccess(user('bob@example.com'), { projects: [404], workspaces: [405], malformed: [] })).allowed).toBe(true);
  });

  it('lets an admin in without asking who the members are', async () => {
    expect((await checkAccess(user('root@example.com', 'admin'), { projects: [1], workspaces: [9] })).allowed).toBe(true);
    expect(repo.loadProjectAccessInfo).not.toHaveBeenCalled();
  });

  it('remembers membership for a short while, and forgets it when told', async () => {
    repo.loadProjectAccessInfo.mockResolvedValue(members);
    await checkAccess(user('ada@example.com'), { projects: [1], workspaces: [], malformed: [] });
    await checkAccess(user('ada@example.com'), { projects: [1], workspaces: [], malformed: [] });
    expect(repo.loadProjectAccessInfo).toHaveBeenCalledTimes(1);
  });

  it('raises the database error instead of guessing, so the caller can answer 503', async () => {
    repo.loadProjectAccessInfo.mockRejectedValue(new Error('db down'));
    await expect(checkAccess(user('bob@example.com'), { projects: [1], workspaces: [], malformed: [] })).rejects.toThrow('db down');
  });

  it('does not remember that a project does not exist, so one created a moment later is not open to everyone for that long', async () => {
    repo.loadProjectAccessInfo.mockResolvedValueOnce(null); // someone probes the next id
    expect((await checkAccess(user('mallory@example.com'), { projects: [7], workspaces: [], malformed: [] })).allowed).toBe(true);
    repo.loadProjectAccessInfo.mockResolvedValueOnce({ createdBy: 'ada@example.com', memberEmails: ['ada@example.com'] }); // then it is created
    expect((await checkAccess(user('mallory@example.com'), { projects: [7], workspaces: [], malformed: [] })).allowed).toBe(false);
  });

  it('does not remember that a workspace does not exist either', async () => {
    repo.projectIdOfWorkspace.mockResolvedValueOnce(null);
    await checkAccess(user('mallory@example.com'), { projects: [], workspaces: [8], malformed: [] });
    repo.projectIdOfWorkspace.mockResolvedValueOnce(1);
    repo.loadProjectAccessInfo.mockResolvedValue({ createdBy: 'ada@example.com', memberEmails: ['ada@example.com'] });
    expect((await checkAccess(user('mallory@example.com'), { projects: [], workspaces: [8], malformed: [] })).allowed).toBe(false);
  });
});

describe('removing someone while a lookup is in flight', () => {
  it('does not let that lookup put the old membership back in the cache', async () => {
    let finishStale!: (value: typeof members) => void;
    repo.loadProjectAccessInfo
      .mockImplementationOnce(() => new Promise((resolve) => { finishStale = resolve; })) // started before the removal
      .mockResolvedValue({ createdBy: 'ada@example.com', memberEmails: ['ada@example.com'] }); // after: bob is gone

    const bob = user('bob@example.com');
    const inFlight = checkAccess(bob, { projects: [1], workspaces: [], malformed: [] });
    forgetProjectAccess(1); // the removal commits and the cache entry is forgotten while the lookup is still running
    finishStale({ createdBy: 'ada@example.com', memberEmails: ['ada@example.com', 'bob@example.com'] });
    expect((await inFlight).allowed).toBe(true); // this one request saw the old answer

    // the next request must ask again rather than trust the stale answer
    expect(await checkAccess(bob, { projects: [1], workspaces: [], malformed: [] })).toEqual({ allowed: false, what: 'project' });
  });
});
