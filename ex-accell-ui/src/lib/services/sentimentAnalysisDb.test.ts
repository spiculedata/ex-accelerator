import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sentimentAnalysisDb } from './sentimentAnalysisDb';

import { CHART } from '$lib/utils/chartColors';
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
  // Reset initialized flag so each test starts fresh
  (sentimentAnalysisDb as any).initialized = true;
});

// ─── getSentimentStats ──────────────────────────────────────────────────────

describe('getSentimentStats', () => {
  it('returns defaults when no data', async () => {
    mockFetch({ 'cross-platform-sentiment': [] });

    const stats = await sentimentAnalysisDb.getSentimentStats();

    expect(stats.total).toBe(0);
    expect(stats.positive.count).toBe(0);
    expect(stats.negative.count).toBe(0);
    expect(stats.neutral.count).toBe(0);
    expect(stats.avgConfidence).toBe(0);
  });

  it('returns defaults when API returns null', async () => {
    mockFetch({ 'cross-platform-sentiment': null });
    const stats = await sentimentAnalysisDb.getSentimentStats();
    expect(stats.total).toBe(0);
  });

  it('aggregates from cross-platform-sentiment data', async () => {
    const data = [
      { sentiment_category: 'Very Positive', post_count: 60, avg_confidence: 0.95 },
      { sentiment_category: 'Positive', post_count: 40, avg_confidence: 0.85 },
      { sentiment_category: 'Negative', post_count: 30, avg_confidence: 0.8 },
      { sentiment_category: 'Neutral', post_count: 70, avg_confidence: 0.7 }
    ];
    mockFetch({ 'cross-platform-sentiment': data });

    const stats = await sentimentAnalysisDb.getSentimentStats();

    expect(stats.total).toBe(200);
    expect(stats.positive.count).toBe(100); // 60+40 (both contain "positive")
    expect(stats.negative.count).toBe(30);
    expect(stats.neutral.count).toBe(70);

    // Percentages
    expect(stats.positive.percentage).toBe(50);
    expect(stats.negative.percentage).toBe(15);
    expect(stats.neutral.percentage).toBe(35);

    // Average confidence across all rows
    expect(stats.avgConfidence).toBeGreaterThan(0);
  });

  it('passes workspaceId and extraParams to the API', async () => {
    mockFetch({ 'cross-platform-sentiment': [] });
    await sentimentAnalysisDb.getSentimentStats('ws-42', { dataset_id: 'd1' });

    const callUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const parsed = new URL(callUrl, 'http://localhost');
    expect(parsed.searchParams.get('workspace_id')).toBe('ws-42');
    expect(parsed.searchParams.get('dataset_id')).toBe('d1');
  });
});

// ─── getDetailedSentiments ──────────────────────────────────────────────────

describe('getDetailedSentiments', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'cross-platform-sentiment': [] });
    const result = await sentimentAnalysisDb.getDetailedSentiments();
    expect(result).toEqual([]);
  });

  it('transforms to SentimentCategory array with colors', async () => {
    const data = [
      { sentiment_category: 'Positive', post_count: 80 },
      { sentiment_category: 'Negative', post_count: 20 }
    ];
    mockFetch({ 'cross-platform-sentiment': data });

    const categories = await sentimentAnalysisDb.getDetailedSentiments();

    expect(categories).toHaveLength(2);

    const positive = categories.find((c) => c.label === 'Positive');
    expect(positive).toBeDefined();
    expect(positive!.count).toBe(80);
    expect(positive!.color).toBe('#56b4e9');
    expect(positive!.percentage).toBe(80);

    const negative = categories.find((c) => c.label === 'Negative');
    expect(negative!.color).toBe('#e69f00');
  });

  it('assigns correct colors for all known categories', async () => {
    const data = [
      { sentiment_category: 'Very Positive', post_count: 10 },
      { sentiment_category: 'Positive', post_count: 10 },
      { sentiment_category: 'Neutral', post_count: 10 },
      { sentiment_category: 'Negative', post_count: 10 },
      { sentiment_category: 'Very Negative', post_count: 10 }
    ];
    mockFetch({ 'cross-platform-sentiment': data });

    const categories = await sentimentAnalysisDb.getDetailedSentiments();

    const colorMap: Record<string, string> = {
      'Very Positive': '#0072b2',
      Positive: '#56b4e9',
      Neutral: '#98a2ae',
      Negative: '#e69f00',
      'Very Negative': '#d55e00'
    };

    categories.forEach((cat) => {
      expect(cat.color).toBe(colorMap[cat.label]);
    });
  });
});

