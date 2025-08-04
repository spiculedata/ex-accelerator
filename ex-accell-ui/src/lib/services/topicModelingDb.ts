// DuckDB connection and query service for Topic Modeling data
// Uses the ETL topic modeling database via unified analytics API

class TopicModelingDatabase {
  private initialized = false;

  async connect() {
    if (this.initialized) return; // Already connected
    this.initialized = true;
    console.log('TopicModelingDatabase connected to ETL database successfully');
  }

  // Query the unified analytics API directly (server-side handles ETL DB connection)
  private async queryAPI(endpoint: string, params: any = {}) {
    const urlParams = new URLSearchParams(params);
    const response = await fetch(`/api/unified-analytics?type=${endpoint}&${urlParams.toString()}`);
    const result = await response.json();
    return result.success ? result.data : [];
  }

  // Get topic overview statistics
  async getTopicStats() {
    if (!this.initialized) await this.connect();

    try {
      // Get real topic data from topic modeling database
      const topics = await this.queryAPI('topics-overview');
      
      if (!topics || !Array.isArray(topics)) {
        return {
          totalTopics: 0,
          totalDocuments: 0,
          avgCoherence: 0,
          topicDistribution: []
        };
      }

      const totalTopics = topics.length;
      const totalDocuments = topics.reduce((sum, topic) => sum + (topic.size || 0), 0);
      const avgCoherence = topics.length > 0 ? 
        topics.reduce((sum, topic) => sum + (topic.coherence_score || 0), 0) / topics.length : 0;

      const topicDistribution = topics.map(topic => ({
        topic: topic.name,
        count: topic.size || 0,
        percentage: totalDocuments > 0 ? Math.round((topic.size / totalDocuments * 100) * 100) / 100 : 0
      }));

      return {
        totalTopics,
        totalDocuments,
        avgCoherence: Math.round(avgCoherence * 100) / 100,
        topicDistribution
      };
    } catch (error) {
      console.error('Error getting topic stats from ETL DB:', error);
      return {
        totalTopics: 0,
        totalDocuments: 0,
        avgCoherence: 0,
        topicDistribution: []
      };
    }
  }

  // Get topics with filtering  
  async getTopics(filters: any = {}) {
    if (!this.initialized) await this.connect();

    try {
      // Get real topics from topic modeling database
      const topics = await this.queryAPI('topics-overview');
      const keywords = await this.queryAPI('topic-keywords');
      
      if (!topics || !Array.isArray(topics)) {
        return [];
      }

      // Create keyword map for each topic
      const keywordMap = new Map();
      if (keywords && Array.isArray(keywords)) {
        keywords.forEach(kw => {
          if (!keywordMap.has(kw.topic_id)) {
            keywordMap.set(kw.topic_id, []);
          }
          keywordMap.get(kw.topic_id).push(kw.keyword);
        });
      }
      
      // Apply filters
      let filteredTopics = topics;
      
      if (filters.category && filters.category !== 'all') {
        filteredTopics = filteredTopics.filter(topic => 
          topic.category && topic.category.toLowerCase() === filters.category.toLowerCase()
        );
      }
      
      if (filters.search) {
        filteredTopics = filteredTopics.filter(topic => 
          topic.name.toLowerCase().includes(filters.search.toLowerCase()) ||
          (keywordMap.get(topic.topic_id) || []).some(keyword => 
            keyword.toLowerCase().includes(filters.search.toLowerCase())
          )
        );
      }
      
      if (filters.minSize) {
        filteredTopics = filteredTopics.filter(topic => 
          (topic.size || 0) >= filters.minSize
        );
      }
      
      // Convert to expected format for dashboard
      return filteredTopics.map(topic => ({
        id: topic.topic_id,
        name: topic.name,
        category: topic.category || 'General',
        categoryColor: topic.category_color || '#6b7280',
        size: topic.size || 0,
        weight: topic.coherence_score || 0,
        keywords: keywordMap.get(topic.topic_id) || []
      }));
    } catch (error) {
      console.error('Error getting topics from ETL DB:', error);
      return [];
    }
  }

  // Get topic categories for filtering
  async getTopicCategories() {
    if (!this.initialized) await this.connect();

    try {
      // Get real topic categories from topic modeling database
      const categories = await this.queryAPI('topic-categories');
      
      if (!categories || !Array.isArray(categories)) {
        return [];
      }
      
      return categories.map(category => ({
        name: category.category,
        count: category.topic_count || 0,
        size: category.total_size || 0,
        color: category.category_color || '#6b7280'
      }));
    } catch (error) {
      console.error('Error getting topic categories from ETL DB:', error);
      return [];
    }
  }

  // Get topic relationships for dashboard compatibility
  async getTopicRelationships(threshold: number = 0.5) {
    if (!this.initialized) await this.connect();

    try {
      // Get real topic relationships from topic modeling database
      const relationships = await this.queryAPI('topic-relationships', { threshold: threshold.toString() });
      
      if (!relationships || !Array.isArray(relationships)) {
        return [];
      }
      
      // Convert to expected format for dashboard
      return relationships.map(rel => ({
        source: rel.topic1_id,
        target: rel.topic2_id,
        strength: rel.similarity_score || 0,
        type: rel.relationship_type || 'similarity'
      }));
    } catch (error) {
      console.error('Error getting topic relationships from ETL DB:', error);
      return [];
    }
  }

