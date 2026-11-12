import { describe, it, expect, vi, beforeEach } from 'vitest';

const { duckdbQuery, healthCheck } = vi.hoisted(() => ({
  duckdbQuery: vi.fn(),
  healthCheck: vi.fn().mockResolvedValue(true)
}));

vi.mock('$lib/services/postgres', () => ({ postgresPool: { duckdbQuery, healthCheck } }));
const { resolveWorkspaceScope } = vi.hoisted(() => ({ resolveWorkspaceScope: vi.fn() }));

vi.mock('$lib/services/workspaceContextResolver', () => ({
  resolveWorkspaceScope,
  buildPlatformFilter: vi.fn().mockReturnValue(null),
  hasDataType: vi.fn().mockReturnValue(true)
}));
vi.mock('$lib/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}));

import { GET } from './+server';

const get = (query: string) => GET({ url: new URL(`http://localhost/api/unified-analytics?${query}`) } as Parameters<typeof GET>[0]);

const NO_SOCIAL = { hasSocialMedia: false, socialPlatforms: [] as string[] };
const TELEGRAM = { hasSocialMedia: true, socialPlatforms: ['telegram'] };

beforeEach(() => {
  duckdbQuery.mockReset();
  duckdbQuery.mockResolvedValue([]);
  resolveWorkspaceScope.mockReset();
  resolveWorkspaceScope.mockResolvedValue({ kind: 'none' });
});

describe('workspace scoping of the social dashboards', () => {
  const SCOPED_TYPES = [
    'language-stats',
    'language-posts',
    'language-mixing',
    'language-trends',
    'language-detection-detail',
    'engagement-stats',
    'engagement-platforms',
    'engagement-content-types',
    'engagement-trends',
    'engagement-top-posts',
    'engagement-timing'
  ];

  it.each(SCOPED_TYPES)('%s returns nothing for a workspace with no social media dataset, instead of every post', async (type) => {
    resolveWorkspaceScope.mockResolvedValue({ kind: 'scoped', scope: NO_SOCIAL });

    const body = await (await get(`type=${type}&workspace_id=7`)).json();

    expect(body).toMatchObject({ success: true, data: [] });
    expect(duckdbQuery).not.toHaveBeenCalled();
  });

  it.each(['language-stats', 'language-mixing', 'language-trends'])(
    '%s is limited to the platforms of the workspace datasets',
    async (type) => {
      resolveWorkspaceScope.mockResolvedValue({ kind: 'scoped', scope: TELEGRAM });

      await get(`type=${type}&workspace_id=7`);

      const [sql, params] = duckdbQuery.mock.calls[0];
      expect(String(sql)).toContain('LOWER(ds.platform) = ANY($1)');
      expect(params).toEqual([['telegram']]);
    }
  );

  it('language-posts adds the workspace platforms after its own filters, keeping parameter order', async () => {
    resolveWorkspaceScope.mockResolvedValue({ kind: 'scoped', scope: TELEGRAM });

    await get('type=language-posts&workspace_id=7&language=es&limit=5');

    const [sql, params] = duckdbQuery.mock.calls[0];
    expect(String(sql)).toContain('l.code = $1');
    expect(String(sql)).toContain('LOWER(ds.platform) = ANY($2)');
    expect(String(sql)).toContain('LIMIT $3');
    expect(params).toEqual(['es', ['telegram'], 5]);
  });

  it('language-detection-detail combines the language and the workspace platforms', async () => {
    resolveWorkspaceScope.mockResolvedValue({ kind: 'scoped', scope: TELEGRAM });

    await get('type=language-detection-detail&workspace_id=7&language=es');

    const [sql, params] = duckdbQuery.mock.calls[0];
    expect(String(sql)).toContain('l.code = $1');
    expect(String(sql)).toContain('LOWER(ds.platform) = ANY($2)');
    expect(params).toEqual(['es', ['telegram']]);
  });

  it('numbers the date window after the workspace platforms', async () => {
    resolveWorkspaceScope.mockResolvedValue({ kind: 'scoped', scope: TELEGRAM });

    await get('type=language-stats&workspace_id=7&date_start=2026-01-01&date_end=2026-01-31');

    const [sql, params] = duckdbQuery.mock.calls[0];
    expect(String(sql)).toContain('LOWER(ds.platform) = ANY($1)');
    expect(String(sql)).toContain('p.created_at >= $2');
    expect(params).toEqual([['telegram'], expect.stringContaining('2026-01-01'), expect.stringContaining('2026-02-01')]);
  });

  it('still rejects a bad date range for a workspace with no social data', async () => {
    resolveWorkspaceScope.mockResolvedValue({ kind: 'scoped', scope: NO_SOCIAL });

    const response = await get('type=language-posts&workspace_id=7&date_start=not-a-date');

    expect(response.status).toBe(400);
  });

  it('still answers 400 to an unknown engagement query for a workspace with no social data', async () => {
    resolveWorkspaceScope.mockResolvedValue({ kind: 'scoped', scope: NO_SOCIAL });

    const response = await get('type=engagement-nope&workspace_id=7');

    expect(response.status).toBe(400);
  });

  it('stays unfiltered without a workspace', async () => {
    await get('type=language-stats');

    expect(String(duckdbQuery.mock.calls[0][0])).not.toContain('ds.platform');
  });
});

describe('GET /api/unified-analytics language-mixing', () => {
  it('reports the number of distinct mixed posts beside the pair counts', async () => {
    duckdbQuery.mockResolvedValue([{ primary_language: 'English', secondary_language: 'Spanish', occurrence_count: '30', mixed_posts: 120 }]);

    const body = await (await get('type=language-mixing')).json();

    const sql = String(duckdbQuery.mock.calls[0][0]);
    expect(sql).toContain('COUNT(DISTINCT');
    expect(sql).toContain('WITH scoped AS');
    expect(body.data[0]).toMatchObject({ occurrence_count: '30', mixed_posts: 120 });
  });
});

describe('GET /api/unified-analytics language-trends', () => {
  it('is computed from the detections of each post, not from a language_trends table that does not exist', async () => {
    duckdbQuery.mockResolvedValue([{ language_code: 'en', analysis_date: '2026-01-02', document_count: '4', avg_confidence: '0.9' }]);

    const body = await (await get('type=language-trends')).json();

    const sql = String(duckdbQuery.mock.calls[0][0]);
    expect(sql).not.toContain('language_trends');
    expect(sql).toContain('FROM language_detection ld');
    expect(body.data).toEqual([{ language_code: 'en', analysis_date: '2026-01-02', document_count: 4, avg_confidence: 0.9 }]);
  });
});

describe('GET /api/unified-analytics language-mixing scope', () => {
  it('applies the workspace platforms and the date window inside the scoped rows that both counts read', async () => {
    resolveWorkspaceScope.mockResolvedValue({ kind: 'scoped', scope: TELEGRAM });

    await get('type=language-mixing&workspace_id=7&date_start=2026-01-01');

    const [sql, params] = duckdbQuery.mock.calls[0];
    const scoped = String(sql).split('SELECT\n      l1.name')[0];
    expect(scoped).toContain('LOWER(ds.platform) = ANY($1)');
    expect(scoped).toContain('p.created_at >= $2');
    expect(params).toEqual([['telegram'], expect.stringContaining('2026-01-01')]);
  });
});
