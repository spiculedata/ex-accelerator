import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUserByEmail: vi.fn(),
  recordLogin: vi.fn().mockResolvedValue(undefined),
  prepare: vi.fn().mockResolvedValue(undefined),
  verifyPassword: vi.fn(),
  hashPassword: vi.fn().mockResolvedValue('scrypt$dummy'),
  blocked: false,
  recordFailure: vi.fn(),
  reset: vi.fn()
}));

vi.mock('$lib/server/auth/userRepo', () => ({
  findUserByEmail: mocks.findUserByEmail,
  recordLogin: mocks.recordLogin
}));
vi.mock('$lib/server/auth/password', () => ({
  verifyPassword: mocks.verifyPassword,
  hashPassword: mocks.hashPassword
}));
vi.mock('$lib/server/auth/runtime', () => ({
  SESSION_COOKIE: 'ex_session',
  getAuthConfig: () => ({ sessionSecret: 's'.repeat(32), sessionTtlSeconds: 3600, secureCookies: false }),
  prepareAuth: mocks.prepare,
  loginThrottle: {
    isBlocked: () => mocks.blocked,
    recordFailure: mocks.recordFailure,
    reset: mocks.reset
  }
}));

import { POST } from './+server';
import { verifySessionToken } from '$lib/server/auth/session';

const member = { id: '1', email: 'a@b.co', name: 'A', role: 'user', passwordHash: 'h' };

function call(body: unknown) {
  const cookies = { set: vi.fn() };
  const request = new Request('http://localhost/api/auth/login', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
  const result = POST({ request, cookies, getClientAddress: () => '1.2.3.4' } as unknown as Parameters<typeof POST>[0]);
  return { cookies, result };
}

async function statusOf(result: Promise<Response>): Promise<number> {
  try {
    return (await result).status;
  } catch (thrown) {
    return (thrown as { status: number }).status;
  }
}

beforeEach(() => {
  mocks.blocked = false;
  mocks.findUserByEmail.mockReset();
  mocks.verifyPassword.mockReset();
  mocks.recordFailure.mockClear();
  mocks.reset.mockClear();
});

describe('POST /api/auth/login', () => {
  it('signs the user in and sets an HttpOnly session cookie', async () => {
    mocks.findUserByEmail.mockResolvedValue(member);
    mocks.verifyPassword.mockResolvedValue(true);

    const { cookies, result } = call({ email: 'a@b.co', password: 'a-long-password-1' });
    const response = await result;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.user).toEqual({ id: '1', email: 'a@b.co', name: 'A', role: 'user' });
    expect(JSON.stringify(body)).not.toContain('passwordHash');
    const [name, token, options] = cookies.set.mock.calls[0];
    expect(name).toBe('ex_session');
    expect(options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 3600 });
    expect(verifySessionToken(token, 's'.repeat(32))).toMatchObject({ id: '1', role: 'user' });
    expect(mocks.reset).toHaveBeenCalled();
  });

  it('returns the same 401 for a wrong password and an unknown user', async () => {
    mocks.verifyPassword.mockResolvedValue(false);

    mocks.findUserByEmail.mockResolvedValue(member);
    const wrongPassword = await call({ email: 'a@b.co', password: 'nope-nope-nope' }).result.then((r) => r, (e) => e);
    mocks.findUserByEmail.mockResolvedValue(null);
    const unknownUser = await call({ email: 'x@y.co', password: 'nope-nope-nope' }).result.then((r) => r, (e) => e);

    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(mocks.recordFailure).toHaveBeenCalledTimes(2);
  });

  it('still verifies against a dummy hash for unknown users (timing equalisation)', async () => {
    mocks.findUserByEmail.mockResolvedValue(null);
    mocks.verifyPassword.mockResolvedValue(false);

    await statusOf(call({ email: 'x@y.co', password: 'nope-nope-nope' }).result);

    expect(mocks.verifyPassword).toHaveBeenCalledWith('nope-nope-nope', 'scrypt$dummy');
  });

  it('returns 429 without checking credentials when throttled', async () => {
    mocks.blocked = true;

    const status = await statusOf(call({ email: 'a@b.co', password: 'a-long-password-1' }).result);

    expect(status).toBe(429);
    expect(mocks.findUserByEmail).not.toHaveBeenCalled();
  });

  it.each([{}, { email: 'a@b.co' }, { email: 5, password: 'x' }, { email: 'a@b.co', password: '' }, { email: 'a'.repeat(400), password: 'x' }, 'not json'])(
    'returns 400 for invalid body %j',
    async (body) => {
      expect(await statusOf(call(body).result)).toBe(400);
      expect(mocks.findUserByEmail).not.toHaveBeenCalled();
    }
  );
});
