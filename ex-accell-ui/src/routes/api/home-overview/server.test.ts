import { describe, it, expect, vi, beforeEach } from 'vitest';

const query = vi.hoisted(() => vi.fn());
const visibleProjectIds = vi.hoisted(() => vi.fn());

vi.mock('$lib/services/postgres', () => ({ postgresPool: { query } }));
vi.mock('$lib/server/auth/accessGuard', () => ({ visibleProjectIds }));

import { GET } from './+server';

const row = {
  id: 1,
  name: 'p',
  description: null,
  project_type: 'general',
  status: 'active',
  created_at: 'now',
  updated_at: 'now',
  workspace_count: 1,
  investigation_count: 0,
  data_source_count: 2,
  total_records: 931,
  source_types: ['csv-upload', 'telegram']
};

const call = () => GET({ locals: { user: { email: 'a@b.c' } } } as unknown as Parameters<typeof GET>[0]);

beforeEach(() => {
  query.mockReset();
  visibleProjectIds.mockReset();
  visibleProjectIds.mockResolvedValue(null);
  query.mockImplementation(async (sql: string) => (sql.includes('FROM projects p') ? [row] : []));
});

describe('GET /api/home-overview', () => {
  it('counts both captured sources and linked datasets in each project card', async () => {
    await call();

    const projectsSql = String(query.mock.calls.find(([sql]) => String(sql).includes('FROM projects p'))?.[0]);
    expect(projectsSql).toContain('workspace_data_sources');
    expect(projectsSql).toContain('workspace_datasets');
  });

  it('returns the combined record count and the source presence from the rollup', async () => {
    const body = await (await call()).json();

    expect(body.success).toBe(true);
    expect(body.projects).toHaveLength(1);
    expect(body.projects[0]).toMatchObject({ event_count: 931, sources: { social: true, gdelt: false, radio: false } });
  });

  it('hides projects the person may not see', async () => {
    visibleProjectIds.mockResolvedValue(new Set<number>([42]));

    const body = await (await call()).json();

    expect(body.projects).toEqual([]);
  });
});

describe('GET /api/home-overview envelope', () => {
  it('returns the payload in data and the legacy keys', async () => {
    const body = await (await call()).json();

    expect(body.success).toBe(true);
    expect(body.data.projects).toHaveLength(1);
    expect(body.data.projects).toEqual(body.projects);
    expect(body.data.summary).toEqual(body.summary);
  });

  it('returns a generic 500 envelope without the database message', async () => {
    query.mockRejectedValue(new Error('password authentication failed for user postgres'));

    const response = await call();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, data: null, error: 'Failed to load the home overview' });
  });
});
