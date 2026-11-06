import { describe, it, expect, vi, beforeEach } from 'vitest';
import { summarizeTrigrams, trigramsDb, type TrigramData } from './trigramsDb';

const trigram = (overrides: Partial<TrigramData> = {}): TrigramData => ({
  trigram: 'new tram timetable', frequency: 10, sentiment: 0.5, platforms: ['telegram'], trend: 'stable',
  firstSeen: '2026-06-01T00:00:00.000Z', lastSeen: '2026-06-10T00:00:00.000Z', averageEngagement: 4.25, topPosts: [], ...overrides
});

function mockFetch(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const fetchMock = vi.fn(async () => ({ ok: init.ok ?? true, status: init.status ?? 200, json: async () => body }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const requestedUrl = (fetchMock: ReturnType<typeof mockFetch>) => new URL(String((fetchMock.mock.calls[0] as unknown[])[0]), 'http://localhost');

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('getTrigramsData', () => {
  it('escapes quotes in exported fields', async () => {
    mockFetch({ success: true, data: [trigram({ trigram: 'say "hi" now', platforms: ['a"b'] })] });

    const csv = await trigramsDb.exportTrigramsData();

    expect(csv).toContain('"say ""hi"" now"');
    expect(csv).toContain('"a""b"');
  });

  it('returns the phrases computed by the server', async () => {
    mockFetch({ success: true, data: [trigram()] });

    const data = await trigramsDb.getTrigramsData();

    expect(data).toEqual([trigram()]);
  });

  it('sends the filters as query parameters, never as SQL', async () => {
    const fetchMock = mockFetch({ success: true, data: [] });

    await trigramsDb.getTrigramsData(
      { platform: 'youtube', timeRange: '30d', minFrequency: 3, maxResults: 20, searchQuery: "x'; DROP TABLE posts; --", sentimentRange: [-0.5, 0.5] },
      '7'
    );

    const url = requestedUrl(fetchMock);
    expect(url.pathname).toBe('/api/unified-analytics');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      type: 'trigrams', platform: 'youtube', timeRange: '30d', minFrequency: '3', maxResults: '20',
      search: "x'; DROP TABLE posts; --", minSentiment: '-0.5', maxSentiment: '0.5', workspace_id: '7'
    });
  });

  it('omits filters that were not set', async () => {
    const fetchMock = mockFetch({ success: true, data: [] });

    await trigramsDb.getTrigramsData();

    expect([...requestedUrl(fetchMock).searchParams.keys()]).toEqual(['type']);
  });

  it('throws when the API reports a failure instead of returning made-up data', async () => {
    mockFetch({ success: false, error: 'Trigram analysis failed' }, { ok: false, status: 500 });

    await expect(trigramsDb.getTrigramsData()).rejects.toThrow(/Trigram analysis failed/);
  });

  it('reports an HTTP error even when the body is not JSON (for example a proxy error page)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 502, json: async () => { throw new SyntaxError('Unexpected token <'); } })));

    await expect(trigramsDb.getTrigramsData()).rejects.toThrow('Trigram request failed (502)');
  });

  it('throws on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(trigramsDb.getTrigramsData()).rejects.toThrow('network down');
  });
});

describe('getTrigramsResult', () => {
  it('returns the phrases with the server\'s truncation flag', async () => {
    mockFetch({ success: true, data: [trigram()], meta: { truncated: true, scannedPosts: 20000 } });

    const result = await trigramsDb.getTrigramsResult();

    expect(result).toEqual({ data: [trigram()], truncated: true });
  });

  it('defaults to not truncated when the server sends no meta', async () => {
    mockFetch({ success: true, data: [] });

    expect((await trigramsDb.getTrigramsResult()).truncated).toBe(false);
  });
});

describe('summarizeTrigrams', () => {
  it('returns zeros for no data', () => {
    expect(summarizeTrigrams([])).toEqual({
      totalTrigrams: 0, uniqueTrigrams: 0, averageFrequency: 0,
      sentimentDistribution: { positive: 0, neutral: 0, negative: 0 },
      trendDistribution: { up: 0, stable: 0, down: 0 }
    });
  });

  it('totals frequencies and buckets sentiment and trend', () => {
    const stats = summarizeTrigrams([
      trigram({ frequency: 10, sentiment: 0.6, trend: 'up' }),
      trigram({ frequency: 4, sentiment: 0, trend: 'stable' }),
      trigram({ frequency: 1, sentiment: -0.6, trend: 'down' })
    ]);

    expect(stats).toEqual({
      totalTrigrams: 15, uniqueTrigrams: 3, averageFrequency: 5,
      sentimentDistribution: { positive: 1, neutral: 1, negative: 1 },
      trendDistribution: { up: 1, stable: 1, down: 1 }
    });
  });
});

describe('exportTrigramsData', () => {
  it('returns a CSV with a header and one row per phrase', async () => {
    mockFetch({ success: true, data: [trigram({ platforms: ['telegram', 'youtube'] })] });

    const csv = await trigramsDb.exportTrigramsData();

    const [header, row] = csv.split('\n');
    expect(header).toBe('Trigram,Frequency,Sentiment,Sentiment Label,Platforms,Trend,First Seen,Last Seen,Average Engagement');
    expect(row).toBe('"new tram timetable",10,0.50,Positive,"telegram; youtube",stable,2026-06-01T00:00:00.000Z,2026-06-10T00:00:00.000Z,4.3');
  });

  it('labels sentiment by threshold', async () => {
    mockFetch({ success: true, data: [trigram({ sentiment: -0.4 }), trigram({ sentiment: 0.1 })] });

    const csv = await trigramsDb.exportTrigramsData();

    expect(csv).toContain(',Negative,');
    expect(csv).toContain(',Neutral,');
  });

  it('returns only the header when there is no data', async () => {
    mockFetch({ success: true, data: [] });

    expect((await trigramsDb.exportTrigramsData()).split('\n')).toHaveLength(1);
  });
});
