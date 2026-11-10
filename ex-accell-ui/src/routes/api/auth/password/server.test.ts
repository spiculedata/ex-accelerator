import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUserByEmail: vi.fn(),
  verifyPassword: vi.fn(),
  changePassword: vi.fn(),
  blocked: false,
  recordFailure: vi.fn(),
  reset: vi.fn(),
  forgive: vi.fn()
}));

vi.mock('$lib/server/auth/userRepo', () => ({ findUserByEmail: mocks.findUserByEmail }));
vi.mock('$lib/server/auth/revocation', () => ({ changePassword: mocks.changePassword }));
vi.mock('$lib/server/auth/password', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/auth/password')>()),
  verifyPassword: mocks.verifyPassword
}));
vi.mock('$lib/server/auth/runtime', () => ({
  SESSION_COOKIE: 'ex_session',
  getAuthConfig: () => ({ sessionSecret: 's'.repeat(32), sessionTtlSeconds: 3600, secureCookies: false }),
  prepareAuth: vi.fn().mockResolvedValue(undefined),
  loginThrottle: { isBlocked: () => mocks.blocked, recordFailure: mocks.recordFailure, reset: mocks.reset, forgive: mocks.forgive }
}));
vi.mock('$lib/utils/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

import { POST } from './+server';
import { verifySessionToken } from '$lib/server/auth/session';

const user = { id: 'u1', email: 'a@b.co', name: 'A', role: 'user' as const };
const stored = { ...user, passwordHash: 'h', sessionVersion: 1, isDisabled: false };

const call = (body: unknown, signedIn: typeof user | null = user) => {
  const cookies = { set: vi.fn(), delete: vi.fn() };
  const request = new Request('http://localhost/api/auth/password', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
  const response = POST({ request, cookies, locals: { user: signedIn } } as unknown as Parameters<typeof POST>[0]);
  return { cookies, response };
};

const good = { currentPassword: 'the-old-password-1', newPassword: 'a-brand-new-password' };

beforeEach(() => {
  mocks.blocked = false;
  mocks.findUserByEmail.mockReset().mockResolvedValue(stored);
  mocks.verifyPassword.mockReset().mockResolvedValue(true);
  mocks.changePassword.mockReset().mockResolvedValue({ sessionVersion: 2, role: 'user', name: 'A' });
  mocks.recordFailure.mockClear();
  mocks.reset.mockClear();
  mocks.forgive.mockClear();
});

describe('POST /api/auth/password', () => {
  it('changes the password, ends other sessions, and keeps this one signed in under the new version', async () => {
    const { cookies, response } = call(good);
    expect((await response).status).toBe(200);

    expect(mocks.changePassword).toHaveBeenCalledWith('u1', 'a-brand-new-password');
    const [name, token] = cookies.set.mock.calls[0];
    expect(name).toBe('ex_session');
    expect(verifySessionToken(token, 's'.repeat(32))).toMatchObject({ id: 'u1' });
    expect(token).toBeTruthy();
    expect(mocks.reset).toHaveBeenCalled();
  });

  it('signs the new session from the stored role and name, not from the old cookie', async () => {
    // The cookie says admin, but the account was demoted a moment ago
    mocks.changePassword.mockResolvedValue({ sessionVersion: 3, role: 'viewer', name: 'Renamed' });
    const { cookies, response } = call(good, { ...user, role: 'admin' as never });
    expect((await response).status).toBe(200);
    expect(verifySessionToken(cookies.set.mock.calls[0][1], 's'.repeat(32))).toMatchObject({ id: 'u1', role: 'viewer', name: 'Renamed' });
  });

  it('refuses a wrong current password, counts it, and changes nothing', async () => {
    mocks.verifyPassword.mockResolvedValue(false);
    const { cookies, response } = call(good);
    const result = await response;
    expect(result.status).toBe(401);
    expect(mocks.recordFailure).toHaveBeenCalled();
    expect(mocks.changePassword).not.toHaveBeenCalled();
    expect(cookies.set).not.toHaveBeenCalled();
  });

  it('stops after too many wrong guesses, before checking anything', async () => {
    mocks.blocked = true;
    const result = await call(good).response;
    expect(result.status).toBe(429);
    expect(mocks.verifyPassword).not.toHaveBeenCalled();
  });

  it.each([
    ['a weak new password', { ...good, newPassword: 'short' }],
    ['the same password again', { currentPassword: 'same-password-123', newPassword: 'same-password-123' }],
    ['a missing field', { currentPassword: 'x' }],
    ['non-text values', { currentPassword: 1, newPassword: 2 }]
  ])('refuses %s with a 400 before touching the account', async (_label, body) => {
    const result = await call(body).response;
    expect(result.status).toBe(400);
    expect(mocks.changePassword).not.toHaveBeenCalled();
  });

  it('refuses a body that is not JSON', async () => {
    expect((await call('nope').response).status).toBe(400);
  });

  it('refuses a caller who is not signed in', async () => {
    const result = await call(good, null).response;
    expect(result.status).toBe(401);
    expect(mocks.changePassword).not.toHaveBeenCalled();
  });

  it('answers a database failure with a generic message', async () => {
    mocks.changePassword.mockRejectedValue(new Error('connection to 10.0.0.5 refused'));
    const result = await call(good).response;
    expect(result.status).toBe(500);
    expect(JSON.stringify(await result.json())).not.toContain('10.0.0.5');
    expect(mocks.forgive).toHaveBeenCalled();
  });
});
