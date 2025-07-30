// DuckDB connection and query service for Engagement Analysis data
// Server-side API integration for real database queries
class EngagementAnalysisDatabase {
  private initialized = false;
  private baseUrl = '/api/engagement-analysis';

  async connect() {
    if (this.initialized) return; // Already connected

    try {
      // Test API connection
      const response = await fetch(`${this.baseUrl}?type=stats`);
      if (!response.ok) {
        throw new Error(`API test failed: ${response.status} ${response.statusText}`);
      }
      
      this.initialized = true;
      console.log('EngagementAnalysisDatabase connected successfully');
    } catch (error) {
      console.error('Failed to connect to EngagementAnalysisDatabase:', error);
      throw error;
    }
  }

  private async queryAPI(queryType: string, params: Record<string, any> = {}): Promise<any[]> {
    const urlParams = new URLSearchParams({ type: queryType, ...params });
    const response = await fetch(`${this.baseUrl}?${urlParams}`);
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'API request failed');
    }
    
    return result.data;
  }

  // Get engagement overview statistics
  async getEngagementStats() {
    if (!this.initialized) await this.connect();

    try {
      const data = await this.queryAPI('stats');
      const stats = data[0] || {};

      return {
        totalEngagements: stats.total_engagements || 0,
        averageRate: Math.round((stats.average_rate || 0) * 10) / 10,
        totalReach: stats.total_reach || 0,
        bestPerformingPost: stats.best_performing_post || 0,
        totalPosts: stats.total_posts || 0,
        totalImpressions: stats.total_impressions || 0,
        avgLikes: Math.round(stats.avg_likes || 0),
        avgComments: Math.round(stats.avg_comments || 0),
        avgShares: Math.round(stats.avg_shares || 0)
      };
    } catch (error) {
      console.error('Error fetching engagement stats:', error);
      throw error;
    }
  }

  // Get platform engagement breakdown
  async getPlatformEngagement(filters: any = {}) {
    if (!this.initialized) await this.connect();

    try {
      const params = {
        platform: filters.platform || 'all',
        timeRange: filters.timeRange || '7d'
      };
      
      const data = await this.queryAPI('platforms', params);

      // Map results and add platform colors
      const platformColors = {
        'Instagram': '#ff6b9d',
        'TikTok': '#667eea', 
        'Twitter': '#26d0ce',
        'LinkedIn': '#6366f1',
        'Facebook': '#8b5cf6',
        'YouTube': '#f72585'
      };

      return data.map(row => ({
        platform: row.platform,
        engagementRate: Math.round((row.engagement_rate || 0) * 10) / 10,
        totalEngagements: row.total_engagements || 0,
        posts: row.posts || 0,
        avgLikes: Math.round(row.avg_likes || 0),
        avgComments: Math.round(row.avg_comments || 0), 
        avgShares: Math.round(row.avg_shares || 0),
        totalReach: row.total_reach || 0,
        color: platformColors[row.platform] || '#6b7280'
      }));
    } catch (error) {
      console.error('Error fetching platform engagement:', error);
      throw error;
    }
  }

  // Get content type performance data
  async getContentTypePerformance(filters: any = {}) {
    if (!this.initialized) await this.connect();

    try {
      const params = {
        contentType: filters.contentType || 'all',
        minEngagementRate: filters.minEngagementRate || 0,
        timeRange: filters.timeRange || '7d'
      };
      
      const data = await this.queryAPI('content-types', params);

      // Add sentiment based on engagement rate
      return data.map(row => ({
        type: row.type,
        engagementRate: Math.round((row.engagement_rate || 0) * 10) / 10,
        posts: row.posts || 0,
        reach: row.reach || 0,
        avgLikes: Math.round(row.avg_likes || 0),
        avgComments: Math.round(row.avg_comments || 0),
        avgShares: Math.round(row.avg_shares || 0),
        sentiment: row.engagement_rate >= 6 ? 'positive' : 
                  row.engagement_rate >= 3 ? 'mixed' : 'neutral'
      }));
    } catch (error) {
      console.error('Error fetching content type performance:', error);
      throw error;
    }
  }

  // Get engagement trends over time
  async getEngagementTrends(timeRange: string = '7d') {
    if (!this.initialized) await this.connect();

    try {
      const data = await this.queryAPI('trends', { timeRange });

      return data.map(row => ({
        date: row.date,
        likes: row.likes || 0,
        comments: row.comments || 0,
        shares: row.shares || 0,
        saves: row.saves || 0,
        views: row.views || 0,
        reach: row.reach || 0,
        engagementRate: Math.round((row.engagement_rate || 0) * 10) / 10
      }));
    } catch (error) {
      console.error('Error fetching engagement trends:', error);
      throw error;
    }
  }

  // Get top performing posts
  async getTopPerformingPosts(filters: any = {}, limit: number = 10) {
    if (!this.initialized) await this.connect();

    try {
      const params = {
        platform: filters.platform || 'all',
        contentType: filters.contentType || 'all',
        minEngagementRate: filters.minEngagementRate || 0,
        limit
      };
      
      const data = await this.queryAPI('top-posts', params);

      return data.map((row, index) => ({
        id: row.id,
        text: row.text || `Post ${row.id}`,
        author: row.author || 'Unknown',
        platform: row.platform,
        contentType: row.content_type,
        engagement: {
          likes: row.likes_count || 0,
          comments: row.comments_count || 0,
          shares: row.shares_count || 0,
          saves: row.saves_count || 0,
          rate: Math.round((row.engagement_rate || 0) * 10) / 10
        },
        reach: row.reach || 0,
        views: row.views_count || 0,
        timestamp: row.timestamp || new Date().toISOString(),
        performance_rank: index + 1
      }));
    } catch (error) {
      console.error('Error fetching top performing posts:', error);
      throw error;
    }
  }

  // Get engagement timing analysis
  async getEngagementTiming() {
    if (!this.initialized) await this.connect();

    try {
      const data = await this.queryAPI('timing');

      return data.map(row => ({
        hour_of_day: row.hour_of_day,
        day_of_week: row.day_of_week,
        day_name: row.day_name,
        avg_engagement_rate: Math.round((row.avg_engagement_rate || 0) * 100) / 100,
        total_posts: row.total_posts || 0,
        total_engagements: row.total_engagements || 0
      }));
    } catch (error) {
      console.error('Error fetching engagement timing:', error);
      throw error;
    }
  }

  // Get hashtag performance analysis
  async getHashtagPerformance(limit: number = 20) {
    if (!this.initialized) await this.connect();

    try {
      const data = await this.queryAPI('hashtags', { limit });

      return data.map(row => ({
        hashtag: row.hashtag,
        usage_count: row.usage_count || 0,
        avg_boost: Math.round((row.avg_boost || 0) * 10) / 10,
        avg_engagement_rate: Math.round((row.avg_engagement_rate || 0) * 10) / 10,
        impact_score: Math.round((row.impact_score || 0) * 10) / 10
      }));
    } catch (error) {
      console.error('Error fetching hashtag performance:', error);
      throw error;
    }
  }

  // Export engagement analysis data
  async exportEngagementData(filters: any = {}) {
    if (!this.initialized) await this.connect();

    try {
      // Use all methods to gather comprehensive data
      const stats = await this.getEngagementStats();
      const platforms = await this.getPlatformEngagement(filters);
      const contentTypes = await this.getContentTypePerformance(filters);
      const trends = await this.getEngagementTrends(filters.timeRange || '7d');
      const topPosts = await this.getTopPerformingPosts(filters, 50);
      const timing = await this.getEngagementTiming();
      const hashtags = await this.getHashtagPerformance(50);

      return {
        exportDate: new Date().toISOString(),
        summary: stats,
        platforms,
        contentTypes,
        trends,
        topPosts,
        timing,
        hashtags,
        filters
      };
    } catch (error) {
      console.error('Error exporting engagement data:', error);
      throw error;
    }
  }

  async close() {
    // No cleanup needed for API connections
    this.initialized = false;
  }
}

export const engagementAnalysisDb = new EngagementAnalysisDatabase();