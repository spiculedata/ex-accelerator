import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dashboardDb } from './dashboardDb';

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
  // Reset the initialized flag so each test starts fresh
  (dashboardDb as any).initialized = true;
});

// ─── getDashboardStats ──────────────────────────────────────────────────────

describe('getDashboardStats', () => {
  it('returns default stats when no data', async () => {
    mockFetch({ 'cross-platform-sentiment': [] });
    const stats = await dashboardDb.getDashboardStats();

    expect(stats.total_posts).toBe(0);
    expect(stats.processing_rate).toBe(0);
    expect(stats.data_quality).toBe(0);
    expect(stats.total_sources).toBe(0);
    expect(stats.active_crawlers).toBe(0);
    expect(stats.last_updated).toBeTruthy();
  });

  it('returns default stats when API returns null-ish', async () => {
    mockFetch({ 'cross-platform-sentiment': null });
    const stats = await dashboardDb.getDashboardStats();
    expect(stats.total_posts).toBe(0);
  });

  it('calculates correct totals and rates from sentiment data', async () => {
    const sentimentData = [
      { sentiment_category: 'Positive', post_count: 100, avg_confidence: 0.9 },
      { sentiment_category: 'Negative', post_count: 50, avg_confidence: 0.85 },
      { sentiment_category: 'Neutral', post_count: 50, avg_confidence: 0.7 }
    ];
    mockFetch({ 'cross-platform-sentiment': sentimentData });

    const stats = await dashboardDb.getDashboardStats();

    expect(stats.total_posts).toBe(200);
    // processing_rate = round((200/24)*100)/100
    expect(stats.processing_rate).toBe(Math.round((200 / 24) * 100) / 100);
    // data_quality: all categories are non-unknown so 100%
    expect(stats.data_quality).toBe(100);
    expect(stats.total_sources).toBe(3);
    expect(stats.active_crawlers).toBe(3);
  });

  it('calculates data quality excluding unknown categories', async () => {
    const sentimentData = [
      { sentiment_category: 'Positive', post_count: 80, avg_confidence: 0.9 },
      { sentiment_category: 'Unknown', post_count: 20, avg_confidence: 0.5 }
    ];
    mockFetch({ 'cross-platform-sentiment': sentimentData });

    const stats = await dashboardDb.getDashboardStats();
    // classified = 80, total = 100 => 80%
    expect(stats.data_quality).toBe(80);
    expect(stats.total_posts).toBe(100);
  });

  it('caps active_crawlers at 8', async () => {
    const data = Array.from({ length: 12 }, (_, i) => ({
      sentiment_category: `Cat${i}`,
      post_count: 10,
      avg_confidence: 0.8
    }));
    mockFetch({ 'cross-platform-sentiment': data });

    const stats = await dashboardDb.getDashboardStats();
    expect(stats.active_crawlers).toBe(8);
  });

  it('passes workspaceId and extraParams', async () => {
    mockFetch({ 'cross-platform-sentiment': [] });
    await dashboardDb.getDashboardStats('ws-1', { foo: 'bar' });

    const callUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const parsed = new URL(callUrl, 'http://localhost');
    expect(parsed.searchParams.get('workspace_id')).toBe('ws-1');
    expect(parsed.searchParams.get('foo')).toBe('bar');
  });
});

// ─── getDataSources ─────────────────────────────────────────────────────────

