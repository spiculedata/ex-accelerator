// Workspace Context Resolver
// Resolves a workspace ID into a data scope for filtering analytics queries

import { postgresPool } from './postgres';

export interface WorkspaceDataScope {
  workspaceId: number;
  workspaceName: string;
  datasets: Array<{
    id: number;
    name: string;
    dataset_type: string;
    source_platform: string | null;
    table_name: string | null;
    schema_name: string | null;
    date_range_start: string | null;
    date_range_end: string | null;
  }>;
  // Derived convenience flags
  hasSocialMedia: boolean;
  hasGdeltEvents: boolean;
  hasGdeltGkg: boolean;
  // Derived filter values
  socialPlatforms: string[];
  datasetTypes: string[];
  gdeltDateRange: { start: number; end: number } | null; // YYYYMMDD integers
}

/**
 * What a request asked for, as three cases a caller cannot confuse:
 * - none: no workspace was requested, so the request is unscoped by choice
 * - scoped: the workspace exists; filter by `scope`
 * - missing: a workspace was requested but is unknown or its id is malformed.
 *   Callers must answer 404 or an empty result, never unscoped data.
 * A database failure is not a result: it throws.
 */
export type WorkspaceScopeResult =
  | { kind: 'none' }
  | { kind: 'scoped'; scope: WorkspaceDataScope }
  | { kind: 'missing'; workspaceId: number | null };

const WORKSPACE_ID_PATTERN = /^\d+$/;
/** workspaces.id is a Postgres integer: a larger id cannot exist, so it is missing rather than a query error. */
const MAX_WORKSPACE_ID = 2_147_483_647;

/**
 * Resolve workspace scope from a URL's workspace_id (or legacy workspace) param.
 * Throws if the database fails.
 */
export async function resolveWorkspaceScope(url: URL): Promise<WorkspaceScopeResult> {
  const wsId = url.searchParams.get('workspace_id') || url.searchParams.get('workspace');
  if (!wsId) return { kind: 'none' };

  const workspaceId = WORKSPACE_ID_PATTERN.test(wsId) ? Number(wsId) : NaN;
  if (!Number.isSafeInteger(workspaceId) || workspaceId > MAX_WORKSPACE_ID) return { kind: 'missing', workspaceId: null };

  const scope = await resolveWorkspaceScopeById(workspaceId);
  return scope ? { kind: 'scoped', scope } : { kind: 'missing', workspaceId };
}

/**
 * Resolve workspace scope by ID.
 */
/** Returns null if the workspace does not exist; throws if the database fails. */
export async function resolveWorkspaceScopeById(workspaceId: number): Promise<WorkspaceDataScope | null> {
  try {
    // Get workspace name
    const wsRows = await postgresPool.query<{ name: string }>(
      'SELECT name FROM workspaces WHERE id = $1',
      [workspaceId]
    );
    if (wsRows.length === 0) return null;

    // Get linked datasets with full metadata
    const datasets = await postgresPool.query<any>(
      `SELECT d.id, d.name, d.dataset_type, d.source_platform, d.table_name, d.schema_name,
              d.date_range_start, d.date_range_end
       FROM datasets d
       JOIN workspace_datasets wd ON d.id = wd.dataset_id
       WHERE wd.workspace_id = $1 AND wd.status = 'active'`,
      [workspaceId]
    );

    const socialPlatforms = [
      ...new Set(
        datasets
          .filter(d => d.dataset_type === 'social_media' && d.source_platform)
          .map(d => d.source_platform.toLowerCase())
      )
    ];

    const gdeltDatasets = datasets.filter(d =>
      d.dataset_type === 'gdelt_events' || d.dataset_type === 'gdelt_gkg'
    );

    let gdeltDateRange: { start: number; end: number } | null = null;
    if (gdeltDatasets.length > 0) {
      const starts = gdeltDatasets
        .filter(d => d.date_range_start)
        .map(d => parseInt(new Date(d.date_range_start).toISOString().slice(0, 10).replace(/-/g, '')));
      const ends = gdeltDatasets
        .filter(d => d.date_range_end)
        .map(d => parseInt(new Date(d.date_range_end).toISOString().slice(0, 10).replace(/-/g, '')));

      if (starts.length > 0 && ends.length > 0) {
        gdeltDateRange = {
          start: Math.min(...starts),
          end: Math.max(...ends)
        };
      }
    }

    return {
      workspaceId,
      workspaceName: wsRows[0].name,
      datasets,
      hasSocialMedia: socialPlatforms.length > 0,
      hasGdeltEvents: gdeltDatasets.some(d => d.dataset_type === 'gdelt_events'),
      hasGdeltGkg: gdeltDatasets.some(d => d.dataset_type === 'gdelt_gkg'),
      socialPlatforms,
      datasetTypes: [...new Set(datasets.map(d => d.dataset_type))],
      gdeltDateRange
    };
  } catch (error) {
    // null means "no workspace filter": a failure must not widen the data a caller sees
    console.error('Failed to resolve workspace scope:', error);
    throw error;
  }
}

