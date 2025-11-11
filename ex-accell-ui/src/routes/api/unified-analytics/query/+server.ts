// Unified Analytics Query API
// Handles direct SQL queries to PostgreSQL with pg_duckdb extension

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { postgresPool } from '$lib/services/postgres';

/**
 * POST /api/unified-analytics/query
 * Execute SQL queries against PostgreSQL using DuckDB execution engine
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const { sql, params = [] } = await request.json();

    if (!sql) {
      return json({
        success: false,
        error: 'SQL query is required'
      }, { status: 400 });
    }

    console.log('Executing SQL query:', sql);

    // Execute query using DuckDB execution engine for analytical queries
    const rows = await postgresPool.duckdbQuery(sql, params);

    console.log(`Query executed successfully, returned ${rows.length} rows`);

    // Convert BigInts to regular numbers for JSON serialization
    const serializedRows = rows.map(row => {
      const serializedRow: any = {};
      for (const [key, value] of Object.entries(row)) {
        if (typeof value === 'bigint') {
          serializedRow[key] = Number(value);
        } else {
          serializedRow[key] = value;
        }
      }
      return serializedRow;
    });

    return json({
      success: true,
      data: serializedRows,
      rowCount: serializedRows.length
    });

  } catch (error: any) {
    console.error('Database query error:', error);

    return json({
      success: false,
      error: error.message,
      details: error.stack
    }, { status: 500 });
  }
};