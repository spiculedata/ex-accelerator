import { describe, it, expect, vi, beforeEach } from 'vitest';
import { engagementAnalysisDb } from './engagementAnalysisDb';

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
  (engagementAnalysisDb as any).initialized = true;
});

// ─── getEngagementStats ────────────────────────────────────────────────────

describe('getEngagementStats', () => {
  it('returns default stats when no data', async () => {
    mockFetch({ 'cross-platform-sentiment': [] });
    const stats = await engagementAnalysisDb.getEngagementStats();

    expect(stats.totalEngagements).toBe(0);
    expect(stats.averageRate).toBe(0);
    expect(stats.totalReach).toBe(0);
    expect(stats.totalPosts).toBe(0);
    expect(stats.avgLikes).toBe(0);
    expect(stats.avgComments).toBe(0);
    expect(stats.avgShares).toBe(0);
  });

  it('returns default stats when API returns null', async () => {
    mockFetch({ 'cross-platform-sentiment': null });
    const stats = await engagementAnalysisDb.getEngagementStats();
    expect(stats.totalEngagements).toBe(0);
  });

  it('calculates stats from cross-platform data', async () => {
    const data = [
      { post_count: 100, avg_confidence: 0.9, total_engagements: 500, total_reach: 2000, avg_likes: 20, avg_comments: 5, avg_shares: 3 },
      { post_count: 200, avg_confidence: 0.8, total_engagements: 1000, total_reach: 4000, avg_likes: 30, avg_comments: 10, avg_shares: 7 }
    ];
    mockFetch({ 'cross-platform-sentiment': data });

    const stats = await engagementAnalysisDb.getEngagementStats();

    expect(stats.totalPosts).toBe(300);
    expect(stats.totalEngagements).toBe(1500);
    expect(stats.totalReach).toBe(6000);
    expect(stats.averageRate).toBe(0.85); // (0.9+0.8)/2 rounded
    expect(stats.avgLikes).toBe(25); // (20+30)/2
    expect(stats.avgComments).toBe(8); // Math.round((5+10)/2)
    expect(stats.bestPerformingPost).toBe(200);
  });

  it('passes workspaceId to the API', async () => {
    mockFetch({ 'cross-platform-sentiment': [] });
    await engagementAnalysisDb.getEngagementStats('ws-1');

    const callUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const parsed = new URL(callUrl, 'http://localhost');
    expect(parsed.searchParams.get('workspace_id')).toBe('ws-1');
  });
});

// ─── getPlatformEngagement ─────────────────────────────────────────────────

describe('getPlatformEngagement', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'platform-performance': [] });
    const platforms = await engagementAnalysisDb.getPlatformEngagement();
    expect(platforms).toEqual([]);
  });

  it('transforms platform data with colors', async () => {
    const data = [
      { platform: 'instagram', total_posts: 500, positive_ratio: 0.75, avg_likes: 50, avg_comments: 10, avg_shares: 5, total_reach: 8000 },
      { platform: 'twitter', total_posts: 300, positive_ratio: 0.6, avg_likes: 20, avg_comments: 5, avg_shares: 3 }
    ];
    mockFetch({ 'platform-performance': data });

    const platforms = await engagementAnalysisDb.getPlatformEngagement();

    expect(platforms).toHaveLength(2);
    expect(platforms[0].platform).toBe('Instagram');
    expect(platforms[0].engagementRate).toBe(0.75);
    expect(platforms[0].posts).toBe(500);
    expect(platforms[0].avgLikes).toBe(50);
    expect(platforms[0].color).toBe('#ff6b9d');

    expect(platforms[1].platform).toBe('Twitter');
    expect(platforms[1].color).toBe('#26d0ce');
  });

  it('uses gray for unknown platforms', async () => {
    const data = [{ platform: 'mastodon', total_posts: 10, positive_ratio: 0.5 }];
    mockFetch({ 'platform-performance': data });

    const platforms = await engagementAnalysisDb.getPlatformEngagement();
    expect(platforms[0].color).toBe('#6b7280');
  });
});

// ─── getContentTypePerformance ─────────────────────────────────────────────

