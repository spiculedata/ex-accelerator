// For routes that read a project or workspace id from the request body, or list projects, where the request hook cannot
// see the id (or must not hide the whole list): the same rule, applied inside the route.
import { json } from '@sveltejs/kit';
import { canAccessProject } from './access';
import { checkAccess } from './accessCheck';
import { listProjectAccessInfo } from './accessRepo';
import type { SessionUser } from './session';

type User = Pick<SessionUser, 'email' | 'role'>;

const wholeNumbers = (values: unknown[] | undefined): number[] =>
  (values ?? []).map((v) => (typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN)).filter((n) => Number.isSafeInteger(n) && n > 0);

/**
 * A 403 JSON response when the user may not see the project or workspace the route is about, a 503 when that cannot be
 * checked, or null when the route may go on. Ids that are missing or not whole numbers are left to the route's own validation.
 */
export async function refuseIfNoAccess(
  user: User | null | undefined,
  ids: { projects?: unknown[]; workspaces?: unknown[] }
): Promise<Response | null> {
  if (!user) return json({ success: false, data: null, error: 'Authentication required' }, { status: 401 });
  try {
    const result = await checkAccess(user, { projects: wholeNumbers(ids.projects), workspaces: wholeNumbers(ids.workspaces) });
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
      verdicts.set(workspaceId, (await checkAccess(user, { projects: [], workspaces: [workspaceId] })).allowed);
    }
  }
  return rows.filter((row) => {
    const workspaceId = workspaceOf(row);
    return !workspaceId || verdicts.get(workspaceId) === true;
  });
}
