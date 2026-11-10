import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({ getSessionVersion: vi.fn(), bumpSessionVersion: vi.fn() }));
vi.mock('./userRepo', () => repo);
vi.mock('$lib/utils/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

import { isSessionCurrent, resetRevocationCacheForTests, revokeSessions } from './revocation';

beforeEach(() => {
  repo.getSessionVersion.mockReset();
  repo.bumpSessionVersion.mockReset();
  resetRevocationCacheForTests();
});

describe('isSessionCurrent', () => {
  it('accepts a session issued under the current version', async () => {
    repo.getSessionVersion.mockResolvedValue(2);
    expect(await isSessionCurrent('u1', 2)).toBe(true);
  });

  it('refuses a session issued before the version was raised', async () => {
    repo.getSessionVersion.mockResolvedValue(3);
    expect(await isSessionCurrent('u1', 2)).toBe(false);
  });

  it('refuses a session whose user no longer exists', async () => {
    repo.getSessionVersion.mockResolvedValue(null);
    expect(await isSessionCurrent('gone', 0)).toBe(false);
  });

  it('refuses, rather than guesses, when the database cannot be asked and nothing is known', async () => {
    repo.getSessionVersion.mockRejectedValue(new Error('db down'));
    expect(await isSessionCurrent('u1', 0)).toBe(false);
  });
});

describe('revokeSessions', () => {
  it('ends the user\'s existing sessions at once on this instance, without waiting for the cache to expire', async () => {
    repo.getSessionVersion.mockResolvedValue(0);
    expect(await isSessionCurrent('u1', 0)).toBe(true); // cached as version 0

    repo.bumpSessionVersion.mockResolvedValue(1);
    repo.getSessionVersion.mockResolvedValue(1);
    expect(await revokeSessions('u1')).toBe(1);

    expect(await isSessionCurrent('u1', 0)).toBe(false); // the old session is gone immediately
    expect(await isSessionCurrent('u1', 1)).toBe(true); // a new sign-in works
  });
});
