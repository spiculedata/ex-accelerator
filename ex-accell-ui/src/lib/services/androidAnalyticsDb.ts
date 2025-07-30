// DuckDB connection and query service for Android Analytics data
// This service provides real DuckDB SQL queries for Princeton SMART research data via server-side API

interface AndroidAnalyticsSummary {
  totalSessions: number;
  totalScreenshots: number;
  uniqueApps: number;
  sessionDuration: number;
  totalEvents: number;
  activeUsers: number;
}

class AndroidAnalyticsDatabase {
  private initialized = false;

  async connect() {
    if (this.initialized) return; // Already connected

    try {
      // Test connection with a simple stats query
      await this.queryAndroidAnalyticsAPI('stats');
      this.initialized = true;
      console.log('AndroidAnalyticsDatabase connected successfully');
    } catch (error) {
      console.error('Failed to connect to AndroidAnalyticsDatabase:', error);
      this.initialized = true; // Continue with fallback mode
    }
  }

  private async queryAndroidAnalyticsAPI(queryType: string, params: any = {}): Promise<any[]> {
    try {
      const urlParams = new URLSearchParams();
      urlParams.append('type', queryType);
      
      // Add any additional parameters
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          urlParams.append(key, String(value));
        }
      });
      
      const response = await fetch(`/api/android-analytics?${urlParams.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error || 'Android analytics API query failed');
      }
    } catch (error) {
      console.error('Android analytics API error:', error);
      throw error;
    }
  }

  async getAccessibilityEvents(limit: number = 50) {
    if (!this.initialized) await this.connect();

    try {
      return await this.queryAndroidAnalyticsAPI('accessibility-events', { limit });
    } catch (error) {
      console.error('Error fetching accessibility events:', error);
      return [];
    }
  }

  async getAppSegments(limit: number = 50) {
    if (!this.initialized) await this.connect();

    try {
      return await this.queryAndroidAnalyticsAPI('app-segments', { limit });
    } catch (error) {
      console.error('Error fetching app segments:', error);
      return [];
    }
  }

  async getScreenshots(limit: number = 50) {
    if (!this.initialized) await this.connect();

    try {
      return await this.queryAndroidAnalyticsAPI('screenshots', { limit });
    } catch (error) {
      console.error('Error fetching screenshots:', error);
      return [];
    }
  }

  async getSessionAnalytics(limit: number = 20) {
    if (!this.initialized) await this.connect();

    try {
      return await this.queryAndroidAnalyticsAPI('session-analytics', { limit });
    } catch (error) {
      console.error('Error fetching session analytics:', error);
      return [];
    }
  }

  async getAppUsageAnalytics(limit: number = 20) {
    if (!this.initialized) await this.connect();

    try {
      return await this.queryAndroidAnalyticsAPI('app-analytics', { limit });
    } catch (error) {
      console.error('Error fetching app analytics:', error);
      return [];
    }
  }

  async getUserBehaviorPatterns(limit: number = 20) {
    if (!this.initialized) await this.connect();

    try {
      return await this.queryAndroidAnalyticsAPI('user-patterns', { limit });
    } catch (error) {
      console.error('Error fetching user patterns:', error);
      return [];
    }
  }

  // Get aggregated analytics for dashboard summary
  async getAnalyticsSummary(): Promise<AndroidAnalyticsSummary> {
    if (!this.initialized) await this.connect();

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
      
      return {
        totalSessions: 0,
        totalScreenshots: 0,
        uniqueApps: 0,
        sessionDuration: 0,
        totalEvents: 0,
        activeUsers: 0
      };
    } catch (error) {
      console.error('Error fetching analytics summary:', error);
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

  // Get top apps by usage time
  async getTopApps(limit: number = 10) {
    if (!this.initialized) await this.connect();

    try {
      return await this.queryAndroidAnalyticsAPI('top-apps', { limit });
    } catch (error) {
      console.error('Error fetching top apps:', error);
      return [];
    }
  }

  // Get app usage timeline
  async getAppUsageTimeline(limit: number = 50) {
    if (!this.initialized) await this.connect();

    try {
      return await this.queryAndroidAnalyticsAPI('timeline', { limit });
    } catch (error) {
      console.error('Error fetching app timeline:', error);
      return [];
    }
  }

  // Get screen text analysis
  async getScreenTextAnalysis(limit: number = 50) {
    if (!this.initialized) await this.connect();

    try {
      return await this.queryAndroidAnalyticsAPI('screen-text', { limit });
    } catch (error) {
      console.error('Error fetching screen text:', error);
      return [];
    }
  }

  // Get URL visits
  async getUrlVisits(limit: number = 50) {
    if (!this.initialized) await this.connect();

    try {
      return await this.queryAndroidAnalyticsAPI('urls', { limit });
    } catch (error) {
      console.error('Error fetching URL visits:', error);
      return [];
    }
  }

  async close() {
    // In browser environment, no cleanup needed
    this.initialized = false;
  }
}

export const androidAnalyticsDb = new AndroidAnalyticsDatabase();