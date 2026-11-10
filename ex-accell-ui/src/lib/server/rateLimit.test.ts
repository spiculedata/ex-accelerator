import { describe, expect, it } from 'vitest';
import { createRateLimiter, parseRateLimit, DEFAULT_REQUESTS_PER_MINUTE } from './rateLimit';

describe('createRateLimiter', () => {
  it('allows requests up to the limit in a window, then refuses with the seconds to wait', () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });
    expect(limiter.hit('u1', 0).allowed).toBe(true);
    expect(limiter.hit('u1', 1_000).allowed).toBe(true);
    expect(limiter.hit('u1', 2_000).allowed).toBe(true);
    const refused = limiter.hit('u1', 3_000);
    expect(refused).toEqual({ allowed: false, retryAfterSeconds: 57 });
  });

  it('starts a fresh window once the old one has passed', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(limiter.hit('u1', 0).allowed).toBe(true);
    expect(limiter.hit('u1', 59_999).allowed).toBe(false);
    expect(limiter.hit('u1', 60_000).allowed).toBe(true);
  });

  it('counts each key separately', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(limiter.hit('a', 0).allowed).toBe(true);
    expect(limiter.hit('b', 0).allowed).toBe(true);
    expect(limiter.hit('a', 1).allowed).toBe(false);
  });

  it('never allows less than one second of waiting to be reported as zero', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    limiter.hit('a', 0);
    expect(limiter.hit('a', 59_999)).toEqual({ allowed: false, retryAfterSeconds: 1 });
  });

  it('is off when the limit is zero', () => {
    const limiter = createRateLimiter({ limit: 0, windowMs: 60_000 });
    for (let i = 0; i < 1000; i++) expect(limiter.hit('a', i).allowed).toBe(true);
  });

  it('keeps memory bounded by forgetting the oldest keys, not by refusing new ones', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, maxKeys: 3 });
    for (const key of ['a', 'b', 'c', 'd']) limiter.hit(key, 0);
    expect(limiter.size()).toBe(3);
    expect(limiter.hit('d', 1).allowed).toBe(false); // the newest is still counted
  });
});

describe('parseRateLimit', () => {
  it('uses the default when nothing is set', () => {
    expect(parseRateLimit(undefined)).toBe(DEFAULT_REQUESTS_PER_MINUTE);
    expect(parseRateLimit('')).toBe(DEFAULT_REQUESTS_PER_MINUTE);
  });

  it('reads a whole number, with 0 meaning off', () => {
    expect(parseRateLimit('300')).toBe(300);
    expect(parseRateLimit('0')).toBe(0);
  });

  it.each(['abc', '-5', '1.5', '10x', ' ', '99999999999999999999'])('falls back to the default for %j', (value) => {
    expect(parseRateLimit(value)).toBe(DEFAULT_REQUESTS_PER_MINUTE);
  });
});
