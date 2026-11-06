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
  it('returns zeroed stats when there is no data', async () => {
    mockFetch({ 'engagement-stats': [] });

    const stats = await engagementAnalysisDb.getEngagementStats();

    expect(stats).toMatchObject({ totalEngagements: 0, averageRate: 0, totalReach: 0, totalPosts: 0 });
  });

  it('maps the aggregate row, converting numeric strings from the database', async () => {
    mockFetch({
      'engagement-stats': [{
        total_posts: '1500', total_engagements: '594154', average_rate: '7.6293133', total_reach: '7810585',
        total_impressions: '10962494', best_post_engagements: '4210', avg_likes: '280.4', avg_comments: '60.2', avg_shares: '39.9'
      }]
    });

    const stats = await engagementAnalysisDb.getEngagementStats();

    expect(stats).toEqual({
      totalPosts: 1500, totalEngagements: 594154, averageRate: 7.63, totalReach: 7810585,
      totalImpressions: 10962494, bestPerformingPost: 4210, avgLikes: 280, avgComments: 60, avgShares: 40
    });
  });

  it('passes the workspace through to the API', async () => {
    mockFetch({ 'engagement-stats': [] });

    await engagementAnalysisDb.getEngagementStats('7');

    const url = String((fetch as any).mock.calls[0][0]);
    expect(url).toContain('workspace_id=7');
  });
});

// ─── getPlatformEngagement ─────────────────────────────────────────────────

