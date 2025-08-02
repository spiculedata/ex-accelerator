// DuckDB connection and query service for Sentiment Analysis data
// Uses the unified social analytics database for cross-platform sentiment analysis
import { unifiedDb } from './duckdb';

class SentimentAnalysisDatabase {
  private initialized = false;

  async connect() {
    if (this.initialized) return; // Already connected

    try {
      // Connect to unified DuckDB service
      await unifiedDb.connect();
      this.initialized = true;
      console.log('SentimentAnalysisDatabase connected to unified analytics successfully');
    } catch (error) {
      console.error('Failed to connect to SentimentAnalysisDatabase:', error);
      throw error;
    }
  }

  // Get overall sentiment statistics
  async getSentimentStats() {
    if (!this.initialized) await this.connect();

    try {
      // Query cross-platform sentiment data from unified database
      const data = await unifiedDb.getCrossPlatformSentiment();
      
      // Aggregate sentiment stats across all platforms
      const sentimentMap = new Map();
      let totalPosts = 0;
      let totalConfidence = 0;
      let confidenceCount = 0;

      data.forEach(row => {
        const sentiment = row.sentiment_category.toLowerCase().includes('positive') ? 'positive' :
                         row.sentiment_category.toLowerCase().includes('negative') ? 'negative' : 'neutral';
        
        if (!sentimentMap.has(sentiment)) {
          sentimentMap.set(sentiment, { count: 0, confidence: 0 });
        }
        
        const current = sentimentMap.get(sentiment);
        current.count += row.post_count;
        totalPosts += row.post_count;
        
        if (row.avg_confidence) {
          current.confidence = (current.confidence + row.avg_confidence) / 2;
          totalConfidence += row.avg_confidence;
          confidenceCount++;
        }
      });

      // Calculate percentages
      const positive = sentimentMap.get('positive') || { count: 0, confidence: 0 };
      const negative = sentimentMap.get('negative') || { count: 0, confidence: 0 };
      const neutral = sentimentMap.get('neutral') || { count: 0, confidence: 0 };

      return {
        positive: { 
          count: positive.count, 
          percentage: totalPosts > 0 ? (positive.count / totalPosts * 100) : 0, 
          confidence: positive.confidence || 0
        },
        negative: { 
          count: negative.count, 
          percentage: totalPosts > 0 ? (negative.count / totalPosts * 100) : 0, 
          confidence: negative.confidence || 0
        },
        neutral: { 
          count: neutral.count, 
          percentage: totalPosts > 0 ? (neutral.count / totalPosts * 100) : 0, 
          confidence: neutral.confidence || 0
        },
        total: totalPosts,
        avgConfidence: confidenceCount > 0 ? (totalConfidence / confidenceCount) : 0
      };
    } catch (error) {
      console.error('Error getting sentiment stats from unified DB:', error);
      throw error;
    }
  }

  // Get detailed sentiment distribution
  async getDetailedSentiments() {
    if (!this.initialized) await this.connect();

    try {
      // Query detailed sentiment classifications from unified database
      const data = await unifiedDb.queryByType('sentiment-classifications');
      
      // Define colors for each sentiment category
      const sentimentColors = {
        'Very Positive': '#22c55e',
        'Positive': '#84cc16', 
        'Neutral': '#6b7280',
        'Negative': '#f97316',
        'Very Negative': '#ef4444'
      };

      return data.map(item => ({
        label: item.sentiment_category,
        count: item.post_count,
        color: sentimentColors[item.sentiment_category] || '#6b7280',
        percentage: item.percentage
      }));
    } catch (error) {
      console.error('Error getting detailed sentiments from unified DB:', error);
      throw error;
    }
  }

  // Get emotion analysis data
  async getEmotionStats() {
    if (!this.initialized) await this.connect();

    try {
      // Query emotion analysis from unified database
      const data = await unifiedDb.queryByType('emotion-analysis');
      
      // Define colors for each emotion
      const emotionColors = {
        'Joy': '#fbbf24',
        'Trust': '#3b82f6',
        'Fear': '#8b5cf6',
        'Surprise': '#f59e0b',
        'Sadness': '#6366f1',
        'Disgust': '#10b981',
        'Anger': '#ef4444'
      };

      return data.map(item => ({
        emotion: item.emotion,
        count: item.post_count,
        percentage: item.percentage,
        color: emotionColors[item.emotion] || '#6b7280'
      }));
    } catch (error) {
      console.error('Error getting emotion stats from unified DB:', error);
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