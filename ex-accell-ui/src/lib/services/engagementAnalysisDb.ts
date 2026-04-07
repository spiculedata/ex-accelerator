// Database connection and query service for Engagement Analysis data
// Uses PostgreSQL with pg_duckdb extension via unified analytics API

import { BaseDatabaseService } from './baseDatabaseService';
import type {
  EngagementMetrics,
  PostEngagement,
  DailyEngagement,
  HashtagEngagement,
  FilterOptions,
  ExportData
} from './types/databaseTypes';

interface EngagementStats {
  totalEngagements: number;
  averageRate: number;
  totalReach: number;
  bestPerformingPost: number;
  totalPosts: number;
  totalImpressions: number;
  avgLikes: number;
  avgComments: number;
  avgShares: number;
}

interface PlatformEngagementData {
  platform: string;
  engagementRate: number;
  totalEngagements: number;
  posts: number;
  avgLikes: number;
  avgComments: number;
  avgShares: number;
  totalReach: number;
  color: string;
}

interface ContentTypePerformance {
  type: string;
  engagementRate: number;
  posts: number;
  reach: number;
  avgLikes: number;
  avgComments: number;
  avgShares: number;
  sentiment: string;
}

interface EngagementTrend {
  date: string;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  views: number;
  reach: number;
  engagementRate: number;
}

interface TopPerformingPost {
  id: string | number;
  text: string;
  author: string;
  platform: string;
  contentType: string;
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    rate: number;
  };
  reach: number;
  views: number;
  timestamp: string;
  performance_rank: number;
}

interface EngagementTiming {
  hour_of_day: number;
  day_of_week: number;
  day_name: string;
  avg_engagement_rate: number;
  total_posts: number;
  total_engagements: number;
}

interface HashtagPerformance {
  hashtag: string;
  usage_count: number;
  avg_boost: number;
  avg_engagement_rate: number;
  impact_score: number;
}

/**
 * Engagement Analysis Database Service
 * Provides engagement metrics and performance data from PostgreSQL with pg_duckdb extension
 */
class EngagementAnalysisDatabase extends BaseDatabaseService {
  constructor() {
    super({
      serviceName: 'EngagementAnalysis',
      apiEndpoint: '/api/unified-analytics',
      autoConnect: false
    });
  }

  /**
   * Get engagement overview statistics
   */
  async getEngagementStats(workspaceId?: string): Promise<EngagementStats> {
    const data = await this.queryAPI<any>({
      endpoint: 'cross-platform-sentiment',
      params: workspaceId ? { workspace_id: workspaceId } : {}
    });

    if (!data || data.length === 0) {
      return this.getDefaultEngagementStats();
    }

    return this.safeTransform(
      [data],
      () => this.calculateEngagementStats(data),
      [this.getDefaultEngagementStats()]
    )[0];
  }