// ─── getEmotionStats ────────────────────────────────────────────────────────

describe('getEmotionStats', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'emotion-stats': [] });
    const result = await sentimentAnalysisDb.getEmotionStats();
    expect(result).toEqual([]);
  });

  it('transforms to EmotionStat array with colors', async () => {
    const data = [
      { emotion: 'Joy', count: 50, percentage: 25 },
      { emotion: 'Anger', count: 30, percentage: 15 },
      { emotion: 'Trust', count: 20, percentage: 10 }
    ];
    mockFetch({ 'emotion-stats': data });

    const emotions = await sentimentAnalysisDb.getEmotionStats();

    expect(emotions).toHaveLength(3);
    expect(emotions[0].emotion).toBe('Joy');
    expect(emotions[0].count).toBe(50);
    expect(emotions[0].color).toBe(CHART.catOrange);

    expect(emotions[1].emotion).toBe('Anger');
    expect(emotions[1].color).toBe(CHART.danger500);

    expect(emotions[2].emotion).toBe('Trust');
    expect(emotions[2].color).toBe(CHART.catBlue);
  });

  it('uses emotion1 field if emotion field is absent', async () => {
    const data = [{ emotion1: 'Fear', co_occurrence_count: 15, percentage: 5 }];
    mockFetch({ 'emotion-stats': data });

    const emotions = await sentimentAnalysisDb.getEmotionStats();
    expect(emotions[0].emotion).toBe('Fear');
    expect(emotions[0].count).toBe(15);
    expect(emotions[0].color).toBe(CHART.catPink);
  });
});

// ─── getSentimentTrends ─────────────────────────────────────────────────────

describe('getSentimentTrends', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'sentiment-trends': [] });
    const result = await sentimentAnalysisDb.getSentimentTrends();
    expect(result).toEqual([]);
  });

  it.each([
    ['oldest first, as the API returns it', ['2024-01-01', '2024-01-02', '2024-01-03']],
    ['newest first', ['2024-01-03', '2024-01-02', '2024-01-01']],
    ['shuffled', ['2024-01-02', '2024-01-03', '2024-01-01']]
  ])('always returns days oldest to newest, whatever the order it receives (%s)', async (_label, dates) => {
    mockFetch({ 'sentiment-trends': dates.map((date) => ({ date, positive: 1, negative: 1, neutral: 1 })) });

    const trends = await sentimentAnalysisDb.getSentimentTrends();

    expect(trends.map((t) => t.date)).toEqual(['2024-01-01', '2024-01-02', '2024-01-03']);
  });

  it('calculates total from positive+negative+neutral', async () => {
    const data = [{ date: '2024-01-01', positive: 10, negative: 5, neutral: 15 }];
    mockFetch({ 'sentiment-trends': data });

    const trends = await sentimentAnalysisDb.getSentimentTrends();
    expect(trends[0].total).toBe(30);
  });

  it('passes timeRange parameter to the API', async () => {
    mockFetch({ 'sentiment-trends': [] });
    await sentimentAnalysisDb.getSentimentTrends('30d');

    const callUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const parsed = new URL(callUrl, 'http://localhost');
    expect(parsed.searchParams.get('timeRange')).toBe('30d');
  });

  it('uses default timeRange of 30d', async () => {
    mockFetch({ 'sentiment-trends': [] });
    await sentimentAnalysisDb.getSentimentTrends();

    const callUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const parsed = new URL(callUrl, 'http://localhost');
    expect(parsed.searchParams.get('timeRange')).toBe('30d');
  });
});

// ─── getSamplePosts ─────────────────────────────────────────────────────────

