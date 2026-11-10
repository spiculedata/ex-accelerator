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

describe('host normalisation', () => {
  it('compares hosts without regard to case or a default port', () => {
    const request = new Request('https://app.example.com/api/x', { method: 'POST', headers: { origin: 'https://app.example.com:443', host: 'App.Example.com', 'x-forwarded-host': 'APP.example.com:443' } });
    const hosts = requestHosts(request, new URL('https://app.example.com/api/x'));
    expect(hosts).toContain('app.example.com');
    expect(hosts.every((h) => h === h.toLowerCase() && !h.endsWith(':443'))).toBe(true);
    expect(isCrossSiteWrite(request, hosts)).toBe(false);
  });
});

describe('a configured ORIGIN', () => {
  it('is the only host accepted, so a rebound or forwarded host cannot widen it', () => {
    const request = new Request('http://internal:3000/api/x', { method: 'POST', headers: { origin: 'https://attacker.tld', host: 'attacker.tld', 'x-forwarded-host': 'attacker.tld' } });
    const hosts = requestHosts(request, new URL('http://internal:3000/api/x'), 'https://app.example.com');
    expect(hosts).toEqual(['app.example.com']);
    expect(isCrossSiteWrite(request, hosts)).toBe(true);
  });

  it('still accepts the app\'s own origin, and falls back to request hosts when ORIGIN is not a URL', () => {
    const own = new Request('http://internal:3000/api/x', { method: 'POST', headers: { origin: 'https://app.example.com' } });
    expect(isCrossSiteWrite(own, requestHosts(own, new URL('http://internal:3000/api/x'), 'https://app.example.com'))).toBe(false);
    expect(requestHosts(own, new URL('http://internal:3000/api/x'), 'not a url')).toContain('internal:3000');
  });

  it('treats an Origin of "null" and a write with no browser headers as the module documents', () => {
    expect(isCrossSiteWrite(req('POST', { origin: 'null' }), hosts)).toBe(true);
    expect(isCrossSiteWrite(req('POST'), hosts)).toBe(false);
  });
});
