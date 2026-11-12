// Characterisation of every `type` the unified-analytics dispatcher serves.
// For each type and request shape it records status, body and the SQL + params sent to the database,
// so a refactor of the dispatcher can be proven behaviour-preserving (see __snapshots__).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { duckdbQuery, healthCheck, getPoolStats } = vi.hoisted(() => ({
  duckdbQuery: vi.fn(),
  healthCheck: vi.fn(),
  getPoolStats: vi.fn()
}));

vi.mock('$lib/services/postgres', () => ({ postgresPool: { duckdbQuery, healthCheck, getPoolStats } }));
const { resolveWorkspaceScope } = vi.hoisted(() => ({ resolveWorkspaceScope: vi.fn() }));

vi.mock('$lib/services/workspaceContextResolver', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/services/workspaceContextResolver')>()),
  resolveWorkspaceScope
}));
vi.mock('$lib/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}));

import { GET } from './+server';

const ALL_TYPES = [
  'test', 'cross-platform-sentiment', 'sentiment-trends', 'sample-posts', 'platform-performance', 'top-keywords',
  'emotion-correlations', 'emotion-stats', 'sentiment-keywords', 'hourly-patterns', 'export-data',
  'topics-overview', 'topic-keywords', 'topic-trends', 'topic-relationships', 'topic-categories',
  'language-stats', 'language-posts', 'language-mixing', 'language-trends', 'language-detection-detail',
  'gdelt-summary', 'gdelt-by-country', 'gdelt-by-eventtype', 'gdelt-timeline', 'gdelt-top-actors',
  'gdelt-country-detail', 'gdelt-conflicts', 'gdelt-search', 'gdelt-narrative-summary',
  'engagement-stats', 'engagement-platforms', 'engagement-content-types', 'engagement-trends',
  'engagement-top-posts', 'engagement-timing', 'engagement-unknown',
  'trigrams', 'hashtag-analysis', 'gdelt-refresh-views', 'workflow-datasets',
  'radio-overview', 'radio-sentiment', 'radio-by-station', 'radio-trends', 'radio-topics', 'radio-political',
  'radio-transcripts', 'radio-wordcloud',
  'investigation-timeline', 'investigation-gdelt-events', 'investigation-radio-segments',
  'investigation-social-posts', 'investigation-keyword-overlap', 'investigation-locations', 'investigation-actors',
  'not-a-real-type'
];

const RICH_QUERY =
  'date_start=2024-01-01&date_end=2024-01-31&dateStart=2024-01-01&dateEnd=2024-01-31&keywords=alpha,beta&' +
  'platform=telegram&sentiment=positive&keywordSentiment=negative&limit=7&offset=3&timeRange=90d&country=UK&' +
  'topicId=t1&threshold=0.7&language=en&search=hello&q=hello&political=true&minConfidence=0.4&topic=energy&' +
  'workspace_id=7&investigation_id=3&days=5&interval=day&granularity=day&source=social';

const SOCIAL_SCOPE = {
  workspaceId: 7, workspaceName: 'ws', datasets: [], hasSocialMedia: true, hasGdeltEvents: true, hasGdeltGkg: false,
  socialPlatforms: ['telegram', 'x'], datasetTypes: ['social_media', 'gdelt_events'],
  gdeltDateRange: { start: 20240101, end: 20240131 }
};
const EMPTY_SCOPE = { ...SOCIAL_SCOPE, hasSocialMedia: false, hasGdeltEvents: false, socialPlatforms: [], datasetTypes: [], gdeltDateRange: null };

const normalise = (sql: unknown) => String(sql).replace(/\s+/g, ' ').trim();
const ROWS = [{ count: '3', present: true, id: 1, text: 'hello world', platform: 'telegram', created_at: '2024-01-02T00:00:00Z', keyword: 'k', actor: 'A', mentions: 2, eventrootcode: '14', cnt: 4, total_events: 5, avg_goldstein: -2, avg_tone: 2, unique_actors: 3, content: 'hello #tag world', sentiment_category: 'Positive', engagement_rate: 1.5 }];

async function record(type: string, query: string, setup: () => void = () => {}) {
  duckdbQuery.mockReset();
  duckdbQuery.mockResolvedValue(ROWS);
  setup();
  const response = await GET({ url: new URL(`http://localhost/api/unified-analytics?type=${type}${query ? '&' + query : ''}`) } as Parameters<typeof GET>[0]);
  return {
    status: response.status,
    body: await response.json(),
    queries: duckdbQuery.mock.calls.map(([sql, params]) => [normalise(sql), params ?? null])
  };
}

const SHAPES: Array<[string, string, () => void]> = [
  ['plain', '', () => {}],
  ['rich', RICH_QUERY, () => {}],
  ['social workspace', 'workspace_id=7&date_start=2024-01-01&date_end=2024-01-31&platform=x&sentiment=negative', () => resolveWorkspaceScope.mockResolvedValue({ kind: 'scoped', scope: SOCIAL_SCOPE })],
  ['empty workspace', 'workspace_id=7&keywords=alpha', () => resolveWorkspaceScope.mockResolvedValue({ kind: 'scoped', scope: EMPTY_SCOPE })],
  ['platforms switched off', 'platforms=', () => {}],
  ['platforms listed', 'platforms=Telegram,X', () => {}],
  ['bad date', 'date_start=nope', () => {}],
  ['reversed dates', 'date_start=2024-02-01&date_end=2024-01-01&dateStart=2024-02-01&dateEnd=2024-01-01', () => {}],
  ['database error', '', () => duckdbQuery.mockRejectedValue(new Error('boom: secret detail'))],
  ['missing table', '', () => duckdbQuery.mockRejectedValue(Object.assign(new Error('relation missing'), { code: '42P01' }))]
];

describe('unified-analytics characterisation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-01T00:00:00Z'));
    resolveWorkspaceScope.mockReset();
    resolveWorkspaceScope.mockResolvedValue({ kind: 'none' });
    healthCheck.mockReset();
    healthCheck.mockResolvedValue(true);
    getPoolStats.mockReset();
    getPoolStats.mockReturnValue({ total: 1 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '', json: async () => ({ response: 'narrative' }) }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  for (const type of ALL_TYPES) {
    describe(type, () => {
      it.each(SHAPES)('%s', async (_name, query, setup) => {
        expect(await record(type, query, setup)).toMatchSnapshot();
      });
    });
  }

  it('answers a request with no type like an unknown type', async () => {
    expect(await record('', '')).toMatchSnapshot();
  });

  it('answers 404 for a workspace that does not exist, whatever the type', async () => {
    const result = await record('sample-posts', 'workspace_id=99', () => resolveWorkspaceScope.mockResolvedValue({ kind: 'missing', workspaceId: 99 }));
    expect(result.status).toBe(404);
    expect(result.body).toEqual({ success: false, data: null, error: 'Workspace not found' });
    expect(result.queries).toEqual([]);
  });

  it('serves an unknown type with an empty 200 envelope and no database call', async () => {
    const result = await record('not-a-real-type', '');
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ success: true, data: [] });
    expect(result.queries).toEqual([]);
  });
});
