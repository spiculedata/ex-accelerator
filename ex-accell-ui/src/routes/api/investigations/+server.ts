// Investigations API Endpoint
// CRUD operations for investigation configurations

import type { SessionUser } from '$lib/server/auth/session';
import { parseResourceId } from '$lib/server/auth/access';
import { filterByWorkspaceAccess, refuseIfNoAccess } from '$lib/server/auth/accessGuard';
import { canModifyInvestigation } from '$lib/server/investigationAccess';
import { investigationListQuery } from '$lib/server/investigationQuery';
import { json } from '@sveltejs/kit';
import { validateDayRange } from '$lib/utils/calendarDay';
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
export const GET: RequestHandler = async ({ url, locals }) => {
  try {
    await ensureTable();

    const id = url.searchParams.get('id');
    const workspaceId = url.searchParams.get('workspace_id');
    const projectId = url.searchParams.get('project_id');

    if (id) {
      const numericId = investigationId(id);
      if (numericId === null) return BAD_ID();
      const rows = await postgresPool.query(
        'SELECT * FROM investigations WHERE id = $1',
        [numericId]
      );

      if (rows.length === 0) {
        return json({ success: false, error: 'Investigation not found' }, { status: 404 });
      }

      const refused = await refuseIfNoAccess(locals.user, { workspaces: [rows[0].workspace_id] });
      if (refused) return refused;
      return json({ success: true, investigation: rows[0] });
    }

    // List investigations, optionally limited to one workspace or to the workspaces of one project
    // A filter that was asked for but is not a whole number must not widen to the unfiltered list
    const filterId = (raw: string | null) => (raw ? (/^\d+$/.test(raw) ? Number(raw) : NaN) : undefined);
    const wsNumber = filterId(workspaceId);
    const projectNumber = filterId(projectId);
    const isBadFilter = (value: number | undefined) => value !== undefined && !(value <= MAX_INTEGER_ID);
    if (isBadFilter(wsNumber) || isBadFilter(projectNumber)) {
      return json({ success: false, error: 'workspace_id and project_id must be whole numbers' }, { status: 400 });
    }
    const { sql, params } = investigationListQuery({ workspaceId: wsNumber, projectId: projectNumber });

    const all = await postgresPool.query(sql, params);
    // Only investigations of workspaces this person may see
    const investigations = locals.user ? await filterByWorkspaceAccess(locals.user, all, (row: any) => row.workspace_id) : [];
    return json({ success: true, investigations });
  } catch (error) {
    // The cause is logged; the browser gets a generic message, never database detail
    console.error('GET /api/investigations error:', error instanceof Error ? error.message : String(error));
    return json({ success: false, error: 'The investigation request failed. Try again in a moment.' }, { status: 500 });
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

    // The date range is optional, but when given it must be real days with the start not after the end.
    // It can arrive as flat fields or inside query_config, so both are checked.
    const rangeProblem = validateDayRange(data.date_start, data.date_end) ?? validateDayRange(data.query_config?.dateStart, data.query_config?.dateEnd);
    if (rangeProblem) {
      return json({ success: false, error: rangeProblem }, { status: 400 });
    }

    // workspace_id is optional, but when present it must name an existing workspace
    let workspaceId: number | null = null;
    if (data.workspace_id !== undefined && data.workspace_id !== null) {
      if (!Number.isInteger(data.workspace_id) || data.workspace_id < 1) {
        return json({ success: false, error: 'workspace_id must be a positive integer' }, { status: 400 });
      }
      const found = await postgresPool.query('SELECT id FROM workspaces WHERE id = $1', [data.workspace_id]);
      if (!found.length) {
        return json({ success: false, error: 'Workspace not found' }, { status: 404 });
      }
      const refused = await refuseIfNoAccess(locals.user, { workspaces: [data.workspace_id] });
      if (refused) return refused;
      workspaceId = data.workspace_id;
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
        workspaceId,
        locals.user?.email ?? null
      ]
    );

    return json({ success: true, investigation: rows[0] });
  } catch (error) {
    // The cause is logged; the browser gets a generic message, never database detail
    console.error('POST /api/investigations error:', error instanceof Error ? error.message : String(error));
    return json({ success: false, error: 'The investigation request failed. Try again in a moment.' }, { status: 500 });
  }
};