describe('getContentTypePerformance', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'cross-platform-sentiment': [] });
    const content = await engagementAnalysisDb.getContentTypePerformance();
    expect(content).toEqual([]);
  });

  it('generates 5 content types from data', async () => {
    const data = [
      { post_count: 100, avg_confidence: 0.7, total_reach: 500, avg_likes: 10, avg_comments: 3, avg_shares: 2 }
    ];
    mockFetch({ 'cross-platform-sentiment': data });

    const content = await engagementAnalysisDb.getContentTypePerformance();

    expect(content).toHaveLength(5);
    expect(content[0].type).toBe('Text Post');
    expect(content[1].type).toBe('Image');
    expect(content[2].type).toBe('Video');
    expect(content[3].type).toBe('Story');
    expect(content[4].type).toBe('Reel');
  });

  it('assigns sentiment based on confidence threshold', async () => {
    const data = [
      { post_count: 10, avg_confidence: 0.8 },  // positive (>=0.65)
      { post_count: 10, avg_confidence: 0.5 },  // mixed (>=0.35)
      { post_count: 10, avg_confidence: 0.2 }   // neutral (<0.35)
    ];
    mockFetch({ 'cross-platform-sentiment': data });

    const content = await engagementAnalysisDb.getContentTypePerformance();

    expect(content[0].sentiment).toBe('positive');
    expect(content[1].sentiment).toBe('mixed');
    expect(content[2].sentiment).toBe('neutral');
  });
});

// ─── getEngagementTrends ───────────────────────────────────────────────────

describe('getEngagementTrends', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'sentiment-trends': [] });
    const trends = await engagementAnalysisDb.getEngagementTrends();
    expect(trends).toEqual([]);
  });

  it('transforms trend data with calculated fields', async () => {
    const data = [
      { date: '2024-01-01', positive: 30, negative: 10, neutral: 60, likes: 100, comments: 20, shares: 15, saves: 5, views: 500, reach: 1000 }
    ];
    mockFetch({ 'sentiment-trends': data });

    const trends = await engagementAnalysisDb.getEngagementTrends();

    expect(trends).toHaveLength(1);
    expect(trends[0].date).toBe('2024-01-01');
    expect(trends[0].likes).toBe(100);
    expect(trends[0].comments).toBe(20);
    expect(trends[0].shares).toBe(15);
    expect(trends[0].reach).toBe(1000);
  });

  it('calculates engagement rate from sentiment when not provided', async () => {
    const data = [
      { date: '2024-01-01', positive: 30, negative: 10, neutral: 60 }
    ];
    mockFetch({ 'sentiment-trends': data });

    const trends = await engagementAnalysisDb.getEngagementTrends();

    // engagementRate = positive / totalSentiment = 30/100 = 0.3
    expect(trends[0].engagementRate).toBe(0.3);
    expect(trends[0].reach).toBe(100); // falls back to totalSentiment
  });

  it('passes timeRange param to the API', async () => {
    mockFetch({ 'sentiment-trends': [] });
    await engagementAnalysisDb.getEngagementTrends('30d');

    const callUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const parsed = new URL(callUrl, 'http://localhost');
    expect(parsed.searchParams.get('timeRange')).toBe('30d');
  });
});

// ─── getTopPerformingPosts ─────────────────────────────────────────────────

describe('getTopPerformingPosts', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'sample-posts': [] });
    const posts = await engagementAnalysisDb.getTopPerformingPosts();
    expect(posts).toEqual([]);
  });

  it('transforms posts and assigns content types cyclically', async () => {
    const data = [
      { id: '1', text: 'Great post', platform: 'twitter', confidence: 0.9, timestamp: '2024-01-01T00:00:00Z' },
      { id: '2', text: 'Another one', platform: 'instagram', confidence: 0.7, timestamp: '2024-01-02T00:00:00Z' }
    ];
    mockFetch({ 'sample-posts': data });

    const posts = await engagementAnalysisDb.getTopPerformingPosts();

    expect(posts).toHaveLength(2);
    // Sorted by engagement rate descending: post 1 (0.9) before post 2 (0.7)
    expect(posts[0].id).toBe('1');
    expect(posts[0].contentType).toBe('Text Post'); // index 0 % 5
    expect(posts[0].engagement.rate).toBe(0.9);
    expect(posts[0].performance_rank).toBe(1);

    expect(posts[1].id).toBe('2');
    expect(posts[1].engagement.rate).toBe(0.7);
  });

  it('passes limit parameter', async () => {
    mockFetch({ 'sample-posts': [] });
    await engagementAnalysisDb.getTopPerformingPosts({}, 25);

    const callUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const parsed = new URL(callUrl, 'http://localhost');
    expect(parsed.searchParams.get('limit')).toBe('25');
  });
});

