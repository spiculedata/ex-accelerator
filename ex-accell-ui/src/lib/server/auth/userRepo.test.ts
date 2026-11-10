import { describe, it, expect, vi, beforeEach } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('$lib/services/postgres', () => ({ query }));

import { bootstrapAdmin, findUserByEmail, createUser, getSessionVersion, bumpSessionVersion, ensureAuthSchema, listUsers, updateUserAccess, setUserPassword } from './userRepo';

beforeEach(() => {
  query.mockReset();
});

describe('findUserByEmail', () => {
  it('looks up case-insensitively with a parameterised query', async () => {
    query.mockResolvedValueOnce([{ id: '1', email: 'a@b.co', name: 'A', role: 'admin', password_hash: 'h', session_version: 2 }]);

    const user = await findUserByEmail('A@B.co');

    expect(query).toHaveBeenCalledWith(expect.stringContaining('lower(email) = lower($1)'), ['A@B.co']);
    expect(user).toEqual({ id: '1', email: 'a@b.co', name: 'A', role: 'admin', passwordHash: 'h', sessionVersion: 2, isDisabled: false });
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

describe('disabled users', () => {
  it('reports a disabled account on the record', async () => {
    query.mockResolvedValueOnce([{ id: '1', email: 'a@b.co', name: 'A', role: 'user', password_hash: 'h', session_version: 0, disabled_at: '2026-11-10T00:00:00Z' }]);
    expect((await findUserByEmail('a@b.co'))?.isDisabled).toBe(true);
  });

  it('gives no session version for a disabled user, so their sessions end', async () => {
    query.mockResolvedValueOnce([]);
    expect(await getSessionVersion('u1')).toBeNull();
    expect(String(query.mock.calls[0][0])).toContain('disabled_at IS NULL');
  });
});

describe('listUsers', () => {
  it('returns people without their password hashes, oldest first', async () => {
    query.mockResolvedValueOnce([{ id: '1', email: 'a@b.co', name: 'A', role: 'admin', disabled_at: null, created_at: '2026-01-01T00:00:00Z', last_login_at: null }]);
    const users = await listUsers();
    expect(users).toEqual([{ id: '1', email: 'a@b.co', name: 'A', role: 'admin', isDisabled: false, createdAt: '2026-01-01T00:00:00Z', lastLoginAt: null }]);
    expect(String(query.mock.calls[0][0])).not.toContain('password_hash');
    expect(String(query.mock.calls[0][0])).toContain('ORDER BY created_at');
  });
});

describe('updateUserAccess', () => {
  it('changes the role in one guarded statement that also ends the person\'s sessions', async () => {
    query.mockResolvedValueOnce([{ id: 'u1' }]);
    expect(await updateUserAccess('u1', { role: 'viewer' })).toBe('updated');
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toContain('session_version = session_version + 1');
    expect(String(sql)).toContain("role = 'admin'"); // the last-admin guard lives in the same statement
    expect(params).toContain('u1');
    expect(params).toContain('viewer');
  });

  it('says last-admin when the guard refused and the user exists', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'u1' }]);
    expect(await updateUserAccess('u1', { disabled: true })).toBe('last-admin');
  });

  it('says not-found when there is no such user', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    expect(await updateUserAccess('nope', { role: 'user' })).toBe('not-found');
  });

  it('does nothing when there is nothing to change', async () => {
    expect(await updateUserAccess('u1', {})).toBe('updated');
    expect(query).not.toHaveBeenCalled();
  });
});

describe('setUserPassword', () => {
  it('stores a hash and ends the sessions made with the old password, in one statement', async () => {
    query.mockResolvedValueOnce([{ session_version: 4 }]);
    const version = await setUserPassword('u1', 'a-brand-new-password');
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toContain('session_version = session_version + 1');
    expect((params as string[]).some((value) => String(value).startsWith('scrypt$'))).toBe(true);
    expect(params).not.toContain('a-brand-new-password');
    expect(version).toBe(4);
  });

  it('refuses a weak password before touching the database', async () => {
    await expect(setUserPassword('u1', 'short')).rejects.toThrow(/at least 12/);
    expect(query).not.toHaveBeenCalled();
  });

  it('throws when there is no such user', async () => {
    query.mockResolvedValueOnce([]);
    await expect(setUserPassword('nope', 'a-brand-new-password')).rejects.toThrow('No such user');
  });
});
