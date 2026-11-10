import { describe, expect, it } from 'vitest';
import { canAccessProject, parseResourceId, resourcesInRequest, type ProjectAccessInfo } from './access';

const user = (email: string, role: 'admin' | 'user' | 'viewer' = 'user') => ({ id: 'u', email, name: 'N', role });
const project = (over: Partial<ProjectAccessInfo> = {}): ProjectAccessInfo => ({ createdBy: 'ada@example.com', memberEmails: ['ada@example.com'], ...over });

describe('canAccessProject', () => {
  it('lets an admin into every project', () => {
    expect(canAccessProject(user('root@example.com', 'admin'), project())).toBe(true);
  });

  it('lets a member in, whatever the case of their email, and the creator even if not listed', () => {
    expect(canAccessProject(user('ADA@example.com'), project())).toBe(true);
    expect(canAccessProject(user('ada@example.com'), project({ memberEmails: [] , createdBy: 'ada@example.com' }))).toBe(true);
  });

  it('keeps everyone else out of a project that has real members', () => {
    expect(canAccessProject(user('bob@example.com'), project())).toBe(false);
    expect(canAccessProject(user('bob@example.com', 'viewer'), project())).toBe(false);
  });

  it('leaves a project from before accounts existed open to every signed-in user, since nobody was ever recorded as its owner', () => {
    expect(canAccessProject(user('bob@example.com'), project({ createdBy: 'default_user', memberEmails: ['default_user'] }))).toBe(true);
    expect(canAccessProject(user('bob@example.com'), project({ createdBy: 'unknown', memberEmails: [] }))).toBe(true);
  });

  it('closes a legacy project once a real person is added to it', () => {
    expect(canAccessProject(user('bob@example.com'), project({ createdBy: 'default_user', memberEmails: ['default_user', 'ada@example.com'] }))).toBe(false);
  });
});

const refs = (path: string, search = '') => resourcesInRequest(new URL(`http://localhost${path}${search}`));

describe('resourcesInRequest', () => {
  it('finds workspace and project ids in the query string, under every name the app uses', () => {
    expect(refs('/api/unified-analytics', '?type=x&workspace_id=4')).toEqual({ projects: [], workspaces: [4], malformed: [] });
    expect(refs('/text-analytics/trigrams', '?workspace=4')).toEqual({ projects: [], workspaces: [4], malformed: [] });
    expect(refs('/api/workspaces', '?project_id=2')).toEqual({ projects: [2], workspaces: [], malformed: [] });
    expect(refs('/api/posts', '?workspaceId=7&projectId=3')).toEqual({ projects: [3], workspaces: [7], malformed: [] });
  });

  it('reads the id of the resource an endpoint is about', () => {
    expect(refs('/api/projects', '?id=5')).toEqual({ projects: [5], workspaces: [], malformed: [] });
    expect(refs('/api/workspaces', '?id=9')).toEqual({ projects: [], workspaces: [9], malformed: [] });
    expect(refs('/api/workspace-overview', '?id=9')).toEqual({ projects: [], workspaces: [9], malformed: [] });
  });

  it('reads ids from the path of pages and API routes', () => {
    expect(refs('/projects/5')).toEqual({ projects: [5], workspaces: [], malformed: [] });
    expect(refs('/workspaces/9')).toEqual({ projects: [], workspaces: [9], malformed: [] });
    expect(refs('/api/workspaces/9/dataset-summary')).toEqual({ projects: [], workspaces: [9], malformed: [] });
    expect(refs('/projects/new')).toEqual({ projects: [], workspaces: [], malformed: [] });
  });

  it('returns each id once', () => {
    expect(refs('/api/x', '?workspace_id=4&workspace=4')).toEqual({ projects: [], workspaces: [4], malformed: [] });
  });

  it('reads the overview endpoints\' ids too, so no project-scoped route is left out', () => {
    expect(refs('/api/project-overview', '?id=5')).toEqual({ projects: [5], workspaces: [], malformed: [] });
    expect(refs('/api/workspace-overview', '?id=9')).toEqual({ projects: [], workspaces: [9], malformed: [] });
  });

  it.each([
    ['workspace_id=9abc'], ['workspace_id=9.5'], ['workspace_id=%209'], ['workspace_id=9%20'], ['workspace_id=%2B9'], ['workspace_id=9e1'],
    ['workspace_id=01'], ['workspace_id=0'], ['workspace_id=-3'], ['project_id=1;drop'], ['projectId=x'], ['workspace=%00']
  ])('marks %s as malformed instead of ignoring it, because a route might read it more loosely and reach a forbidden row', (query) => {
    const found = refs('/api/x', `?${query}`);
    expect(found.malformed.length).toBeGreaterThan(0);
    expect(found.projects).toEqual([]);
    expect(found.workspaces).toEqual([]);
  });

  it('marks a malformed id on the endpoints that take their own id', () => {
    expect(refs('/api/project-overview', '?id=9abc').malformed).toEqual(['id']);
    expect(refs('/api/workspaces', '?id=+9').malformed).toEqual(['id']);
    expect(refs('/api/projects', '?id=0').malformed).toEqual(['id']);
  });

  it('treats an empty parameter as absent, as the app itself leaves one blank', () => {
    expect(refs('/api/x', '?workspace_id=&project_id=')).toEqual({ projects: [], workspaces: [], malformed: [] });
  });

  it.each([
    ['/api/workspaces/9abc/dataset-summary'], ['/api/workspaces/%209/dataset-summary'], ['/workspaces/abc'], ['/projects/9x'], ['/api/projects/ 9']
  ])('marks a malformed id in the path %s', (path) => {
    expect(refs(path).malformed.length).toBeGreaterThan(0);
  });

  it('reads the path the way the router does: percent-encoded letters and digits, and doubled slashes', () => {
    expect(refs('/api/%77orkspaces/9/dataset-summary')).toEqual({ projects: [], workspaces: [9], malformed: [] });
    expect(refs('/api/workspaces/%39/dataset-summary')).toEqual({ projects: [], workspaces: [9], malformed: [] });
    expect(refs('/api//workspaces//9/dataset-summary')).toEqual({ projects: [], workspaces: [9], malformed: [] });
    expect(refs('/api//project-overview', '?id=5')).toEqual({ projects: [5], workspaces: [], malformed: [] });
  });

  it('allows the new-project page, which has no id', () => {
    expect(refs('/projects/new')).toEqual({ projects: [], workspaces: [], malformed: [] });
  });

  it('finds nothing in a request that names no resource', () => {
    expect(refs('/api/health')).toEqual({ projects: [], workspaces: [], malformed: [] });
    expect(refs('/dashboards')).toEqual({ projects: [], workspaces: [], malformed: [] });
  });
});

describe('parseResourceId', () => {
  it('accepts a positive whole number or its plain digits', () => {
    expect(parseResourceId(9)).toBe(9);
    expect(parseResourceId('9')).toBe(9);
    expect(parseResourceId('120')).toBe(120);
  });

  it('is null for a value that is absent', () => {
    for (const value of [undefined, null, '']) expect(parseResourceId(value)).toBeNull();
  });

  it('is "invalid" for anything else, so callers refuse it instead of passing it on', () => {
    for (const value of [' 9', '9 ', '+9', '09', '9abc', '9.5', 0, -1, 1.5, NaN, Infinity, '1e3', {}, [], true, 'x']) {
      expect(parseResourceId(value)).toBe('invalid');
    }
  });
});