describe('getPlatformEngagement', () => {
  it('returns an empty list when there is no data', async () => {
    mockFetch({ 'engagement-platforms': [] });

    expect(await engagementAnalysisDb.getPlatformEngagement()).toEqual([]);
  });

  it('maps platforms with a capitalised name, real engagement rate and a colour', async () => {
    mockFetch({
      'engagement-platforms': [{
        platform: 'youtube', posts: '295', total_engagements: '283979', engagement_rate: '7.7532881',
        total_reach: '3594530', avg_likes: '500.2', avg_comments: '90.7', avg_shares: '60.1'
      }]
    });

    const [platform] = await engagementAnalysisDb.getPlatformEngagement();

    expect(platform).toMatchObject({
      platform: 'Youtube', posts: 295, totalEngagements: 283979, engagementRate: 7.75,
      totalReach: 3594530, avgLikes: 500, avgComments: 91, avgShares: 60
    });
    expect(platform.color).toMatch(/^#/);
  });

  it('gives unknown platforms a neutral colour', async () => {
    mockFetch({ 'engagement-platforms': [{ platform: 'myspace', posts: '1', total_engagements: '1', engagement_rate: '1', total_reach: '1', avg_likes: '0', avg_comments: '0', avg_shares: '0' }] });

    const [platform] = await engagementAnalysisDb.getPlatformEngagement();

    expect(platform.color).toBe('#6b7280');
  });
});

// ─── getContentTypePerformance ─────────────────────────────────────────────

describe('getContentTypePerformance', () => {
  it('returns real content types from the data, not a fixed list', async () => {
    mockFetch({
      'engagement-content-types': [
        { content_type: 'Video', posts: '354', engagement_rate: '7.82', reach: '3625571', avg_likes: '568.5', avg_comments: '90', avg_shares: '55', positive_share: '0.7' },
        { content_type: 'Link', posts: '200', engagement_rate: '6.1', reach: '900000', avg_likes: '100', avg_comments: '10', avg_shares: '5', positive_share: '0.2' }
      ]
    });

    const types = await engagementAnalysisDb.getContentTypePerformance();

    expect(types.map((t) => t.type)).toEqual(['Video', 'Link']);
    expect(types[0]).toMatchObject({ posts: 354, engagementRate: 7.82, reach: 3625571, avgLikes: 569 });
  });

  it('derives the sentiment label from the share of positive posts', async () => {
    mockFetch({
      'engagement-content-types': [
        { content_type: 'A', posts: '1', engagement_rate: '1', reach: '1', avg_likes: '0', avg_comments: '0', avg_shares: '0', positive_share: '0.8' },
        { content_type: 'B', posts: '1', engagement_rate: '1', reach: '1', avg_likes: '0', avg_comments: '0', avg_shares: '0', positive_share: '0.4' },
        { content_type: 'C', posts: '1', engagement_rate: '1', reach: '1', avg_likes: '0', avg_comments: '0', avg_shares: '0', positive_share: '0.1' }
      ]
    });

    const types = await engagementAnalysisDb.getContentTypePerformance();

    expect(types.map((t) => t.sentiment)).toEqual(['positive', 'mixed', 'negative']);
  });
});

// ─── getEngagementTrends ───────────────────────────────────────────────────

describe('getEngagementTrends', () => {
  it('returns an empty list when there is no data', async () => {
    mockFetch({ 'engagement-trends': [] });

    expect(await engagementAnalysisDb.getEngagementTrends('7d')).toEqual([]);
  });

  it('maps daily totals and passes the time range', async () => {
    mockFetch({
      'engagement-trends': [{ date: '2026-10-07', likes: '5148', comments: '1104', shares: '736', saves: '366', views: '143648', reach: '104918', engagement_rate: '7.4' }]
    });

    const [day] = await engagementAnalysisDb.getEngagementTrends('30d');

    expect(day).toEqual({ date: '2026-10-07', likes: 5148, comments: 1104, shares: 736, saves: 366, views: 143648, reach: 104918, engagementRate: 7.4 });
    expect(String((fetch as any).mock.calls[0][0])).toContain('timeRange=30d');
  });
});

// ─── getTopPerformingPosts ─────────────────────────────────────────────────

describe('getTopPerformingPosts', () => {
  it('returns an empty list when there is no data', async () => {
    mockFetch({ 'engagement-top-posts': [] });

    expect(await engagementAnalysisDb.getTopPerformingPosts()).toEqual([]);
  });

  it('maps posts with their real engagement and ranks them in the order returned', async () => {
    mockFetch({
      'engagement-top-posts': [
        { id: 271, text: 'First', author: 'demo_user_0001', platform: 'youtube', content_type: 'Video', likes: '900', comments: '100', shares: '50', saves: '10', engagement_rate: '12.5', reach: '8000', views: '9000', timestamp: '2026-10-01T10:00:00.000Z' },
        { id: 12, text: 'Second', author: 'demo_user_0002', platform: 'bluesky', content_type: 'Text Only', likes: '40', comments: '4', shares: '2', saves: '1', engagement_rate: '3.1', reach: '900', views: '1000', timestamp: '2026-10-02T10:00:00.000Z' }
      ]
    });

    const posts = await engagementAnalysisDb.getTopPerformingPosts({}, 2);

    expect(posts.map((p) => p.id)).toEqual([271, 12]);
    expect(posts[0]).toMatchObject({
      contentType: 'Video', platform: 'youtube', reach: 8000, views: 9000, performance_rank: 1,
      engagement: { likes: 900, comments: 100, shares: 50, saves: 10, rate: 12.5 }
    });
    expect(posts[1].performance_rank).toBe(2);
    expect(String((fetch as any).mock.calls[0][0])).toContain('limit=2');
  });
});

// ─── getEngagementTiming ───────────────────────────────────────────────────

describe('getEngagementTiming', () => {
  it('returns an empty list when there is no data', async () => {
    mockFetch({ 'engagement-timing': [] });

    expect(await engagementAnalysisDb.getEngagementTiming()).toEqual([]);
  });

  it('maps the real day of week and hour', async () => {
    mockFetch({
      'engagement-timing': [{ hour_of_day: 9, day_of_week: 2, avg_engagement_rate: '7.5', total_posts: '12', total_engagements: '3400' }]
    });

    const [slot] = await engagementAnalysisDb.getEngagementTiming();

    expect(slot).toEqual({ hour_of_day: 9, day_of_week: 2, day_name: 'Tuesday', avg_engagement_rate: 7.5, total_posts: 12, total_engagements: 3400 });
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
    mockFetch({
      'engagement-stats': [{ total_posts: '100', total_engagements: '5000', average_rate: '5', total_reach: '9000', total_impressions: '12000', best_post_engagements: '300', avg_likes: '30', avg_comments: '5', avg_shares: '2' }],
      'engagement-platforms': [{ platform: 'youtube', posts: '100', total_engagements: '5000', engagement_rate: '5', total_reach: '9000', avg_likes: '30', avg_comments: '5', avg_shares: '2' }],
      'engagement-trends': [{ date: '2024-01-01', likes: '1', comments: '1', shares: '1', saves: '1', views: '1', reach: '1', engagement_rate: '1' }],
      'engagement-top-posts': [{ id: 1, text: 'Test', author: 'a', platform: 'youtube', content_type: 'Video', likes: '1', comments: '1', shares: '1', saves: '1', engagement_rate: '1', reach: '1', views: '1', timestamp: '2024-01-01T00:00:00Z' }],
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