// ─── SQL Filter Builders ─────────────────────────────────────────────────────

/**
 * Build a platform filter for social media queries.
 * Returns { clause, params, nextIndex } or null if no filter needed.
 */
export function buildPlatformFilter(
  scope: WorkspaceDataScope | null,
  paramIndex: number
): { clause: string; params: any[]; nextIndex: number } | null {
  if (!scope || !scope.hasSocialMedia || scope.socialPlatforms.length === 0) {
    return null;
  }

  const placeholders = scope.socialPlatforms.map((_, i) => `$${paramIndex + i}`).join(', ');
  return {
    clause: `LOWER(platform) IN (${placeholders})`,
    params: scope.socialPlatforms,
    nextIndex: paramIndex + scope.socialPlatforms.length
  };
}

/**
 * Build a GDELT date filter from workspace scope.
 * Returns { clause, params, nextIndex } or null if no filter needed.
 */
export function buildGdeltDateFilter(
  scope: WorkspaceDataScope | null,
  paramIndex: number
): { clause: string; params: any[]; nextIndex: number } | null {
  if (!scope || !scope.gdeltDateRange) {
    return null;
  }

  return {
    clause: `sqldate BETWEEN $${paramIndex} AND $${paramIndex + 1}`,
    params: [scope.gdeltDateRange.start, scope.gdeltDateRange.end],
    nextIndex: paramIndex + 2
  };
}

/**
 * Check if workspace has any datasets of the given type.
 * If scope is null (global view), returns true (show everything).
 */
export function hasDataType(scope: WorkspaceDataScope | null, type: string): boolean {
  if (!scope) return true; // Global view
  return scope.datasetTypes.includes(type);
}

/**
 * Extract all filter params from URL — workspace, platforms, date range.
 * Used by API endpoints to build comprehensive SQL conditions.
 */
export interface QueryFilters {
  scope: WorkspaceDataScope | null;
  platforms: string[] | null;      // explicit platform filter (overrides workspace)
  dateStart: string | null;        // ISO date string
  dateEnd: string | null;          // ISO date string
}

export async function resolveFilters(url: URL): Promise<QueryFilters> {
  const resolved = await resolveWorkspaceScope(url);
  if (resolved.kind === 'missing') throw new Error('Workspace not found');
  const scope = resolved.kind === 'scoped' ? resolved.scope : null;

  // Explicit platform filter (comma-separated)
  const platformsParam = url.searchParams.get('platforms');
  const platforms = platformsParam ? platformsParam.split(',').filter(Boolean) : null;

  // Date range filter
  const dateStart = url.searchParams.get('date_start') || null;
  const dateEnd = url.searchParams.get('date_end') || null;

  return { scope, platforms, dateStart, dateEnd };
}

/**
 * Build SQL conditions for social media queries with all filters applied.
 * Returns conditions array and params array for parameterized queries.
 */
export function buildSocialFilters(
  filters: QueryFilters,
  paramIndex: number,
  tableAlias: string = ''
): { conditions: string[]; params: any[]; nextIndex: number } {
  const conditions: string[] = [];
  const params: any[] = [];
  let idx = paramIndex;
  const prefix = tableAlias ? `${tableAlias}.` : '';

  // Platform filter: explicit platforms > workspace scope > no filter
  const platformList = filters.platforms
    || (filters.scope?.hasSocialMedia ? filters.scope.socialPlatforms : null);

  if (platformList && platformList.length > 0) {
    conditions.push(`LOWER(${prefix}platform) = ANY($${idx})`);
    params.push(platformList.map(p => p.toLowerCase()));
    idx++;
  }

  // Date range filter
  if (filters.dateStart) {
    conditions.push(`${prefix}published_at >= $${idx}`);
    params.push(filters.dateStart);
    idx++;
  }
  if (filters.dateEnd) {
    conditions.push(`${prefix}published_at <= $${idx}`);
    params.push(filters.dateEnd);
    idx++;
  }

  return { conditions, params, nextIndex: idx };
}