describe('getSamplePosts', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'sample-posts': [] });
    const result = await sentimentAnalysisDb.getSamplePosts();
    expect(result).toEqual([]);
  });

  it('transforms post data with engagement object', async () => {
    const posts = [
      {
        id: '1',
        text: 'Great product!',
        sentiment: 'positive',
        confidence: 0.92,
        emotions: 'joy,trust',
        platform: 'twitter',
        timestamp: '2024-01-15T10:00:00Z',
        engagement_likes: 42,
        engagement_shares: 7,
        engagement_comments: 3,
        author: 'user123'
      }
    ];
    mockFetch({ 'sample-posts': posts });

    const result = await sentimentAnalysisDb.getSamplePosts();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
    expect(result[0].text).toBe('Great product!');
    expect(result[0].sentiment).toBe('positive');
    expect(result[0].confidence).toBe(0.92);
    expect(result[0].emotions).toEqual(['joy', 'trust']);
    expect(result[0].platform).toBe('twitter');
    expect(result[0].engagement).toEqual({ likes: 42, shares: 7, comments: 3 });
    expect(result[0].author).toBe('user123');
  });

  it('reads epoch-millisecond timestamps, as the posts view stores them, instead of replacing them with now', async () => {
    mockFetch({ 'sample-posts': [{ id: '9', text: 'x', sentiment: 'neutral', confidence: 0.5, platform: 'fb', timestamp: '1762530618733' }] });
    const result = await sentimentAnalysisDb.getSamplePosts();
    expect(result[0].timestamp).toBe('2025-11-07T15:50:18.733Z');
  });

  it('leaves a missing timestamp empty rather than inventing one', async () => {
    const posts = [
      { id: '2', text: 'No timestamp', sentiment: 'neutral', confidence: 0.5, platform: 'reddit' }
    ];
    mockFetch({ 'sample-posts': posts });

    const result = await sentimentAnalysisDb.getSamplePosts();
    expect(result[0].timestamp).toBe('');
  });

  it('leaves an unreadable timestamp empty rather than showing today', async () => {
    const posts = [
      { id: '3', text: 'Bad ts', sentiment: 'neutral', confidence: 0.5, platform: 'fb', timestamp: 'not-a-date' }
    ];
    mockFetch({ 'sample-posts': posts });

    const result = await sentimentAnalysisDb.getSamplePosts();
    expect(result[0].timestamp).toBe('');
  });

  it('defaults engagement to zeros when missing', async () => {
    const posts = [
      { id: '4', text: 'Minimal', sentiment: 'neutral', confidence: 0.5, platform: 'twitter', timestamp: '2024-01-01T00:00:00Z' }
    ];
    mockFetch({ 'sample-posts': posts });

    const result = await sentimentAnalysisDb.getSamplePosts();
    expect(result[0].engagement).toEqual({ likes: 0, shares: 0, comments: 0 });
  });

  it('splits emotions string by comma', async () => {
    const posts = [
      { id: '5', text: 'Mixed', sentiment: 'positive', confidence: 0.7, emotions: 'joy,surprise,trust', platform: 'fb', timestamp: '2024-01-01T00:00:00Z' }
    ];
    mockFetch({ 'sample-posts': posts });

    const result = await sentimentAnalysisDb.getSamplePosts();
    expect(result[0].emotions).toEqual(['joy', 'surprise', 'trust']);
  });

  it('returns empty emotions array when emotions is null', async () => {
    const posts = [
      { id: '6', text: 'None', sentiment: 'neutral', confidence: 0.5, emotions: null, platform: 'ig', timestamp: '2024-01-01T00:00:00Z' }
    ];
    mockFetch({ 'sample-posts': posts });

    const result = await sentimentAnalysisDb.getSamplePosts();
    expect(result[0].emotions).toEqual([]);
  });

  it('passes filter options to the API', async () => {
    mockFetch({ 'sample-posts': [] });
    await sentimentAnalysisDb.getSamplePosts({ sentiment: 'positive', platform: 'twitter', limit: 25 });

    const callUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const parsed = new URL(callUrl, 'http://localhost');
    expect(parsed.searchParams.get('sentiment')).toBe('positive');
    expect(parsed.searchParams.get('platform')).toBe('twitter');
    expect(parsed.searchParams.get('limit')).toBe('25');
  });
});

// ─── getTopSentimentKeywords ────────────────────────────────────────────────

