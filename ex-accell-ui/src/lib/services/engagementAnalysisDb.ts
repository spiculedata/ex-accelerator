// Database connection and query service for Engagement Analysis data
// Uses PostgreSQL with pg_duckdb extension via unified analytics API

import { platformColour } from '$lib/utils/categoryColours';
import { currentRangeQuery } from '$lib/utils/filterRange';
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

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];


/** The API returns numeric columns as strings. */
const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const round = (value: number, places: number): number => Number(value.toFixed(places));

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
    const [row] = await this.queryAPI<any>({ endpoint: 'engagement-stats', params: this.scope(workspaceId) });
    if (!row) return this.getDefaultEngagementStats();

    return {
      totalPosts: toNumber(row.total_posts),
      totalEngagements: toNumber(row.total_engagements),
      averageRate: round(toNumber(row.average_rate), 2),
      totalReach: toNumber(row.total_reach),
      totalImpressions: toNumber(row.total_impressions),
      bestPerformingPost: toNumber(row.best_post_engagements),
      avgLikes: Math.round(toNumber(row.avg_likes)),
      avgComments: Math.round(toNumber(row.avg_comments)),
      avgShares: Math.round(toNumber(row.avg_shares))
    };
  }

  /**
   * Get platform engagement breakdown
   */
  async getPlatformEngagement(filters: FilterOptions = {}, workspaceId?: string): Promise<PlatformEngagementData[]> {
    const rows = await this.queryAPI<any>({ endpoint: 'engagement-platforms', params: this.scope(workspaceId) });

    return rows.map((row) => ({
      platform: String(row.platform).charAt(0).toUpperCase() + String(row.platform).slice(1),
      engagementRate: round(toNumber(row.engagement_rate), 2),
      totalEngagements: toNumber(row.total_engagements),
      posts: toNumber(row.posts),
      avgLikes: Math.round(toNumber(row.avg_likes)),
      avgComments: Math.round(toNumber(row.avg_comments)),
      avgShares: Math.round(toNumber(row.avg_shares)),
      totalReach: toNumber(row.total_reach),
      color: platformColour(String(row.platform))
    }));
  }

  /**
   * Get content type performance data
   */
  async getContentTypePerformance(filters: FilterOptions = {}, workspaceId?: string): Promise<ContentTypePerformance[]> {
    const rows = await this.queryAPI<any>({ endpoint: 'engagement-content-types', params: this.scope(workspaceId) });

    return rows.map((row) => {
      const positiveShare = toNumber(row.positive_share);
      return {
        type: String(row.content_type),
        engagementRate: round(toNumber(row.engagement_rate), 2),
        posts: toNumber(row.posts),
        reach: toNumber(row.reach),
        avgLikes: Math.round(toNumber(row.avg_likes)),
        avgComments: Math.round(toNumber(row.avg_comments)),
        avgShares: Math.round(toNumber(row.avg_shares)),
        sentiment: positiveShare >= 0.65 ? 'positive' : positiveShare >= 0.3 ? 'mixed' : 'negative'
      };
    });
  }

  /**
   * Get engagement trends over time
   */
  async getEngagementTrends(timeRange: string = '7d', workspaceId?: string): Promise<EngagementTrend[]> {
    const rows = await this.queryAPI<any>({ endpoint: 'engagement-trends', params: { ...this.scope(workspaceId), timeRange } });

    return rows.map((row) => ({
      date: String(row.date),
      likes: toNumber(row.likes),
      comments: toNumber(row.comments),
      shares: toNumber(row.shares),
      saves: toNumber(row.saves),
      views: toNumber(row.views),
      reach: toNumber(row.reach),
      engagementRate: round(toNumber(row.engagement_rate), 2)
    }));
  }

  /**
   * Get top performing posts, ranked by total engagements
   */
  async getTopPerformingPosts(filters: FilterOptions = {}, limit: number = 10, workspaceId?: string): Promise<TopPerformingPost[]> {
    const rows = await this.queryAPI<any>({
      endpoint: 'engagement-top-posts',
      params: { ...this.scope(workspaceId), limit: String(limit) }
    });

    return rows.map((row, index) => ({
      id: row.id,
      text: row.text || `Post ${row.id}`,
      author: row.author || 'unknown',
      platform: row.platform,
      contentType: String(row.content_type),
      engagement: {
        likes: toNumber(row.likes),
        comments: toNumber(row.comments),
        shares: toNumber(row.shares),
        saves: toNumber(row.saves),
        rate: round(toNumber(row.engagement_rate), 2)
      },
      reach: toNumber(row.reach),
      views: toNumber(row.views),
      timestamp: String(row.timestamp),
      performance_rank: index + 1
    }));
  }

  /**
   * Get engagement by hour of day and day of week
   */
  async getEngagementTiming(workspaceId?: string): Promise<EngagementTiming[]> {
    const rows = await this.queryAPI<any>({ endpoint: 'engagement-timing', params: this.scope(workspaceId) });

    return rows.map((row) => ({
      hour_of_day: toNumber(row.hour_of_day),
      day_of_week: toNumber(row.day_of_week),
      day_name: DAY_NAMES[toNumber(row.day_of_week)] ?? 'Unknown',
      avg_engagement_rate: round(toNumber(row.avg_engagement_rate), 2),
      total_posts: toNumber(row.total_posts),
      total_engagements: toNumber(row.total_engagements)
    }));
  }

  /**
   * Get hashtag performance analysis
   */
  async getHashtagPerformance(limit: number = 20, workspaceId?: string): Promise<HashtagPerformance[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'hashtag-analysis',
      params: {
        limit: String(limit),
        ...(workspaceId ? { workspace_id: workspaceId } : {})
      }
    });

    const hashtags = data?.hashtags || [];
    if (hashtags.length === 0) {
      return [];
    }

    return hashtags.map((h: any) => ({
      hashtag: '#' + h.hashtag,
      usage_count: parseInt(h.count) || 0,
      avg_boost: 1.0,
      avg_engagement_rate: parseInt(h.post_count) > 0 ? Math.round((parseInt(h.count) / parseInt(h.post_count)) * 100) / 100 : 0,
      impact_score: Math.min(Math.round(Math.log2(parseInt(h.count) + 1) * 10) / 10, 10)
    }));
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

  private scope(workspaceId?: string): Record<string, string> {
    return { ...(workspaceId ? { workspace_id: workspaceId } : {}), ...currentRangeQuery() };
  }
}

export const engagementAnalysisDb = new EngagementAnalysisDatabase();