  /**
   * Get platform engagement breakdown
   */
  async getPlatformEngagement(filters: FilterOptions = {}, workspaceId?: string): Promise<PlatformEngagementData[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'platform-performance',
      params: workspaceId ? { workspace_id: workspaceId } : {}
    });

    if (!data || data.length === 0) {
      return [];
    }

    const platformColors: Record<string, string> = {
      'instagram': '#ff6b9d',
      'tiktok': '#667eea',
      'twitter': '#26d0ce',
      'linkedin': '#6366f1',
      'facebook': '#8b5cf6',
      'youtube': '#f72585'
    };

    return this.safeTransform(
      data,
      (row) => ({
        platform: row.platform.charAt(0).toUpperCase() + row.platform.slice(1),
        engagementRate: Math.round((row.positive_ratio || 0) * 100) / 100,
        totalEngagements: row.total_posts || 0,
        posts: row.total_posts || 0,
        avgLikes: row.avg_likes || 0,
        avgComments: row.avg_comments || 0,
        avgShares: row.avg_shares || 0,
        totalReach: row.total_reach || row.total_posts || 0,
        color: platformColors[row.platform] || '#6b7280'
      }),
      []
    );
  }

  /**
   * Get content type performance data
   */
  async getContentTypePerformance(filters: FilterOptions = {}, workspaceId?: string): Promise<ContentTypePerformance[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'cross-platform-sentiment',
      params: workspaceId ? { workspace_id: workspaceId } : {}
    });

    if (!data || data.length === 0) {
      return [];
    }

    const contentTypes = ['Text Post', 'Image', 'Video', 'Story', 'Reel'];

    return contentTypes.map((type, index) => {
      const baseData = data[index % data.length] || { post_count: 0, avg_confidence: 0 };
      const posts = baseData.post_count || 0;
      const confidence = baseData.avg_confidence || 0;

      return {
        type,
        engagementRate: Math.round(confidence * 100) / 100,
        posts,
        reach: baseData.total_reach || posts,
        avgLikes: baseData.avg_likes || 0,
        avgComments: baseData.avg_comments || 0,
        avgShares: baseData.avg_shares || 0,
        sentiment: confidence >= 0.65 ? 'positive' :
                  confidence >= 0.35 ? 'mixed' : 'neutral'
      };
    });
  }

  /**
   * Get engagement trends over time
   */
  async getEngagementTrends(timeRange: string = '7d', workspaceId?: string): Promise<EngagementTrend[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'sentiment-trends',
      params: { ...(workspaceId ? { workspace_id: workspaceId } : {}), timeRange }
    });

    if (!data || data.length === 0) {
      return [];
    }

    return this.safeTransform(
      data,
      (row) => {
        const totalSentiment = (row.positive || 0) + (row.negative || 0) + (row.neutral || 0);
        return {
          date: row.date,
          likes: row.likes || 0,
          comments: row.comments || 0,
          shares: row.shares || 0,
          saves: row.saves || 0,
          views: row.views || 0,
          reach: row.reach || totalSentiment,
          engagementRate: row.engagement_rate || (totalSentiment > 0 ? Math.round((row.positive || 0) / totalSentiment * 100) / 100 : 0)
        };
      },
      []
    );
  }

  /**
   * Get top performing posts
   */
  async getTopPerformingPosts(filters: FilterOptions = {}, limit: number = 10, workspaceId?: string): Promise<TopPerformingPost[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'sample-posts',
      params: { ...(workspaceId ? { workspace_id: workspaceId } : {}), limit: limit.toString() }
    });

    if (!data || data.length === 0) {
      return [];
    }

    const contentTypes = ['Text Post', 'Image', 'Video', 'Story', 'Reel'];

    const posts = this.safeTransform(
      data,
      (row, index) => ({
        id: row.id,
        text: row.text || `Post ${row.id}`,
        author: row.author || `user_${row.id}`,
        platform: row.platform,
        contentType: contentTypes[index % contentTypes.length],
        engagement: {
          likes: row.likes || 0,
          comments: row.comments || 0,
          shares: row.shares || 0,
          saves: row.saves || 0,
          rate: row.engagement_rate || Math.round((row.confidence || 0) * 100) / 100
        },
        reach: row.reach || 0,
        views: row.views || 0,
        timestamp: row.timestamp || new Date().toISOString(),
        performance_rank: index + 1
      }),
      []
    );

    return posts.sort((a, b) => b.engagement.rate - a.engagement.rate);
  }

  /**
   * Get engagement timing analysis
   */
  async getEngagementTiming(workspaceId?: string): Promise<EngagementTiming[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'hourly-patterns',
      params: workspaceId ? { workspace_id: workspaceId } : {}
    });

    if (!data || data.length === 0) {
      return [];
    }

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    return this.safeTransform(
      data,
      (row) => {
        const totalActivity = (row.positive || 0) + (row.negative || 0) + (row.neutral || 0);
        return {
          hour_of_day: row.hour_of_day,
          day_of_week: row.hour_of_day % 7,
          day_name: dayNames[row.hour_of_day % 7],
          avg_engagement_rate: row.avg_engagement_rate || (totalActivity > 0 ? Math.round((row.positive || 0) / totalActivity * 100) / 100 : 0),
          total_posts: totalActivity,
          total_engagements: row.total_engagements || totalActivity
        };
      },
      []
    );
  }

  /**
   * Get hashtag performance analysis
   */
  async getHashtagPerformance(limit: number = 20, workspaceId?: string): Promise<HashtagPerformance[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'platform-performance',
      params: workspaceId ? { workspace_id: workspaceId } : {}
    });

    if (!data || data.length === 0) {
      return [];
    }

    // TODO: Get actual hashtag data from database
    const hashtags = [
      '#social', '#media', '#content', '#engagement', '#marketing',
      '#digital', '#brand', '#community', '#viral', '#trending',
      '#analytics', '#growth', '#strategy', '#influence', '#reach',
      '#impression', '#conversion', '#roi', '#kpi', '#metrics'
    ];

    return hashtags.slice(0, limit).map((hashtag, index) => {
      const platformData = data[index % data.length] || { total_posts: 0, positive_ratio: 0.3 };
      return {
        hashtag,
        usage_count: Math.floor(platformData.total_posts * (0.8 - index * 0.03)),
        avg_boost: Math.round((1.2 + (index % 10) * 0.08) * 100) / 100,
        avg_engagement_rate: Math.round((platformData.positive_ratio || 0.3) * 8 * 100) / 100,
        impact_score: Math.round((platformData.positive_ratio || 0.3) * 10 * 100) / 100
      };
    });
  }

  /**
   * Export engagement analysis data
   */
  async exportEngagementData(filters: FilterOptions = {}, workspaceId?: string): Promise<ExportData<TopPerformingPost>> {
    const [stats, platforms, contentTypes, trends, topPosts, timing, hashtags] = await Promise.all([
      this.getEngagementStats(workspaceId),
      this.getPlatformEngagement(filters, workspaceId),
      this.getContentTypePerformance(filters, workspaceId),
      this.getEngagementTrends(filters.timeRange || '7d', workspaceId),
      this.getTopPerformingPosts(filters, 50, workspaceId),
      this.getEngagementTiming(workspaceId),
      this.getHashtagPerformance(50, workspaceId)
    ]);

    return {
      exportDate: new Date().toISOString(),
      filters,
      data: topPosts,
      summary: {
        stats,
        platforms,
        contentTypes,
        trends,
        timing,
        hashtags
      }
    };
  }

  // ========== Private Helper Methods ==========

  /**
   * Get default engagement statistics
   */
  private getDefaultEngagementStats(): EngagementStats {
    return {
      totalEngagements: 0,
      averageRate: 0,
      totalReach: 0,
      bestPerformingPost: 0,
      totalPosts: 0,
      totalImpressions: 0,
      avgLikes: 0,
      avgComments: 0,
      avgShares: 0
    };
  }

  /**
   * Calculate engagement statistics from raw data
   */
  private calculateEngagementStats(data: any[]): EngagementStats {
    const totalPosts = data.reduce((sum, item) => sum + (item.post_count || 0), 0);
    const avgConfidence = data.reduce((sum, item) => sum + (item.avg_confidence || 0), 0) / (data.length || 1);
    const totalEngagements = data.reduce((sum, item) => sum + (item.total_engagements || item.post_count || 0), 0);
    const totalReach = data.reduce((sum, item) => sum + (item.total_reach || item.post_count || 0), 0);
    const totalLikes = data.reduce((sum, item) => sum + (item.avg_likes || 0), 0);
    const totalComments = data.reduce((sum, item) => sum + (item.avg_comments || 0), 0);
    const totalShares = data.reduce((sum, item) => sum + (item.avg_shares || 0), 0);

    return {
      totalEngagements,
      averageRate: Math.round(avgConfidence * 100) / 100,
      totalReach,
      bestPerformingPost: Math.max(...data.map(item => item.post_count || 0)),
      totalPosts,
      totalImpressions: data.reduce((sum, item) => sum + (item.total_impressions || item.post_count || 0), 0),
      avgLikes: data.length > 0 ? Math.round(totalLikes / data.length) : 0,
      avgComments: data.length > 0 ? Math.round(totalComments / data.length) : 0,
      avgShares: data.length > 0 ? Math.round(totalShares / data.length) : 0
    };
  }
}

export const engagementAnalysisDb = new EngagementAnalysisDatabase();
