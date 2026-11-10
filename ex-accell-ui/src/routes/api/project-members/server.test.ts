import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({ loadProjectAccessInfo: vi.fn() }));
const db = vi.hoisted(() => ({ addProjectMember: vi.fn(), removeProjectMember: vi.fn(), getProjectMembers: vi.fn() }));
const cache = vi.hoisted(() => ({ forgetProjectAccess: vi.fn() }));
const guard = vi.hoisted(() => ({ refuseIfNoAccess: vi.fn() }));
vi.mock('$lib/server/auth/accessRepo', () => repo);
vi.mock('$lib/services/projectsDb', () => ({ projectsDb: db }));
vi.mock('$lib/server/auth/accessCheck', () => cache);
vi.mock('$lib/server/auth/accessGuard', () => guard);

import { DELETE, GET, POST } from './+server';

const creator = { id: '1', email: 'ada@example.com', name: 'Ada', role: 'user' };
const member = { id: '2', email: 'bob@example.com', name: 'Bob', role: 'user' };
const admin = { id: '3', email: 'root@example.com', name: 'Root', role: 'admin' };
const viewer = { id: '4', email: 'ada@example.com', name: 'Ada', role: 'viewer' };

const info = { createdBy: 'ada@example.com', memberEmails: ['ada@example.com', 'bob@example.com'] };

const post = (user: unknown, body: unknown) =>
  POST({ request: new Request('http://localhost/api/project-members', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }), locals: { user } } as any);
const del = (user: unknown, search: string) => DELETE({ url: new URL(`http://localhost/api/project-members${search}`), locals: { user } } as any);
const get = (user: unknown, search: string) => GET({ url: new URL(`http://localhost/api/project-members${search}`), locals: { user } } as any);

beforeEach(() => {
  repo.loadProjectAccessInfo.mockReset().mockResolvedValue(info);
  db.addProjectMember.mockReset().mockResolvedValue(true);
  db.removeProjectMember.mockReset().mockResolvedValue(true);
  db.getProjectMembers.mockReset().mockResolvedValue([{ id: 1, project_id: 7, email: 'bob@example.com', role: 'member', added_at: '2026-11-01' }]);
  cache.forgetProjectAccess.mockReset();
  guard.refuseIfNoAccess.mockReset().mockResolvedValue(null);
});

describe('GET /api/project-members', () => {
  it('lists the members, the creator, and whether the caller may change them', async () => {
    const body = await (await get(creator, '?project_id=7')).json();
    expect(body.data.members).toEqual([{ email: 'bob@example.com', role: 'member', addedAt: '2026-11-01' }]);
    expect(body.data.createdBy).toBe('ada@example.com');
    expect(body.data.canManage).toBe(true);
    expect((await (await get(member, '?project_id=7')).json()).data.canManage).toBe(false);
  });

  it('is refused for someone outside the project, and for a malformed id', async () => {
    guard.refuseIfNoAccess.mockResolvedValue(new Response('no', { status: 403 }));
    expect((await get(member, '?project_id=7')).status).toBe(403);
    guard.refuseIfNoAccess.mockResolvedValue(null);
    for (const search of ['', '?project_id=7abc', '?project_id=0', '?project_id=%201']) expect((await get(creator, search)).status).toBe(400);
  });

  it('says 404 for a project that does not exist', async () => {
    repo.loadProjectAccessInfo.mockResolvedValue(null);
    expect((await get(admin, '?project_id=999')).status).toBe(404);
  });
});

describe('POST /api/project-members', () => {
  it('lets the creator add someone, stored in lower case, and forgets the cached answer so it applies at once', async () => {
    const response = await post(creator, { project_id: 7, email: ' New.Person@Example.com ' });
    expect(response.status).toBe(200);
    expect(db.addProjectMember).toHaveBeenCalledWith(7, 'new.person@example.com', 'member');
    expect(cache.forgetProjectAccess).toHaveBeenCalledWith(7);
  });

  it('lets an admin add someone to any project', async () => {
    expect((await post(admin, { project_id: 7, email: 'x@example.com' })).status).toBe(200);
  });

  it('refuses an ordinary member, a viewer, and someone outside, adding nothing', async () => {
    for (const user of [member, viewer, { ...member, email: 'eve@example.com' }]) {
      expect((await post(user, { project_id: 7, email: 'x@example.com' })).status).toBe(403);
    }
    expect(db.addProjectMember).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing project', { email: 'x@example.com' }],
    ['a non-canonical project id', { project_id: '7abc', email: 'x@example.com' }],
    ['a missing email', { project_id: 7 }],
    ['an invalid email', { project_id: 7, email: 'nobody' }],
    ['non-text email', { project_id: 7, email: 5 }]
  ])('refuses %s with a 400', async (_label, body) => {
    expect((await post(creator, body)).status).toBe(400);
    expect(db.addProjectMember).not.toHaveBeenCalled();
  });

  it('refuses a body that is not JSON, and a project that does not exist', async () => {
    expect((await post(creator, 'nope')).status).toBe(400);
    repo.loadProjectAccessInfo.mockResolvedValue(null);
    expect((await post(creator, { project_id: 7, email: 'x@example.com' })).status).toBe(404);
  });

  it('answers a failed save with a generic 500', async () => {
    db.addProjectMember.mockResolvedValue(false);
    const response = await post(creator, { project_id: 7, email: 'x@example.com' });
    expect(response.status).toBe(500);
  });
});

describe('DELETE /api/project-members', () => {
  it('lets the creator remove a member and forgets the cached answer', async () => {
    expect((await del(creator, '?project_id=7&email=bob%40example.com')).status).toBe(200);
    expect(db.removeProjectMember).toHaveBeenCalledWith(7, 'bob@example.com');
    expect(cache.forgetProjectAccess).toHaveBeenCalledWith(7);
  });

  it('refuses a member removing someone, and removing the creator', async () => {
    expect((await del(member, '?project_id=7&email=ada%40example.com')).status).toBe(403);
    expect((await del(creator, '?project_id=7&email=ADA%40example.com')).status).toBe(400);
    expect(db.removeProjectMember).not.toHaveBeenCalled();
  });

  it('refuses a missing or malformed id or email', async () => {
    for (const search of ['', '?project_id=7', '?project_id=x&email=a%40b.co', '?project_id=7&email=nobody']) {
      expect((await del(creator, search)).status).toBe(400);
    }
  });
});
