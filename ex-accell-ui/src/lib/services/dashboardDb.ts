// Database connection and query service for dashboard data
// Uses PostgreSQL with pg_duckdb extension via unified analytics API

import { BaseDatabaseService } from './baseDatabaseService';
import type {
  DashboardStats,
  DataSource,
  TopLanguage,
  TopTopic,
  CrawlingActivity,
  RecentActivity
} from './types/databaseTypes';

interface SentimentBreakdown {
  sentiment: string;
  count: number;
  percentage: number;
}

/**
 * Dashboard Database Service
 * Provides comprehensive dashboard metrics from PostgreSQL with pg_duckdb extension
 */
class DashboardDatabase extends BaseDatabaseService {
  constructor() {
    super({
      serviceName: 'Dashboard',
      apiEndpoint: '/api/unified-analytics',
      autoConnect: false
    });
  }

  /**
   * Get comprehensive dashboard statistics
   */
  async getDashboardStats(workspaceId?: string): Promise<DashboardStats> {
    const data = await this.queryAPI<any>({
      endpoint: 'cross-platform-sentiment',
      params: workspaceId ? { workspace_id: workspaceId } : {}
    });

    if (!data || data.length === 0) {
      return this.getDefaultDashboardStats();
    }

    return this.safeTransform(
      [data],
      () => this.calculateDashboardStats(data),
      [this.getDefaultDashboardStats()]
    )[0];
  }

  /**
   * Get data sources with statistics
   */
  async getDataSources(workspaceId?: string): Promise<DataSource[]> {
    // Get platform performance stats
    const data = await this.queryAPI<any>({
      endpoint: 'platform-performance',
      params: workspaceId ? { workspace_id: workspaceId } : {}
    });

    if (!data || data.length === 0) {
      return [];
    }

    // Try to get dataset names for richer display
    let datasetNames: Record<string, string> = {};
    try {
      const dsParams = workspaceId ? `?workspace_id=${workspaceId}` : '?status=available';
      const dsRes = await fetch(`/api/datasets${dsParams}`);
      const dsData = await dsRes.json();
      if (dsData.datasets) {
        for (const ds of dsData.datasets) {
          const platform = (ds.source_platform || '').toLowerCase();
          if (platform) {
            datasetNames[platform] = ds.name || ds.dataset_name || platform;
          }
        }
      }
    } catch { /* fallback to platform name */ }

    const totalPosts = data.reduce((sum: number, item: any) => sum + item.total_posts, 0);

    return this.safeTransform(
      data,
      (source) => {
        const platformKey = (source.platform || '').toLowerCase();
        const datasetName = datasetNames[platformKey];
        const platformLabel = source.platform.charAt(0).toUpperCase() + source.platform.slice(1);
        return {
          name: datasetName || platformLabel,
          platform: platformLabel,
          posts: source.total_posts,
          percentage: totalPosts > 0 ? Math.round((source.total_posts / totalPosts * 100) * 100) / 100 : 0,
          status: (source.total_posts > 0 ? 'active' : 'inactive') as 'active' | 'inactive' | 'error',
          last_sync: new Date().toISOString(),
          health: Math.round((source.avg_confidence || 0.8) * 100)
        };
      },
      []
    );
  }

