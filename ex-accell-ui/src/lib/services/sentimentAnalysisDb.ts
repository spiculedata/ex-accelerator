// Database connection and query service for Sentiment Analysis data
// Uses PostgreSQL with pg_duckdb extension via unified analytics API

import { BaseDatabaseService } from './baseDatabaseService';
import type {
  SentimentStats,
  SentimentCategory,
  EmotionStat,
  SentimentTrend,
  SentimentPost,
  PlatformPerformance,
  SentimentKeyword,
  EmotionCorrelation,
  FilterOptions,
  ExportData
} from './types/databaseTypes';

/**
 * Sentiment Analysis Database Service
 * Provides sentiment analysis data from PostgreSQL with pg_duckdb extension
 */
class SentimentAnalysisDatabase extends BaseDatabaseService {
  constructor() {
    super({
      serviceName: 'SentimentAnalysis',
      apiEndpoint: '/api/unified-analytics',
      autoConnect: false
    });
  }

  /**
   * Get overall sentiment statistics
   */
  async getSentimentStats(workspaceId?: string, extraParams?: Record<string, string>): Promise<SentimentStats> {
    const data = await this.queryAPI<any>({
      endpoint: 'cross-platform-sentiment',
      params: { ...(workspaceId ? { workspace_id: workspaceId } : {}), ...extraParams }
    });

    // Return default stats if no data
    if (!data || data.length === 0) {
      return this.getDefaultSentimentStats();
    }

    return this.aggregateSentimentStats(data);
  }