describe('getTopSentimentKeywords', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'sentiment-keywords': [] });
    const result = await sentimentAnalysisDb.getTopSentimentKeywords();
    expect(result).toEqual([]);
  });

  it('normalizes impact score from 0-10 to 0-1', async () => {
    const data = [
      { keyword: 'love', sentiment_type: 'positive', frequency: 100, impact_score: 8 },
      { keyword: 'hate', sentiment_type: 'negative', frequency: 50, impact_score: 5 }
    ];
    mockFetch({ 'sentiment-keywords': data });

    const keywords = await sentimentAnalysisDb.getTopSentimentKeywords();

    expect(keywords).toHaveLength(2);
    expect(keywords[0].keyword).toBe('love');
    expect(keywords[0].impact).toBe(0.8); // 8/10
    expect(keywords[0].frequency).toBe(100);
    expect(keywords[0].sentiment).toBe('positive');

    expect(keywords[1].impact).toBe(0.5); // 5/10
  });

  it('handles missing impact_score as 0', async () => {
    const data = [{ keyword: 'test', sentiment_type: 'neutral', frequency: 10 }];
    mockFetch({ 'sentiment-keywords': data });

    const keywords = await sentimentAnalysisDb.getTopSentimentKeywords();
    expect(keywords[0].impact).toBe(0);
  });

  it('passes sentiment filter to API', async () => {
    mockFetch({ 'sentiment-keywords': [] });
    await sentimentAnalysisDb.getTopSentimentKeywords('positive', 'ws-1');

    const callUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const parsed = new URL(callUrl, 'http://localhost');
    expect(parsed.searchParams.get('keywordSentiment')).toBe('positive');
    expect(parsed.searchParams.get('workspace_id')).toBe('ws-1');
  });
});

// ─── exportSentimentData ────────────────────────────────────────────────────

describe('exportSentimentData', () => {
  it('executes parallel queries and combines results', async () => {
    const mockPosts = [
      {
        id: '1',
        text: 'Export test',
        sentiment: 'positive',
        confidence: 0.9,
        emotions: 'joy;trust',
        platform: 'twitter',
        timestamp: '2024-01-01T00:00:00Z',
        engagement_likes: 10,
        engagement_shares: 2,
        engagement_comments: 1
      }
    ];
    const mockSentiment = [
      { sentiment_category: 'Positive', post_count: 100, avg_confidence: 0.9 }
    ];
    const mockEmotions = [
      { emotion: 'Joy', count: 50, percentage: 25 }
    ];
    const mockTrends = [
      { date: '2024-01-01', positive: 10, negative: 5, neutral: 15 }
    ];

    mockFetch({
      'export-data': mockPosts,
      'cross-platform-sentiment': mockSentiment,
      'emotion-correlations': mockEmotions,
      'sentiment-trends': mockTrends
    });

    const result = await sentimentAnalysisDb.exportSentimentData(
      { sentiment: 'positive', platform: 'twitter', timeRange: '30d' }
    );

    // Check structure
    expect(result.exportDate).toBeTruthy();
    expect(result.filters).toEqual({ sentiment: 'positive', platform: 'twitter', timeRange: '30d' });

    // Posts data
    expect(result.data).toHaveLength(1);
    expect(result.data[0].text).toBe('Export test');
    // Export uses semicolon split for emotions
    expect(result.data[0].emotions).toEqual(['joy', 'trust']);
    expect(result.data[0].engagement).toEqual({ likes: 10, shares: 2, comments: 1 });

    // Summary
    expect(result.summary.sentimentStats.positive.count).toBe(100);
    expect(result.summary.emotionStats).toHaveLength(1);
    expect(result.summary.trends).toHaveLength(1);
  });

  it('handles empty results from all queries', async () => {
    mockFetch({});

    const result = await sentimentAnalysisDb.exportSentimentData();

    expect(result.data).toEqual([]);
    expect(result.summary.sentimentStats.total).toBe(0);
    expect(result.summary.emotionStats).toEqual([]);
    expect(result.summary.trends).toEqual([]);
  });

  it('uses default filter values', async () => {
    mockFetch({});

    const result = await sentimentAnalysisDb.exportSentimentData();
    expect(result.filters).toEqual({});
  });
});
