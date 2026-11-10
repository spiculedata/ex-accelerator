import { canAccessProject, type ProjectAccessInfo, type RequestResources } from './access';
import { loadProjectAccessInfo, projectIdOfWorkspace } from './accessRepo';
import type { SessionUser } from './session';

// Membership changes rarely and is checked on many requests, so answers are kept briefly. A person added to a project
// gets in, and one removed is shut out, within this long.
const CACHE_TTL_MS = 30_000;

interface Cached<T> {
  value: T;
  at: number;
}

const projectCache = new Map<number, Cached<ProjectAccessInfo | null>>();
const workspaceCache = new Map<number, Cached<number | null>>();

async function cached<K, V>(cache: Map<K, Cached<V>>, key: K, load: (key: K) => Promise<V>): Promise<V> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  const value = await load(key);
  cache.set(key, { value, at: Date.now() });
  return value;
}

export type AccessResult = { allowed: true } | { allowed: false; what: 'project' | 'workspace' };

/**
 * Whether the user may see every project and workspace the request names. A resource that does not exist is allowed
 * here so the route can answer 404 itself. Database failures are raised, never guessed at.
 */
export async function checkAccess(user: Pick<SessionUser, 'email' | 'role'>, resources: RequestResources): Promise<AccessResult> {
  if (user.role === 'admin') return { allowed: true };

  for (const projectId of resources.projects) {
    const info = await cached(projectCache, projectId, loadProjectAccessInfo);
    if (info && !canAccessProject(user, info)) return { allowed: false, what: 'project' };
  }
  for (const workspaceId of resources.workspaces) {
    const projectId = await cached(workspaceCache, workspaceId, projectIdOfWorkspace);
    if (projectId === null) continue;
    const info = await cached(projectCache, projectId, loadProjectAccessInfo);
    if (info && !canAccessProject(user, info)) return { allowed: false, what: 'workspace' };
  }
  return { allowed: true };
}

/** Forgets remembered membership, for example after someone is added to or removed from a project. */
export function forgetProjectAccess(projectId?: number): void {
  if (projectId === undefined) projectCache.clear();
  else projectCache.delete(projectId);
}

/** For tests: forget everything that was remembered. */
export function resetAccessCacheForTests(): void {
  projectCache.clear();
  workspaceCache.clear();
}
