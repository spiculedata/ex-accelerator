import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({ getSessionVersion: vi.fn(), bumpSessionVersion: vi.fn(), ensureAuthSchema: vi.fn(), setUserPassword: vi.fn(), updateUserAccess: vi.fn() }));
vi.mock('./userRepo', () => repo);
vi.mock('$lib/utils/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

import { changePassword, changeUserAccess, isSessionCurrent, resetRevocationCacheForTests, revokeSessions } from './revocation';

beforeEach(() => {
  repo.getSessionVersion.mockReset();
  repo.bumpSessionVersion.mockReset();
  repo.ensureAuthSchema.mockReset();
  repo.ensureAuthSchema.mockResolvedValue(undefined);
  resetRevocationCacheForTests();
});

describe('isSessionCurrent', () => {
  it('accepts a session issued under the current version', async () => {
    repo.getSessionVersion.mockResolvedValue(2);
    expect(await isSessionCurrent('u1', 2)).toBe('current');
  });

  it('refuses a session issued before the version was raised', async () => {
    repo.getSessionVersion.mockResolvedValue(3);
    expect(await isSessionCurrent('u1', 2)).toBe('revoked');
  });

  it('refuses a session whose user no longer exists', async () => {
    repo.getSessionVersion.mockResolvedValue(null);
    expect(await isSessionCurrent('gone', 0)).toBe('revoked');
  });

  it('says "unknown", not "revoked", when the database cannot be asked and nothing is known, so an outage never ends anyone\'s session', async () => {
    repo.getSessionVersion.mockRejectedValue(new Error('db down'));
    expect(await isSessionCurrent('u1', 0)).toBe('unknown');
  });

  it('makes sure the users table has the version column before asking, so an upgraded install works before anyone signs in', async () => {
    repo.getSessionVersion.mockResolvedValue(0);
    await isSessionCurrent('u1', 0);
    expect(repo.ensureAuthSchema).toHaveBeenCalled();
    expect(repo.ensureAuthSchema.mock.invocationCallOrder[0]).toBeLessThan(repo.getSessionVersion.mock.invocationCallOrder[0]);
  });
});

describe('revokeSessions', () => {
  it('ends the user\'s existing sessions at once on this instance, without waiting for the cache to expire', async () => {
    repo.getSessionVersion.mockResolvedValue(0);
    expect(await isSessionCurrent('u1', 0)).toBe('current'); // cached as version 0

    repo.bumpSessionVersion.mockResolvedValue(1);
    repo.getSessionVersion.mockResolvedValue(1);
    expect(await revokeSessions('u1')).toBe(1);

    expect(await isSessionCurrent('u1', 0)).toBe('revoked'); // the old session is gone immediately
    expect(await isSessionCurrent('u1', 1)).toBe('current'); // a new sign-in works
  });
});

describe('changePassword', () => {
  it('ends older sessions on this instance at once, not after the cache expires, and returns the version for a new session', async () => {
    repo.getSessionVersion.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    expect(await isSessionCurrent('u1', 1)).toBe('current'); // now remembered
    repo.setUserPassword.mockResolvedValue({ sessionVersion: 2, role: 'user', name: 'A' });

    expect(await changePassword('u1', 'a-brand-new-password')).toEqual({ sessionVersion: 2, role: 'user', name: 'A' });

    expect(repo.setUserPassword).toHaveBeenCalledWith('u1', 'a-brand-new-password');
    expect(await isSessionCurrent('u1', 1)).toBe('revoked');
    expect(await isSessionCurrent('u1', 2)).toBe('current');
  });
});

describe('changeUserAccess', () => {
  it('forgets the remembered version after a change so a demoted or disabled person loses access at once', async () => {
    repo.getSessionVersion.mockResolvedValueOnce(0).mockResolvedValueOnce(null);
    expect(await isSessionCurrent('u1', 0)).toBe('current');
    repo.updateUserAccess.mockResolvedValue('updated');

    expect(await changeUserAccess('u1', { disabled: true })).toBe('updated');

    expect(repo.updateUserAccess).toHaveBeenCalledWith('u1', { disabled: true });
    expect(await isSessionCurrent('u1', 0)).toBe('revoked');
  });

  it('passes a refusal through without touching the cache', async () => {
    repo.updateUserAccess.mockResolvedValue('last-admin');
    expect(await changeUserAccess('u1', { role: 'user' })).toBe('last-admin');
  });
});
