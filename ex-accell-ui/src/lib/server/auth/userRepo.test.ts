import { describe, it, expect, vi, beforeEach } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('$lib/services/postgres', () => ({ query }));

import { bootstrapAdmin, findUserByEmail, createUser, getSessionVersion, bumpSessionVersion, ensureAuthSchema } from './userRepo';

beforeEach(() => {
  query.mockReset();
});

describe('findUserByEmail', () => {
  it('looks up case-insensitively with a parameterised query', async () => {
    query.mockResolvedValueOnce([{ id: '1', email: 'a@b.co', name: 'A', role: 'admin', password_hash: 'h', session_version: 2 }]);

    const user = await findUserByEmail('A@B.co');

    expect(query).toHaveBeenCalledWith(expect.stringContaining('lower(email) = lower($1)'), ['A@B.co']);
    expect(user).toEqual({ id: '1', email: 'a@b.co', name: 'A', role: 'admin', passwordHash: 'h', sessionVersion: 2 });
  });

  it('returns null when no row matches', async () => {
    query.mockResolvedValueOnce([]);

    expect(await findUserByEmail('none@x.co')).toBeNull();
  });
});

describe('createUser', () => {
  it('stores a hash, never the plaintext password', async () => {
    query.mockResolvedValueOnce([{ id: '9', email: 'n@x.co', name: 'N', role: 'user', password_hash: 'x' }]);

    await createUser({ email: 'n@x.co', name: 'N', role: 'user', password: 'a-long-password-1' });

    const params = query.mock.calls[0][1] as string[];
    expect(params).not.toContain('a-long-password-1');
    expect(params.some((value) => value.startsWith('scrypt$'))).toBe(true);
  });

  it('rejects weak passwords before touching the database', async () => {
    await expect(createUser({ email: 'n@x.co', name: 'N', role: 'user', password: 'short' })).rejects.toThrow(/at least 12/);
    expect(query).not.toHaveBeenCalled();
  });
});

describe('bootstrapAdmin', () => {
  const env = { ADMIN_EMAIL: 'root@x.co', ADMIN_PASSWORD: 'a-long-password-1', ADMIN_NAME: 'Root' };

  it('creates the first admin when there are no users', async () => {
    query
      .mockResolvedValueOnce([{ count: '0' }])
      .mockResolvedValueOnce([{ id: '1', email: 'root@x.co', name: 'Root', role: 'admin', password_hash: 'h' }]);

    expect(await bootstrapAdmin(env)).toBe('created');
    expect(query.mock.calls[1][1]).toContain('admin');
  });

  it('does nothing when users already exist', async () => {
    query.mockResolvedValueOnce([{ count: '3' }]);

    expect(await bootstrapAdmin(env)).toBe('skipped');
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('does nothing when ADMIN_EMAIL / ADMIN_PASSWORD are not set', async () => {
    query.mockResolvedValueOnce([{ count: '0' }]);

    expect(await bootstrapAdmin({})).toBe('no-credentials');
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('throws on a weak ADMIN_PASSWORD instead of creating a weak admin', async () => {
    query.mockResolvedValueOnce([{ count: '0' }]);

    await expect(bootstrapAdmin({ ADMIN_EMAIL: 'root@x.co', ADMIN_PASSWORD: 'weak' })).rejects.toThrow(/at least 12/);
  });
});

describe('session versions', () => {
  it('reads a user\'s current version, and null for a user who no longer exists', async () => {
    query.mockResolvedValueOnce([{ session_version: '3' }]);
    expect(await getSessionVersion('u1')).toBe(3);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM app_users WHERE id = $1'), ['u1']);
    query.mockResolvedValueOnce([]);
    expect(await getSessionVersion('gone')).toBeNull();
  });

  it('raises the version in one statement, so two changes at once both count, and returns the new one', async () => {
    query.mockResolvedValueOnce([{ session_version: 4 }]);
    expect(await bumpSessionVersion('u1')).toBe(4);
    const [sql] = query.mock.calls[0];
    expect(String(sql)).toContain('session_version = session_version + 1');
    expect(String(sql)).toContain('RETURNING');
  });

  it('adds the column to a users table made before versions existed', async () => {
    query.mockResolvedValue([]);
    await ensureAuthSchema();
    expect(query.mock.calls.some(([sql]) => String(sql).includes('ADD COLUMN IF NOT EXISTS session_version'))).toBe(true);
  });
});
