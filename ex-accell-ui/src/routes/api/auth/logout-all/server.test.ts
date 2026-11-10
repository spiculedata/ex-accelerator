import { beforeEach, describe, expect, it, vi } from 'vitest';

const revokeSessions = vi.hoisted(() => vi.fn());
vi.mock('$lib/server/auth/revocation', () => ({ revokeSessions }));
vi.mock('$lib/server/auth/runtime', () => ({ SESSION_COOKIE: 'ex_session' }));
vi.mock('$lib/utils/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

import { POST } from './+server';

const call = (user: { id: string } | null) => {
  const deleted: string[] = [];
  const response = POST({ locals: { user }, cookies: { delete: (name: string) => deleted.push(name) } } as unknown as Parameters<typeof POST>[0]);
  return { response, deleted };
};

beforeEach(() => {
  revokeSessions.mockReset();
});

describe('POST /api/auth/logout-all', () => {
  it('ends every session of the caller and clears this device\'s cookie', async () => {
    revokeSessions.mockResolvedValue(2);
    const { response, deleted } = call({ id: 'u1' });
    expect((await response).status).toBe(200);
    expect(revokeSessions).toHaveBeenCalledWith('u1');
    expect(deleted).toEqual(['ex_session']);
  });

  it('refuses a caller who is not signed in, and revokes nothing', async () => {
    const { response } = call(null);
    expect((await response).status).toBe(401);
    expect(revokeSessions).not.toHaveBeenCalled();
  });

  it('says so, without detail, when it cannot revoke, and keeps the cookie', async () => {
    revokeSessions.mockRejectedValue(new Error('relation "app_users" does not exist'));
    const { response, deleted } = call({ id: 'u1' });
    const result = await response;
    expect(result.status).toBe(500);
    expect(JSON.stringify(await result.json())).not.toContain('app_users');
    expect(deleted).toEqual([]);
  });
});
