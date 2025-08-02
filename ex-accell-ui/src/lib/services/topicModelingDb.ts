// DuckDB connection and query service for Topic Modeling data
// Uses the unified social analytics database for cross-platform topic analysis
import { unifiedDb } from './duckdb';

class TopicModelingDatabase {
  private initialized = false;

  async connect() {
    if (this.initialized) return; // Already connected

    try {
      // Connect to unified DuckDB service
      await unifiedDb.connect();
      this.initialized = true;
      console.log('TopicModelingDatabase connected to unified analytics successfully');
    } catch (error) {
      console.error('Failed to connect to TopicModelingDatabase:', error);
      throw error;
    }
  }

  // Get all topics with category information
  async getTopics(filters: any = {}) {
    if (!this.initialized) await this.connect();

    try {
      // Query topics from unified database with filters
      const data = await unifiedDb.queryByType('topic-overview', {
        category: filters.category || 'all',
        search: filters.search || '',
        minSize: filters.minSize || 0,
        limit: filters.limit || 50
      });
      
      return data.map(topic => ({
        id: topic.id,
        name: topic.name,
        category: topic.category,
        categoryColor: topic.category_color,
        size: topic.size,
        weight: topic.weight,
        keywords: topic.keywords ? topic.keywords.split(',') : []
      }));
    } catch (error) {
      console.error('Error getting topics from unified DB:', error);
      throw error;
    }
  }

  // Get topic categories
  async getTopicCategories() {
    if (!this.initialized) await this.connect();

    try {
      // Query topic categories from unified database
      const data = await unifiedDb.queryByType('topic-categories');
      
      return data.map(category => ({
        name: category.category,
        color: category.category_color,
        topicCount: category.topic_count,
        totalDocuments: category.total_documents,
        avgWeight: category.avg_weight,
        avgCoherence: category.avg_coherence
      }));
    } catch (error) {
      console.error('Error getting topic categories from unified DB:', error);
      throw error;
    }
  }

  // Get topic relationships for network visualization
  async getTopicRelationships(minStrength: number = 0.5) {
    if (!this.initialized) await this.connect();

    try {
      const params = {
        limit: 50
      };
      
      const data = await this.queryAPI('relationships', params);
      return data.filter(rel => rel.strength >= minStrength).map(rel => ({
        source: rel.topic1_id,
        target: rel.topic2_id,
        topic1Id: rel.topic1_id,
        topic1Name: rel.topic1_name,
        topic2Id: rel.topic2_id,
        topic2Name: rel.topic2_name,
        similarityScore: rel.similarity_score,
        relationshipType: rel.relationship_type,
        strength: rel.strength
      }));
    } catch (error) {
      console.error('Error getting topic relationships:', error);
      throw error;
    }
  }

  // Get overall topic modeling statistics
  async getTopicStats() {
    if (!this.initialized) await this.connect();

    try {
      const data = await this.queryAPI('topic-stats');
      const stats = data[0] || {};
      
      return {
        totalTopics: stats.total_topics || 0,
        totalCategories: stats.total_categories || 0,
        totalDocuments: stats.total_documents || 0,
        avgWeight: stats.avg_weight || 0,
        avgCoherence: stats.avg_coherence || 0,
        maxWeight: stats.max_weight || 0,
        minWeight: stats.min_weight || 0
      };
    } catch (error) {
      console.error('Error getting topic stats:', error);
      throw error;
    }
  }

  // Get trending topics
  async getTrendingTopics(filters: any = {}) {
    if (!this.initialized) await this.connect();

    try {
      const params = {
        limit: filters.limit || 20
      };
      
      const data = await this.queryAPI('trending-topics', params);
      return data.map(topic => ({
        id: topic.topic_id,
        name: topic.name,
        category: topic.category,
        categoryColor: topic.category_color,
        weight: topic.weight,
        growthRate: topic.avg_growth_rate,
        recentDocuments: topic.recent_document_count,
        trendDataPoints: topic.trend_data_points
      }));
    } catch (error) {
      console.error('Error getting trending topics:', error);
      throw error;
    }
  }

