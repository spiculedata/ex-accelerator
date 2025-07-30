// DuckDB connection and query service for Hashtag Analysis data
// Server-side API integration for real database queries
class HashtagAnalysisDatabase {
  private initialized = false;
  private baseUrl = '/api/hashtag-analysis';

  async connect() {
    if (this.initialized) return; // Already connected

    try {
      // Test API connection
      const response = await fetch(`${this.baseUrl}?type=test`);
      if (!response.ok) {
        throw new Error(`API test failed: ${response.status} ${response.statusText}`);
      }
      
      this.initialized = true;
      console.log('HashtagAnalysisDatabase connected successfully');
    } catch (error) {
      console.error('Failed to connect to HashtagAnalysisDatabase:', error);
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

  // Get overall hashtag statistics
  async getHashtagStats() {
    if (!this.initialized) await this.connect();

    try {
      const data = await this.queryAPI('hashtag-stats');
      const stats = data[0] || {};
      
      return {
        totalHashtags: stats.total_hashtags || 0,
        trendingHashtags: stats.trending_hashtags || 0,
        totalReach: stats.total_reach || 0,
        averageEngagement: Math.round((stats.average_engagement || 0) * 10) / 10
      };
    } catch (error) {
      console.error('Error getting hashtag stats:', error);
      throw error;
    }
  }

  // Get trending hashtags with filters
  async getTrendingHashtags(filters: any = {}) {
    if (!this.initialized) await this.connect();

    try {
      const params = {
        platform: filters.platform || 'all',
        sentiment: filters.sentiment || 'all',
        trend: filters.trend || 'all',
        minEngagement: filters.minEngagement || 0,
        timeRange: filters.timeRange || '7d',
        limit: filters.limit || 50
      };
      
      const data = await this.queryAPI('trending-hashtags', params);
      
      return data.map(hashtag => ({
        hashtag: hashtag.hashtag,
        count: hashtag.count,
        reach: hashtag.reach,
        engagement: Math.round((hashtag.engagement || 0) * 10) / 10,
        sentiment: hashtag.sentiment,
        trend: hashtag.trend,
        platforms: hashtag.platforms ? hashtag.platforms.split(',') : [],
        growth: Math.round((hashtag.growth || 0) * 10) / 10
      }));
    } catch (error) {
      console.error('Error getting trending hashtags:', error);
      throw error;
    }
  }

  // Get hashtag trends over time
  async getHashtagTrends(timeRange: string = '7d') {
    if (!this.initialized) await this.connect();

    try {
      const data = await this.queryAPI('hashtag-trends', { timeRange });
      
      // Group by date and transform to expected format
      const trendsMap = {};
      data.forEach(item => {
        if (!trendsMap[item.date]) {
          trendsMap[item.date] = { date: item.date };
        }
        
        // Map hashtag names to expected field names
        if (item.hashtag === '#AI') {
          trendsMap[item.date].aiCount = item.post_count;
        } else if (item.hashtag === '#ClimateChange') {
          trendsMap[item.date].climateCount = item.post_count;
        } else if (item.hashtag === '#Technology') {
          trendsMap[item.date].techCount = item.post_count;
        }
      });
      
      return Object.values(trendsMap);
    } catch (error) {
      console.error('Error getting hashtag trends:', error);
      throw error;
    }
  }

  // Get sample posts with hashtags
  async getSamplePosts(filters: any = {}) {
    if (!this.initialized) await this.connect();

    try {
      const params = {
        platform: filters.platform || 'all',
        limit: filters.limit || 10
      };
      
      const data = await this.queryAPI('sample-posts', params);
      
      return data.map(post => ({
        id: post.id,
        text: post.text,
        hashtags: post.hashtags ? post.hashtags.split(',') : [],
        platform: post.platform,
        engagement: {
          likes: post.likes_count || 0,
          shares: post.shares_count || 0,
          comments: post.comments_count || 0
        },
        reach: post.reach || 0,
        timestamp: new Date(post.timestamp).toISOString()
      }));
    } catch (error) {
      console.error('Error getting sample posts:', error);
      throw error;
    }
  }

  // Get hashtag performance by platform
  async getPlatformPerformance() {
    if (!this.initialized) await this.connect();

    try {
      const data = await this.queryAPI('platform-performance');
      
      return data.map(platform => ({
        platform: platform.platform,
        hashtagCount: platform.hashtag_count,
        postCount: platform.post_count,
        totalReach: platform.total_reach,
        avgEngagementRate: Math.round((platform.avg_engagement_rate || 0) * 10) / 10
      }));
    } catch (error) {
      console.error('Error getting platform performance:', error);
      throw error;
    }
  }

  // Get hashtag co-occurrence relationships
  async getHashtagRelationships() {
    if (!this.initialized) await this.connect();

    try {
      const data = await this.queryAPI('hashtag-relationships');
      
      return data.map(rel => ({
        hashtag1: rel.hashtag1,
        hashtag2: rel.hashtag2,
        coOccurrenceCount: rel.co_occurrence_count,
        correlationStrength: rel.correlation_strength
      }));
    } catch (error) {
      console.error('Error getting hashtag relationships:', error);
      throw error;
    }
  }

  // Export hashtag analysis data
  async exportHashtagData(filters: any = {}) {
    if (!this.initialized) await this.connect();

    try {
      const params = {
        platform: filters.platform || 'all',
        sentiment: filters.sentiment || 'all',
        timeRange: filters.timeRange || '7d',
        limit: filters.limit || 100
      };
      
      const posts = await this.queryAPI('export-data', params);
      const stats = await this.getHashtagStats();
      const trendingHashtags = await this.getTrendingHashtags(filters);
      const platformPerformance = await this.getPlatformPerformance();
      const relationships = await this.getHashtagRelationships();

      return {
        exportDate: new Date().toISOString(),
        summary: stats,
        trendingHashtags,
        platformPerformance,
        relationships,
        posts: posts.map(post => ({
          hashtag: post.hashtag,
          category: post.category,
          text: post.text,
          platform: post.platform,
          timestamp: new Date(post.timestamp).toISOString(),
          engagement: {
            likes: post.likes_count || 0,
            shares: post.shares_count || 0,
            comments: post.comments_count || 0
          },
          reach: post.reach || 0,
          sentiment: post.sentiment,
          sentimentConfidence: post.sentiment_confidence
        })),
        filters
      };
    } catch (error) {
      console.error('Error exporting hashtag data:', error);
      throw error;
    }
  }

  async close() {
    // No cleanup needed for API connections
    this.initialized = false;
  }
}

export const hashtagAnalysisDb = new HashtagAnalysisDatabase();