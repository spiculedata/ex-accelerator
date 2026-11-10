// Android Analytics data (Princeton SMART / Screenlake research kit) via the unified analytics API.
// Every method throws when a request fails, so the page can show an error instead of an empty module.

import { BaseDatabaseService, type QueryResult } from './baseDatabaseService';
import type {
  AndroidAccessibilityEvent,
  AndroidAnalyticsSummary,
  AndroidAppSegment,
  AndroidScreenshot,
  DataResult
} from './types/databaseTypes';

interface AndroidStatsRow {
  total_sessions?: number;
  total_screenshots?: number;
  unique_apps?: number;
  total_duration_minutes?: number;
  total_events?: number;
  active_users?: number;
}

const EMPTY_SUMMARY: Readonly<AndroidAnalyticsSummary> = {
  totalSessions: 0,
  totalScreenshots: 0,
  uniqueApps: 0,
  sessionDuration: 0,
  totalEvents: 0,
  activeUsers: 0
};

class AndroidAnalyticsDatabase extends BaseDatabaseService {
  constructor() {
    super({
      serviceName: 'AndroidAnalytics',
      apiEndpoint: '/api/unified-analytics',
      autoConnect: false
    });
  }

  private rows<T>(endpoint: string, limit?: number): Promise<T[]> {
    return this.queryAPIOrThrow<T>({ endpoint, params: limit === undefined ? {} : { limit: String(limit) } });
  }

  getAccessibilityEvents(limit = 50): Promise<AndroidAccessibilityEvent[]> {
    return this.rows('accessibility-events', limit);
  }

  getAppSegments(limit = 50): Promise<AndroidAppSegment[]> {
    return this.rows('app-segments', limit);
  }

  getScreenshots(limit = 50): Promise<AndroidScreenshot[]> {
    return this.rows('screenshots', limit);
  }

  getSessionAnalytics(limit = 20): Promise<QueryResult[]> {
    return this.rows('session-analytics', limit);
  }

  getAppUsageAnalytics(limit = 20): Promise<QueryResult[]> {
    return this.rows('app-analytics', limit);
  }

  getUserBehaviorPatterns(limit = 20): Promise<QueryResult[]> {
    return this.rows('user-patterns', limit);
  }

  /** Headline counts; zeros flagged as no data when nothing is loaded. */
  async getAnalyticsSummary(): Promise<DataResult<AndroidAnalyticsSummary>> {
    const [stats] = await this.rows<AndroidStatsRow>('stats');
    if (!stats) return { data: { ...EMPTY_SUMMARY }, hasData: false };

    return {
      data: {
        totalSessions: stats.total_sessions ?? 0,
        totalScreenshots: stats.total_screenshots ?? 0,
        uniqueApps: stats.unique_apps ?? 0,
        sessionDuration: stats.total_duration_minutes ?? 0,
        totalEvents: stats.total_events ?? 0,
        activeUsers: stats.active_users ?? 0
      },
      hasData: true
    };
  }
}

export const androidAnalyticsDb = new AndroidAnalyticsDatabase();
