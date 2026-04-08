import { describe, it, expect, vi, beforeEach } from 'vitest';
import { languageDetectionDb } from './languageDetectionDb';

// Helper to create a mock fetch that routes by endpoint (the 'type' query param)
function mockFetch(routes: Record<string, any>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const parsed = new URL(url, 'http://localhost');
      const endpoint = parsed.searchParams.get('type');
      const data = routes[endpoint ?? ''];
      if (data !== undefined) {
        return { ok: true, json: async () => ({ success: true, data }) };
      }
      return { ok: true, json: async () => ({ success: true, data: [] }) };
    })
  );
}

beforeEach(() => {
  (languageDetectionDb as any).initialized = true;
});

// ─── getLanguageStats ──────────────────────────────────────────────────────

describe('getLanguageStats', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'language-stats': [] });
    const stats = await languageDetectionDb.getLanguageStats();
    expect(stats).toEqual([]);
  });

  it('returns empty array when API returns null', async () => {
    mockFetch({ 'language-stats': null });
    const stats = await languageDetectionDb.getLanguageStats();
    expect(stats).toEqual([]);
  });

  it('transforms language data with correct percentages', async () => {
    const data = [
      { language: 'English', language_code: 'en', post_count: 300, confidence: 0.95 },
      { language: 'Spanish', language_code: 'es', post_count: 200, confidence: 0.88 }
    ];
    mockFetch({ 'language-stats': data });

    const stats = await languageDetectionDb.getLanguageStats();

    expect(stats).toHaveLength(2);
    expect(stats[0].language).toBe('English');
    expect(stats[0].language_code).toBe('en');
    expect(stats[0].post_count).toBe(300);
    expect(stats[0].percentage).toBe(60);
    expect(stats[0].confidence).toBe(0.95);

    expect(stats[1].percentage).toBe(40);
  });

  it('passes workspaceId to the API', async () => {
    mockFetch({ 'language-stats': [] });
    await languageDetectionDb.getLanguageStats('ws-1');

    const callUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const parsed = new URL(callUrl, 'http://localhost');
    expect(parsed.searchParams.get('workspace_id')).toBe('ws-1');
  });
});

// ─── getLanguageAnalysis ───────────────────────────────────────────────────

describe('getLanguageAnalysis', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'language-stats': [] });
    const analysis = await languageDetectionDb.getLanguageAnalysis();
    expect(analysis).toEqual([]);
  });

  it('transforms data with confidence breakdown and native names', async () => {
    const data = [
      { language: 'English', language_code: 'en', post_count: 100, confidence: 0.95 },
      { language: 'Welsh', language_code: 'cy', post_count: 50, confidence: 0.8 }
    ];
    mockFetch({ 'language-stats': data });

    const analysis = await languageDetectionDb.getLanguageAnalysis();

    expect(analysis).toHaveLength(2);
    expect(analysis[0].code).toBe('en');
    expect(analysis[0].name).toBe('English');
    expect(analysis[0].native_name).toBe('English');
    expect(analysis[0].totalDetections).toBe(100);
    expect(analysis[0].avgConfidence).toBe(0.95);
    expect(analysis[0].confidenceStddev).toBe(0.05);

    expect(analysis[1].native_name).toBe('Cymraeg');
  });

  it('uses language name as native_name for unknown codes', async () => {
    const data = [
      { language: 'Klingon', language_code: 'tlh', post_count: 5, confidence: 0.6 }
    ];
    mockFetch({ 'language-stats': data });

    const analysis = await languageDetectionDb.getLanguageAnalysis();
    expect(analysis[0].native_name).toBe('Klingon');
  });
});

// ─── getLanguageTrends ─────────────────────────────────────────────────────

describe('getLanguageTrends', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'language-trends': [] });
    const trends = await languageDetectionDb.getLanguageTrends();
    expect(trends).toEqual([]);
  });

  it('transforms trend data correctly', async () => {
    const data = [
      { analysis_date: '2024-01-01', language_code: 'en', document_count: 50 },
      { analysis_date: '2024-01-02', language_code: 'es', document_count: 30 }
    ];
    mockFetch({ 'language-trends': data });

    const trends = await languageDetectionDb.getLanguageTrends('30d');

    expect(trends).toHaveLength(2);
    expect(trends[0].date).toBe('2024-01-01');
    expect(trends[0].language).toBe('en');
    expect(trends[0].post_count).toBe(50);
  });
});

// ─── getSamplePosts ────────────────────────────────────────────────────────

