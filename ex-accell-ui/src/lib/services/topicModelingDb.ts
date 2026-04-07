// Database connection and query service for Topic Modeling data
// Uses PostgreSQL with pg_duckdb extension via unified analytics API

import { BaseDatabaseService } from './baseDatabaseService';
import type {
  Topic,
  TopicKeyword,
  TopicTrend,
  TopicRelationship,
  TopicCategory,
  FilterOptions,
  ExportData
} from './types/databaseTypes';

interface TopicStats {
  totalTopics: number;
  totalDocuments: number;
  avgCoherence: number;
  topicDistribution: Array<{
    topic: string;
    count: number;
    percentage: number;
  }>;
}

interface TopicDocument {
  id: string | number;
  content: string;
  topic: string;
  topicProbability: number;
  platform: string;
  timestamp: string;
  sentiment: string;
}

interface TreemapNode {
  name: string;
  value: number;
  itemStyle: { color: string };
  children?: TreemapNode[];
}

interface TopicCorrelation {
  topic1: string | number;
  topic2: string | number;
  correlation: number;
  sharedDocuments: number;
}

/**
 * Topic Modeling Database Service
 * Provides topic modeling and analysis data from PostgreSQL with pg_duckdb extension
 */
class TopicModelingDatabase extends BaseDatabaseService {
  constructor() {
    super({
      serviceName: 'TopicModeling',
      apiEndpoint: '/api/unified-analytics',
      autoConnect: false
    });
  }

  /**
   * Get topic overview statistics
   */
  async getTopicStats(workspaceId?: string): Promise<TopicStats> {
    const topics = await this.queryAPI<any>({
      endpoint: 'topics-overview',
      params: workspaceId ? { workspace_id: workspaceId } : {}
    });

    if (!topics || topics.length === 0) {
      return this.getDefaultTopicStats();
    }

    return this.safeTransform(
      [topics],
      () => this.calculateTopicStats(topics),
      [this.getDefaultTopicStats()]
    )[0];
  }

  /**
   * Get topics with optional filtering
   */
  async getTopics(filters: FilterOptions = {}, workspaceId?: string): Promise<Topic[]> {
    const wsParam = workspaceId ? { workspace_id: workspaceId } : {};
    const [topics, keywords] = await this.queryMultiple<any>([
      { endpoint: 'topics-overview', params: wsParam },
      { endpoint: 'topic-keywords', params: wsParam }
    ]);

    if (!topics || topics.length === 0) {
      return [];
    }

    // Create keyword map for each topic
    const keywordMap = this.createKeywordMap(keywords);

    // Apply filters
    let filteredTopics = this.applyTopicFilters(topics, keywordMap, filters);

    // Transform to Topic interface
    return this.safeTransform(
      filteredTopics,
      (topic) => ({
        id: topic.topic_id,
        name: topic.name,
        category: topic.category || 'General',
        categoryColor: topic.category_color || '#6b7280',
        size: topic.size || 0,
        weight: topic.coherence_score || 0,
        coherenceScore: topic.coherence_score || 0,
        topWords: keywordMap.get(topic.topic_id) || [],
        keywords: keywordMap.get(topic.topic_id) || [],
        created_at: topic.created_at
      }),
      []
    );
  }

  /**
   * Get topic categories for filtering
   */
  async getTopicCategories(workspaceId?: string): Promise<TopicCategory[]> {
    const categories = await this.queryAPI<any>({
      endpoint: 'topic-categories',
      params: workspaceId ? { workspace_id: workspaceId } : {}
    });

    if (!categories || categories.length === 0) {
      return [];
    }

    return this.safeTransform(
      categories,
      (category) => ({
        category: category.category,
        category_color: category.category_color || '#6b7280',
        topic_count: category.topic_count || 0,
        total_size: category.total_size || 0,
        avg_coherence: category.avg_coherence || 0
      }),
      []
    );
  }

  /**
   * Get topic relationships
   */
  async getTopicRelationships(threshold: number = 0.5, workspaceId?: string): Promise<TopicRelationship[]> {
    const relationships = await this.queryAPI<any>({
      endpoint: 'topic-relationships',
      params: { ...(workspaceId ? { workspace_id: workspaceId } : {}), threshold: threshold.toString() }
    });

    if (!relationships || relationships.length === 0) {
      return [];
    }

    return this.safeTransform(
      relationships,
      (rel) => ({
        topic1_id: rel.topic1_id,
        topic2_id: rel.topic2_id,
        similarity_score: rel.similarity_score || 0,
        relationship_type: rel.relationship_type || 'similarity',
        strength: rel.strength || 0
      }),
      []
    );
  }