describe('getDataSources', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'platform-performance': [] });
    const sources = await dashboardDb.getDataSources();
    expect(sources).toEqual([]);
  });

  it('transforms platform data correctly', async () => {
    const platformData = [
      { platform: 'twitter', total_posts: 300, avg_confidence: 0.9 },
      { platform: 'facebook', total_posts: 200, avg_confidence: 0.75 }
    ];
    mockFetch({ 'platform-performance': platformData });

    // Also mock the datasets fetch that getDataSources calls
    const originalFetch = fetch as ReturnType<typeof vi.fn>;
    const baseFn = originalFetch.getMockImplementation()!;
    originalFetch.mockImplementation(async (url: string, opts?: any) => {
      if (url.includes('/api/datasets')) {
        return { ok: true, json: async () => ({ datasets: [] }) };
      }
      return baseFn(url, opts);
    });

    const sources = await dashboardDb.getDataSources();

    expect(sources).toHaveLength(2);
    expect(sources[0].platform).toBe('Twitter');
    expect(sources[0].posts).toBe(300);
    expect(sources[0].percentage).toBe(60);
    expect(sources[0].status).toBe('active');
    expect(sources[0].health).toBe(90);

    expect(sources[1].platform).toBe('Facebook');
    expect(sources[1].posts).toBe(200);
    expect(sources[1].percentage).toBe(40);
  });

  it('marks zero-post sources as inactive', async () => {
    const platformData = [
      { platform: 'reddit', total_posts: 0, avg_confidence: 0.5 }
    ];
    mockFetch({ 'platform-performance': platformData });
    const originalFetch = fetch as ReturnType<typeof vi.fn>;
    const baseFn = originalFetch.getMockImplementation()!;
    originalFetch.mockImplementation(async (url: string, opts?: any) => {
      if (url.includes('/api/datasets')) {
        return { ok: true, json: async () => ({ datasets: [] }) };
      }
      return baseFn(url, opts);
    });

    const sources = await dashboardDb.getDataSources();
    expect(sources[0].status).toBe('inactive');
  });
});

// ─── getSentimentBreakdown ──────────────────────────────────────────────────

describe('getSentimentBreakdown', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'cross-platform-sentiment': [] });
    const breakdown = await dashboardDb.getSentimentBreakdown();
    expect(breakdown).toEqual([]);
  });

  it('aggregates positive/negative/neutral correctly', async () => {
    const sentimentData = [
      { sentiment_category: 'Very Positive', post_count: 60 },
      { sentiment_category: 'Positive', post_count: 40 },
      { sentiment_category: 'Negative', post_count: 30 },
      { sentiment_category: 'Neutral', post_count: 70 }
    ];
    mockFetch({ 'cross-platform-sentiment': sentimentData });

    const breakdown = await dashboardDb.getSentimentBreakdown();

    const positive = breakdown.find((b) => b.sentiment === 'positive');
    const negative = breakdown.find((b) => b.sentiment === 'negative');
    const neutral = breakdown.find((b) => b.sentiment === 'neutral');

    expect(positive?.count).toBe(100);
    expect(negative?.count).toBe(30);
    expect(neutral?.count).toBe(70);

    // Percentages should sum to 100
    const totalPct = breakdown.reduce((s, b) => s + b.percentage, 0);
    expect(totalPct).toBeCloseTo(100, 0);
  });
});

// ─── getTopLanguages ────────────────────────────────────────────────────────

describe('getTopLanguages', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'language-stats': [] });
    const langs = await dashboardDb.getTopLanguages();
    expect(langs).toEqual([]);
  });

  it('transforms language data and calculates percentages', async () => {
    const langData = [
      { language: 'English', post_count: 300 },
      { language: 'Spanish', post_count: 100 },
      { language: 'French', post_count: 100 }
    ];
    mockFetch({ 'language-stats': langData });

    const langs = await dashboardDb.getTopLanguages();

    expect(langs).toHaveLength(3);
    expect(langs[0].language).toBe('English');
    expect(langs[0].count).toBe(300);
    expect(langs[0].percentage).toBe(60);

    expect(langs[1].language).toBe('Spanish');
    expect(langs[1].percentage).toBe(20);
  });

  it('handles zero total gracefully', async () => {
    const langData = [{ language: 'Unknown', post_count: 0 }];
    mockFetch({ 'language-stats': langData });

    const langs = await dashboardDb.getTopLanguages();
    expect(langs[0].percentage).toBe(0);
  });
});

// ─── getTopTopics ───────────────────────────────────────────────────────────

