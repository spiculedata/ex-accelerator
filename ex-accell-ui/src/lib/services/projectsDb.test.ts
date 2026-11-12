import { describe, it, expect, vi, beforeEach } from 'vitest';

const query = vi.hoisted(() => vi.fn());

vi.mock('./postgres', () => ({ postgresPool: { query } }));

import { projectsDb } from './projectsDb';

beforeEach(() => {
  query.mockReset();
});

describe('projectsDb.getWorkspaceDataSources', () => {
  it('reads captured sources and linked datasets for the workspace', async () => {
    query.mockResolvedValue([]);

    await projectsDb.getWorkspaceDataSources(7);

    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toContain('workspace_data_sources');
    expect(String(sql)).toContain('workspace_datasets');
    expect(params).toEqual([7]);
  });

  it('returns the combined rows, newest first', async () => {
    const rows = [{ kind: 'dataset', id: 3 }, { kind: 'capture', id: 1 }];
    query.mockResolvedValue(rows);

    expect(await projectsDb.getWorkspaceDataSources(7)).toEqual(rows);
    expect(String(query.mock.calls[0][0])).toMatch(/ORDER BY created_at DESC/i);
  });
});
