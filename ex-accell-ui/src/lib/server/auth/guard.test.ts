import { describe, it, expect } from 'vitest';
import { decideAccess, safeRedirectTarget } from './guard';
import type { SessionUser } from './session';

const admin: SessionUser = { id: '1', email: 'a@b.co', name: 'A', role: 'admin' };
const member: SessionUser = { ...admin, role: 'user' };
const viewer: SessionUser = { ...admin, role: 'viewer' };

const req = (pathname: string, method = 'GET', user: SessionUser | null = null, search = '') =>
  decideAccess({ pathname, search, method, user });

describe('decideAccess: anonymous', () => {
  it.each(['/login', '/api/auth/login', '/api/auth/logout', '/api/health', '/_app/immutable/x.js', '/favicon.svg'])(
    'allows public path %s',
    (path) => {
      expect(req(path).action).toBe('allow');
    }
  );

  it('returns 401 for API requests', () => {
    expect(req('/api/projects').action).toBe('unauthorized');
    expect(req('/api/deploy-workflow', 'POST').action).toBe('unauthorized');
  });

  it('redirects page requests to login, preserving the destination', () => {
    expect(req('/projects/3', 'GET', null, '?tab=x')).toEqual({
      action: 'redirect',
      location: '/login?next=%2Fprojects%2F3%3Ftab%3Dx'
    });
  });

  it('does not treat lookalike paths as public', () => {
    expect(req('/api/health/../projects').action).toBe('unauthorized');
    expect(req('/loginx').action).toBe('redirect');
    expect(req('/api/auth/me').action).toBe('unauthorized');
  });
});

describe('decideAccess: authenticated', () => {
  it('allows normal reads and writes for members', () => {
    expect(req('/api/projects', 'GET', member).action).toBe('allow');
    expect(req('/api/projects', 'POST', member).action).toBe('allow');
  });

  it('restricts viewers to read-only methods', () => {
    expect(req('/api/projects', 'GET', viewer).action).toBe('allow');
    expect(req('/api/projects', 'POST', viewer).action).toBe('forbidden');
    expect(req('/api/projects/1', 'DELETE', viewer).action).toBe('forbidden');
  });

  it.each([
    '/api/deploy-workflow',
    '/api/generate-python-workflow',
    '/api/jupyter/start',
    '/api/workflows/abc/execute'
  ])('restricts code-execution endpoint %s to admins', (path) => {
    expect(req(path, 'POST', member).action).toBe('forbidden');
    expect(req(path, 'POST', viewer).action).toBe('forbidden');
    expect(req(path, 'POST', admin).action).toBe('allow');
  });

  it('sends signed-in users away from the login page', () => {
    expect(req('/login', 'GET', member)).toEqual({ action: 'redirect', location: '/' });
  });
});

describe('safeRedirectTarget', () => {
  it.each([
    ['/projects/1', '/projects/1'],
    ['/a?b=c', '/a?b=c']
  ])('keeps local path %s', (input, expected) => {
    expect(safeRedirectTarget(input)).toBe(expected);
  });

  it.each([null, undefined, '', '//evil.com', 'https://evil.com', '/\\evil.com', 'javascript:alert(1)', '/login', '/\t/evil.com'])(
    'falls back to / for %j',
    (input) => {
      expect(safeRedirectTarget(input)).toBe('/');
    }
  );
});
