// For routes that read a project or workspace id from the request body, or list projects, where the request hook cannot
// see the id (or must not hide the whole list): the same rule, applied inside the route.
import { json } from '@sveltejs/kit';
import { canAccessProject, parseResourceId } from './access';
import { checkAccess } from './accessCheck';
import { listProjectAccessInfo } from './accessRepo';
import type { SessionUser } from './session';

type User = Pick<SessionUser, 'email' | 'role'>;

/**
 * A 403 JSON response when the user may not see the project or workspace the route is about, a 503 when that cannot be
 * checked, or null when the route may go on. Ids that are missing or not whole numbers are left to the route's own validation.
 */
export async function refuseIfNoAccess(
  user: User | null | undefined,
  ids: { projects?: unknown[]; workspaces?: unknown[] }
): Promise<Response | null> {
  if (!user) return json({ success: false, data: null, error: 'Authentication required' }, { status: 401 });

  // A missing id is the route's own validation to report. One that is present but not a plain whole number is refused
  // here: a route may read it more loosely (parseInt('9abc') is 9) and reach a project this check never looked at.
  const projects: number[] = [];
  const workspaces: number[] = [];
  for (const [list, values] of [[projects, ids.projects], [workspaces, ids.workspaces]] as const) {
    for (const value of values ?? []) {
      const id = parseResourceId(value);
      if (id === 'invalid') return json({ success: false, data: null, error: 'Invalid project or workspace id' }, { status: 400 });
      if (id !== null) list.push(id);
    }
  }

  try {
    const result = await checkAccess(user, { projects, workspaces, malformed: [] });
    return result.allowed ? null : json({ success: false, data: null, error: `You do not have access to this ${result.what}` }, { status: 403 });
  } catch {
    return json({ success: false, data: null, error: 'The service is temporarily unavailable. Try again in a moment.' }, { status: 503 });
  }
}

/** The ids of the projects this person may see, or null for an admin (everything). */
export async function visibleProjectIds(user: User): Promise<Set<number> | null> {
  if (user.role === 'admin') return null;
  const all = await listProjectAccessInfo();
  return new Set([...all].filter(([, info]) => canAccessProject(user, info)).map(([id]) => id));
}

/** The rows whose workspace the person may see (rows that belong to no workspace are kept). Each workspace is checked once. */
export async function filterByWorkspaceAccess<T>(user: User, rows: T[], workspaceOf: (row: T) => number | null | undefined): Promise<T[]> {
  if (user.role === 'admin') return rows;
  const verdicts = new Map<number, boolean>();
  for (const row of rows) {
    const workspaceId = workspaceOf(row);
    if (workspaceId && !verdicts.has(workspaceId)) {
      verdicts.set(workspaceId, (await checkAccess(user, { projects: [], workspaces: [workspaceId], malformed: [] })).allowed);
    }
  }
  return rows.filter((row) => {
    const workspaceId = workspaceOf(row);
    return !workspaceId || verdicts.get(workspaceId) === true;
  });
}
