import { describe, expect, it } from 'vitest';
import { canAccessProject, resourcesInRequest, type ProjectAccessInfo } from './access';

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
    expect(refs('/api/unified-analytics', '?type=x&workspace_id=4')).toEqual({ projects: [], workspaces: [4] });
    expect(refs('/text-analytics/trigrams', '?workspace=4')).toEqual({ projects: [], workspaces: [4] });
    expect(refs('/api/workspaces', '?project_id=2')).toEqual({ projects: [2], workspaces: [] });
    expect(refs('/api/posts', '?workspaceId=7&projectId=3')).toEqual({ projects: [3], workspaces: [7] });
  });

  it('reads the id of the resource an endpoint is about', () => {
    expect(refs('/api/projects', '?id=5')).toEqual({ projects: [5], workspaces: [] });
    expect(refs('/api/workspaces', '?id=9')).toEqual({ projects: [], workspaces: [9] });
    expect(refs('/api/workspace-overview', '?id=9')).toEqual({ projects: [], workspaces: [9] });
  });

  it('reads ids from the path of pages and API routes', () => {
    expect(refs('/projects/5')).toEqual({ projects: [5], workspaces: [] });
    expect(refs('/workspaces/9')).toEqual({ projects: [], workspaces: [9] });
    expect(refs('/api/workspaces/9/dataset-summary')).toEqual({ projects: [], workspaces: [9] });
    expect(refs('/projects/new')).toEqual({ projects: [], workspaces: [] });
  });

  it('ignores anything that is not a whole number, and returns each id once', () => {
    expect(refs('/api/x', '?workspace_id=abc&project_id=1;drop')).toEqual({ projects: [], workspaces: [] });
    expect(refs('/api/x', '?workspace_id=4&workspace=4')).toEqual({ projects: [], workspaces: [4] });
    expect(refs('/api/projects', '?id=0')).toEqual({ projects: [], workspaces: [] });
  });

  it('finds nothing in a request that names no resource', () => {
    expect(refs('/api/health')).toEqual({ projects: [], workspaces: [] });
    expect(refs('/dashboards')).toEqual({ projects: [], workspaces: [] });
  });
});
