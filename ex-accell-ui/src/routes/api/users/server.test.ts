import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({ listUsers: vi.fn(), createUser: vi.fn() }));
vi.mock('$lib/server/auth/userRepo', () => repo);
vi.mock('$lib/server/auth/runtime', () => ({ prepareAuth: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/utils/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

import { GET, POST } from './+server';

const admin = { user: { id: 'u1', role: 'admin' } };
const notAdmin = { user: { id: 'u2', role: 'user' } };

const created = { id: 'u9', email: 'new@x.co', name: 'New Person', role: 'user', passwordHash: 'scrypt$secret', sessionVersion: 0, isDisabled: false };
const create = (body: unknown) =>
  POST({ locals: admin, request: new Request('http://localhost/api/users', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }) } as any);
const good = { email: 'new@x.co', name: 'New Person', role: 'user', password: 'a-long-password-1' };

beforeEach(() => {
  repo.listUsers.mockReset();
  repo.createUser.mockReset().mockResolvedValue(created);
});

describe('when the caller is not an admin', () => {
  it('refuses in the handlers too, not only in the access guard', async () => {
    expect((await GET({ locals: notAdmin } as any)).status).toBe(403);
    const response = await POST({ locals: notAdmin, request: new Request('http://localhost/api/users', { method: 'POST', body: JSON.stringify(good) }) } as any);
    expect(response.status).toBe(403);
    expect(repo.listUsers).not.toHaveBeenCalled();
    expect(repo.createUser).not.toHaveBeenCalled();
  });
});

describe('GET /api/users', () => {
  it('lists people without any password data', async () => {
    repo.listUsers.mockResolvedValue([{ id: '1', email: 'a@b.co', name: 'A', role: 'admin', isDisabled: false, createdAt: null, lastLoginAt: null }]);
    const body = await (await GET({ locals: admin } as any)).json();
    expect(body.data.users).toHaveLength(1);
    expect(JSON.stringify(body)).not.toMatch(/password|hash/i);
  });

  it('answers a database failure with a generic message', async () => {
    repo.listUsers.mockRejectedValue(new Error('connection to 10.0.0.5 refused'));
    const response = await GET({ locals: admin } as any);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('10.0.0.5');
  });
});

describe('POST /api/users', () => {
  it('creates the account and returns it without the hash', async () => {
    const response = await create(good);
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(repo.createUser).toHaveBeenCalledWith({ email: 'new@x.co', name: 'New Person', role: 'user', password: 'a-long-password-1' });
    expect(body.data.user).toEqual({ id: 'u9', email: 'new@x.co', name: 'New Person', role: 'user', isDisabled: false });
    expect(JSON.stringify(body)).not.toMatch(/scrypt|passwordHash/);
  });

  it.each([
    ['a missing email', { ...good, email: undefined }],
    ['an email without a domain', { ...good, email: 'nobody' }],
    ['an email with spaces', { ...good, email: 'a b@x.co' }],
    ['a very long email', { ...good, email: `${'a'.repeat(250)}@x.co` }],
    ['an empty name', { ...good, name: '  ' }],
    ['a very long name', { ...good, name: 'n'.repeat(101) }],
    ['an unknown role', { ...good, role: 'root' }],
    ['a weak password', { ...good, password: 'short' }],
    ['non-text values', { ...good, email: 5 }]
  ])('refuses %s with a 400 and creates nothing', async (_label, body) => {
    expect((await create(body)).status).toBe(400);
    expect(repo.createUser).not.toHaveBeenCalled();
  });

  it('refuses a body that is not JSON', async () => {
    expect((await create('nope')).status).toBe(400);
  });

  it('answers a duplicate email with 409', async () => {
    repo.createUser.mockRejectedValue(Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' }));
    const response = await create(good);
    expect(response.status).toBe(409);
    expect(JSON.stringify(await response.json())).not.toContain('constraint');
  });

  it('answers any other failure with a generic 500', async () => {
    repo.createUser.mockRejectedValue(new Error('connection to 10.0.0.5 refused'));
    const response = await create(good);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('10.0.0.5');
  });
});