  // Get keywords for a specific topic
  async getTopicKeywords(topicId: string) {
    if (!this.initialized) await this.connect();

    try {
      const data = await this.queryAPI('topic-keywords', { topicId });
      return data.map(keyword => ({
        keyword: keyword.keyword,
        weight: keyword.weight,
        rank: keyword.rank_position
      }));
    } catch (error) {
      console.error('Error getting topic keywords:', error);
      throw error;
    }
  }

  // Get documents for a specific topic
  async getTopicDocuments(topicId: string, filters: any = {}) {
    if (!this.initialized) await this.connect();

    try {
      const params = {
        topicId,
        limit: filters.limit || 50
      };
      
      const data = await this.queryAPI('topic-documents', params);
      return data.map(doc => ({
        documentId: doc.document_id,
        title: doc.title,
        source: doc.source,
        author: doc.author,
        engagementScore: doc.engagement_score,
        probability: doc.probability,
        isPrimary: doc.is_primary
      }));
    } catch (error) {
      console.error('Error getting topic documents:', error);
      throw error;
    }
  }

  // Search topics by keywords or name
  async searchTopics(query: string, filters: any = {}) {
    if (!this.initialized) await this.connect();

    try {
      const params = {
        query,
        limit: filters.limit || 50
      };
      
      const data = await this.queryAPI('search-topics', params);
      return data.map(topic => ({
        id: topic.id,
        name: topic.name,
        category: topic.category,
        categoryColor: topic.category_color,
        size: topic.size,
        weight: topic.weight,
        keywords: topic.keywords ? topic.keywords.split(',') : []
      }));
    } catch (error) {
      console.error('Error searching topics:', error);
      throw error;
    }
  }

  // Get topic evolution trends over time
  async getTopicTrends(filters: any = {}) {
    if (!this.initialized) await this.connect();

    try {
      const params = {
        topicId: filters.topicId || null,
        days: filters.days || 30,
        limit: filters.limit || 100
      };
      
      const data = await this.queryAPI('topic-trends', params);
      return data.map(trend => ({
        topicId: trend.topic_id,
        name: trend.name,
        category: trend.category,
        analysisDate: trend.analysis_date,
        documentCount: trend.document_count,
        averageEngagement: trend.average_engagement,
        growthRate: trend.growth_rate,
        trendDirection: trend.trend_direction
      }));
    } catch (error) {
      console.error('Error getting topic trends:', error);
      throw error;
    }
  }

  // Get topic modeling run history
  async getModelingRuns(filters: any = {}) {
    if (!this.initialized) await this.connect();

    try {
      const params = {
        limit: filters.limit || 20
      };
      
      const data = await this.queryAPI('modeling-runs', params);
      return data.map(run => ({
        runId: run.run_id,
        algorithm: run.algorithm,
        numTopics: run.num_topics,
        perplexity: run.perplexity,
        coherence: run.coherence,
        parameters: run.parameters,
        status: run.status,
        startedAt: run.started_at,
        completedAt: run.completed_at
      }));
    } catch (error) {
      console.error('Error getting modeling runs:', error);
      throw error;
    }
  }

  // Get treemap data for hierarchical visualization
  async getTreemapData(filters: any = {}) {
    if (!this.initialized) await this.connect();

    try {
      const topics = await this.getTopics(filters);
      const categories = await this.getTopicCategories();
      
      // Group topics by category
      const categoryMap = new Map();
      
      categories.forEach(cat => {
        categoryMap.set(cat.name, {
          name: cat.name,
          itemStyle: { color: cat.color },
          children: []
        });
      });
      
      topics.forEach(topic => {
        const category = categoryMap.get(topic.category);
        if (category) {
          category.children.push({
            name: topic.name,
            value: topic.size,
            itemStyle: { color: topic.categoryColor || '#8b5cf6' }
          });
        }
      });
      
      return Array.from(categoryMap.values()).filter(cat => cat.children.length > 0);
    } catch (error) {
      console.error('Error getting treemap data:', error);
      throw error;
    }
  }

  async close() {
    // No cleanup needed for API connections
    this.initialized = false;
  }
}

export const topicModelingDb = new TopicModelingDatabase();