  /**
   * Get detailed topic analysis
   */
  async getDetailedTopics(workspaceId?: string): Promise<Topic[]> {
    const wsParam = workspaceId ? { workspace_id: workspaceId } : {};
    const [topics, keywords] = await this.queryMultiple<any>([
      { endpoint: 'topics-overview', params: wsParam },
      { endpoint: 'topic-keywords', params: wsParam }
    ]);

    if (!topics || topics.length === 0) {
      return [];
    }

    const keywordMap = this.createKeywordMap(keywords);

    return this.safeTransform(
      topics,
      (topic) => ({
        id: topic.topic_id,
        name: topic.name,
        description: `Topic: ${topic.name} (${topic.category || 'General'})`,
        category: topic.category || 'General',
        categoryColor: topic.category_color || '#6b7280',
        size: topic.size || 0,
        weight: topic.coherence_score || 0,
        coherenceScore: topic.coherence_score || 0,
        topWords: keywordMap.get(topic.topic_id) || [],
        color: topic.category_color || '#6b7280',
        documentCount: topic.size || 0
      }),
      []
    );
  }

  /**
   * Get topic trends over time
   */
  async getTopicTrends(timeRange: string = '7d', workspaceId?: string): Promise<TopicTrend[]> {
    const trends = await this.queryAPI<any>({
      endpoint: 'topic-trends',
      params: { ...(workspaceId ? { workspace_id: workspaceId } : {}), timeRange }
    });

    if (!trends || trends.length === 0) {
      return [];
    }

    return this.safeTransform(
      trends,
      (trend) => ({
        topic_id: trend.topic_id,
        analysis_date: trend.analysis_date,
        document_count: trend.document_count || 0,
        average_engagement: trend.average_engagement || 0,
        growth_rate: trend.growth_rate || 0,
        trend_direction: trend.trend_direction || 'stable'
      }),
      []
    );
  }

  /**
   * Get topic correlations
   */
  async getTopicCorrelations(workspaceId?: string): Promise<TopicCorrelation[]> {
    const relationships = await this.queryAPI<any>({
      endpoint: 'topic-relationships',
      params: { ...(workspaceId ? { workspace_id: workspaceId } : {}), threshold: '0.0' }
    });

    if (!relationships || relationships.length === 0) {
      return [];
    }

    return this.safeTransform(
      relationships,
      (rel) => ({
        topic1: rel.topic1_id,
        topic2: rel.topic2_id,
        correlation: rel.similarity_score || 0,
        sharedDocuments: Math.floor((rel.strength || 0.5) * 100)
      }),
      []
    );
  }