describe('getSamplePosts', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'sample-posts': [] });
    const posts = await languageDetectionDb.getSamplePosts();
    expect(posts).toEqual([]);
  });

  it('transforms posts with language mapping based on platform', async () => {
    const data = [
      { id: '1', text: 'Hello world', platform: 'twitter', confidence: 0.92, timestamp: '2024-01-01T00:00:00Z' },
      { id: '2', text: 'Hola mundo', platform: 'facebook', confidence: 0.88, timestamp: '2024-01-02T00:00:00Z' }
    ];
    mockFetch({ 'sample-posts': data });

    const posts = await languageDetectionDb.getSamplePosts();

    expect(posts).toHaveLength(2);
    expect(posts[0].language).toBe('en');
    expect(posts[0].language_name).toBe('English');
    expect(posts[0].confidence).toBe(0.92);

    expect(posts[1].language).toBe('es');
    expect(posts[1].language_name).toBe('Spanish');
  });

  it('passes platform and limit filters', async () => {
    mockFetch({ 'sample-posts': [] });
    await languageDetectionDb.getSamplePosts({ platform: 'twitter', limit: 25 });

    const callUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const parsed = new URL(callUrl, 'http://localhost');
    expect(parsed.searchParams.get('platform')).toBe('twitter');
    expect(parsed.searchParams.get('limit')).toBe('25');
  });
});

// ─── getLanguageMixing ─────────────────────────────────────────────────────

describe('getLanguageMixing', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'emotion-correlations': [] });
    const mixing = await languageDetectionDb.getLanguageMixing();
    expect(mixing).toEqual([]);
  });

  it('generates mixing pairs from correlation data', async () => {
    const data = [
      { score: 50 },
      { score: 40 },
      { score: 30 }
    ];
    mockFetch({ 'emotion-correlations': data });

    const mixing = await languageDetectionDb.getLanguageMixing();

    expect(mixing).toHaveLength(3);
    expect(mixing[0].primary_language).toBe('English');
    expect(mixing[0].secondary_language).toBe('Spanish');
    expect(mixing[0].occurrence_count).toBeGreaterThanOrEqual(10);
    expect(mixing[0].percentage).toBeGreaterThan(0);
  });
});

// ─── getGeographicDistribution ─────────────────────────────────────────────

describe('getGeographicDistribution', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'platform-performance': [] });
    const geo = await languageDetectionDb.getGeographicDistribution();
    expect(geo).toEqual([]);
  });

  it('generates geographic distribution from platform data', async () => {
    const data = [
      { platform: 'twitter', total_posts: 1000 }
    ];
    mockFetch({ 'platform-performance': data });

    const geo = await languageDetectionDb.getGeographicDistribution();

    expect(geo).toHaveLength(5);
    expect(geo[0].language_name).toBe('English');
    expect(geo[0].country_code).toBe('US');
    expect(geo[0].region).toBe('North America');
    expect(geo[0].country_rank).toBe(1);
    expect(geo[0].post_count).toBeGreaterThan(0);
  });
});

// ─── getLanguageDetectionStats ─────────────────────────────────────────────

describe('getLanguageDetectionStats', () => {
  it('returns defaults when no data', async () => {
    mockFetch({ 'cross-platform-sentiment': [] });
    const stats = await languageDetectionDb.getLanguageDetectionStats();

    expect(stats.totalPosts).toBe(0);
    expect(stats.totalLanguages).toBe(0);
    expect(stats.avgConfidence).toBe(0);
    expect(stats.topLanguage.name).toBe('English');
    expect(stats.confidenceDistribution.veryHigh).toBe(0);
  });

  it('calculates stats from cross-platform data', async () => {
    const data = [
      { post_count: 200, avg_confidence: 0.9 },
      { post_count: 100, avg_confidence: 0.8 }
    ];
    mockFetch({ 'cross-platform-sentiment': data });

    const stats = await languageDetectionDb.getLanguageDetectionStats();

    expect(stats.totalPosts).toBe(300);
    expect(stats.totalLanguages).toBe(5);
    expect(stats.avgConfidence).toBe(0.85);
    expect(stats.confidenceDistribution.veryHigh).toBe(Math.floor(300 * 0.4));
    expect(stats.confidenceDistribution.high).toBe(Math.floor(300 * 0.3));
    expect(stats.lastUpdated).toBeTruthy();
  });
});

// ─── exportLanguageData ────────────────────────────────────────────────────

describe('exportLanguageData', () => {
  it('combines results from all queries', async () => {
    const langStats = [
      { language: 'English', language_code: 'en', post_count: 100, confidence: 0.9 }
    ];
    const samplePosts = [
      { id: '1', text: 'Hello', platform: 'twitter', confidence: 0.9, timestamp: '2024-01-01T00:00:00Z' }
    ];
    const crossPlatform = [{ post_count: 100, avg_confidence: 0.9 }];
    const platformPerf = [{ platform: 'twitter', total_posts: 100 }];

    mockFetch({
      'language-stats': langStats,
      'sample-posts': samplePosts,
      'cross-platform-sentiment': crossPlatform,
      'platform-performance': platformPerf,
      'language-trends': [],
      'emotion-correlations': []
    });

    const result = await languageDetectionDb.exportLanguageData();

    expect(result.exportDate).toBeTruthy();
    expect(result.data).toHaveLength(1);
    expect(result.summary.languages).toHaveLength(1);
    expect(result.summary.stats.totalPosts).toBe(100);
  });

  it('handles empty results gracefully', async () => {
    mockFetch({});
    const result = await languageDetectionDb.exportLanguageData();

    expect(result.data).toEqual([]);
    expect(result.summary.languages).toEqual([]);
    expect(result.summary.stats.totalPosts).toBe(0);
  });
});
