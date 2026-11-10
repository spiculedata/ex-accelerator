import { describe, expect, it, vi } from 'vitest';
import { watchForExpiredSession } from './sessionExpiry';

const respond = (status: number) => new Response('{}', { status });

describe('watchForExpiredSession', () => {
  const setup = (status: number) => {
    const target = { fetch: vi.fn().mockResolvedValue(respond(status)) } as { fetch: typeof fetch };
    const onExpired = vi.fn();
    const stop = watchForExpiredSession(target, onExpired);
    return { target, onExpired, stop };
  };

  it('reports an expired session when the app API answers 401', async () => {
    const { target, onExpired } = setup(401);
    const response = await target.fetch('/api/unified-analytics?type=x');
    expect(response.status).toBe(401); // the caller still gets the response
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('ignores a failed sign-in, other statuses and other sites', async () => {
    const login = setup(401);
    await login.target.fetch('/api/auth/login', { method: 'POST' });
    const ok = setup(200);
    await ok.target.fetch('/api/projects');
    const denied = setup(403);
    await denied.target.fetch('/api/projects');
    const external = setup(401);
    await external.target.fetch('https://example.com/api/x');
    for (const { onExpired } of [login, ok, denied, external]) expect(onExpired).not.toHaveBeenCalled();
  });

  it('puts fetch back when stopped', async () => {
    const original = vi.fn().mockResolvedValue(respond(401));
    const target = { fetch: original as unknown as typeof fetch };
    const stop = watchForExpiredSession(target, vi.fn());
    expect(target.fetch).not.toBe(original);
    stop();
    expect(target.fetch).toBe(original);
  });
});
