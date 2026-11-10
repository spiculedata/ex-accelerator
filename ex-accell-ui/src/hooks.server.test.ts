import { describe, it, expect, vi } from 'vitest';

const config = vi.hoisted(() => ({ secureCookies: false }));

vi.mock('$lib/server/auth/runtime', () => ({
  SESSION_COOKIE: 'ex_session',
  getAuthConfig: () => ({ sessionSecret: 's'.repeat(32), sessionTtlSeconds: 3600, secureCookies: config.secureCookies })
}));

import { handle } from './hooks.server';
import { createSessionToken, type SessionUser } from '$lib/server/auth/session';

const SECRET = 's'.repeat(32);
const admin: SessionUser = { id: '1', email: 'a@b.co', name: 'A', role: 'admin' };
const viewer: SessionUser = { ...admin, role: 'viewer' };

async function run(path: string, { method = 'GET', user }: { method?: string; user?: SessionUser } = {}) {
  const resolve = vi.fn().mockResolvedValue(new Response('ok'));
  const token = user ? createSessionToken(user, SECRET, 3600) : undefined;
  const event = {
    url: new URL(`http://localhost${path}`),
    request: new Request(`http://localhost${path}`, { method }),
    cookies: { get: (name: string) => (name === 'ex_session' ? token : undefined) },
    locals: {} as { user: SessionUser | null }
  };
  const response = await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);
  return { response, resolve, event };
}

describe('handle', () => {
  it('returns 401 JSON for anonymous API requests without reaching the route', async () => {
    const { response, resolve } = await run('/api/deploy-workflow', { method: 'POST' });

    expect(response.status).toBe(401);
    expect((await response.json()).success).toBe(false);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('redirects anonymous page requests to /login with the destination', async () => {
    const { response } = await run('/projects?x=1');

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/login?next=%2Fprojects%3Fx%3D1');
  });

  it('lets anonymous users reach the login page and health check', async () => {
    expect((await run('/login')).resolve).toHaveBeenCalled();
    expect((await run('/api/health')).resolve).toHaveBeenCalled();
  });

  it('populates locals.user from a valid session cookie', async () => {
    const { event, resolve } = await run('/api/projects', { user: admin });

    expect(event.locals.user).toEqual(admin);
    expect(resolve).toHaveBeenCalled();
  });

  it('treats a forged cookie as anonymous', async () => {
    const resolve = vi.fn();
    const event = {
      url: new URL('http://localhost/api/projects'),
      request: new Request('http://localhost/api/projects'),
      cookies: { get: () => 'forged.token' },
      locals: {} as { user: SessionUser | null }
    };

    const response = await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);

    expect(response.status).toBe(401);
    expect(event.locals.user).toBeNull();
  });

  it('returns 403 when a viewer attempts a write', async () => {
    const { response, resolve } = await run('/api/projects', { method: 'POST', user: viewer });

    expect(response.status).toBe(403);
    expect(resolve).not.toHaveBeenCalled();
  });
});

describe('security headers', () => {
  const headerSet = ['x-content-type-options', 'referrer-policy', 'x-frame-options', 'permissions-policy'];

  it('adds the baseline headers to responses from routes', async () => {
    const { response } = await run('/projects', { user: admin });

    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(response.headers.get('permissions-policy')).toContain('camera=()');
  });

  it('adds them to denial and redirect responses too', async () => {
    const denied = (await run('/api/projects')).response;
    const redirected = (await run('/projects')).response;

    for (const response of [denied, redirected]) {
      for (const name of headerSet) expect(response.headers.get(name), name).toBeTruthy();
    }
  });

  it('sends HSTS only when secure cookies are enabled', async () => {
    config.secureCookies = false;
    expect((await run('/projects', { user: admin })).response.headers.get('strict-transport-security')).toBeNull();

    config.secureCookies = true;
    try {
      const header = (await run('/projects', { user: admin })).response.headers.get('strict-transport-security');
      expect(header).toContain('max-age=');
    } finally {
      config.secureCookies = false;
    }
  });

  describe('caching of pages', () => {
    const runWith = async (path: string, response: Response) => {
      const resolve = vi.fn().mockResolvedValue(response);
      const token = createSessionToken(admin, SECRET, 3600);
      const event = {
        url: new URL(`http://localhost${path}`),
        request: new Request(`http://localhost${path}`),
        cookies: { get: (name: string) => (name === 'ex_session' ? token : undefined) },
        locals: {} as { user: SessionUser | null }
      };
      return handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);
    };

    it('stops the browser keeping a signed-in page, so Back after sign out cannot show it', async () => {
      const page = await runWith('/dashboards', new Response('<html></html>', { headers: { 'content-type': 'text/html; charset=utf-8' } }));
      expect(page.headers.get('cache-control')).toBe('no-store');
    });

    it('leaves the caching of scripts, styles and other assets alone', async () => {
      const asset = await runWith('/_app/immutable/app.js', new Response('x', { headers: { 'content-type': 'text/javascript', 'cache-control': 'public, max-age=31536000, immutable' } }));
      expect(asset.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    });
  });

  describe('cross-site writes', () => {
    const write = async (headers: Record<string, string>, user: SessionUser | undefined = admin) => {
      const resolve = vi.fn().mockResolvedValue(new Response('ok'));
      const token = user ? createSessionToken(user, SECRET, 3600) : undefined;
      const event = {
        url: new URL('http://localhost/api/projects'),
        request: new Request('http://localhost/api/projects', { method: 'POST', headers }),
        cookies: { get: (name: string) => (name === 'ex_session' ? token : undefined) },
        locals: {} as { user: SessionUser | null }
      };
      const response = await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);
      return { response, resolve };
    };

    it('refuses a write another site sent with the user\'s cookie, without reaching the route', async () => {
      const { response, resolve } = await write({ origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' });
      expect(response.status).toBe(403);
      expect(resolve).not.toHaveBeenCalled();
    });

    it('lets the app\'s own writes through', async () => {
      const { response, resolve } = await write({ origin: 'http://localhost', 'sec-fetch-site': 'same-origin' });
      expect(response.status).toBe(200);
      expect(resolve).toHaveBeenCalled();
    });

    it('refuses a cross-site sign-in attempt too, so a login cannot be forced', async () => {
      const resolve = vi.fn();
      const event = {
        url: new URL('http://localhost/api/auth/login'),
        request: new Request('http://localhost/api/auth/login', { method: 'POST', headers: { origin: 'https://evil.example' } }),
        cookies: { get: () => undefined },
        locals: {} as { user: SessionUser | null }
      };
      const response = await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);
      expect(response.status).toBe(403);
      expect(resolve).not.toHaveBeenCalled();
    });
  });
});