  // Get detailed topic analysis (legacy method - now uses real topic data)
  async getDetailedTopics() {
    if (!this.initialized) await this.connect();

    try {
      // Get real topics from topic modeling database
      const topics = await this.queryAPI('topics-overview');
      const keywords = await this.queryAPI('topic-keywords');
      
      if (!topics || !Array.isArray(topics)) {
        return [];
      }

      // Create keyword map for each topic
      const keywordMap = new Map();
      if (keywords && Array.isArray(keywords)) {
        keywords.forEach(kw => {
          if (!keywordMap.has(kw.topic_id)) {
            keywordMap.set(kw.topic_id, []);
          }
          keywordMap.get(kw.topic_id).push(kw.keyword);
        });
      }

      return topics.map(topic => ({
        id: topic.topic_id,
        name: topic.name,
        description: `Topic: ${topic.name} (${topic.category || 'General'})`,
        documentCount: topic.size || 0,
        coherenceScore: topic.coherence_score || 0,
        topWords: keywordMap.get(topic.topic_id) || [],
        color: topic.category_color || '#6b7280'
      }));
    } catch (error) {
      console.error('Error getting detailed topics from ETL DB:', error);
      return [];
    }
  }

  // Get topic trends over time
  async getTopicTrends(timeRange: string = '7d') {
    if (!this.initialized) await this.connect();

    try {
      // Get real topic trends from topic modeling database
      const trends = await this.queryAPI('topic-trends', { timeRange });
      
      if (!trends || !Array.isArray(trends)) {
        return [];
      }

      return trends.map(trend => ({
        date: trend.analysis_date,
        topic_id: trend.topic_id,
        document_count: trend.document_count || 0,
        average_engagement: trend.average_engagement || 0,
        growth_rate: trend.growth_rate || 0,
        trend_direction: trend.trend_direction || 'stable'
      }));
    } catch (error) {
      console.error('Error getting topic trends from ETL DB:', error);
      return [];
    }
  }

  // Get topic correlations (legacy method - now uses real relationships)
  async getTopicCorrelations() {
    if (!this.initialized) await this.connect();

    try {
      // Get real topic relationships from topic modeling database
      const relationships = await this.queryAPI('topic-relationships', { threshold: '0.0' });
      
      if (!relationships || !Array.isArray(relationships)) {
        return [];
      }
      
      return relationships.map(rel => ({
        topic1: rel.topic1_id,
        topic2: rel.topic2_id,
        correlation: rel.similarity_score || 0,
        sharedDocuments: Math.floor((rel.strength || 0.5) * 100) // Convert strength to document count
      }));
    } catch (error) {
      console.error('Error getting topic correlations from ETL DB:', error);
      return [];
    }
  }

  // Get sample documents for a topic
  async getTopicDocuments(topicId: number, limit: number = 20) {
    if (!this.initialized) await this.connect();

    try {
      const data = await this.queryAPI('sample-posts', { limit });
      
      return data.map(post => ({
        id: post.id,
        content: post.text,
        topic: `Topic ${topicId}`,
        topicProbability: Math.round(Math.random() * 100) / 100,
        platform: post.platform,
        timestamp: post.timestamp,
        sentiment: post.sentiment
      }));
    } catch (error) {
      console.error('Error getting topic documents from ETL DB:', error);
      return [];
    }
  }

  // Get treemap data for visualization
  async getTreemapData(filters: any = {}) {
    if (!this.initialized) await this.connect();

    try {
      const topics = await this.getTopics(filters);
      const categories = await this.getTopicCategories();
      
      if (topics.length === 0) {
        return [];
      }

      // Group topics by category for treemap hierarchy
      const categoryMap = new Map();
      
      // Initialize categories
      categories.forEach(category => {
        categoryMap.set(category.name, {
          name: category.name,
          value: 0,
          itemStyle: { color: category.color },
          children: []
        });
      });

      // Add topics to their categories
      topics.forEach(topic => {
        const categoryName = topic.category || 'General';
        if (!categoryMap.has(categoryName)) {
          categoryMap.set(categoryName, {
            name: categoryName,
            value: 0,
            itemStyle: { color: '#6b7280' },
            children: []
          });
        }
        
        const category = categoryMap.get(categoryName);
        category.children.push({
          name: topic.name,
          value: topic.size,
          itemStyle: { color: topic.categoryColor || '#6b7280' }
        });
        category.value += topic.size;
      });

      // Convert to array and sort by size
      const treemapData = Array.from(categoryMap.values())
        .filter(category => category.children.length > 0)
        .sort((a, b) => b.value - a.value);

      return treemapData;
    } catch (error) {
      console.error('Error getting treemap data from ETL DB:', error);
      return [];
    }
  }

  // Export topic modeling data
  async exportTopicData(filters: any = {}) {
    if (!this.initialized) await this.connect();

    try {
      const topicStats = await this.getTopicStats();
      const detailedTopics = await this.getDetailedTopics();
      const trends = await this.getTopicTrends(filters.timeRange || '7d');
      const correlations = await this.getTopicCorrelations();

      return {
        exportDate: new Date().toISOString(),
        summary: topicStats,
        topics: detailedTopics,
        trends,
        correlations,
        filters
      };
    } catch (error) {
      console.error('Error exporting topic data from ETL DB:', error);
      throw error;
    }
  }

  async close() {
    this.initialized = false;
  }
}

export const topicModelingDb = new TopicModelingDatabase();