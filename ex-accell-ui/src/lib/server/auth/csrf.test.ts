import { describe, expect, it } from 'vitest';
import { isCrossSiteWrite, requestHosts } from './csrf';

const req = (method: string, headers: Record<string, string> = {}) => new Request('https://app.example.com/api/projects', { method, headers });
const origin = new URL('https://app.example.com').origin;
const hosts = ['app.example.com'];

describe('isCrossSiteWrite', () => {
  it('lets reads through whatever the origin', () => {
    expect(isCrossSiteWrite(req('GET', { origin: 'https://evil.example' }), hosts)).toBe(false);
    expect(isCrossSiteWrite(req('HEAD', { 'sec-fetch-site': 'cross-site' }), hosts)).toBe(false);
  });

  it('refuses a write from another site, however it announces itself', () => {
    expect(isCrossSiteWrite(req('POST', { origin: 'https://evil.example' }), hosts)).toBe(true);
    expect(isCrossSiteWrite(req('DELETE', { 'sec-fetch-site': 'cross-site' }), hosts)).toBe(true);
    expect(isCrossSiteWrite(req('PATCH', { 'sec-fetch-site': 'same-site', origin: 'https://other.app.example.com' }), hosts)).toBe(true);
    expect(isCrossSiteWrite(req('PUT', { origin: 'null' }), hosts)).toBe(true);
  });

  it('allows a write from the app itself', () => {
    expect(isCrossSiteWrite(req('POST', { origin }), hosts)).toBe(false);
    expect(isCrossSiteWrite(req('POST', { 'sec-fetch-site': 'same-origin', origin }), hosts)).toBe(false);
  });

  it('allows a write with no browser headers at all (a script or curl: there is no ambient cookie to ride on)', () => {
    expect(isCrossSiteWrite(req('POST'), hosts)).toBe(false);
  });

  it('allows a user-initiated navigation with Sec-Fetch-Site none', () => {
    expect(isCrossSiteWrite(req('POST', { 'sec-fetch-site': 'none' }), hosts)).toBe(false);
  });
});

describe('behind a proxy', () => {
  it('accepts the public host the proxy forwards, even when the app sees an internal URL', () => {
    const request = new Request('http://internal:3000/api/projects', { method: 'POST', headers: { origin: 'https://app.example.com', host: 'internal:3000', 'x-forwarded-host': 'app.example.com' } });
    expect(requestHosts(request, new URL('http://internal:3000/api/projects'))).toEqual(['internal:3000', 'internal:3000', 'app.example.com']);
    expect(isCrossSiteWrite(request, requestHosts(request, new URL('http://internal:3000/api/projects')))).toBe(false);
  });

  it('ignores the scheme, since a proxy may terminate TLS', () => {
    expect(isCrossSiteWrite(req('POST', { origin: 'http://app.example.com' }), hosts)).toBe(false);
  });
});
