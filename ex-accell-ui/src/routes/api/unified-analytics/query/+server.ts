// Unified Analytics Query API
// Handles direct SQL queries to PostgreSQL with pg_duckdb extension (admin-only, see the access guard)

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { postgresPool } from '$lib/services/postgres';
import { apiFail, apiServerError } from '$lib/server/apiResponse';
import { createLogger } from '$lib/utils/logger';

const log = createLogger('analytics-query');

/** Postgres SQLSTATE for a syntax error: the one failure whose message helps the admin who typed the query. */
const SYNTAX_ERROR_CODE = '42601';

function isSyntaxError(error: unknown): error is Error {
  return error instanceof Error && (error as Error & { code?: unknown }).code === SYNTAX_ERROR_CODE;
}

/**
 * POST /api/unified-analytics/query
 * Execute SQL queries against PostgreSQL using DuckDB execution engine
 */
export const POST: RequestHandler = async ({ request }) => {
  let payload: { sql?: unknown; params?: unknown };
  try {
    payload = await request.json();
  } catch {
    return apiFail('Send a JSON body', 400);
  }

  const { sql, params = [] } = payload ?? {};
  if (!sql || typeof sql !== 'string') return apiFail('SQL query is required', 400);
  if (!Array.isArray(params)) return apiFail('params must be an array', 400);

  try {
    log.info('Executing SQL query', { sql });

    // Execute query using DuckDB execution engine for analytical queries
    const rows = await postgresPool.duckdbQuery(sql, params);

    log.info('Query executed', { rowCount: rows.length });

    // Convert BigInts to regular numbers for JSON serialization
    const serializedRows = rows.map(row => {
      const serializedRow: any = {};
      for (const [key, value] of Object.entries(row)) {
        serializedRow[key] = typeof value === 'bigint' ? Number(value) : value;
      }
      return serializedRow;
    });

    return json({
      success: true,
      data: serializedRows,
      rowCount: serializedRows.length
    });
  } catch (error) {
    // The admin wrote this SQL, so a syntax error message is theirs to read; every other failure stays generic
    if (isSyntaxError(error)) {
      log.warn('SQL syntax error', { detail: error.message });
      return apiFail(error.message, 400);
    }
    return apiServerError('Database query', error, 'Query failed');
  }
};
