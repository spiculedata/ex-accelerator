import { query } from '$lib/services/postgres';
import type { ProjectAccessInfo } from './access';

/** A project's creator and members, or null when there is no such project. */
export async function loadProjectAccessInfo(projectId: number): Promise<ProjectAccessInfo | null> {
  const rows = await query<{ created_by: string | null; members: string[] | null }>(
    `SELECT p.created_by,
            COALESCE(array_agg(m.email) FILTER (WHERE m.email IS NOT NULL), '{}') AS members
       FROM projects p LEFT JOIN project_members m ON m.project_id = p.id
      WHERE p.id = $1
      GROUP BY p.id`,
    [projectId]
  );
  if (rows.length === 0) return null;
  return { createdBy: rows[0].created_by, memberEmails: rows[0].members ?? [] };
}

/** The project a workspace belongs to, or null when there is no such workspace. */
export async function projectIdOfWorkspace(workspaceId: number): Promise<number | null> {
  const rows = await query<{ project_id: number }>('SELECT project_id FROM workspaces WHERE id = $1', [workspaceId]);
  return rows.length > 0 ? Number(rows[0].project_id) : null;
}

/** Every project's creator and members, for filtering a list down to what a person may see. */
export async function listProjectAccessInfo(): Promise<Map<number, ProjectAccessInfo>> {
  const rows = await query<{ id: number; created_by: string | null; members: string[] | null }>(
    `SELECT p.id, p.created_by,
            COALESCE(array_agg(m.email) FILTER (WHERE m.email IS NOT NULL), '{}') AS members
       FROM projects p LEFT JOIN project_members m ON m.project_id = p.id
      GROUP BY p.id`
  );
  return new Map(rows.map((row) => [Number(row.id), { createdBy: row.created_by, memberEmails: row.members ?? [] }]));
}