  /**
   * Get sample documents for a topic
   */
  async getTopicDocuments(topicId: number, limit: number = 20, workspaceId?: string): Promise<TopicDocument[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'sample-posts',
      params: { ...(workspaceId ? { workspace_id: workspaceId } : {}), limit: limit.toString() }
    });

    if (!data || data.length === 0) {
      return [];
    }

    return this.safeTransform(
      data,
      (post) => ({
        id: post.id,
        content: post.text,
        topic: `Topic ${topicId}`,
        topicProbability: Math.round(Math.random() * 100) / 100, // TODO: Get actual probability from database
        platform: post.platform,
        timestamp: post.timestamp,
        sentiment: post.sentiment
      }),
      []
    );
  }

  /**
   * Get treemap data for visualization
   */
  async getTreemapData(filters: FilterOptions = {}, workspaceId?: string): Promise<TreemapNode[]> {
    const [topics, categories] = await Promise.all([
      this.getTopics(filters, workspaceId),
      this.getTopicCategories(workspaceId)
    ]);

    if (topics.length === 0) {
      return [];
    }

    return this.safeTransform(
      [{ topics, categories }],
      () => this.buildTreemapHierarchy(topics, categories),
      []
    )[0];
  }

  /**
   * Export topic modeling data
   */
  async exportTopicData(filters: FilterOptions = {}, workspaceId?: string): Promise<ExportData<Topic>> {
    const [topicStats, detailedTopics, trends, correlations] = await Promise.all([
      this.getTopicStats(workspaceId),
      this.getDetailedTopics(workspaceId),
      this.getTopicTrends(filters.timeRange || '7d', workspaceId),
      this.getTopicCorrelations(workspaceId)
    ]);

    return {
      exportDate: new Date().toISOString(),
      filters,
      data: detailedTopics,
      summary: {
        topicStats,
        trends,
        correlations
      }
    };
  }

  // ========== Private Helper Methods ==========

  /**
   * Get default topic statistics
   */
  private getDefaultTopicStats(): TopicStats {
    return {
      totalTopics: 0,
      totalDocuments: 0,
      avgCoherence: 0,
      topicDistribution: []
    };
  }

  /**
   * Calculate topic statistics from raw data
   */
  private calculateTopicStats(topics: any[]): TopicStats {
    const totalTopics = topics.length;
    const totalDocuments = topics.reduce((sum, topic) => sum + (topic.size || 0), 0);
    const avgCoherence = topics.length > 0
      ? topics.reduce((sum, topic) => sum + (topic.coherence_score || 0), 0) / topics.length
      : 0;

    const topicDistribution = topics.map(topic => ({
      topic: topic.name,
      count: topic.size || 0,
      percentage: totalDocuments > 0 ? Math.round((topic.size / totalDocuments * 100) * 100) / 100 : 0
    }));

    return {
      totalTopics,
      totalDocuments,
      avgCoherence: Math.round(avgCoherence * 100) / 100,
      topicDistribution
    };
  }

  /**
   * Create keyword map from keywords array
   */
  private createKeywordMap(keywords: any[]): Map<string | number, string[]> {
    const keywordMap = new Map<string | number, string[]>();

    if (keywords && Array.isArray(keywords)) {
      keywords.forEach(kw => {
        if (!keywordMap.has(kw.topic_id)) {
          keywordMap.set(kw.topic_id, []);
        }
        keywordMap.get(kw.topic_id)!.push(kw.keyword);
      });
    }

    return keywordMap;
  }

  /**
   * Apply filters to topics
   */
  private applyTopicFilters(
    topics: any[],
    keywordMap: Map<string | number, string[]>,
    filters: FilterOptions
  ): any[] {
    let filteredTopics = topics;

    const category = filters.category || filters.platform;
    if (category && category !== 'all') {
      filteredTopics = filteredTopics.filter(topic =>
        topic.category && topic.category.toLowerCase() === category.toLowerCase()
      );
    }

    const search = filters.search || filters.sortBy;
    if (search) {
      filteredTopics = filteredTopics.filter(topic =>
        topic.name.toLowerCase().includes(search.toLowerCase()) ||
        (keywordMap.get(topic.topic_id) || []).some(keyword =>
          keyword.toLowerCase().includes(search.toLowerCase())
        )
      );
    }

    if (filters.minSize) {
      filteredTopics = filteredTopics.filter(topic =>
        (topic.size || 0) >= filters.minSize!
      );
    }

    return filteredTopics;
  }

  /**
   * Build treemap hierarchy from topics and categories
   */
  private buildTreemapHierarchy(topics: Topic[], categories: TopicCategory[]): TreemapNode[] {
    const categoryMap = new Map<string, TreemapNode>();

    // Initialize categories
    categories.forEach(category => {
      categoryMap.set(category.category, {
        name: category.category,
        value: 0,
        itemStyle: { color: category.category_color },
        children: []
      });
    });

    // Add topics to their categories
    topics.forEach(topic => {
      const categoryName = topic.category || 'General';
      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, {
          name: categoryName,
          value: 0,
          itemStyle: { color: '#6b7280' },
          children: []
        });
      }

      const category = categoryMap.get(categoryName)!;
      category.children!.push({
        name: topic.name,
        value: topic.size,
        itemStyle: { color: topic.categoryColor || '#6b7280' }
      });
      category.value += topic.size;
    });

    // Convert to array and sort by size
    return Array.from(categoryMap.values())
      .filter(category => category.children && category.children.length > 0)
      .sort((a, b) => b.value - a.value);
  }
}

export const topicModelingDb = new TopicModelingDatabase();
