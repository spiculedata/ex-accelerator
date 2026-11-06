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

    expect(await languageDetectionDb.getLanguageAnalysis()).toEqual([]);
  });

  it('uses the real confidence buckets from the database', async () => {
    mockFetch({
      'language-stats': [{
        language_code: 'es', language: 'Spanish', post_count: '200', confidence: '0.9123',
        very_high_count: '120', high_count: '50', medium_count: '20', low_count: '10', confidence_stddev: '0.0431'
      }]
    });

    const [analysis] = await languageDetectionDb.getLanguageAnalysis();

    expect(analysis).toEqual({
      code: 'es', name: 'Spanish', native_name: 'Español', totalDetections: 200,
      veryHighConfidence: 120, highConfidence: 50, mediumConfidence: 20, lowConfidence: 10,
      avgConfidence: 0.91, confidenceStddev: 0.04
    });
  });

  it('uses the language name as native_name for unknown codes', async () => {
    mockFetch({ 'language-stats': [{ language_code: 'xx', language: 'Klingon', post_count: '1', confidence: '0.9', very_high_count: '0', high_count: '1', medium_count: '0', low_count: '0', confidence_stddev: '0' }] });

    const [analysis] = await languageDetectionDb.getLanguageAnalysis();

    expect(analysis.native_name).toBe('Klingon');
  });
});

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
    mockFetch({ 'language-posts': [] });

    expect(await languageDetectionDb.getSamplePosts()).toEqual([]);
  });

  it('maps the language detected for each post, not one guessed from its platform', async () => {
    mockFetch({
      'language-posts': [{
        id: 12, text: 'Bonjour', language_code: 'fr', language_name: 'French', confidence: '0.97',
        timestamp: '2026-10-07 08:30:00', platform: 'bluesky', secondary_language: 'en', secondary_confidence: '0.2'
      }]
    });

    const [post] = await languageDetectionDb.getSamplePosts();

    expect(post).toEqual({
      id: 12, text: 'Bonjour', language: 'fr', language_name: 'French', confidence: 0.97,
      timestamp: '2026-10-07T08:30:00.000Z', platform: 'bluesky', secondary_language: 'en', secondary_confidence: 0.2
    });
  });

  it('leaves the secondary language empty when none was detected', async () => {
    mockFetch({ 'language-posts': [{ id: 1, text: 'Hi', language_code: 'en', language_name: 'English', confidence: '0.99', timestamp: '2026-10-07 08:30:00', platform: 'telegram', secondary_language: null, secondary_confidence: null }] });

    const [post] = await languageDetectionDb.getSamplePosts();

    expect(post.secondary_language).toBeNull();
    expect(post.secondary_confidence).toBeNull();
  });

  it('passes the platform, language, confidence and limit filters to the API', async () => {
    mockFetch({ 'language-posts': [] });

    await languageDetectionDb.getSamplePosts({ platform: 'youtube', language: 'es', confidenceThreshold: 0.8, limit: 25 } as any);

    const url = String((fetch as any).mock.calls[0][0]);
    expect(url).toContain('platform=youtube');
    expect(url).toContain('language=es');
    expect(url).toContain('minConfidence=0.8');
    expect(url).toContain('limit=25');
  });
});

describe('getLanguageMixing', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'language-mixing': [] });

    expect(await languageDetectionDb.getLanguageMixing()).toEqual([]);
  });

  it('maps real language pairs with their share of all mixed posts', async () => {
    mockFetch({
      'language-mixing': [
        { primary_language: 'English', secondary_language: 'Spanish', occurrence_count: '30' },
        { primary_language: 'English', secondary_language: 'French', occurrence_count: '10' }
      ]
    });

    const mixing = await languageDetectionDb.getLanguageMixing();

    expect(mixing).toEqual([
      { primary_language: 'English', secondary_language: 'Spanish', occurrence_count: 30, percentage: 75 },
      { primary_language: 'English', secondary_language: 'French', occurrence_count: 10, percentage: 25 }
    ]);
  });
});

describe('getGeographicDistribution', () => {
  it('returns nothing because posts carry no location data', async () => {
    mockFetch({ 'platform-performance': [{ platform: 'twitter', total_posts: 100 }] });

    expect(await languageDetectionDb.getGeographicDistribution()).toEqual([]);
  });
});

describe('getLanguageDetectionStats', () => {
  it('returns defaults when no data', async () => {
    mockFetch({ 'language-stats': [] });

    const stats = await languageDetectionDb.getLanguageDetectionStats();

    expect(stats.totalPosts).toBe(0);
    expect(stats.totalLanguages).toBe(0);
    expect(stats.confidenceDistribution).toEqual({ veryHigh: 0, high: 0, medium: 0, low: 0 });
  });

  it('aggregates real totals, the top language and the confidence distribution', async () => {
    mockFetch({
      'language-stats': [
        { language_code: 'en', language: 'English', post_count: '300', confidence: '0.9', very_high_count: '200', high_count: '60', medium_count: '30', low_count: '10', confidence_stddev: '0.05' },
        { language_code: 'es', language: 'Spanish', post_count: '100', confidence: '0.8', very_high_count: '40', high_count: '30', medium_count: '20', low_count: '10', confidence_stddev: '0.06' }
      ]
    });

    const stats = await languageDetectionDb.getLanguageDetectionStats();

    expect(stats.totalPosts).toBe(400);
    expect(stats.totalLanguages).toBe(2);
    expect(stats.avgConfidence).toBe(0.88);
    expect(stats.topLanguage).toEqual({ name: 'English' });
    expect(stats.confidenceDistribution).toEqual({ veryHigh: 240, high: 90, medium: 50, low: 20 });
  });
});

describe('exportLanguageData', () => {
  it('combines results from all queries', async () => {
    mockFetch({
      'language-stats': [{ language_code: 'en', language: 'English', post_count: '100', confidence: '0.9', very_high_count: '60', high_count: '30', medium_count: '5', low_count: '5', confidence_stddev: '0.04' }],
      'language-posts': [{ id: 1, text: 'Hello', language_code: 'en', language_name: 'English', confidence: '0.9', timestamp: '2026-10-07 08:30:00', platform: 'telegram', secondary_language: null, secondary_confidence: null }]
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
