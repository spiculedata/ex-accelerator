// DuckDB connection utility
// This provides a unified interface for DuckDB queries across the application
// Uses server-side API endpoints to execute DuckDB queries

interface QueryResult {
  [key: string]: any;
}

// Execute DuckDB queries via server-side API endpoints
export async function query(sql: string, queryType?: string): Promise<QueryResult[]> {
  try {
    // For engagement analysis queries, use the dedicated API endpoint
    if (queryType) {
      const response = await fetch(`/api/engagement-analysis?type=${queryType}`);
      const result = await response.json();
      
      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error || 'API query failed');
      }
    }
    
    // For generic queries, we still need to implement a generic endpoint
    // For now, throw an error to maintain existing fallback behavior
    throw new Error('Generic DuckDB queries not yet implemented via API');
  } catch (error) {
    console.warn('DuckDB API query failed:', error);
    throw error;
  }
}

// Execute engagement analysis specific queries
export async function queryEngagementAnalysis(queryType: string, filters: any = {}): Promise<QueryResult[]> {
  try {
    const params = new URLSearchParams();
    params.append('type', queryType);
    
    // Add filters as query parameters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
    
    const response = await fetch(`/api/engagement-analysis?${params.toString()}`);
    const result = await response.json();
    
    if (result.success) {
      return result.data;
    } else {
      throw new Error(result.error || 'Engagement analysis query failed');
    }
  } catch (error) {
    console.error('Engagement analysis API error:', error);
    throw error;
  }
}

export async function executeSchema(schemaFile: string): Promise<void> {
  try {
    // Schema execution is handled server-side during API initialization
    console.log(`Schema ${schemaFile} will be executed server-side`);
    return Promise.resolve();
  } catch (error) {
    console.warn('Schema execution delegated to server-side');
    throw error;
  }
}

export function isConnected(): boolean {
  // Connection status is managed server-side
  return true; // Assume connected if API is available
}