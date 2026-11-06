import { describe, it, expect } from 'vitest';
import { resolveAuthConfig } from './config';

const LONG_SECRET = 's'.repeat(32);

describe('resolveAuthConfig', () => {
  it('uses SESSION_SECRET in production', () => {
    const config = resolveAuthConfig({ SESSION_SECRET: LONG_SECRET }, true);

    expect(config.sessionSecret).toBe(LONG_SECRET);
    expect(config.secureCookies).toBe(true);
  });

  it('fails fast in production when the secret is missing', () => {
    expect(() => resolveAuthConfig({}, true)).toThrow(/SESSION_SECRET/);
  });

  it('fails fast in production when the secret is too short', () => {
    expect(() => resolveAuthConfig({ SESSION_SECRET: 'short' }, true)).toThrow(/at least 32/);
  });

  it('generates an ephemeral secret in development', () => {
    const config = resolveAuthConfig({}, false, () => 'generated-secret-value-0123456789abcdef');

    expect(config.sessionSecret).toBe('generated-secret-value-0123456789abcdef');
    expect(config.secureCookies).toBe(false);
  });

  it('honours SESSION_TTL_HOURS and falls back on invalid values', () => {
    expect(resolveAuthConfig({ SESSION_SECRET: LONG_SECRET, SESSION_TTL_HOURS: '2' }, true).sessionTtlSeconds).toBe(7200);
    expect(resolveAuthConfig({ SESSION_SECRET: LONG_SECRET, SESSION_TTL_HOURS: 'abc' }, true).sessionTtlSeconds).toBe(12 * 3600);
    expect(resolveAuthConfig({ SESSION_SECRET: LONG_SECRET, SESSION_TTL_HOURS: '-5' }, true).sessionTtlSeconds).toBe(12 * 3600);
  });

  it('allows COOKIE_SECURE=false to support plain-http deployments behind localhost', () => {
    expect(resolveAuthConfig({ SESSION_SECRET: LONG_SECRET, COOKIE_SECURE: 'false' }, true).secureCookies).toBe(false);
  });
});
