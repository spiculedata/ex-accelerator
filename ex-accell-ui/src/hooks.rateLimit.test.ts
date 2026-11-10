import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  process.env.API_RATE_LIMIT_PER_MINUTE = '3';
});

vi.mock('$lib/server/auth/runtime', () => ({
  SESSION_COOKIE: 'ex_session',
  getAuthConfig: () => ({ sessionSecret: 's'.repeat(32), sessionTtlSeconds: 3600, secureCookies: false })
}));
const { isSessionCurrent, checkAccess } = vi.hoisted(() => ({ isSessionCurrent: vi.fn(), checkAccess: vi.fn() }));
vi.mock('$lib/server/auth/revocation', () => ({ isSessionCurrent }));
vi.mock('$lib/server/auth/accessCheck', () => ({ checkAccess }));

import { handle } from './hooks.server';
import { createSessionToken, type SessionUser } from '$lib/server/auth/session';

const SECRET = 's'.repeat(32);
const ada: SessionUser = { id: 'ada', email: 'ada@example.com', name: 'Ada', role: 'user' };
const bob: SessionUser = { id: 'bob', email: 'bob@example.com', name: 'Bob', role: 'user' };

async function run(path: string, { user, address = '10.0.0.1', method = 'GET' }: { user?: SessionUser; address?: string; method?: string } = {}) {
  const resolve = vi.fn().mockResolvedValue(new Response('ok'));
  const token = user ? createSessionToken(user, SECRET, 3600) : undefined;
  const event = {
    url: new URL(`http://localhost${path}`),
    request: new Request(`http://localhost${path}`, { method }),
    cookies: { get: (name: string) => (name === 'ex_session' ? token : undefined), delete: () => {} },
    getClientAddress: () => address,
    locals: {} as { user: SessionUser | null }
  };
  const response = await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);
  return { response, resolve };
}

beforeEach(() => {
  isSessionCurrent.mockReset().mockResolvedValue('current');
  checkAccess.mockReset().mockResolvedValue({ allowed: true });
});

describe('API rate limit', () => {
  it('answers 429 with Retry-After once one person goes over their limit, without reaching the route', async () => {
    for (let i = 0; i < 3; i++) expect((await run('/api/projects', { user: ada })).response.status).toBe(200);
    const { response, resolve } = await run('/api/projects', { user: ada });
    expect(response.status).toBe(429);
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await response.json()).success).toBe(false);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('counts each person separately', async () => {
    for (let i = 0; i < 4; i++) await run('/api/projects', { user: ada });
    expect((await run('/api/projects', { user: bob })).response.status).toBe(200);
  });

  it('limits a person by their account, not by the address they come from', async () => {
    for (let i = 0; i < 3; i++) await run('/api/posts', { user: bob, address: '10.0.0.2' });
    expect((await run('/api/posts', { user: bob, address: '10.9.9.9' })).response.status).toBe(429);
  });

  it('does not limit pages, the health check or the sign-in page', async () => {
    for (let i = 0; i < 10; i++) {
      expect((await run('/api/health', { address: '10.0.0.3' })).response.status).toBe(200);
      expect((await run('/login', { address: '10.0.0.3' })).response.status).toBe(200);
      expect((await run('/', { user: ada, address: '10.0.0.3' })).response.status).toBe(200);
    }
  });

  it('limits anonymous API calls by address, ahead of the sign-in check', async () => {
    for (let i = 0; i < 3; i++) expect((await run('/api/projects', { address: '10.0.0.4' })).response.status).toBe(401);
    expect((await run('/api/projects', { address: '10.0.0.4' })).response.status).toBe(429);
    expect((await run('/api/projects', { address: '10.0.0.5' })).response.status).toBe(401);
  });
});