/** Ids are Postgres integers: a larger value cannot exist and would only fail the query. */
const MAX_INTEGER_ID = 2_147_483_647;
const BAD_ID = () => json({ success: false, error: 'Investigation ID must be a whole number' }, { status: 400 });

/** The one reading of an id. The check and the change both use this number, never a second parse of the raw value. */
function investigationId(raw: unknown): number | null {
  const id = parseResourceId(raw);
  return typeof id === 'number' ? id : null;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** A 403 when the signed-in user may not change this investigation, or null when they may (or it does not exist yet to be refused). */
async function refuseUnlessAllowed(numericId: number, user: Pick<SessionUser, 'email' | 'role'> | null | undefined): Promise<Response | null> {
  const rows = await postgresPool.query('SELECT created_by, workspace_id FROM investigations WHERE id = $1', [numericId]);
  if (rows.length === 0) return null; // the handler reports not found
  // The workspace's project must be one the person belongs to, as well as the investigation being theirs to change
  const noAccess = await refuseIfNoAccess(user, { workspaces: [rows[0].workspace_id] });
  if (noAccess) return noAccess;
  return canModifyInvestigation(user, rows[0].created_by) ? null : json({ success: false, error: 'Only the person who created this investigation, or an admin, can change it.' }, { status: 403 });
}

/**
 * PATCH /api/investigations
 * Update an existing investigation
 */
export const PATCH: RequestHandler = async ({ request, locals }) => {
  try {
    await ensureTable();

    const data = await request.json();

    if (!data.id) {
      return json({ success: false, error: 'Investigation ID required' }, { status: 400 });
    }

    const numericId = investigationId(data.id);
    if (numericId === null) return BAD_ID();
    const denied = await refuseUnlessAllowed(numericId, locals.user);
    if (denied) return denied;

    // Build dynamic SET clause from provided fields
    const allowedFields = [
      'name', 'description', 'query_config', 'layout_config',
      'pinned_views', 'annotations'
    ];
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Notes are a list. Decode text from older clients first, then refuse anything else at the boundary
    if (data.annotations !== undefined) {
      const decoded = typeof data.annotations === 'string' ? safeJsonParse(data.annotations) : data.annotations;
      if (!Array.isArray(decoded)) {
        return json({ success: false, error: 'annotations must be a list of notes' }, { status: 400 });
      }
      data.annotations = decoded; // decoded once; the loop below only encodes
    }

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        // JSON columns are encoded exactly once. Older clients sent annotations already stringified,
        // which stored a JSON string inside the JSON column, so a string is decoded first.
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

    params.push(numericId);
    const sql = `UPDATE investigations SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

    const rows = await postgresPool.query(sql, params);

    if (rows.length === 0) {
      return json({ success: false, error: 'Investigation not found' }, { status: 404 });
    }

    return json({ success: true, investigation: rows[0] });
  } catch (error) {
    // The cause is logged; the browser gets a generic message, never database detail
    console.error('PATCH /api/investigations error:', error instanceof Error ? error.message : String(error));
    return json({ success: false, error: 'The investigation request failed. Try again in a moment.' }, { status: 500 });
  }
};

/**
 * DELETE /api/investigations?id=X
 * Delete an investigation
 */
export const DELETE: RequestHandler = async ({ url, locals }) => {
  try {
    await ensureTable();

    const id = url.searchParams.get('id');

    if (!id) {
      return json({ success: false, error: 'Investigation ID required' }, { status: 400 });
    }

    const numericId = investigationId(id);
    if (numericId === null) return BAD_ID();
    const denied = await refuseUnlessAllowed(numericId, locals.user);
    if (denied) return denied;

    const rows = await postgresPool.query(
      'DELETE FROM investigations WHERE id = $1 RETURNING id',
      [numericId]
    );

    if (rows.length === 0) {
      return json({ success: false, error: 'Investigation not found' }, { status: 404 });
    }

    return json({ success: true });
  } catch (error) {
    // The cause is logged; the browser gets a generic message, never database detail
    console.error('DELETE /api/investigations error:', error instanceof Error ? error.message : String(error));
    return json({ success: false, error: 'The investigation request failed. Try again in a moment.' }, { status: 500 });
  }
};
