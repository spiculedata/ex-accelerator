// Unified DuckDB connection utility
// This provides a centralized interface for all DuckDB queries across the application
// Uses the unified social analytics database schema for cross-table analysis

interface QueryResult {
  [key: string]: any;
}

interface DatabaseConfig {
  databaseFile: string;
  schemaFile: string;
  apiEndpoint: string;
}

// Unified database configuration
const UNIFIED_DB_CONFIG: DatabaseConfig = {
  databaseFile: 'unified_social_analytics.db',
  schemaFile: 'unified_social_analytics_schema.sql',
  apiEndpoint: '/api/unified-analytics'
};

// Unified DuckDB Service Class
class UnifiedDuckDBService {
  private initialized = false;
  private baseUrl = UNIFIED_DB_CONFIG.apiEndpoint;

  async connect(): Promise<void> {
    if (this.initialized) return;

    try {
      // Test connection to unified analytics API
      const response = await fetch(`${this.baseUrl}?type=test`);
      if (!response.ok) {
        throw new Error(`Unified DuckDB API connection failed: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Unified DuckDB connection test failed');
      }

      this.initialized = true;
      console.log('Unified DuckDB Service connected successfully');
    } catch (error) {
      console.error('Failed to connect to Unified DuckDB Service:', error);
      throw error;
    }
  }

  async query(sql: string, params: Record<string, any> = {}): Promise<QueryResult[]> {
    if (!this.initialized) await this.connect();

    try {
      const requestBody = {
        sql,
        params,
        timestamp: Date.now()
      };

      const response = await fetch(`${this.baseUrl}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Query failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Query execution failed');
      }

      return result.data;
    } catch (error) {
      console.error('Unified DuckDB query error:', error);
      throw error;
    }
  }

  async queryByType(queryType: string, params: Record<string, any> = {}): Promise<QueryResult[]> {
    if (!this.initialized) await this.connect();

    try {
      const urlParams = new URLSearchParams({ type: queryType, ...params });
      const response = await fetch(`${this.baseUrl}?${urlParams.toString()}`);

      if (!response.ok) {
        throw new Error(`Query type '${queryType}' failed: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || `Query type '${queryType}' failed`);
      }

      return result.data;
    } catch (error) {
      console.error(`Unified DuckDB query type '${queryType}' error:`, error);
      throw error;
    }
  }

  // Cross-table analysis methods
  async getUnifiedPostAnalysis(filters: any = {}): Promise<QueryResult[]> {
    return this.queryByType('unified-post-analysis', filters);
  }

  async getCrossPlatformSentiment(filters: any = {}): Promise<QueryResult[]> {
    return this.queryByType('cross-platform-sentiment', filters);
  }

  async getTopicPlatformPerformance(filters: any = {}): Promise<QueryResult[]> {
    return this.queryByType('topic-platform-performance', filters);
  }

  async getLanguageSentimentCorrelation(filters: any = {}): Promise<QueryResult[]> {
    return this.queryByType('language-sentiment-correlation', filters);
  }

  async getContentPerformanceAnalysis(filters: any = {}): Promise<QueryResult[]> {
    return this.queryByType('content-performance-analysis', filters);
  }

  async getAnalyticsDashboardSummary(): Promise<QueryResult[]> {
    return this.queryByType('analytics-dashboard-summary');
  }

  isConnected(): boolean {
    return this.initialized;
  }

  async close(): Promise<void> {
    this.initialized = false;
  }
}

// Create singleton instance
export const unifiedDb = new UnifiedDuckDBService();

// Legacy compatibility functions for backward compatibility
export async function query(sql: string, queryType?: string): Promise<QueryResult[]> {
  if (queryType) {
    return unifiedDb.queryByType(queryType);
  }
  return unifiedDb.query(sql);
}

export async function queryEngagementAnalysis(queryType: string, filters: any = {}): Promise<QueryResult[]> {
  return unifiedDb.queryByType(`engagement-${queryType}`, filters);
}

export async function executeSchema(schemaFile: string): Promise<void> {
  try {
    console.log(`Schema ${schemaFile} will be executed server-side with unified schema`);
    return Promise.resolve();
  } catch (error) {
    console.warn('Schema execution delegated to unified server-side database');
    throw error;
  }
}

export function isConnected(): boolean {
  return unifiedDb.isConnected();
}