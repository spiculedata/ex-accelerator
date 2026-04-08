import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hashtagAnalysisDb } from './hashtagAnalysisDb';

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
  (hashtagAnalysisDb as any).initialized = true;
});

// ─── getHashtagStats ───────────────────────────────────────────────────────

describe('getHashtagStats', () => {
  it('returns default stats when no data', async () => {
    mockFetch({ 'cross-platform-sentiment': [] });
    const stats = await hashtagAnalysisDb.getHashtagStats();

    expect(stats.totalHashtags).toBe(0);
    expect(stats.trendingHashtags).toBe(0);
    expect(stats.totalReach).toBe(0);
    expect(stats.averageEngagement).toBe(0);
  });

  it('returns default stats when API returns null', async () => {
    mockFetch({ 'cross-platform-sentiment': null });
    const stats = await hashtagAnalysisDb.getHashtagStats();
    expect(stats.totalHashtags).toBe(0);
  });

  it('calculates stats from cross-platform data', async () => {
    const data = [
      { post_count: 200, avg_confidence: 0.9 },
      { post_count: 100, avg_confidence: 0.7 }
    ];
    mockFetch({ 'cross-platform-sentiment': data });

    const stats = await hashtagAnalysisDb.getHashtagStats();

    expect(stats.totalHashtags).toBe(Math.floor(300 * 0.3)); // 90
    expect(stats.trendingHashtags).toBe(4); // 2 * 2
    expect(stats.totalReach).toBe(Math.floor(300 * 12)); // 3600
    // averageEngagement = round(avg_confidence_avg * 4 * 100) / 100
    expect(stats.averageEngagement).toBe(Math.round(0.8 * 4 * 100) / 100);
  });
});

// ─── getTrendingHashtags ───────────────────────────────────────────────────

describe('getTrendingHashtags', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'platform-performance': [] });
    const trending = await hashtagAnalysisDb.getTrendingHashtags();
    expect(trending).toEqual([]);
  });

  it('generates trending hashtags from platform data', async () => {
    const data = [
      { platform: 'twitter', total_posts: 1000, positive_ratio: 0.7 },
      { platform: 'instagram', total_posts: 800, positive_ratio: 0.5 }
    ];
    mockFetch({ 'platform-performance': data });

    const trending = await hashtagAnalysisDb.getTrendingHashtags();

    expect(trending.length).toBeGreaterThan(0);
    expect(trending[0].hashtag).toBe('#AI');
    expect(trending[0].count).toBeGreaterThan(0);
    expect(trending[0].reach).toBe(trending[0].count * 15);
    expect(['positive', 'neutral', 'negative']).toContain(trending[0].sentiment);
    expect(['rising', 'stable', 'declining']).toContain(trending[0].trend);
    expect(trending[0].platforms).toBeInstanceOf(Array);
  });

  it('respects limit filter', async () => {
    const data = [
      { platform: 'twitter', total_posts: 1000, positive_ratio: 0.7 }
    ];
    mockFetch({ 'platform-performance': data });

    const trending = await hashtagAnalysisDb.getTrendingHashtags({ limit: 5 });
    expect(trending).toHaveLength(5);
  });

  it('defaults to 20 items when no limit specified', async () => {
    const data = [
      { platform: 'twitter', total_posts: 1000, positive_ratio: 0.7 }
    ];
    mockFetch({ 'platform-performance': data });

    const trending = await hashtagAnalysisDb.getTrendingHashtags();
    expect(trending).toHaveLength(20);
  });
});

// ─── getHashtagTrends ──────────────────────────────────────────────────────

describe('getHashtagTrends', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'sentiment-trends': [] });
    const trends = await hashtagAnalysisDb.getHashtagTrends();
    expect(trends).toEqual([]);
  });

  it('transforms sentiment data into hashtag trends', async () => {
    const data = [
      { date: '2024-01-01', positive: 40, negative: 20, neutral: 40 }
    ];
    mockFetch({ 'sentiment-trends': data });

    const trends = await hashtagAnalysisDb.getHashtagTrends();

    expect(trends).toHaveLength(1);
    expect(trends[0].date).toBe('2024-01-01');
    // totalSentiment = 100
    expect(trends[0].aiCount).toBe(40); // 100 * 0.4
    expect(trends[0].climateCount).toBe(25); // 100 * 0.25
    expect(trends[0].techCount).toBe(35); // 100 * 0.35
    expect(trends[0].totalHashtags).toBe(80); // 100 * 0.8
  });

  it('passes timeRange param to the API', async () => {
    mockFetch({ 'sentiment-trends': [] });
    await hashtagAnalysisDb.getHashtagTrends('30d');

    const callUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const parsed = new URL(callUrl, 'http://localhost');
    expect(parsed.searchParams.get('timeRange')).toBe('30d');
  });
});

// ─── getSamplePosts ────────────────────────────────────────────────────────

