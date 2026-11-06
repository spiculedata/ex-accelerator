import { describe, it, expect, vi, beforeEach } from 'vitest';
import { topicModelingDb } from './topicModelingDb';

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
  (topicModelingDb as any).initialized = true;
});

// ─── getTopicStats ─────────────────────────────────────────────────────────

describe('getTopicStats', () => {
  it('returns default stats when no data', async () => {
    mockFetch({ 'topics-overview': [] });
    const stats = await topicModelingDb.getTopicStats();

    expect(stats.totalTopics).toBe(0);
    expect(stats.totalDocuments).toBe(0);
    expect(stats.avgCoherence).toBe(0);
    expect(stats.topicDistribution).toEqual([]);
  });

  it('returns default stats when API returns null', async () => {
    mockFetch({ 'topics-overview': null });
    const stats = await topicModelingDb.getTopicStats();
    expect(stats.totalTopics).toBe(0);
  });

  it('calculates stats from topic data', async () => {
    const topics = [
      { topic_id: 1, name: 'Tech', size: 100, coherence_score: 0.8 },
      { topic_id: 2, name: 'Health', size: 50, coherence_score: 0.6 }
    ];
    mockFetch({ 'topics-overview': topics });

    const stats = await topicModelingDb.getTopicStats();

    expect(stats.totalTopics).toBe(2);
    expect(stats.totalDocuments).toBe(150);
    expect(stats.avgCoherence).toBe(0.7);
    expect(stats.topicDistribution).toHaveLength(2);
    expect(stats.topicDistribution[0].topic).toBe('Tech');
    expect(stats.topicDistribution[0].count).toBe(100);
    expect(stats.topicDistribution[0].percentage).toBeCloseTo(66.67, 1);
  });

  it('passes workspaceId to the API', async () => {
    mockFetch({ 'topics-overview': [] });
    await topicModelingDb.getTopicStats('ws-1');

    const callUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const parsed = new URL(callUrl, 'http://localhost');
    expect(parsed.searchParams.get('workspace_id')).toBe('ws-1');
  });
});

// ─── getTopics ─────────────────────────────────────────────────────────────

describe('getTopics', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'topics-overview': [], 'topic-keywords': [] });
    const topics = await topicModelingDb.getTopics();
    expect(topics).toEqual([]);
  });

  it('transforms topic data with keywords', async () => {
    const topicsData = [
      { topic_id: 1, name: 'Technology', category: 'Tech', category_color: '#3b82f6', size: 200, coherence_score: 0.85 }
    ];
    const keywordsData = [
      { topic_id: 1, keyword: 'AI' },
      { topic_id: 1, keyword: 'ML' }
    ];
    mockFetch({ 'topics-overview': topicsData, 'topic-keywords': keywordsData });

    const topics = await topicModelingDb.getTopics();

    expect(topics).toHaveLength(1);
    expect(topics[0].id).toBe(1);
    expect(topics[0].name).toBe('Technology');
    expect(topics[0].category).toBe('Tech');
    expect(topics[0].categoryColor).toBe('#3b82f6');
    expect(topics[0].size).toBe(200);
    expect(topics[0].coherenceScore).toBe(0.85);
    expect(topics[0].topWords).toEqual(['AI', 'ML']);
    expect(topics[0].keywords).toEqual(['AI', 'ML']);
  });

  it('defaults category to General and color to gray', async () => {
    const topicsData = [
      { topic_id: 1, name: 'Unknown', size: 10, coherence_score: 0.5 }
    ];
    mockFetch({ 'topics-overview': topicsData, 'topic-keywords': [] });

    const topics = await topicModelingDb.getTopics();
    expect(topics[0].category).toBe('General');
    expect(topics[0].categoryColor).toBe('#6b7280');
  });

  it('passes workspaceId to both queries', async () => {
    mockFetch({ 'topics-overview': [], 'topic-keywords': [] });
    await topicModelingDb.getTopics({}, 'ws-2');

    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    calls.forEach((call: any[]) => {
      const parsed = new URL(call[0], 'http://localhost');
      expect(parsed.searchParams.get('workspace_id')).toBe('ws-2');
    });
  });
});

// ─── getTopicCategories ────────────────────────────────────────────────────

describe('getTopicCategories', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'topic-categories': [] });
    const categories = await topicModelingDb.getTopicCategories();
    expect(categories).toEqual([]);
  });

  it('transforms category data correctly', async () => {
    const data = [
      { category: 'Technology', category_color: '#3b82f6', topic_count: 5, total_size: 300, avg_coherence: 0.75 }
    ];
    mockFetch({ 'topic-categories': data });

    const categories = await topicModelingDb.getTopicCategories();

    expect(categories).toHaveLength(1);
    expect(categories[0].category).toBe('Technology');
    expect(categories[0].category_color).toBe('#3b82f6');
    expect(categories[0].topic_count).toBe(5);
    expect(categories[0].total_size).toBe(300);
    expect(categories[0].avg_coherence).toBe(0.75);
  });
});

// ─── getTopicRelationships ─────────────────────────────────────────────────

describe('getTopicRelationships', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'topic-relationships': [] });
    const rels = await topicModelingDb.getTopicRelationships();
    expect(rels).toEqual([]);
  });

  it('transforms relationships and passes threshold', async () => {
    const data = [
      { topic1_id: 1, topic2_id: 2, similarity_score: 0.8, relationship_type: 'similarity', strength: 0.7 }
    ];
    mockFetch({ 'topic-relationships': data });

    const rels = await topicModelingDb.getTopicRelationships(0.6, 'ws-1');

    expect(rels).toHaveLength(1);
    expect(rels[0].topic1_id).toBe(1);
    expect(rels[0].topic2_id).toBe(2);
    expect(rels[0].similarity_score).toBe(0.8);

    const callUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const parsed = new URL(callUrl, 'http://localhost');
    expect(parsed.searchParams.get('threshold')).toBe('0.6');
    expect(parsed.searchParams.get('workspace_id')).toBe('ws-1');
  });
});

