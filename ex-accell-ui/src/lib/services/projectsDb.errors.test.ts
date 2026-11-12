import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const query = vi.hoisted(() => vi.fn());
vi.mock('./postgres', () => ({ postgresPool: { query } }));

import { projectsDb } from './projectsDb';

const dbDown = new Error('connection refused');

beforeEach(() => {
  query.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('projectsDb reads', () => {
  it.each([
    ['getAllProjects', () => projectsDb.getAllProjects()],
    ['getWorkspacesByProject', () => projectsDb.getWorkspacesByProject(1)],
    ['getProjectMembers', () => projectsDb.getProjectMembers(1)],
    ['getWorkspaceDataSources', () => projectsDb.getWorkspaceDataSources(1)]
  ])('%s rethrows a database failure instead of returning an empty list', async (_name, call) => {
    query.mockRejectedValue(dbDown);
    await expect(call()).rejects.toThrow('connection refused');
  });

  it.each([
    ['getAllProjects', () => projectsDb.getAllProjects()],
    ['getWorkspacesByProject', () => projectsDb.getWorkspacesByProject(1)],
    ['getProjectMembers', () => projectsDb.getProjectMembers(1)],
    ['getWorkspaceDataSources', () => projectsDb.getWorkspaceDataSources(1)]
  ])('%s returns an empty list when the table has not been created yet (42P01)', async (_name, call) => {
    query.mockRejectedValue(Object.assign(new Error('relation does not exist'), { code: '42P01' }));
    expect(await call()).toEqual([]);
  });

  it('getAllProjects still returns an empty list when there are no projects', async () => {
    query.mockResolvedValue([]);
    expect(await projectsDb.getAllProjects()).toEqual([]);
  });

  it('getWorkspacesByProject returns the rows it finds', async () => {
    query.mockResolvedValue([{ id: 2 }]);
    expect(await projectsDb.getWorkspacesByProject(1)).toEqual([{ id: 2 }]);
  });
});

describe('projectsDb updates', () => {
  it('updateProject rethrows a database failure rather than reporting "not found"', async () => {
    query.mockRejectedValue(dbDown);
    await expect(projectsDb.updateProject(1, { name: 'x' })).rejects.toThrow('connection refused');
  });

  it('updateProject returns null when the project does not exist', async () => {
    query.mockResolvedValue([]);
    expect(await projectsDb.updateProject(1, { name: 'x' })).toBeNull();
  });

  it('updateWorkspace rethrows a database failure rather than reporting "not found"', async () => {
    query.mockRejectedValue(dbDown);
    await expect(projectsDb.updateWorkspace(1, { name: 'x' })).rejects.toThrow('connection refused');
  });
});
