import { describe, it, expect, vi, beforeEach } from 'vitest';

const { duckdbQuery, healthCheck } = vi.hoisted(() => ({
  duckdbQuery: vi.fn(),
  healthCheck: vi.fn().mockResolvedValue(true)
}));

vi.mock('$lib/services/postgres', () => ({ postgresPool: { duckdbQuery, healthCheck } }));
vi.mock('$lib/services/workspaceContextResolver', () => ({
  resolveWorkspaceScope: vi.fn().mockResolvedValue(null),
  buildPlatformFilter: vi.fn().mockReturnValue(null),
  hasDataType: vi.fn().mockReturnValue(true)
}));
vi.mock('$lib/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}));

import { GET } from './+server';

const call = (type: string) =>
  GET({ url: new URL(`http://localhost/api/unified-analytics?type=${type}`) } as Parameters<typeof GET>[0]);

beforeEach(() => {
  duckdbQuery.mockReset();
});

describe('GET /api/unified-analytics error handling', () => {
  it('returns rows on success', async () => {
    duckdbQuery.mockResolvedValue([{ emotion: 'joy', count: '3' }]);

    const body = await (await call('emotion-stats')).json();

    expect(body.success).toBe(true);
    expect(body.data).toEqual([{ emotion: 'joy', count: 3 }]);
  });

  it('returns a 500 (not success with empty data) when the query fails', async () => {
    duckdbQuery.mockRejectedValue(new Error('connection terminated unexpectedly'));

    const response = await call('emotion-stats');
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(JSON.stringify(body)).not.toContain('connection terminated');
  });

  it('returns empty data flagged unavailable when the module has no table yet', async () => {
    duckdbQuery.mockRejectedValue(Object.assign(new Error('relation "emotion_analysis" does not exist'), { code: '42P01' }));

    const response = await call('emotion-stats');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, data: [], meta: { unavailable: true } });
  });
});

describe('GET /api/unified-analytics hashtag-analysis', () => {
  const sqlCalls = () => duckdbQuery.mock.calls.map(([sql]) => String(sql));
  const stub = (silverPresent: boolean) =>
    duckdbQuery.mockImplementation(async (sql: string) =>
      /to_regclass/i.test(sql) ? [{ present: silverPresent }] : []
    );

  it('reads the core posts table when the ETL silver.posts table does not exist', async () => {
    stub(false);

    await call('hashtag-analysis');

    const queries = sqlCalls().filter((sql) => !/to_regclass/i.test(sql));
    expect(queries.length).toBeGreaterThan(0);
    expect(queries.every((sql) => !sql.includes('silver.posts'))).toBe(true);
    expect(queries.every((sql) => sql.includes('FROM posts p'))).toBe(true);
  });

  it('keeps reading silver.posts when the ETL table exists', async () => {
    stub(true);

    await call('hashtag-analysis');

    const queries = sqlCalls().filter((sql) => !/to_regclass/i.test(sql));
    expect(queries.every((sql) => sql.includes('silver.posts'))).toBe(true);
  });

  it('returns a 500 instead of an empty success when the query fails', async () => {
    duckdbQuery.mockImplementation(async (sql: string) => {
      if (/to_regclass/i.test(sql)) return [{ present: false }];
      throw new Error('connection terminated unexpectedly');
    });

    const response = await call('hashtag-analysis');

    expect(response.status).toBe(500);
  });
});

describe('GET /api/unified-analytics engagement queries', () => {
  it.each([
    'engagement-stats',
    'engagement-platforms',
    'engagement-content-types',
    'engagement-trends',
    'engagement-top-posts',
    'engagement-timing'
  ])('%s reads the engagement tables and returns the rows', async (type) => {
    duckdbQuery.mockResolvedValue([{ posts: '4' }]);

    const response = await call(type);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(String(duckdbQuery.mock.calls[0][0])).toContain('post_engagement');
  });

  it('applies the trend window from the timeRange parameter', async () => {
    duckdbQuery.mockResolvedValue([]);

    await GET({ url: new URL('http://localhost/api/unified-analytics?type=engagement-trends&timeRange=30d') } as Parameters<typeof GET>[0]);

    expect(String(duckdbQuery.mock.calls[0][0])).toContain("INTERVAL '30 days'");
  });

  it('returns a 500, not an empty success, when the query fails', async () => {
    duckdbQuery.mockRejectedValue(new Error('connection terminated unexpectedly'));

    const response = await call('engagement-stats');

    expect(response.status).toBe(500);
  });
});

describe('GET /api/unified-analytics topic-keywords', () => {
  it('keys keywords by the same topic_id that topics-overview returns', async () => {
    duckdbQuery.mockResolvedValue([]);

    await call('topic-keywords');

    const sql = String(duckdbQuery.mock.calls[0][0]);
    expect(sql).toMatch(/JOIN topics t ON t\.id = tk\.topic_id/);
    expect(sql).toMatch(/t\.topic_id AS topic_id/);
  });
});
