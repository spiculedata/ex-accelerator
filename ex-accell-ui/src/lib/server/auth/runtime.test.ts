import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  migrateDatabase: vi.fn(),
  ensureAuthSchema: vi.fn(),
  bootstrapAdmin: vi.fn(),
  warn: vi.fn(),
  info: vi.fn()
}));

vi.mock('$app/environment', () => ({ dev: false }));
vi.mock('$lib/server/migrations', () => ({ migrateDatabase: mocks.migrateDatabase }));
vi.mock('./userRepo', () => ({
  ensureAuthSchema: mocks.ensureAuthSchema,
  bootstrapAdmin: mocks.bootstrapAdmin
}));
vi.mock('$lib/utils/logger', () => ({
  createLogger: () => ({ warn: mocks.warn, info: mocks.info, error: vi.fn(), debug: vi.fn() })
}));

const GOOD_SECRET = 'a'.repeat(40);
const originalEnv = { ...process.env };

async function loadRuntime() {
  vi.resetModules();
  return import('./runtime');
}

beforeEach(() => {
  mocks.migrateDatabase.mockReset().mockResolvedValue(undefined);
  mocks.ensureAuthSchema.mockReset().mockResolvedValue(undefined);
  mocks.bootstrapAdmin.mockReset().mockResolvedValue('exists');
  mocks.warn.mockReset();
  mocks.info.mockReset();
  delete process.env.SESSION_SECRET;
  delete process.env.ADDRESS_HEADER;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('getAuthConfig', () => {
  it('throws in production when SESSION_SECRET is missing', async () => {
    const { getAuthConfig } = await loadRuntime();
    expect(() => getAuthConfig()).toThrow(/SESSION_SECRET must be set/);
  });

  it('rejects a short secret', async () => {
    process.env.SESSION_SECRET = 'short';
    const { getAuthConfig } = await loadRuntime();
    expect(() => getAuthConfig()).toThrow(/at least 32/);
  });

  it('caches the resolved config and warns once when ADDRESS_HEADER is unset', async () => {
    process.env.SESSION_SECRET = GOOD_SECRET;
    const { getAuthConfig } = await loadRuntime();
    const first = getAuthConfig();
    expect(first.sessionSecret).toBe(GOOD_SECRET);
    expect(getAuthConfig()).toBe(first);
    expect(mocks.warn).toHaveBeenCalledTimes(1);
    expect(mocks.warn.mock.calls[0][0]).toMatch(/ADDRESS_HEADER/);
  });

  it('does not warn when ADDRESS_HEADER is set', async () => {
    process.env.SESSION_SECRET = GOOD_SECRET;
    process.env.ADDRESS_HEADER = 'x-forwarded-for';
    const { getAuthConfig } = await loadRuntime();
    getAuthConfig();
    expect(mocks.warn).not.toHaveBeenCalled();
  });
});

describe('login throttles', () => {
  it('limits an account to 5 failures while the per-address limit is larger', async () => {
    const { loginThrottle, loginIpThrottle, SESSION_COOKIE } = await loadRuntime();
    expect(SESSION_COOKIE).toBe('ex_session');
    for (let i = 0; i < 5; i++) loginThrottle.recordFailure('a@x.io');
    expect(loginThrottle.isBlocked('a@x.io')).toBe(true);
    expect(loginThrottle.isBlocked('b@x.io')).toBe(false);

    for (let i = 0; i < 19; i++) loginIpThrottle.recordFailure('1.2.3.4');
    expect(loginIpThrottle.isBlocked('1.2.3.4')).toBe(false);
    loginIpThrottle.recordFailure('1.2.3.4');
    expect(loginIpThrottle.isBlocked('1.2.3.4')).toBe(true);
  });
});

describe('prepareAuth', () => {
  it('runs migrate, schema, bootstrap in order and only once', async () => {
    const order: string[] = [];
    mocks.migrateDatabase.mockImplementation(async () => { order.push('migrate'); });
    mocks.ensureAuthSchema.mockImplementation(async () => { order.push('schema'); });
    mocks.bootstrapAdmin.mockImplementation(async () => { order.push('bootstrap'); return 'exists'; });
    const { prepareAuth } = await loadRuntime();

    await Promise.all([prepareAuth(), prepareAuth()]);
    await prepareAuth();

    expect(order).toEqual(['migrate', 'schema', 'bootstrap']);
  });

  it('logs when the first admin is created and warns when no credentials exist', async () => {
    mocks.bootstrapAdmin.mockResolvedValueOnce('created');
    let { prepareAuth } = await loadRuntime();
    await prepareAuth();
    expect(mocks.info).toHaveBeenCalledWith(expect.stringContaining('initial admin'));

    mocks.bootstrapAdmin.mockResolvedValueOnce('no-credentials');
    ({ prepareAuth } = await loadRuntime());
    await prepareAuth();
    expect(mocks.warn).toHaveBeenCalledWith(expect.stringContaining('ADMIN_EMAIL'));
  });

  it('propagates a failure and retries on the next call', async () => {
    mocks.migrateDatabase.mockRejectedValueOnce(new Error('db down'));
    const { prepareAuth } = await loadRuntime();

    await expect(prepareAuth()).rejects.toThrow('db down');
    await expect(prepareAuth()).resolves.toBeUndefined();
    expect(mocks.migrateDatabase).toHaveBeenCalledTimes(2);
  });
});
