// The investigations list, optionally limited to one workspace or to every workspace of one project.
// Values are always bound as parameters.

export function investigationListQuery(filters: { workspaceId?: number; projectId?: number }): { sql: string; params: number[] } {
  const conditions: string[] = [];
  const params: number[] = [];
  if (filters.workspaceId !== undefined) {
    params.push(filters.workspaceId);
    conditions.push(`workspace_id = $${params.length}`);
  }
  if (filters.projectId !== undefined) {
    params.push(filters.projectId);
    conditions.push(`workspace_id IN (SELECT id FROM workspaces WHERE project_id = $${params.length})`);
  }
  const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  return { sql: `SELECT * FROM investigations${where} ORDER BY updated_at DESC`, params };
}
