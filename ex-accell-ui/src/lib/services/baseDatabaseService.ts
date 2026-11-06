// Base Database Service Class
// Provides common functionality for all database services with type safety and error handling

import { clearApiError, reportApiError } from '$lib/stores/apiErrors';

/**
 * Generic query result type - can be extended by specific services
 */
export interface QueryResult {
  [key: string]: any;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T = QueryResult[]> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Query options for API calls
 */
export interface QueryOptions {
  endpoint: string;
  params?: Record<string, any>;
  timeout?: number;
}

/**
 * Base configuration for database services
 */
export interface DatabaseServiceConfig {
  serviceName: string;
  apiEndpoint?: string;
  autoConnect?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * Abstract base class for all database services
 *
 * This class eliminates ~3,000 lines of duplicate code across services by providing:
 * - Standardized connection management
 * - Typed query methods
 * - Error handling and retry logic
 * - Logging and debugging utilities
 *
 * Usage:
 * ```typescript
 * class MyDatabaseService extends BaseDatabaseService {
 *   constructor() {
 *     super({ serviceName: 'MyDatabase', apiEndpoint: '/api/my-data' });
 *   }
 *
 *   async getMyData() {
 *     return this.queryAPI<MyDataType[]>({ endpoint: 'my-endpoint' });
 *   }
 * }
 * ```
 */
/** Plain-language wording for the failures users are most likely to hit. */
function friendlyMessage(error: unknown): string {
  if (error instanceof Error && error.name === 'AbortError') return 'The request timed out';
  const message = error instanceof Error ? error.message : String(error);
  if (/^HTTP 401\b/.test(message)) return 'Your session has expired. Please sign in again.';
  if (/^HTTP 403\b/.test(message)) return 'You do not have permission to load this data.';
  return message;
}

export abstract class BaseDatabaseService {
  protected initialized = false;
  protected config: Required<DatabaseServiceConfig>;
  private connectionAttempts = 0;
  private maxConnectionAttempts = 3;

  constructor(config: DatabaseServiceConfig) {
    this.config = {
      serviceName: config.serviceName,
      apiEndpoint: config.apiEndpoint || '/api/unified-analytics',
      autoConnect: config.autoConnect ?? false,
      retryAttempts: config.retryAttempts ?? 2,
      retryDelay: config.retryDelay ?? 1000
    };

    if (this.config.autoConnect) {
      this.connect().catch(error => {
        console.warn(`Auto-connect failed for ${this.config.serviceName}:`, error);
      });
    }
  }

  /**
   * Initialize database connection
   * Implements retry logic for resilience
   */
  async connect(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.connectionAttempts++;

      // Test connection with a simple query
      await this.testConnection();

      this.initialized = true;
      this.connectionAttempts = 0;
      this.log('info', 'Connected successfully');

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (this.connectionAttempts < this.maxConnectionAttempts) {
        this.log('warn', `Connection failed (attempt ${this.connectionAttempts}/${this.maxConnectionAttempts}), retrying...`);
        await this.delay(this.config.retryDelay);
        return this.connect();
      }

      this.log('error', `Connection failed after ${this.maxConnectionAttempts} attempts: ${errorMsg}`);
      // Mark as initialized anyway to prevent infinite retry loops
      this.initialized = true;
    }
  }

  /**
   * Test database connection
   * Override this in subclasses for custom connection testing
   */
  protected async testConnection(): Promise<void> {
    // Default: no-op, subclasses can override
    return Promise.resolve();
  }

