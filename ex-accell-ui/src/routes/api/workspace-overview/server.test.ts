import { describe, it, expect, vi, beforeEach } from 'vitest';

const query = vi.hoisted(() => vi.fn());

vi.mock('$lib/services/postgres', () => ({ postgresPool: { query } }));

import { GET } from './+server';

const workspace = { id: 1, name: 'w', description: null, workspace_type: 'analysis', project_id: 1, status: 'active', created_at: 'now', project_name: 'p' };
const captured = { kind: 'capture', id: 1, source_type: 'csv-upload', source_name: 'upload', status: 'active', record_count: 10, last_sync: null, created_at: 'now' };
const linked = { kind: 'dataset', id: 7, source_type: 'telegram', source_name: 'Telegram posts', status: 'active', record_count: 921, last_sync: 'now', created_at: 'now' };

const call = (id = '1') =>
  GET({ url: new URL(`http://localhost/api/workspace-overview?id=${id}`) } as unknown as Parameters<typeof GET>[0]);

beforeEach(() => {
  query.mockReset();
});

describe('GET /api/workspace-overview', () => {
  it('counts datasets linked to the workspace as data sources and records', async () => {
    query
      .mockResolvedValueOnce([workspace])
      .mockResolvedValueOnce([captured, linked])
      .mockResolvedValueOnce([]);

    const body = await (await call()).json();

    expect(body.summary).toMatchObject({ total_data_sources: 2, total_records: 931 });
    expect(body.data_sources.map((s: { source_name: string }) => s.source_name)).toEqual(['upload', 'Telegram posts']);
  });

  it('reads both captured sources and linked datasets', async () => {
    query.mockResolvedValueOnce([workspace]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await call();

    const sourcesSql = String(query.mock.calls[1][0]);
    expect(sourcesSql).toContain('workspace_data_sources');
    expect(sourcesSql).toContain('workspace_datasets');
  });
});
