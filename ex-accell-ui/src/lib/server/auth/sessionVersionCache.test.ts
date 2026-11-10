import { describe, expect, it, vi } from 'vitest';
import { createSessionVersionCache } from './sessionVersionCache';

const setup = (lookup: (id: string) => Promise<number | null>, ttlMs = 30_000, maxStaleMs = 300_000) => {
  let now = 1_000_000;
  const cache = createSessionVersionCache({ lookup: vi.fn(lookup), ttlMs, maxStaleMs, now: () => now });
  return { cache, advance: (ms: number) => (now += ms), lookup: cache.lookup as unknown as ReturnType<typeof vi.fn> };
};

describe('createSessionVersionCache', () => {
  it('asks the database once, then answers from memory until the time is up', async () => {
    const { cache, advance, lookup } = setup(async () => 3);
    expect(await cache.get('u1')).toBe(3);
    advance(29_000);
    expect(await cache.get('u1')).toBe(3);
    expect(lookup).toHaveBeenCalledTimes(1);
    advance(2_000);
    expect(await cache.get('u1')).toBe(3);
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it('picks up a revocation made elsewhere within one time window', async () => {
    let version = 0;
    const { cache, advance } = setup(async () => version);
    expect(await cache.get('u1')).toBe(0);
    version = 1; // another instance bumped it
    advance(31_000);
    expect(await cache.get('u1')).toBe(1);
  });

  it('forgets at once when told, so a revocation made here takes effect immediately', async () => {
    let version = 0;
    const { cache } = setup(async () => version);
    await cache.get('u1');
    version = 1;
    cache.invalidate('u1');
    expect(await cache.get('u1')).toBe(1);
  });

  it('shares one lookup between requests that arrive together', async () => {
    let resolve!: (v: number) => void;
    const { cache, lookup } = setup(() => new Promise<number>((r) => (resolve = r)));
    const both = Promise.all([cache.get('u1'), cache.get('u1')]);
    resolve(2);
    expect(await both).toEqual([2, 2]);
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it('answers null for a user who no longer exists, so their sessions end', async () => {
    const { cache } = setup(async () => null);
    expect(await cache.get('gone')).toBeNull();
  });

  it('keeps using the last known answer if the database fails, and refuses when it has none', async () => {
    let fail = false;
    const { cache, advance } = setup(async () => {
      if (fail) throw new Error('db down');
      return 4;
    });
    expect(await cache.get('u1')).toBe(4);
    fail = true;
    advance(31_000);
    expect(await cache.get('u1')).toBe(4); // stale but known
    await expect(cache.get('never-seen')).rejects.toThrow('db down'); // nothing to fall back on
  });

  it('stops trusting an old answer after the stale limit, so an outage cannot keep a revoked session alive indefinitely', async () => {
    let fail = false;
    const { cache, advance } = setup(async () => {
      if (fail) throw new Error('db down');
      return 4;
    }, 30_000, 300_000);
    await cache.get('u1');
    fail = true;
    advance(200_000);
    expect(await cache.get('u1')).toBe(4); // within the limit
    advance(150_000);
    await expect(cache.get('u1')).rejects.toThrow('db down'); // past it: no answer rather than a stale one
  });

  it('does not let a lookup that started before an invalidation write its old answer back', async () => {
    let resolveOld!: (v: number) => void;
    let version = 0;
    const { cache } = setup(() => (version === 0 ? new Promise<number>((r) => (resolveOld = r)) : Promise.resolve(version)));
    const early = cache.get('u1'); // starts asking while the version is still 0
    version = 1; // a revocation happens
    cache.invalidate('u1');
    resolveOld(0); // the old answer arrives after the invalidation
    await early;
    expect(await cache.get('u1')).toBe(1); // the next check asks again instead of trusting the old 0
  });
});