describe('getSamplePosts', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'sample-posts': [] });
    const posts = await hashtagAnalysisDb.getSamplePosts();
    expect(posts).toEqual([]);
  });

  it('transforms posts with hashtags and engagement', async () => {
    const data = [
      { id: '1', text: 'Great post', platform: 'twitter', confidence: 0.8, timestamp: '2024-01-01T00:00:00Z' }
    ];
    mockFetch({ 'sample-posts': data });

    const posts = await hashtagAnalysisDb.getSamplePosts();

    expect(posts).toHaveLength(1);
    expect(posts[0].id).toBe('1');
    expect(posts[0].text).toBe('Great post');
    expect(posts[0].platform).toBe('twitter');
    expect(posts[0].hashtags).toEqual(['#AI', '#MachineLearning']); // index 0 set
    expect(posts[0].engagement.likes).toBe(Math.floor(0.8 * 80));
    expect(posts[0].engagement.shares).toBe(Math.floor(0.8 * 20));
    expect(posts[0].engagement.comments).toBe(Math.floor(0.8 * 12));
    expect(posts[0].reach).toBe(Math.floor(0.8 * 400));
  });

  it('passes platform and limit filters', async () => {
    mockFetch({ 'sample-posts': [] });
    await hashtagAnalysisDb.getSamplePosts({ platform: 'instagram', limit: 20 });

    const callUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const parsed = new URL(callUrl, 'http://localhost');
    expect(parsed.searchParams.get('platform')).toBe('instagram');
    expect(parsed.searchParams.get('limit')).toBe('20');
  });
});

// ─── getPlatformPerformance ────────────────────────────────────────────────

describe('getPlatformPerformance', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'platform-performance': [] });
    const perf = await hashtagAnalysisDb.getPlatformPerformance();
    expect(perf).toEqual([]);
  });

  it('transforms platform data with capitalized names', async () => {
    const data = [
      { platform: 'twitter', total_posts: 500, positive_ratio: 0.6 },
      { platform: 'instagram', total_posts: 300, positive_ratio: 0.8 }
    ];
    mockFetch({ 'platform-performance': data });

    const perf = await hashtagAnalysisDb.getPlatformPerformance();

    expect(perf).toHaveLength(2);
    expect(perf[0].platform).toBe('Twitter');
    expect(perf[0].postCount).toBe(500);
    expect(perf[0].hashtagCount).toBe(Math.floor(500 * 0.3));
    expect(perf[0].totalReach).toBe(Math.floor(500 * 12));
    expect(perf[0].avgEngagementRate).toBe(Math.round(0.6 * 8 * 100) / 100);

    expect(perf[1].platform).toBe('Instagram');
  });
});

// ─── getHashtagRelationships ───────────────────────────────────────────────

describe('getHashtagRelationships', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'emotion-correlations': [] });
    const rels = await hashtagAnalysisDb.getHashtagRelationships();
    expect(rels).toEqual([]);
  });

  it('generates hashtag relationships from emotion correlations', async () => {
    const data = [
      { correlation: 0.8 },
      { correlation: 0.6 }
    ];
    mockFetch({ 'emotion-correlations': data });

    const rels = await hashtagAnalysisDb.getHashtagRelationships();

    expect(rels).toHaveLength(2);
    expect(rels[0].hashtag1).toBe('#AI');
    expect(rels[0].hashtag2).toBe('#Technology');
    expect(rels[0].correlationStrength).toBe(0.8);
    expect(rels[0].coOccurrenceCount).toBeGreaterThan(0);

    expect(rels[1].hashtag1).toBe('#Technology');
    expect(rels[1].hashtag2).toBe('#Innovation');
  });
});

// ─── exportHashtagData ─────────────────────────────────────────────────────

describe('exportHashtagData', () => {
  it('combines results from all queries', async () => {
    const crossPlatform = [{ post_count: 100, avg_confidence: 0.8 }];
    const platformPerf = [{ platform: 'twitter', total_posts: 100, positive_ratio: 0.6 }];
    const samplePosts = [{ id: '1', text: 'Test', platform: 'twitter', confidence: 0.8, timestamp: '2024-01-01T00:00:00Z' }];

    mockFetch({
      'cross-platform-sentiment': crossPlatform,
      'platform-performance': platformPerf,
      'sample-posts': samplePosts,
      'emotion-correlations': []
    });

    const result = await hashtagAnalysisDb.exportHashtagData();

    expect(result.exportDate).toBeTruthy();
    expect(result.data).toHaveLength(1);
    expect(result.data[0].hashtag).toBe('#AI');
    expect(result.summary.stats.totalHashtags).toBeGreaterThan(0);
    expect(result.summary.platformPerformance).toHaveLength(1);
  });

  it('handles empty results gracefully', async () => {
    mockFetch({});
    const result = await hashtagAnalysisDb.exportHashtagData();

    expect(result.data).toEqual([]);
    expect(result.summary.stats.totalHashtags).toBe(0);
  });
});