  /**
   * Get detailed sentiment distribution
   */
  async getDetailedSentiments(workspaceId?: string, extraParams?: Record<string, string>): Promise<SentimentCategory[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'cross-platform-sentiment',
      params: { ...(workspaceId ? { workspace_id: workspaceId } : {}), ...extraParams }
    });

    if (!data || data.length === 0) {
      return [];
    }

    return this.safeTransform(
      [data],
      () => this.transformToDetailedSentiments(data),
      []
    )[0];
  }

  /**
   * Get emotion analysis data from the emotion_analysis table
   */
  async getEmotionStats(workspaceId?: string, extraParams?: Record<string, string>): Promise<EmotionStat[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'emotion-stats',
      params: { ...(workspaceId ? { workspace_id: workspaceId } : {}), ...extraParams }
    });

    if (!data || data.length === 0) {
      return [];
    }

    return this.safeTransform(
      data,
      (item) => this.transformToEmotionStat(item),
      []
    );
  }

  /**
   * Get sentiment trends over time
   */
  async getSentimentTrends(timeRange: string = '7d', workspaceId?: string, extraParams?: Record<string, string>): Promise<SentimentTrend[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'sentiment-trends',
      params: { ...(workspaceId ? { workspace_id: workspaceId } : {}), timeRange, ...extraParams }
    });

    if (!data || data.length === 0) {
      return [];
    }

    return this.safeTransform(
      data,
      (item) => ({
        date: item.date,
        positive: item.positive,
        negative: item.negative,
        neutral: item.neutral,
        total: (item.positive || 0) + (item.negative || 0) + (item.neutral || 0)
      }),
      []
    ).reverse(); // Reverse to get chronological order
  }

  /**
   * Get sample posts with sentiment analysis
   */
  async getSamplePosts(filters: FilterOptions = {}, workspaceId?: string): Promise<SentimentPost[]> {
    const params = {
      ...(workspaceId ? { workspace_id: workspaceId } : {}),
      sentiment: filters.sentiment || 'all',
      platform: filters.platform || 'all',
      limit: filters.limit || 50
    };

    const data = await this.queryAPI<any>({
      endpoint: 'sample-posts',
      params
    });

    if (!data || data.length === 0) {
      return [];
    }

    return this.safeTransform(
      data,
      (post) => ({
        id: post.id,
        text: post.text,
        sentiment: post.sentiment,
        confidence: post.confidence,
        emotions: post.emotions ? post.emotions.split(',') : [],
        platform: post.platform,
        timestamp: post.timestamp ? (isNaN(new Date(post.timestamp).getTime()) ? new Date().toISOString() : new Date(post.timestamp).toISOString()) : new Date().toISOString(),
        engagement: {
          likes: post.engagement_likes || 0,
          shares: post.engagement_shares || 0,
          comments: post.engagement_comments || 0
        },
        author: post.author
      }),
      []
    );
  }

  /**
   * Get platform-specific sentiment performance
   */
  async getPlatformSentimentPerformance(workspaceId?: string): Promise<PlatformPerformance[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'platform-performance',
      params: { ...(workspaceId ? { workspace_id: workspaceId } : {}), ...extraParams }
    });

    if (!data || data.length === 0) {
      return [];
    }

    return this.safeTransform(
      data,
      (item) => ({
        platform: item.platform.charAt(0).toUpperCase() + item.platform.slice(1),
        totalPosts: item.total_posts,
        avgConfidence: item.avg_confidence,
        positiveRatio: item.positive_ratio
      }),
      []
    );
  }

  /**
   * Get top sentiment keywords from the sentiment_keywords table
   */
  async getTopSentimentKeywords(sentiment: string = 'all', workspaceId?: string): Promise<SentimentKeyword[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'sentiment-keywords',
      params: { ...(workspaceId ? { workspace_id: workspaceId } : {}), keywordSentiment: sentiment }
    });

    if (!data || data.length === 0) {
      return [];
    }

    return this.safeTransform(
      data,
      (item) => ({
        keyword: item.keyword,
        sentiment: item.sentiment_type || sentiment,
        frequency: item.frequency || 0,
        impact: item.impact_score ? item.impact_score / 10 : 0 // Normalize 0-10 scale to 0-1
      }),
      []
    );
  }

  /**
   * Get emotion correlations
   */
  async getEmotionCorrelations(workspaceId?: string): Promise<EmotionCorrelation[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'emotion-correlations',
      params: { ...(workspaceId ? { workspace_id: workspaceId } : {}), ...extraParams }
    });

    if (!data || data.length === 0) {
      return [];
    }

    return this.safeTransform(
      data,
      (item) => ({
        emotion1: item.emotion1,
        emotion2: item.emotion2,
        correlation: item.correlation,
        coOccurrence: item.co_occurrence_count || 0
      }),
      []
    );
  }

  /**
   * Get sentiment distribution by time of day
   */
  async getSentimentByTimeOfDay(workspaceId?: string): Promise<SentimentTrend[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'hourly-patterns',
      params: { ...(workspaceId ? { workspace_id: workspaceId } : {}), ...extraParams }
    });

    if (!data || data.length === 0) {
      return [];
    }

    return this.safeTransform(
      data,
      (item) => ({
        date: String(item.hour_of_day), // Using hour as date for consistency
        positive: item.positive,
        negative: item.negative,
        neutral: item.neutral
      }),
      []
    );
  }

  /**
   * Export sentiment analysis data
   */
  async exportSentimentData(filters: FilterOptions = {}, workspaceId?: string): Promise<ExportData<SentimentPost>> {
    const wsParam = workspaceId ? { workspace_id: workspaceId } : {};
    const params = {
      ...wsParam,
      sentiment: filters.sentiment || 'all',
      platform: filters.platform || 'all',
      timeRange: filters.timeRange || '7d'
    };

    // Execute multiple queries in parallel
    const [posts, sentimentStats, emotionStats, trends] = await this.queryMultiple<any>([
      { endpoint: 'export-data', params },
      { endpoint: 'cross-platform-sentiment', params: wsParam },
      { endpoint: 'emotion-correlations', params: wsParam },
      { endpoint: 'sentiment-trends', params: { ...wsParam, timeRange: filters.timeRange || '7d' } }
    ]);

    // Transform posts data
    const transformedPosts = this.safeTransform(
      posts,
      (post) => ({
        id: post.id,
        text: post.text,
        sentiment: post.sentiment,
        confidence: post.confidence,
        emotions: post.emotions ? post.emotions.split(';') : [],
        platform: post.platform,
        timestamp: post.timestamp ? (isNaN(new Date(post.timestamp).getTime()) ? new Date().toISOString() : new Date(post.timestamp).toISOString()) : new Date().toISOString(),
        engagement: {
          likes: post.engagement_likes || 0,
          shares: post.engagement_shares || 0,
          comments: post.engagement_comments || 0
        }
      }),
      []
    );

    return {
      exportDate: new Date().toISOString(),
      filters,
      data: transformedPosts,
      summary: {
        sentimentStats: this.aggregateSentimentStats(sentimentStats),
        emotionStats: this.safeTransform(emotionStats, (item) => this.transformToEmotionStat(item), []),
        trends: this.safeTransform(trends, (item) => ({
          date: item.date,
          positive: item.positive,
          negative: item.negative,
          neutral: item.neutral
        }), [])
      }
    };
  }

  // ========== Private Helper Methods ==========

  /**
   * Get default sentiment statistics
   */
  private getDefaultSentimentStats(): SentimentStats {
    return {
      positive: { count: 0, percentage: 0, confidence: 0 },
      negative: { count: 0, percentage: 0, confidence: 0 },
      neutral: { count: 0, percentage: 0, confidence: 0 },
      total: 0,
      avgConfidence: 0
    };
  }

  /**
   * Aggregate sentiment statistics from raw data
   */
  private aggregateSentimentStats(data: any[]): SentimentStats {
    const sentimentMap = new Map<string, { count: number; confidence: number }>();
    let totalPosts = 0;
    let totalConfidence = 0;
    let confidenceCount = 0;

    data.forEach(row => {
      const sentiment = row.sentiment_category.toLowerCase().includes('positive') ? 'positive' :
                       row.sentiment_category.toLowerCase().includes('negative') ? 'negative' : 'neutral';

      if (!sentimentMap.has(sentiment)) {
        sentimentMap.set(sentiment, { count: 0, confidence: 0 });
      }

      const current = sentimentMap.get(sentiment)!;
      const postCount = parseInt(row.post_count) || 0;
      current.count += postCount;
      totalPosts += postCount;

      if (row.avg_confidence) {
        current.confidence = (current.confidence + row.avg_confidence) / 2;
        totalConfidence += row.avg_confidence;
        confidenceCount++;
      }
    });

    const positive = sentimentMap.get('positive') || { count: 0, confidence: 0 };
    const negative = sentimentMap.get('negative') || { count: 0, confidence: 0 };
    const neutral = sentimentMap.get('neutral') || { count: 0, confidence: 0 };

    return {
      positive: {
        count: positive.count,
        percentage: totalPosts > 0 ? Math.round((positive.count / totalPosts * 100) * 100) / 100 : 0,
        confidence: Math.round((positive.confidence || 0) * 100) / 100
      },
      negative: {
        count: negative.count,
        percentage: totalPosts > 0 ? Math.round((negative.count / totalPosts * 100) * 100) / 100 : 0,
        confidence: Math.round((negative.confidence || 0) * 100) / 100
      },
      neutral: {
        count: neutral.count,
        percentage: totalPosts > 0 ? Math.round((neutral.count / totalPosts * 100) * 100) / 100 : 0,
        confidence: Math.round((neutral.confidence || 0) * 100) / 100
      },
      total: totalPosts,
      avgConfidence: confidenceCount > 0 ? Math.round((totalConfidence / confidenceCount) * 100) / 100 : 0
    };
  }

  /**
   * Transform to detailed sentiment categories
   */
  private transformToDetailedSentiments(data: any[]): SentimentCategory[] {
    const sentimentColors: Record<string, string> = {
      'Very Positive': '#22c55e',
      'Positive': '#84cc16',
      'Neutral': '#6b7280',
      'Negative': '#f97316',
      'Very Negative': '#ef4444'
    };

    const sentimentTotals = new Map<string, number>();
    let totalPosts = 0;

    data.forEach(row => {
      const category = row.sentiment_category;
      if (!sentimentTotals.has(category)) {
        sentimentTotals.set(category, 0);
      }
      sentimentTotals.set(category, sentimentTotals.get(category)! + row.post_count);
      totalPosts += row.post_count;
    });

    return Array.from(sentimentTotals.entries()).map(([category, count]) => ({
      label: category,
      count: count,
      color: sentimentColors[category] || '#6b7280',
      percentage: totalPosts > 0 ? Math.round((count / totalPosts * 100) * 100) / 100 : 0
    }));
  }

  /**
   * Transform to emotion stat
   */
  private transformToEmotionStat(item: any): EmotionStat {
    const emotionColors: Record<string, string> = {
      'Joy': '#fbbf24',
      'Trust': '#3b82f6',
      'Fear': '#8b5cf6',
      'Surprise': '#f59e0b',
      'Sadness': '#6366f1',
      'Disgust': '#10b981',
      'Anger': '#ef4444'
    };

    const emotion = item.emotion1 || item.emotion;

    return {
      emotion: emotion,
      count: item.count || item.co_occurrence_count || item.post_count || 0,
      percentage: item.percentage || 0,
      color: emotionColors[emotion] || '#6b7280'
    };
  }
}

export const sentimentAnalysisDb = new SentimentAnalysisDatabase();
