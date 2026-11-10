import { afterEach, describe, expect, it, vi } from 'vitest';
import { signOut, signOutEverywhere } from './signOut';

afterEach(() => vi.unstubAllGlobals());

const stubBrowser = (fetchImpl: () => Promise<unknown>) => {
  const location = { href: '/projects' };
  vi.stubGlobal('fetch', vi.fn(fetchImpl));
  vi.stubGlobal('window', { location });
  return location;
};

describe('signOut', () => {
  it('ends this session and goes to the sign-in page', async () => {
    const location = stubBrowser(async () => ({ ok: true }));
    await signOut();
    expect(fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
    expect(location.href).toBe('/login');
  });
});

describe('signOutEverywhere', () => {
  it('ends every session of the user, then goes to the sign-in page', async () => {
    const location = stubBrowser(async () => ({ ok: true }));
    await signOutEverywhere();
    expect(fetch).toHaveBeenCalledWith('/api/auth/logout-all', { method: 'POST' });
    expect(location.href).toBe('/login');
  });

  it('still leaves for the sign-in page when the request fails, so the visitor is never stuck signed in on screen', async () => {
    const location = stubBrowser(async () => {
      throw new Error('offline');
    });
    await expect(signOutEverywhere()).rejects.toThrow('offline');
    expect(location.href).toBe('/login');
  });
});