// ─── getTopicTrends ────────────────────────────────────────────────────────

describe('getTopicTrends', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'topic-trends': [] });
    const trends = await topicModelingDb.getTopicTrends();
    expect(trends).toEqual([]);
  });

  it('transforms trend data correctly', async () => {
    const data = [
      { topic_id: 1, analysis_date: '2024-01-01', document_count: 50, average_engagement: 3.5, growth_rate: 0.12, trend_direction: 'rising' }
    ];
    mockFetch({ 'topic-trends': data });

    const trends = await topicModelingDb.getTopicTrends('30d');

    expect(trends).toHaveLength(1);
    expect(trends[0].topic_id).toBe(1);
    expect(trends[0].analysis_date).toBe('2024-01-01');
    expect(trends[0].document_count).toBe(50);
    expect(trends[0].growth_rate).toBe(0.12);
    expect(trends[0].trend_direction).toBe('rising');
  });

  it('passes timeRange param to the API', async () => {
    mockFetch({ 'topic-trends': [] });
    await topicModelingDb.getTopicTrends('90d');

    const callUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const parsed = new URL(callUrl, 'http://localhost');
    expect(parsed.searchParams.get('timeRange')).toBe('90d');
  });
});

// ─── getTopicCorrelations ──────────────────────────────────────────────────

describe('getTopicCorrelations', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'topic-relationships': [] });
    const corr = await topicModelingDb.getTopicCorrelations();
    expect(corr).toEqual([]);
  });

  it('transforms relationships into correlations', async () => {
    const data = [
      { topic1_id: 1, topic2_id: 2, similarity_score: 0.75, strength: 0.6 }
    ];
    mockFetch({ 'topic-relationships': data });

    const corr = await topicModelingDb.getTopicCorrelations();

    expect(corr).toHaveLength(1);
    expect(corr[0].topic1).toBe(1);
    expect(corr[0].topic2).toBe(2);
    expect(corr[0].correlation).toBe(0.75);
    expect(corr[0].sharedDocuments).toBe(60); // Math.floor(0.6 * 100)
  });

  it('uses threshold 0.0 to fetch all relationships', async () => {
    mockFetch({ 'topic-relationships': [] });
    await topicModelingDb.getTopicCorrelations();

    const callUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const parsed = new URL(callUrl, 'http://localhost');
    expect(parsed.searchParams.get('threshold')).toBe('0.0');
  });
});

// ─── getTopicDocuments ─────────────────────────────────────────────────────

describe('getTopicDocuments', () => {
  it('returns empty array when no data', async () => {
    mockFetch({ 'sample-posts': [] });
    const docs = await topicModelingDb.getTopicDocuments(1);
    expect(docs).toEqual([]);
  });

  it('transforms posts into topic documents', async () => {
    const data = [
      { id: '1', text: 'Hello world', platform: 'twitter', timestamp: '2024-01-01', sentiment: 'positive' }
    ];
    mockFetch({ 'sample-posts': data });

    const docs = await topicModelingDb.getTopicDocuments(5);

    expect(docs).toHaveLength(1);
    expect(docs[0].id).toBe('1');
    expect(docs[0].content).toBe('Hello world');
    expect(docs[0].topic).toBe('Topic 5');
    expect(docs[0].platform).toBe('twitter');
    expect(docs[0].sentiment).toBe('positive');
    // The API does not provide per-document probabilities; never fabricate one
    expect(docs[0].topicProbability).toBeNull();
  });

  it('passes limit parameter', async () => {
    mockFetch({ 'sample-posts': [] });
    await topicModelingDb.getTopicDocuments(1, 30);

    const callUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const parsed = new URL(callUrl, 'http://localhost');
    expect(parsed.searchParams.get('limit')).toBe('30');
  });
});

// ─── exportTopicData ───────────────────────────────────────────────────────

describe('exportTopicData', () => {
  it('combines results from multiple queries', async () => {
    const topics = [
      { topic_id: 1, name: 'Tech', size: 100, coherence_score: 0.8, category: 'Technology' }
    ];
    const keywords = [{ topic_id: 1, keyword: 'AI' }];
    const trends = [
      { topic_id: 1, analysis_date: '2024-01-01', document_count: 50, average_engagement: 3.5, growth_rate: 0.1, trend_direction: 'rising' }
    ];
    const relationships = [
      { topic1_id: 1, topic2_id: 2, similarity_score: 0.7, strength: 0.5 }
    ];

    mockFetch({
      'topics-overview': topics,
      'topic-keywords': keywords,
      'topic-trends': trends,
      'topic-relationships': relationships
    });

    const result = await topicModelingDb.exportTopicData();

    expect(result.exportDate).toBeTruthy();
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('Tech');
    expect(result.summary.topicStats.totalTopics).toBe(1);
    expect(result.summary.trends).toHaveLength(1);
    expect(result.summary.correlations).toHaveLength(1);
  });

  it('handles empty results gracefully', async () => {
    mockFetch({});
    const result = await topicModelingDb.exportTopicData();

    expect(result.data).toEqual([]);
    expect(result.summary.topicStats.totalTopics).toBe(0);
    expect(result.summary.trends).toEqual([]);
    expect(result.summary.correlations).toEqual([]);
  });
});
