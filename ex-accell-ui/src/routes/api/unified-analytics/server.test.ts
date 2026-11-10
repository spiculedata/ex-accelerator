import { describe, it, expect, vi, beforeEach } from 'vitest';

const { duckdbQuery, healthCheck } = vi.hoisted(() => ({
  duckdbQuery: vi.fn(),
  healthCheck: vi.fn().mockResolvedValue(true)
}));

vi.mock('$lib/services/postgres', () => ({ postgresPool: { duckdbQuery, healthCheck } }));
const { resolveWorkspaceScope } = vi.hoisted(() => ({ resolveWorkspaceScope: vi.fn().mockResolvedValue(null) }));

vi.mock('$lib/services/workspaceContextResolver', () => ({
  resolveWorkspaceScope,
  buildPlatformFilter: vi.fn().mockReturnValue(null),
  hasDataType: vi.fn().mockReturnValue(true)
}));
vi.mock('$lib/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}));

import { GET } from './+server';
import { WORKFLOW_DATASET_COUNT_QUERIES } from '$lib/server/workflowDatasets';

const call = (type: string, query = '') =>
  GET({ url: new URL(`http://localhost/api/unified-analytics?type=${type}${query}`) } as Parameters<typeof GET>[0]);

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

describe('GET /api/unified-analytics engagement edge cases', () => {
  const get = (query: string) =>
    GET({ url: new URL(`http://localhost/api/unified-analytics?${query}`) } as Parameters<typeof GET>[0]);

  it('rejects an unknown engagement query with a 400', async () => {
    const response = await get('type=engagement-nope');

    expect(response.status).toBe(400);
  });

  it('filters by the workspace platforms, passing them as $1 and the limit as $2', async () => {
    resolveWorkspaceScope.mockResolvedValue({ hasSocialMedia: true, socialPlatforms: ['telegram'] });
    duckdbQuery.mockResolvedValue([]);

    try {
      await get('type=engagement-top-posts&workspace_id=7&limit=5');
    } finally {
      resolveWorkspaceScope.mockResolvedValue(null);
    }

    const [sql, params] = duckdbQuery.mock.calls[0];
    expect(String(sql)).toContain('ds.platform = ANY($1)');
    expect(String(sql)).toContain('LIMIT $2');
    expect(params).toEqual([['telegram'], 5]);
  });

  it('clamps the limit to 1-100', async () => {
    duckdbQuery.mockResolvedValue([]);

    await get('type=engagement-top-posts&limit=100000');

    expect(duckdbQuery.mock.calls[0][1]).toEqual([100]);
  });

  it('counts a post once in content-type positive share even with several classifications', async () => {
    duckdbQuery.mockResolvedValue([]);

    await get('type=engagement-content-types');

    const sql = String(duckdbQuery.mock.calls[0][0]);
    expect(sql).not.toMatch(/LEFT JOIN sentiment_classifications/);
    expect(sql).toMatch(/EXISTS/);
  });
});

describe('GET /api/unified-analytics language-posts', () => {
  const get = (query: string) =>
    GET({ url: new URL(`http://localhost/api/unified-analytics?${query}`) } as Parameters<typeof GET>[0]);

  it('numbers parameters in order for every filter and clamps the limit', async () => {
    duckdbQuery.mockResolvedValue([]);

    await get('type=language-posts&platform=youtube&language=es&minConfidence=0.8&limit=9999');

    const [sql, params] = duckdbQuery.mock.calls[0];
    expect(String(sql)).toContain('ds.platform = $1');
    expect(String(sql)).toContain('l.code = $2');
    expect(String(sql)).toContain('ld.confidence_score >= $3');
    expect(String(sql)).toContain('LIMIT $4');
    expect(params).toEqual(['youtube', 'es', 0.8, 200]);
  });

  it('returns each post once even when it has several mixing rows', async () => {
    duckdbQuery.mockResolvedValue([]);

    await get('type=language-posts');

    expect(String(duckdbQuery.mock.calls[0][0])).not.toMatch(/LEFT JOIN language_mixing/);
  });
});

describe('GET /api/unified-analytics hashtag-analysis limit', () => {
  it('falls back to a default when limit is not a number', async () => {
    duckdbQuery.mockImplementation(async (sql: string) => (/to_regclass/i.test(sql) ? [{ present: false }] : []));

    const response = await GET({ url: new URL('http://localhost/api/unified-analytics?type=hashtag-analysis&limit=abc') } as Parameters<typeof GET>[0]);

    expect(response.status).toBe(200);
  });
});

describe('GET /api/unified-analytics trigrams', () => {
  const get = (query = '') =>
    GET({ url: new URL(`http://localhost/api/unified-analytics?type=trigrams${query ? `&${query}` : ''}`) } as Parameters<typeof GET>[0]);

  const row = (id: number, text: string, extra: Record<string, unknown> = {}) => ({
    id, text, platform: 'telegram', created_at: new Date(), sentiment_category: 'Negative', engagement_rate: '6.5', ...extra
  });

  it('computes phrases from the posts the database returns', async () => {
    duckdbQuery.mockResolvedValue([row(1, 'fare increase unfair'), row(2, 'fare increase unfair')]);

    const response = await get('minFrequency=2');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({ trigram: 'fare increase unfair', frequency: 2, sentiment: -0.5, averageEngagement: 6.5, platforms: ['telegram'] });
  });

  it('keeps the search text out of the SQL', async () => {
    duckdbQuery.mockResolvedValue([]);

    await get(`search=${encodeURIComponent("'; DROP TABLE posts; --")}`);

    expect(String(duckdbQuery.mock.calls[0][0])).not.toContain('DROP TABLE');
  });

  it('applies the platform filter as a parameter and the time range from a whitelist', async () => {
    duckdbQuery.mockResolvedValue([]);

    await get('platform=youtube&timeRange=30d');

    const [sql, params] = duckdbQuery.mock.calls[0];
    expect(String(sql)).toContain('ds.platform = $1');
    expect(String(sql)).toContain("INTERVAL '30 days'");
    expect(params).toEqual(['youtube']);
  });

  it('falls back to a 7 day window for an unknown time range', async () => {
    duckdbQuery.mockResolvedValue([]);

    await get('timeRange=1000%20years');

    expect(String(duckdbQuery.mock.calls[0][0])).toContain("INTERVAL '7 days'");
  });

  it('clamps maxResults and ignores non-numeric filters', async () => {
    duckdbQuery.mockResolvedValue(Array.from({ length: 5 }, (_, i) => row(i, `phrase number ${i} here`)));

    const body = await (await get('maxResults=abc&minFrequency=xyz')).json();

    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it('returns a 500 when the query fails', async () => {
    duckdbQuery.mockRejectedValue(new Error('connection terminated unexpectedly'));

    expect((await get()).status).toBe(500);
  });

  it('limits the scan to the workspace platforms and combines them with the platform filter', async () => {
    resolveWorkspaceScope.mockResolvedValue({ hasSocialMedia: true, socialPlatforms: ['telegram', 'bluesky'] });
    duckdbQuery.mockResolvedValue([]);

    try {
      await get('platform=bluesky&workspace_id=3');
    } finally {
      resolveWorkspaceScope.mockResolvedValue(null);
    }

    const [sql, params] = duckdbQuery.mock.calls[0];
    expect(String(sql)).toContain('ds.platform = ANY($1)');
    expect(String(sql)).toContain('ds.platform = $2');
    expect(params).toEqual([['telegram', 'bluesky'], 'bluesky']);
  });

  it('flags a truncated scan so the UI can say so', async () => {
    duckdbQuery.mockResolvedValue(Array.from({ length: 20_000 }, (_, i) => row(i, `water advisory update ${i % 3}`)));

    const body = await (await get()).json();

    expect(body.meta).toMatchObject({ truncated: true, scannedPosts: 20_000 });
  });

  it('does not flag a complete scan', async () => {
    duckdbQuery.mockResolvedValue([row(1, 'fare increase unfair')]);

    const body = await (await get()).json();

    expect(body.meta).toMatchObject({ truncated: false, scannedPosts: 1 });
  });

  it('clamps sentiment bounds to -1..1', async () => {
    duckdbQuery.mockResolvedValue([row(1, 'fare increase unfair', { sentiment_category: 'Very Negative' })]);

    const body = await (await get('minSentiment=-50&maxSentiment=50')).json();

    expect(body.data).toHaveLength(1);
  });
});

describe('GET /api/unified-analytics workflow-datasets', () => {
  const get = () => GET({ url: new URL('http://localhost/api/unified-analytics?type=workflow-datasets') } as Parameters<typeof GET>[0]);

  it('lists the datasets whose tables have data', async () => {
    duckdbQuery.mockImplementation(async (sql: string) => [{ count: /FROM posts\b/.test(sql) ? '1500' : '0' }]);

    const body = await (await get()).json();

    expect(body.success).toBe(true);
    expect(body.data.map((d: { id: string }) => d.id)).toEqual(['unified_analysis', 'social_posts']);
  });

  it('treats a missing table as empty rather than failing', async () => {
    duckdbQuery.mockRejectedValue(Object.assign(new Error('relation "android_devices" does not exist'), { code: '42P01' }));

    const response = await get();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([]);
  });

  it('keeps the other datasets when only one module has no table yet', async () => {
    duckdbQuery.mockImplementation(async (sql: string) => {
      if (/android_devices/.test(sql)) throw Object.assign(new Error('relation "android_devices" does not exist'), { code: '42P01' });
      return [{ count: /FROM posts\b/.test(sql) ? '10' : '0' }];
    });

    const body = await (await get()).json();

    expect(body.data.map((d: { id: string }) => d.id)).toEqual(['unified_analysis', 'social_posts']);
  });

  it('runs only the fixed count queries, with no input-derived SQL', async () => {
    duckdbQuery.mockResolvedValue([{ count: '0' }]);

    await get();

    const sent = duckdbQuery.mock.calls.map(([sql]) => String(sql)).sort();
    expect(sent).toEqual([...Object.values(WORKFLOW_DATASET_COUNT_QUERIES)].sort());
  });

  it('returns a 500 for a real failure', async () => {
    duckdbQuery.mockRejectedValue(new Error('connection terminated unexpectedly'));

    expect((await get()).status).toBe(500);
  });
});

describe('GET /api/unified-analytics removed placeholder queries', () => {
  it('does not serve invented datasets: type=datasets falls through to the default handler', async () => {
    const response = await GET({ url: new URL('http://localhost/api/unified-analytics?type=datasets') } as Parameters<typeof GET>[0]);
    const body = await response.json();

    expect(JSON.stringify(body)).not.toContain('Sample Social Media Data');
    expect(body.datasets).toBeUndefined();
    expect(body.endpoints?.datasets).toBeUndefined();
  });
});

describe('GET /api/unified-analytics investigation-timeline', () => {
  const get = () =>
    GET({ url: new URL('http://localhost/api/unified-analytics?type=investigation-timeline&keywords=tram&date_start=2026-06-01&date_end=2026-06-30') } as Parameters<typeof GET>[0]);

  const stub = (gdelt: boolean, radio: boolean) =>
    duckdbQuery.mockImplementation(async (sql: string) => (/to_regclass/i.test(sql) ? [{ gdelt, radio }] : []));
  const timelineSql = () => String(duckdbQuery.mock.calls.map(([sql]) => String(sql)).find((sql) => /date_series/.test(sql)));

  it('uses only the social posts when GDELT and radio tables do not exist', async () => {
    stub(false, false);

    const response = await get();

    expect(response.status).toBe(200);
    const sql = timelineSql();
    expect(sql).toContain('FROM posts_with_sentiment');
    expect(sql).not.toContain('FROM gdelt_events');
    expect(sql).not.toContain('FROM radio_transcripts');
    expect(sql).toContain('gdelt_events'); // output column still present
  });

  it('swaps out only the missing source (radio present, GDELT absent)', async () => {
    stub(false, true);

    await get();

    const sql = timelineSql();
    expect(sql).not.toContain('FROM gdelt_events');
    expect(sql).toContain('FROM radio_transcripts');
    expect(sql).toContain('FROM posts_with_sentiment');
  });

  it('includes each source whose table exists', async () => {
    stub(true, true);

    await get();

    const sql = timelineSql();
    expect(sql).toContain('FROM gdelt_events');
    expect(sql).toContain('FROM radio_transcripts');
  });
});

describe('GET /api/unified-analytics date filters for cross-platform sentiment', () => {
  it('compares the epoch-millisecond timestamp column with epoch milliseconds, not ISO strings', async () => {
    duckdbQuery.mockResolvedValue([]);

    await call('cross-platform-sentiment', '&date_start=2026-11-02&date_end=2026-11-09');

    const [sql, params] = duckdbQuery.mock.calls[0];
    expect(String(sql)).toContain('timestamp >=');
    expect(params).toEqual([Date.UTC(2026, 10, 2), Date.UTC(2026, 10, 9, 23, 59, 59, 999)]);
  });

  it('rejects an invalid date with a 400 and a clear message instead of failing in the database', async () => {
    const response = await call('cross-platform-sentiment', '&date_start=yesterday');
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ success: false });
    expect(body.error).toContain('date_start');
    expect(duckdbQuery).not.toHaveBeenCalled();
  });

  it('numbers the parameters correctly when only an end date is given, or a platform filter comes first', async () => {
    duckdbQuery.mockResolvedValue([]);

    await call('cross-platform-sentiment', '&date_end=2026-11-09');
    const [endOnlySql, endOnlyParams] = duckdbQuery.mock.calls[0];
    expect(String(endOnlySql)).toContain('timestamp <= $1');
    expect(endOnlyParams).toEqual([Date.UTC(2026, 10, 9, 23, 59, 59, 999)]);

    duckdbQuery.mockClear();
    await call('cross-platform-sentiment', '&platforms=telegram&date_start=2026-11-02&date_end=2026-11-09');
    const [sql] = duckdbQuery.mock.calls[0];
    expect(String(sql)).toContain('timestamp >= $2');
    expect(String(sql)).toContain('timestamp <= $3');
  });

  it('still works with no dates', async () => {
    duckdbQuery.mockResolvedValue([{ sentiment_category: 'Negative', post_count: '5', avg_confidence: '0.9', platform: 'x' }]);

    const body = await (await call('cross-platform-sentiment')).json();

    expect(body.success).toBe(true);
  });
});

describe('GET /api/unified-analytics sentiment-trends range', () => {
  it('uses the date bar (epoch ms bounds) when it is set, instead of the fixed number of days', async () => {
    duckdbQuery.mockResolvedValue([]);

    await call('sentiment-trends', '&timeRange=7d&date_start=2026-10-01&date_end=2026-10-31');

    const [sql, params] = duckdbQuery.mock.calls[0];
    expect(String(sql)).toContain('timestamp >=');
    expect(String(sql)).not.toContain('CURRENT_DATE');
    expect(params).toEqual([Date.UTC(2026, 9, 1), Date.UTC(2026, 9, 31, 23, 59, 59, 999)]);
  });

  it('falls back to the number of days when there are no dates', async () => {
    duckdbQuery.mockResolvedValue([]);

    await call('sentiment-trends', '&timeRange=30d');

    const [sql, params] = duckdbQuery.mock.calls[0];
    expect(String(sql)).toContain('CURRENT_TIMESTAMP');
    expect(params[0]).toBe(30);
  });

  it.each([
    ['both a date window and a platform filter', '&date_start=2026-10-01&date_end=2026-10-31&platforms=telegram', ['timestamp >= $1', 'timestamp <= $2', '= ANY($3)']],
    ['an end date only', '&date_end=2026-10-31', ['timestamp <= $1']],
    ['dates only (no platform parameter)', '&date_start=2026-10-01', ['timestamp >= $1']]
  ])('numbers placeholders correctly for %s', async (_label, query, expected) => {
    duckdbQuery.mockResolvedValue([]);

    await call('sentiment-trends', query);

    const sql = String(duckdbQuery.mock.calls[0][0]).replace(/\s+/g, ' ');
    for (const fragment of expected) expect(sql).toContain(fragment);
  });

  it('groups days in UTC so the buckets match the epoch-ms window', async () => {
    duckdbQuery.mockResolvedValue([]);

    await call('sentiment-trends', '&timeRange=7d');

    expect(String(duckdbQuery.mock.calls[0][0])).toContain("AT TIME ZONE 'UTC'");
  });

  it('rejects an invalid date with a 400', async () => {
    const response = await call('sentiment-trends', '&date_start=soon');

    expect(response.status).toBe(400);
  });
});

describe('GET /api/unified-analytics date ranges', () => {
  it.each(['emotion-stats', 'sample-posts', 'engagement-stats', 'language-stats', 'trigrams', 'sentiment-keywords'])(
    'answers 400, without touching the database, for a bad or reversed range on %s',
    async (type) => {
      for (const query of ['&date_start=2026-02-30', '&date_start=2026-11-05&date_end=2026-11-01', '&dateStart=nope']) {
        const response = await call(type, query);
        expect(response.status).toBe(400);
        expect((await response.json()).success).toBe(false);
      }
      expect(duckdbQuery).not.toHaveBeenCalled();
    }
  );
});
