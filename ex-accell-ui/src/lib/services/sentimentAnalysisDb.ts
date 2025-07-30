// DuckDB connection and query service for Sentiment Analysis data
// Server-side API integration for real database queries
class SentimentAnalysisDatabase {
  private initialized = false;
  private baseUrl = '/api/sentiment-analysis';

  async connect() {
    if (this.initialized) return; // Already connected

    try {
      // Test API connection
      const response = await fetch(`${this.baseUrl}?type=test`);
      if (!response.ok) {
        throw new Error(`API test failed: ${response.status} ${response.statusText}`);
      }
      
      this.initialized = true;
      console.log('SentimentAnalysisDatabase connected successfully');
    } catch (error) {
      console.error('Failed to connect to SentimentAnalysisDatabase:', error);
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

  // Get overall sentiment statistics
  async getSentimentStats() {
    if (!this.initialized) await this.connect();

    try {
      const data = await this.queryAPI('sentiment-stats');
      const stats = data[0] || {};
      
      return {
        positive: { 
          count: stats.positive_count || 0, 
          percentage: stats.positive_percentage || 0, 
          confidence: stats.avg_confidence || 0 
        },
        negative: { 
          count: stats.negative_count || 0, 
          percentage: stats.negative_percentage || 0, 
          confidence: stats.avg_confidence || 0 
        },
        neutral: { 
          count: stats.neutral_count || 0, 
          percentage: stats.neutral_percentage || 0, 
          confidence: stats.avg_confidence || 0 
        },
        total: stats.total_posts || 0,
        avgConfidence: stats.avg_confidence || 0
      };
    } catch (error) {
      console.error('Error getting sentiment stats:', error);
      throw error;
    }
  }

  // Get detailed sentiment distribution
  async getDetailedSentiments() {
    if (!this.initialized) await this.connect();

    try {
      const data = await this.queryAPI('detailed-sentiments');
      return data.map(item => ({
        label: item.label,
        count: item.count,
        color: item.color,
        percentage: item.percentage
      }));
    } catch (error) {
      console.error('Error getting detailed sentiments:', error);
      throw error;
    }
  }

  // Get emotion analysis data
  async getEmotionStats() {
    if (!this.initialized) await this.connect();

    try {
      const data = await this.queryAPI('emotion-stats');
      return data.map(item => ({
        emotion: item.emotion,
        count: item.count,
        percentage: item.percentage,
        color: item.color
      }));
    } catch (error) {
      console.error('Error getting emotion stats:', error);
      throw error;
    }
  }

  // Get sentiment trends over time
  async getSentimentTrends(timeRange: string = '7d') {
    if (!this.initialized) await this.connect();

    try {
      const data = await this.queryAPI('sentiment-trends', { timeRange });
      return data.map(item => ({
        date: item.date,
        positive: item.positive,
        negative: item.negative,
        neutral: item.neutral
      })).reverse(); // Reverse to get chronological order
    } catch (error) {
      console.error('Error getting sentiment trends:', error);
      throw error;
    }
  }

  // Get sample posts with sentiment analysis
  async getSamplePosts(filters: any = {}) {
    if (!this.initialized) await this.connect();

    try {
      const params = {
        sentiment: filters.sentiment || 'all',
        platform: filters.platform || 'all',
        confidenceThreshold: filters.confidenceThreshold || 0,
        limit: filters.limit || 50
      };
      
      const data = await this.queryAPI('sample-posts', params);
      return data.map(post => ({
        id: post.id,
        text: post.text,
        sentiment: post.sentiment,
        confidence: post.confidence,
        emotions: post.emotions ? post.emotions.split(',') : [],
        platform: post.platform,
        timestamp: new Date(post.timestamp).toISOString(),
        engagement: {
          likes: post.likes || 0,
          shares: post.shares || 0,
          comments: post.comments || 0
        }
      }));
    } catch (error) {
      console.error('Error getting sample posts:', error);
      throw error;
    }
  }

  // Get platform-specific sentiment performance
  async getPlatformSentimentPerformance() {
    if (!this.initialized) await this.connect();

    try {
      const data = await this.queryAPI('platform-performance');
      return data.map(item => ({
        platform: item.platform.charAt(0).toUpperCase() + item.platform.slice(1),
        totalPosts: item.total_posts,
        avgConfidence: item.avg_confidence,
        positivePercentage: item.positive_percentage,
        negativePercentage: item.negative_percentage,
        neutralPercentage: item.neutral_percentage
      }));
    } catch (error) {
      console.error('Error getting platform performance:', error);
      throw error;
    }
  }

  // Get top sentiment keywords
  async getTopSentimentKeywords(sentiment: string = 'all') {
    if (!this.initialized) await this.connect();

    try {
      const data = await this.queryAPI('top-keywords', { keywordSentiment: sentiment });
      return data.map(item => ({
        keyword: item.keyword,
        sentiment: item.sentiment_type,
        frequency: item.frequency,
        impact: item.impact_score
      }));
    } catch (error) {
      console.error('Error getting sentiment keywords:', error);
      throw error;
    }
  }

  // Get emotion correlations
  async getEmotionCorrelations() {
    if (!this.initialized) await this.connect();

    try {
      const data = await this.queryAPI('emotion-correlations');
      return data.map(item => ({
        emotion1: item.emotion1,
        emotion2: item.emotion2,
        correlation: item.correlation,
        coOccurrence: item.co_occurrence_count
      }));
    } catch (error) {
      console.error('Error getting emotion correlations:', error);
      throw error;
    }
  }

  // Get sentiment distribution by time of day
  async getSentimentByTimeOfDay() {
    if (!this.initialized) await this.connect();

    try {
      const data = await this.queryAPI('hourly-patterns');
      return data.map(item => ({
        hour: item.hour_of_day,
        positive: item.positive,
        negative: item.negative,
        neutral: item.neutral
      }));
    } catch (error) {
      console.error('Error getting hourly patterns:', error);
      throw error;
    }
  }

  // Export sentiment analysis data
  async exportSentimentData(filters: any = {}) {
    if (!this.initialized) await this.connect();

    try {
      const params = {
        sentiment: filters.sentiment || 'all',
        platform: filters.platform || 'all',
        confidenceThreshold: filters.confidenceThreshold || 0,
        timeRange: filters.timeRange || '7d'
      };
      
      const posts = await this.queryAPI('export-data', params);
      const sentimentStats = await this.getSentimentStats();
      const emotionStats = await this.getEmotionStats();
      const trends = await this.getSentimentTrends(filters.timeRange || '7d');

      return {
        exportDate: new Date().toISOString(),
        summary: sentimentStats,
        emotions: emotionStats,
        trends,
        posts: posts.map(post => ({
          text: post.text,
          sentiment: post.sentiment,
          confidence: post.confidence,
          emotions: post.emotions ? post.emotions.split(';') : [],
          platform: post.platform,
          timestamp: new Date(post.timestamp).toISOString(),
          engagement: {
            likes: post.engagement_likes || 0,
            shares: post.engagement_shares || 0,
            comments: post.engagement_comments || 0
          }
        })),
        filters
      };
    } catch (error) {
      console.error('Error exporting sentiment data:', error);
      throw error;
    }
  }

  async close() {
    // In browser environment, no cleanup needed
    this.initialized = false;
  }
}

export const sentimentAnalysisDb = new SentimentAnalysisDatabase();