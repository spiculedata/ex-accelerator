// DuckDB connection and query service for Language Detection data
// Server-side API integration for real database queries
class LanguageDetectionDatabase {
  private initialized = false;
  private baseUrl = '/api/language-detection';

  async connect() {
    if (this.initialized) return; // Already connected

    try {
      // Test API connection
      const response = await fetch(`${this.baseUrl}?type=test`);
      if (!response.ok) {
        throw new Error(`API test failed: ${response.status} ${response.statusText}`);
      }
      
      this.initialized = true;
      console.log('LanguageDetectionDatabase connected successfully');
    } catch (error) {
      console.error('Failed to connect to LanguageDetectionDatabase:', error);
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

  // Get language statistics and distribution
  async getLanguageStats() {
    if (!this.initialized) await this.connect();

    try {
      const data = await this.queryAPI('language-stats');
      return data.map(lang => ({
        code: lang.code,
        name: lang.name,
        native_name: lang.native_name,
        count: lang.count,
        percentage: lang.percentage,
        confidence: lang.confidence
      }));
    } catch (error) {
      console.error('Error getting language stats:', error);
      throw error;
    }
  }

  // Get detailed language analysis with confidence breakdown
  async getLanguageAnalysis() {
    if (!this.initialized) await this.connect();

    try {
      const data = await this.queryAPI('language-analysis');
      return data.map(lang => ({
        code: lang.code,
        name: lang.name,
        native_name: lang.native_name,
        totalDetections: lang.total_detections,
        veryHighConfidence: lang.very_high_confidence,
        highConfidence: lang.high_confidence,
        mediumConfidence: lang.medium_confidence,
        lowConfidence: lang.low_confidence,
        avgConfidence: lang.avg_confidence,
        confidenceStddev: lang.confidence_stddev
      }));
    } catch (error) {
      console.error('Error getting language analysis:', error);
      throw error;
    }
  }

  // Get language trends over time
  async getLanguageTrends(timeRange: string = '7d') {
    if (!this.initialized) await this.connect();

    try {
      const data = await this.queryAPI('language-trends', { timeRange });
      return data.map(trend => ({
        date: trend.date,
        language_code: trend.language_code,
        language_name: trend.language_name,
        post_count: trend.post_count,
        avg_confidence: trend.avg_confidence,
        total_characters: trend.total_characters,
        total_words: trend.total_words
      }));
    } catch (error) {
      console.error('Error getting language trends:', error);
      throw error;
    }
  }

  // Get sample posts with language detection
  async getSamplePosts(filters: any = {}) {
    if (!this.initialized) await this.connect();

    try {
      const params = {
        language: filters.language || 'all',
        platform: filters.platform || 'all',
        confidenceThreshold: filters.confidenceThreshold || 0,
        limit: filters.limit || 50
      };
      
      const data = await this.queryAPI('sample-posts', params);
      return data.map(post => ({
        id: post.id,
        text: post.text,
        language: post.language,
        language_name: post.language_name,
        confidence: post.confidence,
        timestamp: new Date(post.timestamp).toISOString(),
        platform: post.platform,
        secondary_language: post.secondary_language,
        secondary_confidence: post.secondary_confidence
      }));
    } catch (error) {
      console.error('Error getting sample posts:', error);
      throw error;
    }
  }

  // Get language mixing analysis (code-switching)
  async getLanguageMixing() {
    if (!this.initialized) await this.connect();

    try {
      const data = await this.queryAPI('language-mixing');
      return data.map(mixing => ({
        primary_language: mixing.primary_language,
        secondary_language: mixing.secondary_language,
        mixing_type: mixing.mixing_type,
        occurrence_count: mixing.occurrence_count,
        avg_primary_confidence: mixing.avg_primary_confidence,
        avg_secondary_confidence: mixing.avg_secondary_confidence,
        avg_segments: mixing.avg_segments
      }));
    } catch (error) {
      console.error('Error getting language mixing:', error);
      throw error;
    }
  }

  // Get geographic language distribution
  async getGeographicDistribution() {
    if (!this.initialized) await this.connect();

    try {
      const data = await this.queryAPI('geographic-distribution');
      return data.map(geo => ({
        language_name: geo.language_name,
        country_code: geo.country_code,
        region: geo.region,
        post_count: geo.post_count,
        percentage: geo.percentage,
        country_rank: geo.country_rank
      }));
    } catch (error) {
      console.error('Error getting geographic distribution:', error);
      throw error;
    }
  }

  // Get overall language detection statistics
  async getLanguageDetectionStats() {
    if (!this.initialized) await this.connect();

    try {
      const data = await this.queryAPI('detection-stats');
      const stats = data[0] || {};
      
      return {
        totalPosts: stats.total_posts || 0,
        totalLanguages: stats.total_languages || 0,
        avgConfidence: stats.avg_confidence || 0,
        topLanguage: { name: stats.top_language || 'English' },
        confidenceDistribution: {
          veryHigh: stats.very_high_confidence || 0,
          high: stats.high_confidence || 0,
          medium: stats.medium_confidence || 0,
          low: stats.low_confidence || 0
        },
        lastUpdated: stats.last_updated || new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting detection stats:', error);
      throw error;
    }
  }

  // Export language detection data
  async exportLanguageData(filters: any = {}) {
    if (!this.initialized) await this.connect();

    try {
      const params = {
        language: filters.language || 'all',
        platform: filters.platform || 'all',
        confidenceThreshold: filters.confidenceThreshold || 0,
        timeRange: filters.timeRange || '7d'
      };
      
      const posts = await this.queryAPI('export-data', params);
      const languageStats = await this.getLanguageStats();
      const mixing = await this.getLanguageMixing();
      const geographic = await this.getGeographicDistribution();
      const trends = await this.getLanguageTrends(filters.timeRange || '7d');
      const stats = await this.getLanguageDetectionStats();

      return {
        exportDate: new Date().toISOString(),
        summary: stats,
        languages: languageStats,
        trends,
        posts: posts.map(post => ({
          text: post.text,
          language: post.language,
          language_name: post.language_name,
          confidence: post.confidence,
          secondary_language: post.secondary_language,
          secondary_confidence: post.secondary_confidence,
          platform: post.platform,
          timestamp: new Date(post.timestamp).toISOString(),
          post_id: post.post_id,
          user_id: post.user_id
        })),
        mixing,
        geographic,
        filters
      };
    } catch (error) {
      console.error('Error exporting language data:', error);
      throw error;
    }
  }


  async close() {
    // No cleanup needed for API connections
    this.initialized = false;
  }
}

export const languageDetectionDb = new LanguageDetectionDatabase();