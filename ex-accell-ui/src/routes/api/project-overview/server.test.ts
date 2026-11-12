import { describe, it, expect, vi, beforeEach } from 'vitest';

const query = vi.hoisted(() => vi.fn());

vi.mock('$lib/services/postgres', () => ({ postgresPool: { query } }));

import { GET } from './+server';

const project = { id: 1, name: 'p', description: null, project_type: 'general', status: 'active', created_at: 'now', updated_at: 'now' };
const workspace = {
  id: 3,
  name: 'w',
  description: null,
  workspace_type: 'analysis',
  status: 'active',
  created_at: 'now',
  updated_at: 'now',
  data_source_count: 2,
  source_names: ['upload', 'Telegram posts'],
  source_types: ['csv-upload', 'telegram'],
  total_records: 931,
  investigation_count: 0,
  last_activity: 'now'
};

const call = (id = '1') => GET({ url: new URL(`http://localhost/api/project-overview?id=${id}`) } as unknown as Parameters<typeof GET>[0]);

beforeEach(() => {
  query.mockReset();
  query.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM projects WHERE id')) return [project];
    if (sql.includes('FROM workspaces w')) return [workspace];
    return [];
  });
});

describe('GET /api/project-overview', () => {
  it('counts both captured sources and linked datasets in the workspace rollup', async () => {
    await call();

    const workspacesSql = String(query.mock.calls.find(([sql]) => String(sql).includes('FROM workspaces w'))?.[0]);
    expect(workspacesSql).toContain('workspace_data_sources');
    expect(workspacesSql).toContain('workspace_datasets');
  });

  it('totals data sources and records across the project from the rollup', async () => {
    const body = await (await call()).json();

    expect(body.success).toBe(true);
    expect(body.summary).toMatchObject({ total_workspaces: 1, total_data_sources: 2, total_records: 931 });
  });

  it('rejects a missing or malformed project id before querying', async () => {
    const missing = await GET({ url: new URL('http://localhost/api/project-overview') } as unknown as Parameters<typeof GET>[0]);
    const bad = await call('abc');

    expect(missing.status).toBe(400);
    expect(bad.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown project', async () => {
    query.mockImplementation(async () => []);

    expect((await call('99')).status).toBe(404);
  });
});

describe('GET /api/project-overview envelope', () => {
  it('returns the payload in data and the legacy keys', async () => {
    const body = await (await call()).json();

    expect(body.success).toBe(true);
    expect(body.data.project).toEqual(body.project);
    expect(body.data.summary).toEqual(body.summary);
  });

  it('puts null data on the 400 and 404 failures', async () => {
    expect(await (await call('abc')).json()).toMatchObject({ success: false, data: null });
    query.mockImplementation(async () => []);
    expect(await (await call('9')).json()).toEqual({ success: false, data: null, error: 'Project not found' });
  });

  it('returns a generic 500 envelope without the database message', async () => {
    query.mockRejectedValue(new Error('password authentication failed for user postgres'));

    const response = await call();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, data: null, error: 'Failed to load the project overview' });
  });
});
