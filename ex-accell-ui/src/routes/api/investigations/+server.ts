// Investigations API Endpoint
// CRUD operations for investigation configurations

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { postgresPool } from '$lib/services/postgres';

let tableEnsured = false;

/**
 * Ensure the investigations table exists (runs once per server lifecycle)
 */
async function ensureTable(): Promise<void> {
  if (tableEnsured) return;

  await postgresPool.query(`
    CREATE TABLE IF NOT EXISTS investigations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      query_config JSONB NOT NULL,
      layout_config JSONB DEFAULT '{}',
      pinned_views JSONB DEFAULT '[]',
      annotations JSONB DEFAULT '[]',
      created_by VARCHAR(255),
      workspace_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  tableEnsured = true;
}

/**
 * GET /api/investigations
 * List all investigations or get a single one by id
 */
export const GET: RequestHandler = async ({ url }) => {
  try {
    await ensureTable();

    const id = url.searchParams.get('id');
    const workspaceId = url.searchParams.get('workspace_id');

    if (id) {
      const rows = await postgresPool.query(
        'SELECT * FROM investigations WHERE id = $1',
        [parseInt(id)]
      );

      if (rows.length === 0) {
        return json({ success: false, error: 'Investigation not found' }, { status: 404 });
      }

      return json({ success: true, investigation: rows[0] });
    }

    // List investigations, optionally filtered by workspace_id
    let sql = 'SELECT * FROM investigations';
    const params: any[] = [];

    if (workspaceId) {
      sql += ' WHERE workspace_id = $1';
      params.push(parseInt(workspaceId));
    }

    sql += ' ORDER BY updated_at DESC';

    const investigations = await postgresPool.query(sql, params);
    return json({ success: true, investigations });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('GET /api/investigations error:', msg);
    return json({ success: false, error: msg }, { status: 500 });
  }
};

/**
 * POST /api/investigations
 * Create a new investigation
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    await ensureTable();

    const data = await request.json();

    if (!data.name) {
      return json({ success: false, error: 'name is required' }, { status: 400 });
    }

    // The New Investigation form sends flat fields; everything downstream reads this shape
    const queryConfig = data.query_config ?? {
      keywords: Array.isArray(data.keywords) ? data.keywords : [],
      dateStart: data.date_start || '',
      dateEnd: data.date_end || '',
      sources: Array.isArray(data.sources) ? data.sources : []
    };

    const rows = await postgresPool.query(
      `INSERT INTO investigations (name, description, query_config, workspace_id, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        data.name,
        data.description || null,
        JSON.stringify(queryConfig),
        data.workspace_id || null,
        locals.user?.email ?? null
      ]
    );

    return json({ success: true, investigation: rows[0] });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('POST /api/investigations error:', msg);
    return json({ success: false, error: msg }, { status: 500 });
  }
};

/**
 * PATCH /api/investigations
 * Update an existing investigation
 */
export const PATCH: RequestHandler = async ({ request }) => {
  try {
    await ensureTable();

    const data = await request.json();

    if (!data.id) {
      return json({ success: false, error: 'Investigation ID required' }, { status: 400 });
    }

    // Build dynamic SET clause from provided fields
    const allowedFields = [
      'name', 'description', 'query_config', 'layout_config',
      'pinned_views', 'annotations'
    ];
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        const value = ['query_config', 'layout_config', 'pinned_views', 'annotations'].includes(field)
          ? JSON.stringify(data[field])
          : data[field];
        setClauses.push(`${field} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    // Always update the updated_at timestamp
    setClauses.push('updated_at = NOW()');

    params.push(parseInt(data.id));
    const sql = `UPDATE investigations SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

    const rows = await postgresPool.query(sql, params);

    if (rows.length === 0) {
      return json({ success: false, error: 'Investigation not found' }, { status: 404 });
    }

    return json({ success: true, investigation: rows[0] });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('PATCH /api/investigations error:', msg);
    return json({ success: false, error: msg }, { status: 500 });
  }
};

/**
 * DELETE /api/investigations?id=X
 * Delete an investigation
 */
export const DELETE: RequestHandler = async ({ url }) => {
  try {
    await ensureTable();

    const id = url.searchParams.get('id');

    if (!id) {
      return json({ success: false, error: 'Investigation ID required' }, { status: 400 });
    }

    const rows = await postgresPool.query(
      'DELETE FROM investigations WHERE id = $1 RETURNING id',
      [parseInt(id)]
    );

    if (rows.length === 0) {
      return json({ success: false, error: 'Investigation not found' }, { status: 404 });
    }

    return json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('DELETE /api/investigations error:', msg);
    return json({ success: false, error: msg }, { status: 500 });
  }
};
