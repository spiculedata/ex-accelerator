// PostgreSQL with pg_duckdb extension connection service
// Provides connection pooling and unified query interface for PostgreSQL + DuckDB

import { Pool, type PoolClient, type QueryResult } from 'pg';

interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max?: number; // Maximum number of clients in pool
  idleTimeoutMillis?: number; // How long a client is allowed to remain idle
  connectionTimeoutMillis?: number; // How long to wait for connection
}

interface QueryOptions {
  useDuckDB?: boolean; // Whether to use DuckDB execution engine
  params?: any[];
}

class PostgresConnectionPool {
  private pool: Pool | null = null;
  private config: PostgresConfig;
  private initialized = false;

  constructor(config?: Partial<PostgresConfig>) {
    // Default configuration with environment variable overrides
    this.config = {
      host: config?.host || process.env.POSTGRES_HOST || 'localhost',
      port: config?.port || parseInt(process.env.POSTGRES_PORT || '5432'),
      database: config?.database || process.env.POSTGRES_DB || 'postgres',
      user: config?.user || process.env.POSTGRES_USER || process.env.USER || 'postgres',
      password: config?.password || process.env.POSTGRES_PASSWORD || '',
      max: config?.max || parseInt(process.env.POSTGRES_POOL_MAX || '20'),
      idleTimeoutMillis: config?.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config?.connectionTimeoutMillis || 5000
    };

    console.log('PostgreSQL Pool Config:', {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      hasPassword: !!this.config.password,
      max: this.config.max
    });
  }

  /**
   * Initialize the connection pool and enable pg_duckdb extension
   */
  async connect(): Promise<void> {
    if (this.initialized && this.pool) {
      return;
    }

    try {
      this.pool = new Pool({
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        max: this.config.max,
        idleTimeoutMillis: this.config.idleTimeoutMillis,
        connectionTimeoutMillis: this.config.connectionTimeoutMillis
      });

      // Test connection and enable pg_duckdb
      const client = await this.pool.connect();
      try {
        // Enable pg_duckdb extension
        await client.query('CREATE EXTENSION IF NOT EXISTS pg_duckdb');

        // Test query
        const result = await client.query('SELECT 1 as test');
        if (result.rows[0].test !== 1) {
          throw new Error('Connection test failed');
        }

        this.initialized = true;
        console.log('PostgreSQL connection pool initialized with pg_duckdb extension');
      } finally {
        client.release();
      }

      // Handle pool errors
      this.pool.on('error', (err) => {
        console.error('Unexpected error on idle client', err);
      });

    } catch (error: any) {
      console.error('Failed to initialize PostgreSQL connection pool:', {
        error: error.message,
        code: error.code,
        detail: error.detail,
        config: {
          host: this.config.host,
          port: this.config.port,
          database: this.config.database,
          user: this.config.user
        }
      });
      throw error;
    }
  }

  /**
   * Execute a query using PostgreSQL or DuckDB execution engine
   */
  async query<T = any>(
    sql: string,
    params?: any[],
    options: QueryOptions = {}
  ): Promise<T[]> {
    if (!this.initialized || !this.pool) {
      await this.connect();
    }

    const client = await this.pool!.connect();

    try {
      // If using DuckDB execution engine, set the execution engine
      if (options.useDuckDB) {
        await client.query("SET duckdb.execution TO 'on'");
      }

      // Execute the query
      const result: QueryResult = await client.query(sql, params || []);

      // Reset execution engine if it was changed
      if (options.useDuckDB) {
        await client.query("SET duckdb.execution TO 'off'");
      }

      return result.rows as T[];
    } catch (error) {
      console.error('Query execution error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Execute a query using DuckDB execution engine
   * This leverages pg_duckdb for analytical queries
   */
  async duckdbQuery<T = any>(sql: string, params?: any[]): Promise<T[]> {
    return this.query<T>(sql, params, { useDuckDB: true });
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    if (!this.initialized || !this.pool) {
      await this.connect();
    }

    const client = await this.pool!.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Transaction error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Query DuckDB tables directly through pg_duckdb
   * This allows querying DuckDB databases attached to PostgreSQL
   */
  async queryDuckDBTable<T = any>(
    tableName: string,
    whereClause?: string,
    params?: any[]
  ): Promise<T[]> {
    const sql = `
      SELECT * FROM ${tableName}
      ${whereClause ? `WHERE ${whereClause}` : ''}
    `;
    return this.duckdbQuery<T>(sql, params);
  }

  /**
   * Attach a DuckDB database file to PostgreSQL
   * This allows querying DuckDB files through PostgreSQL
   */
  async attachDuckDBDatabase(
    alias: string,
    filePath: string
  ): Promise<void> {
    if (!this.initialized || !this.pool) {
      await this.connect();
    }

    const client = await this.pool!.connect();

    try {
      // Use pg_duckdb to attach DuckDB database
      await client.query("SET duckdb.execution TO 'on'");
      await client.query(`ATTACH '${filePath}' AS ${alias}`);
      console.log(`DuckDB database attached as '${alias}' from ${filePath}`);
    } catch (error) {
      console.error(`Failed to attach DuckDB database '${alias}':`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get connection pool statistics
   */
  getPoolStats() {
    if (!this.pool) {
      return null;
    }

    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    };
  }

  /**
   * Check if the connection pool is healthy
   */
  async healthCheck(): Promise<boolean> {
    console.log('Health check called, initialized:', this.initialized, 'has pool:', !!this.pool);

    if (!this.initialized || !this.pool) {
      try {
        console.log('Attempting to connect...');
        await this.connect();
      } catch (error: any) {
        console.error('Health check - connect failed:', error.message);
        return false;
      }
    }

    try {
      const client = await this.pool!.connect();
      try {
        const result = await client.query('SELECT 1 as health');
        const isHealthy = result.rows[0].health === 1;
        console.log('Health check result:', isHealthy);
        return isHealthy;
      } finally {
        client.release();
      }
    } catch (error: any) {
      console.error('Health check failed:', {
        message: error.message,
        code: error.code,
        detail: error.detail
      });
      return false;
    }
  }

  /**
   * Get a client from the pool for complex operations
   */
  async getClient(): Promise<PoolClient> {
    if (!this.initialized || !this.pool) {
      await this.connect();
    }

    return this.pool!.connect();
  }

  /**
   * Close the connection pool
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.initialized = false;
      console.log('PostgreSQL connection pool closed');
    }
  }

  /**
   * Check if the pool is connected
   */
  isConnected(): boolean {
    return this.initialized && this.pool !== null;
  }
}

// Create and export singleton instance
export const postgresPool = new PostgresConnectionPool();

// Export types for consumers
export type { PostgresConfig, QueryOptions, PoolClient };

// Helper functions for backward compatibility
export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  return postgresPool.query<T>(sql, params);
}

export async function duckdbQuery<T = any>(sql: string, params?: any[]): Promise<T[]> {
  return postgresPool.duckdbQuery<T>(sql, params);
}

export function isConnected(): boolean {
  return postgresPool.isConnected();
}

export async function close(): Promise<void> {
  return postgresPool.close();
}
