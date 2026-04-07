// Database connection and query service for Android Analytics data
// Uses PostgreSQL with pg_duckdb extension via unified analytics API

import { BaseDatabaseService } from './baseDatabaseService';
import type { AndroidAnalyticsSummary, AppUsage, ScreenData } from './types/databaseTypes';

interface UrlVisit {
  id: number;
  url: string;
  domain: string;
  visit_count: number;
  avg_duration_seconds: number;
  last_visited: string;
  confidence_score: number;
}

/**
 * Android Analytics Database Service
 * Provides Android device analytics data from PostgreSQL with pg_duckdb extension
 */
class AndroidAnalyticsDatabase extends BaseDatabaseService {
  constructor() {
    super({
      serviceName: 'AndroidAnalytics',
      apiEndpoint: '/api/unified-analytics',
      autoConnect: false
    });
  }

  /**
   * Query Android Analytics API specifically
   */
  private async queryAndroidAnalyticsAPI<T = any>(queryType: string, params: any = {}): Promise<T[]> {
    try {
      const queryParams: Record<string, any> = { ...params };

      return await this.queryAPI<T>({
        endpoint: queryType,
        params: queryParams
      });
    } catch (error) {
      this.log('error', `Android analytics query failed for ${queryType}`);
      return [];
    }
  }

  /**
   * Get accessibility events
   */
  async getAccessibilityEvents(limit: number = 50): Promise<any[]> {
    return this.queryAndroidAnalyticsAPI('accessibility-events', { limit: limit.toString() });
  }

  /**
   * Get app segments
   */
  async getAppSegments(limit: number = 50): Promise<any[]> {
    return this.queryAndroidAnalyticsAPI('app-segments', { limit: limit.toString() });
  }

  /**
   * Get screenshots
   */
  async getScreenshots(limit: number = 50): Promise<any[]> {
    return this.queryAndroidAnalyticsAPI('screenshots', { limit: limit.toString() });
  }

  /**
   * Get session analytics
   */
  async getSessionAnalytics(limit: number = 20): Promise<any[]> {
    return this.queryAndroidAnalyticsAPI('session-analytics', { limit: limit.toString() });
  }

  /**
   * Get app usage analytics
   */
  async getAppUsageAnalytics(limit: number = 20): Promise<any[]> {
    return this.queryAndroidAnalyticsAPI('app-analytics', { limit: limit.toString() });
  }

  /**
   * Get user behavior patterns
   */
  async getUserBehaviorPatterns(limit: number = 20): Promise<any[]> {
    return this.queryAndroidAnalyticsAPI('user-patterns', { limit: limit.toString() });
  }

  /**
   * Get aggregated analytics summary
   */
  async getAnalyticsSummary(): Promise<AndroidAnalyticsSummary & { isDemo?: boolean }> {
    try {
      const result = await this.queryAndroidAnalyticsAPI('stats');

      if (result.length > 0) {
        const stats = result[0];
        return {
          totalSessions: stats.total_sessions || 0,
          totalScreenshots: stats.total_screenshots || 0,
          uniqueApps: stats.unique_apps || 0,
          sessionDuration: stats.total_duration_minutes || 0,
          totalEvents: stats.total_events || 0,
          activeUsers: stats.active_users || 0
        };
      }

      return { ...this.getDefaultAndroidSummary(), isDemo: true };
    } catch (error) {
      this.log('error', 'Failed to fetch analytics summary');
      return { ...this.getDefaultAndroidSummary(), isDemo: true };
    }
  }

  /**
   * Get top apps by usage time (fallback to unified API)
   * Note: Returns demo data derived from social analytics platforms since no real Android tables exist.
   */
  async getTopApps(limit: number = 10): Promise<{ data: AppUsage[]; isDemo: boolean }> {
    // Fallback to unified analytics for now
    const data = await this.queryAPI<any>({
      endpoint: 'platform-performance'
    });

    if (!data || data.length === 0) {
      return { data: [], isDemo: true };
    }

    const apps = this.safeTransform(
      data.slice(0, limit),
      (item, index) => ({
        app_name: item.platform.charAt(0).toUpperCase() + item.platform.slice(1),
        package_name: `com.${item.platform}.app`,
        usage_time: Math.round(item.total_posts * 2.5),
        session_count: item.total_posts,
        last_used: new Date().toISOString()
      }),
      []
    );

    return { data: apps, isDemo: true };
  }

  /**
   * Get app usage timeline
   * Note: Returns demo data derived from sentiment trends since no real Android tables exist.
   */
  async getAppUsageTimeline(limit: number = 50): Promise<{ data: any[]; isDemo: boolean }> {
    const data = await this.queryAPI<any>({
      endpoint: 'sentiment-trends',
      params: { timeRange: '7d' }
    });

    if (!data || data.length === 0) {
      return { data: [], isDemo: true };
    }

    const timeline = this.safeTransform(
      data.slice(0, limit),
      (item, index) => {
        const totalSentiment = (item.positive || 0) + (item.negative || 0) + (item.neutral || 0);
        return {
          id: index + 1,
          date: item.date,
          app_name: 'Social Media App',
          usage_minutes: totalSentiment * 2,
          positive_interactions: item.positive || 0,
          negative_interactions: item.negative || 0,
          neutral_interactions: item.neutral || 0,
          total_interactions: totalSentiment
        };
      },
      []
    );

    return { data: timeline, isDemo: true };
  }

  /**
   * Get screen text analysis
   * Note: Returns demo data derived from sample posts since no real Android tables exist.
   */
  async getScreenTextAnalysis(limit: number = 50): Promise<{ data: ScreenData[]; isDemo: boolean }> {
    const data = await this.queryAPI<any>({
      endpoint: 'sample-posts',
      params: { limit: limit.toString() }
    });

    if (!data || data.length === 0) {
      return { data: [], isDemo: true };
    }

    const screens = this.safeTransform(
      data,
      (post, index) => ({
        screen_id: index + 1,
        timestamp: post.timestamp,
        screen_text: [post.text],
        app_context: post.platform,
        user_interaction: 'view'
      }),
      []
    );

    return { data: screens, isDemo: true };
  }

  /**
   * Get URL visits
   * Note: Returns demo data derived from platform performance since no real Android tables exist.
   */
  async getUrlVisits(limit: number = 50): Promise<{ data: UrlVisit[]; isDemo: boolean }> {
    const data = await this.queryAPI<any>({
      endpoint: 'platform-performance'
    });

    if (!data || data.length === 0) {
      return { data: [], isDemo: true };
    }

    const urls: UrlVisit[] = [];
    data.forEach((item: any, index: number) => {
      for (let i = 0; i < Math.min(item.total_posts / 10, 10); i++) {
        const seed = (index * 10 + i);
        urls.push({
          id: urls.length + 1,
          url: `https://${item.platform}.com/post/${index}_${i}`,
          domain: `${item.platform}.com`,
          visit_count: (seed % 50) + 1,
          avg_duration_seconds: (seed * 7 % 300) + 30,
          last_visited: new Date().toISOString(),
          confidence_score: Math.round((item.avg_confidence || 0.8) * 100) / 100
        });
      }
    });

    return { data: urls.slice(0, limit), isDemo: true };
  }

  // ========== Private Helper Methods ==========

  /**
   * Get default Android summary
   */
  private getDefaultAndroidSummary(): AndroidAnalyticsSummary {
    return {
      totalSessions: 0,
      totalScreenshots: 0,
      uniqueApps: 0,
      sessionDuration: 0,
      totalEvents: 0,
      activeUsers: 0
    };
  }
}

export const androidAnalyticsDb = new AndroidAnalyticsDatabase();
