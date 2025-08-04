// Unified Analytics Query API
// Handles direct SQL queries to the unified DuckDB database

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { DuckDBInstance } from '@duckdb/node-api';
import { join } from 'path';

// Initialize DuckDB connection
let db: DuckDBInstance | null = null;

async function getDb() {
  if (!db) {
    const dbPath = join(process.cwd(), '../etl/sentiment_analysis.db');
    db = await DuckDBInstance.create(dbPath);
  }
  return db;
}

/**
 * POST /api/unified-analytics/query
 * Execute SQL queries against the unified database
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const { sql, params = {} } = await request.json();
    
    if (!sql) {
      return json({
        success: false,
        error: 'SQL query is required'
      }, { status: 400 });
    }

    console.log('Executing SQL query:', sql);
    
    const database = await getDb();
    const connection = await database.connect();
    
    // Execute the query
    const result = await connection.runAndReadAll(sql);
    const rows = result.getRowObjectsJS();
    
    console.log(`Query executed successfully, returned ${rows.length} rows`);
    
    connection.closeSync();
    
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
    
  } catch (error) {
    console.error('Database query error:', error);
    
    return json({
      success: false,
      error: error.message,
      details: error.stack
    }, { status: 500 });
  }
};