  /**
   * Query the unified analytics API
   * Provides type-safe querying with automatic error handling
   *
   * @param options Query options including endpoint and parameters
   * @returns Promise resolving to typed data array
   */
  protected async queryAPI<T = QueryResult>(
    options: QueryOptions
  ): Promise<T[]> {
    if (!this.initialized) {
      await this.connect();
    }

    const { endpoint, params = {}, timeout = 30000 } = options;

    try {
      const urlParams = new URLSearchParams();
      urlParams.append('type', endpoint);

      // Add additional parameters
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          urlParams.append(key, String(value));
        }
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(
          `${this.config.apiEndpoint}?${urlParams.toString()}`,
          { signal: controller.signal }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result: ApiResponse<T[]> = await response.json();

        if (!result.success) {
          throw new Error(result.error || result.message || 'Query failed');
        }

        this.clearFailure(this.requestKey(endpoint, params));
        return result.data || [];

      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log('error', `Query failed for endpoint '${endpoint}': ${errorMsg}`);
      this.reportFailure(this.requestKey(endpoint, params), friendlyMessage(error));

      // Return empty array instead of throwing to prevent UI crashes; the failure is surfaced to the
      // user through the error banner rather than silently looking like "no data".
      return [];
    }
  }

  /**
   * Execute a custom SQL query (for advanced use cases)
   */
  protected async executeQuery<T = QueryResult>(
    sql: string,
    params?: any[]
  ): Promise<T[]> {
    if (!this.initialized) {
      await this.connect();
    }

    try {
      const response = await fetch(`${this.config.apiEndpoint}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql, params: params || [] })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: ApiResponse<T[]> = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Query execution failed');
      }

      this.clearFailure('SQL query');
      return result.data || [];

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log('error', `SQL query failed: ${errorMsg}`);
      this.reportFailure('SQL query', friendlyMessage(error));
      return [];
    }
  }

  /**
   * Safe data transformation with error handling
   * Useful for mapping API results to domain objects
   */
  protected safeTransform<TInput, TOutput>(
    data: TInput[],
    transformer: (item: TInput, index: number) => TOutput,
    defaultValue: TOutput[] = []
  ): TOutput[] {
    try {
      return data.map(transformer);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log('error', `Data transformation failed: ${errorMsg}`);
      return defaultValue;
    }
  }

  /**
   * Aggregate multiple API calls with error handling
   */
  protected async queryMultiple<T = QueryResult>(
    queries: QueryOptions[]
  ): Promise<T[][]> {
    const results = await Promise.allSettled(
      queries.map(query => this.queryAPI<T>(query))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        this.log('error', `Query ${index} failed: ${result.reason}`);
        return [];
      }
    });
  }

  /** Identifies one request (endpoint plus parameters) so a different request cannot clear its error. */
  private requestKey(endpoint: string, params: Record<string, unknown> = {}): string {
    const query = Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join('&');
    return query ? `${endpoint} (${query})` : endpoint;
  }

  private failureSource(what: string): string {
    return `${this.config.serviceName}: ${what}`;
  }

  // Services only run in the browser; guard so server rendering never shares error state between users
  private reportFailure(what: string, message: string): void {
    if (typeof window !== 'undefined') reportApiError(this.failureSource(what), message);
  }

  private clearFailure(what: string): void {
    if (typeof window !== 'undefined') clearApiError(this.failureSource(what));
  }

  /**
   * Check if service is connected
   */
  isConnected(): boolean {
    return this.initialized;
  }

  /**
   * Get service configuration
   */
  getConfig(): Readonly<Required<DatabaseServiceConfig>> {
    return { ...this.config };
  }

  /**
   * Close database connection
   * Override in subclasses if cleanup is needed
   */
  async close(): Promise<void> {
    this.initialized = false;
    this.log('info', 'Connection closed');
  }

  /**
   * Structured logging
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const prefix = `[${this.config.serviceName}]`;

    switch (level) {
      case 'info':
        console.log(prefix, message, data || '');
        break;
      case 'warn':
        console.warn(prefix, message, data || '');
        break;
      case 'error':
        console.error(prefix, message, data || '');
        break;
    }
  }

  /**
   * Utility: delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Helper type for creating typed database services
 */
export type DatabaseService<T extends BaseDatabaseService> = T;