// ─── getEngagementTiming ───────────────────────────────────────────────────

describe('getEngagementTiming', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'hourly-patterns': [] });
    const timing = await engagementAnalysisDb.getEngagementTiming();
    expect(timing).toEqual([]);
  });

  it('transforms hourly patterns with day names', async () => {
    const data = [
      { hour_of_day: 0, positive: 10, negative: 5, neutral: 15 },
      { hour_of_day: 3, positive: 20, negative: 10, neutral: 30 }
    ];
    mockFetch({ 'hourly-patterns': data });

    const timing = await engagementAnalysisDb.getEngagementTiming();

    expect(timing).toHaveLength(2);
    expect(timing[0].hour_of_day).toBe(0);
    expect(timing[0].day_of_week).toBe(0); // 0 % 7
    expect(timing[0].day_name).toBe('Sunday');
    expect(timing[0].total_posts).toBe(30); // 10+5+15

    expect(timing[1].day_of_week).toBe(3); // 3 % 7
    expect(timing[1].day_name).toBe('Wednesday');
  });
});

// ─── getHashtagPerformance ─────────────────────────────────────────────────

describe('getHashtagPerformance', () => {
  it('returns empty array when no hashtag data', async () => {
    mockFetch({ 'hashtag-analysis': { hashtags: [] } });
    const hashtags = await engagementAnalysisDb.getHashtagPerformance();
    expect(hashtags).toEqual([]);
  });

  it('returns empty array when hashtags field is missing', async () => {
    mockFetch({ 'hashtag-analysis': {} });
    const hashtags = await engagementAnalysisDb.getHashtagPerformance();
    expect(hashtags).toEqual([]);
  });

  it('transforms hashtag data with # prefix and impact score', async () => {
    const data = {
      hashtags: [
        { hashtag: 'AI', count: '100', post_count: '50' },
        { hashtag: 'Tech', count: '200', post_count: '80' }
      ]
    };
    mockFetch({ 'hashtag-analysis': data });

    const hashtags = await engagementAnalysisDb.getHashtagPerformance();

    expect(hashtags).toHaveLength(2);
    expect(hashtags[0].hashtag).toBe('#AI');
    expect(hashtags[0].usage_count).toBe(100);
    expect(hashtags[0].avg_boost).toBe(1.0);
    expect(hashtags[0].avg_engagement_rate).toBe(2); // 100/50
    expect(hashtags[0].impact_score).toBeGreaterThan(0);
    expect(hashtags[0].impact_score).toBeLessThanOrEqual(10);
  });

  it('passes limit parameter', async () => {
    mockFetch({ 'hashtag-analysis': { hashtags: [] } });
    await engagementAnalysisDb.getHashtagPerformance(30);

    const callUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const parsed = new URL(callUrl, 'http://localhost');
    expect(parsed.searchParams.get('limit')).toBe('30');
  });
});

// ─── exportEngagementData ──────────────────────────────────────────────────

describe('exportEngagementData', () => {
  it('combines results from all queries', async () => {
    const crossPlatform = [{ post_count: 100, avg_confidence: 0.8 }];
    const platformPerf = [{ platform: 'twitter', total_posts: 100, positive_ratio: 0.6 }];
    const trends = [{ date: '2024-01-01', positive: 10, negative: 5, neutral: 15 }];
    const samplePosts = [{ id: '1', text: 'Test', platform: 'twitter', confidence: 0.9, timestamp: '2024-01-01T00:00:00Z' }];
    const hourly = [{ hour_of_day: 0, positive: 10, negative: 5, neutral: 15 }];

    mockFetch({
      'cross-platform-sentiment': crossPlatform,
      'platform-performance': platformPerf,
      'sentiment-trends': trends,
      'sample-posts': samplePosts,
      'hourly-patterns': hourly,
      'hashtag-analysis': { hashtags: [] }
    });

    const result = await engagementAnalysisDb.exportEngagementData();

    expect(result.exportDate).toBeTruthy();
    expect(result.data).toHaveLength(1);
    expect(result.summary.stats.totalPosts).toBe(100);
    expect(result.summary.platforms).toHaveLength(1);
    expect(result.summary.trends).toHaveLength(1);
  });

  it('handles empty results gracefully', async () => {
    mockFetch({});
    const result = await engagementAnalysisDb.exportEngagementData();

    expect(result.data).toEqual([]);
    expect(result.summary.stats.totalEngagements).toBe(0);
  });
});