describe('getTopTopics', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'topics-overview': [] });
    const topics = await dashboardDb.getTopTopics();
    expect(topics).toEqual([]);
  });

  it('filters out gdelt topics when social topics exist', async () => {
    const topicData = [
      { topic_id: 'gdelt_war', name: 'War', size: 500, coherence_score: 0.9 },
      { topic_id: 'social_tech', name: 'Tech', size: 200, coherence_score: 0.6 },
      { topic_id: 'social_health', name: 'Health', size: 100, coherence_score: 0.4 }
    ];
    mockFetch({ 'topics-overview': topicData });

    const topics = await dashboardDb.getTopTopics();

    expect(topics.every((t) => t.topic !== 'War')).toBe(true);
    expect(topics[0].topic).toBe('Tech');
    expect(topics[1].topic).toBe('Health');
  });

  it('falls back to gdelt topics when no social topics exist', async () => {
    const topicData = [
      { topic_id: 'gdelt_war', name: 'War', size: 500, coherence_score: 0.9 }
    ];
    mockFetch({ 'topics-overview': topicData });

    const topics = await dashboardDb.getTopTopics();
    expect(topics).toHaveLength(1);
    expect(topics[0].topic).toBe('War');
  });

  it('sorts by size descending and limits to 5', async () => {
    const topicData = Array.from({ length: 8 }, (_, i) => ({
      topic_id: `social_${i}`,
      name: `Topic ${i}`,
      size: (i + 1) * 10,
      coherence_score: 0.5
    }));
    mockFetch({ 'topics-overview': topicData });

    const topics = await dashboardDb.getTopTopics();

    expect(topics).toHaveLength(5);
    expect(topics[0].posts).toBe(80); // largest first
    expect(topics[4].posts).toBe(40);
  });

  it('sets trend based on coherence score', async () => {
    const topicData = [
      { topic_id: 'social_a', name: 'A', size: 10, coherence_score: 0.8 },
      { topic_id: 'social_b', name: 'B', size: 5, coherence_score: 0.3 }
    ];
    mockFetch({ 'topics-overview': topicData });

    const topics = await dashboardDb.getTopTopics();
    expect(topics[0].trend).toBe('up');
    expect(topics[1].trend).toBe('stable');
  });
});

// ─── getCrawlingActivity ────────────────────────────────────────────────────

describe('getCrawlingActivity', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'hourly-patterns': [] });
    const activity = await dashboardDb.getCrawlingActivity();
    expect(activity).toEqual([]);
  });

  it('transforms hourly patterns into time/posts/positive/negative/neutral', async () => {
    const hourlyData = [
      { hour_of_day: 0, positive: 10, negative: 5, neutral: 15 },
      { hour_of_day: 13, positive: 20, negative: 10, neutral: 30 }
    ];
    mockFetch({ 'hourly-patterns': hourlyData });

    const activity = await dashboardDb.getCrawlingActivity();

    expect(activity).toHaveLength(2);
    expect(activity[0].time).toBe('00:00');
    expect(activity[0].posts).toBe(30); // 10+5+15
    expect(activity[0].positive).toBe(10);

    expect(activity[1].time).toBe('13:00');
    expect(activity[1].posts).toBe(60);
  });

  it('handles missing sentiment counts as zero', async () => {
    const hourlyData = [{ hour_of_day: 5 }];
    mockFetch({ 'hourly-patterns': hourlyData });

    const activity = await dashboardDb.getCrawlingActivity();
    expect(activity[0].posts).toBe(0);
    expect(activity[0].positive).toBe(0);
  });
});

// ─── getRecentActivity ──────────────────────────────────────────────────────

describe('getRecentActivity', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'sample-posts': [] });
    const activity = await dashboardDb.getRecentActivity();
    expect(activity).toEqual([]);
  });

  it('transforms sample posts into activity feed', async () => {
    const posts = [
      { id: '1', platform: 'twitter', text: 'Hello world this is a long post for testing truncation purposes', timestamp: '2024-01-01T12:00:00Z' },
      { id: '2', platform: 'facebook', text: 'Another post here with some extra text for good measure yeah', timestamp: '2024-01-01T13:00:00Z' }
    ];
    mockFetch({ 'sample-posts': posts });

    const activity = await dashboardDb.getRecentActivity();

    expect(activity).toHaveLength(2);
    expect(activity[0].id).toBe('1');
    expect(activity[0].type).toBe('crawl'); // index 0 % 4
    expect(activity[0].message).toContain('twitter');
    expect(activity[0].status).toBe('completed'); // index 0 % 3

    expect(activity[1].type).toBe('analysis'); // index 1 % 4
    expect(activity[1].status).toBe('active'); // index 1 % 3
  });
});