  /**
   * Get sentiment breakdown across all platforms
   */
  async getSentimentBreakdown(workspaceId?: string): Promise<SentimentBreakdown[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'cross-platform-sentiment',
      params: workspaceId ? { workspace_id: workspaceId } : {}
    });

    if (!data || data.length === 0) {
      return [];
    }

    return this.safeTransform(
      [data],
      () => this.aggregateSentimentBreakdown(data),
      []
    )[0];
  }

  /**
   * Get top languages from platform data
   */
  async getTopLanguages(workspaceId?: string): Promise<TopLanguage[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'language-stats',
      params: workspaceId ? { workspace_id: workspaceId } : {}
    });

    if (!data || data.length === 0) {
      return [];
    }

    const totalPosts = data.reduce((sum: number, item: any) => sum + (item.post_count || 0), 0);

    return data.map((lang: any) => ({
      language: lang.language,
      count: lang.post_count || 0,
      percentage: totalPosts > 0 ? Math.round(((lang.post_count || 0) / totalPosts * 100) * 100) / 100 : 0
    }));
  }

  /**
   * Get top topics from the topics table
   */
  async getTopTopics(workspaceId?: string): Promise<TopTopic[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'topics-overview',
      params: workspaceId ? { workspace_id: workspaceId } : {}
    });

    if (!data || data.length === 0) {
      return [];
    }

    // Prefer social-derived topics over GDELT news themes for dashboards
    const socialTopics = data.filter((t: any) => !t.topic_id?.startsWith('gdelt_'));
    const topicsToShow = socialTopics.length > 0 ? socialTopics : data;

    // Return top 5 topics by size
    return topicsToShow
      .sort((a: any, b: any) => (b.size || 0) - (a.size || 0))
      .slice(0, 5)
      .map((topic: any) => ({
        topic: topic.name,
        posts: topic.size || 0,
        trend: (topic.coherence_score || 0) > 0.5 ? 'up' as const : 'stable' as const
      }));
  }

  /**
   * Get crawling activity by hour
   */
  async getCrawlingActivity(workspaceId?: string): Promise<CrawlingActivity[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'hourly-patterns',
      params: workspaceId ? { workspace_id: workspaceId } : {}
    });

    if (!data || data.length === 0) {
      return [];
    }

    return this.safeTransform(
      data,
      (row) => ({
        time: `${String(row.hour_of_day).padStart(2, '0')}:00`,
        posts: (row.positive || 0) + (row.negative || 0) + (row.neutral || 0),
        positive: row.positive || 0,
        negative: row.negative || 0,
        neutral: row.neutral || 0
      }),
      []
    );
  }

  /**
   * Get recent activity feed
   */
  async getRecentActivity(workspaceId?: string): Promise<RecentActivity[]> {
    const data = await this.queryAPI<any>({
      endpoint: 'sample-posts',
      params: { ...(workspaceId ? { workspace_id: workspaceId } : {}), limit: 10 }
    });

    if (!data || data.length === 0) {
      return [];
    }

    const activityTypes = ['crawl', 'analysis', 'processing', 'export'];
    const statuses = ['completed', 'active', 'pending'];

    return this.safeTransform(
      data,
      (post, index) => ({
        id: post.id,
        type: activityTypes[index % activityTypes.length],
        message: `Processed ${post.platform} content: "${post.text.substring(0, 50)}..."`,
        timestamp: post.timestamp,
        status: statuses[index % statuses.length]
      }),
      []
    );
  }

  // ========== Private Helper Methods ==========

  /**
   * Get default dashboard statistics
   */
  private getDefaultDashboardStats(): DashboardStats {
    return {
      total_posts: 0,
      processing_rate: 0,
      data_quality: 0,
      total_sources: 0,
      active_crawlers: 0,
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Calculate dashboard statistics from raw data
   */
  private calculateDashboardStats(data: any[]): DashboardStats {
    const totalPosts = data.reduce((sum, item) => sum + item.post_count, 0);
    // Processing rate: posts per hour (total posts / 24h window)
    const processingRate = Math.round((totalPosts / 24) * 100) / 100;
    // Data quality: % of posts that have sentiment classification (non-unknown)
    const classifiedPosts = data
      .filter(item => !item.sentiment_category.toLowerCase().includes('unknown'))
      .reduce((sum, item) => sum + item.post_count, 0);
    const dataQuality = totalPosts > 0 ? Math.round((classifiedPosts / totalPosts) * 10000) / 100 : 0;

    return {
      total_posts: totalPosts,
      processing_rate: processingRate,
      data_quality: dataQuality,
      total_sources: data.length,
      active_crawlers: Math.min(data.length, 8),
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Aggregate sentiment breakdown
   */
  private aggregateSentimentBreakdown(data: any[]): SentimentBreakdown[] {
    const sentimentMap = new Map<string, { sentiment: string; count: number; percentage: number }>();

    data.forEach(row => {
      const sentiment = row.sentiment_category.toLowerCase().includes('positive') ? 'positive' :
                       row.sentiment_category.toLowerCase().includes('negative') ? 'negative' : 'neutral';

      if (!sentimentMap.has(sentiment)) {
        sentimentMap.set(sentiment, { sentiment, count: 0, percentage: 0 });
      }

      const current = sentimentMap.get(sentiment)!;
      current.count += row.post_count;
    });

    // Calculate percentages
    const total = Array.from(sentimentMap.values()).reduce((sum, item) => sum + item.count, 0);
    sentimentMap.forEach(item => {
      item.percentage = total > 0 ? Math.round((item.count / total * 100) * 100) / 100 : 0;
    });

    return Array.from(sentimentMap.values());
  }

  /**
   * Determine trend direction based on coherence score
   */
  private getTrendDirection(coherenceScore: number): 'up' | 'down' | 'stable' {
    if (coherenceScore > 0.8) return 'up';
    if (coherenceScore < 0.6) return 'down';
    return 'stable';
  }
}

export const dashboardDb = new DashboardDatabase();
