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

  it('keeps the Jupyter status endpoint, which returns the tokenised link, admin-only even for reads', () => {
    expect(req('/api/jupyter/status', 'GET', member).action).toBe('forbidden');
    expect(req('/api/jupyter/status', 'GET', viewer).action).toBe('forbidden');
    expect(req('/api/jupyter/status', 'GET', admin).action).toBe('allow');
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

describe('decideAccess: admin-only bypass attempts', () => {
  it.each([
    '/api/unified-analytics/query',
    '/api/unified-analytics/seed',
    '/api/%64eploy-workflow',
    '/api/deploy%2Dworkflow',
    '/api/deploy-workflow/',
    '/api//deploy-workflow',
    '/api/workflows/abc/%65xecute',
    '/api/jupyter/%73tart'
  ])('forbids a non-admin from %s', (path) => {
    expect(req(path, 'POST', member).action).toBe('forbidden');
  });

  it('still allows an admin to use the raw SQL endpoint', () => {
    expect(req('/api/unified-analytics/query', 'POST', admin).action).toBe('allow');
  });

  it('still allows ordinary analytics reads for members', () => {
    expect(req('/api/unified-analytics', 'GET', member).action).toBe('allow');
  });
});

describe('sign out everywhere', () => {
  const logoutAll = (user: SessionUser | null) => decideAccess({ pathname: '/api/auth/logout-all', search: '', method: 'POST', user });

  it('is for signed-in users only: an anonymous caller gets 401', () => {
    expect(logoutAll(null)).toEqual({ action: 'unauthorized' });
  });

  it('works for every role, including a read-only viewer, since it only ends the caller\'s own sessions', () => {
    for (const role of ['admin', 'user', 'viewer'] as const) {
      expect(logoutAll({ id: '1', email: 'a@b.co', name: 'A', role })).toEqual({ action: 'allow' });
    }
  });
});

describe('workflow executions', () => {
  it.each([
    ['/api/workflow-executions/ex_1', 'DELETE'],
    ['/api/workflow-executions/ex_1/manage', 'POST'],
    ['/api/workflow-executions/%65x_1/manage', 'POST']
  ])('only an admin may change %s (%s)', (path, method) => {
    expect(req(path, method, member).action).toBe('forbidden');
    expect(req(path, method, admin).action).toBe('allow');
  });

  it('lets any signed-in role read executions and their status', () => {
    for (const user of [admin, member, viewer]) {
      expect(req('/api/workflow-executions', 'GET', user).action).toBe('allow');
      expect(req('/api/workflow-executions/ex_1/manage', 'GET', user, '?action=status').action).toBe('allow');
    }
  });
});

describe('data sharing', () => {
  it.each([
    ['/api/data-sharing', 'POST'],
    ['/api/data-sharing/', 'POST'],
    ['/api/%64ata-sharing', 'POST'],
    ['/api//data-sharing', 'POST']
  ])('only an admin may publish, import or generate a package via %s (%s)', (path, method) => {
    expect(req(path, method, member).action).toBe('forbidden');
    expect(req(path, method, viewer).action).toBe('forbidden');
    expect(req(path, method, admin).action).toBe('allow');
  });

  it('lets any signed-in role read the package list and the registry', () => {
    for (const user of [admin, member, viewer]) {
      expect(req('/api/data-sharing', 'GET', user, '?action=registry').action).toBe('allow');
    }
  });
});

describe('account management', () => {
  it('lets any signed-in role change their own password', () => {
    for (const user of [admin, member, viewer]) expect(req('/api/auth/password', 'POST', user).action).toBe('allow');
  });

  it.each(['/api/users', '/api/users/5b1c7e3a-0000-4000-8000-000000000001', '/api/%75sers', '/api//users', '/settings/users', '/settings/%75sers'])('keeps %s for admins only, even for reads', (path) => {
    for (const method of ['GET', 'POST', 'PATCH']) {
      expect(req(path, method, member).action).toBe('forbidden');
      expect(req(path, method, viewer).action).toBe('forbidden');
      expect(req(path, method, admin).action).toBe('allow');
    }
  });
});
