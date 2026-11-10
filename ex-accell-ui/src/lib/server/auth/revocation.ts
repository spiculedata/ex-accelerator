// Ending sessions early. A session is a signed token that carries the user's session version; raising the version on the
// server makes every older token invalid. Versions are remembered for a short time (see sessionVersionCache), so a
// revocation made on another instance takes at most this long to apply; on this instance it applies at once.
import { createLogger } from '$lib/utils/logger';
import { createSessionVersionCache } from './sessionVersionCache';
import { bumpSessionVersion, getSessionVersion } from './userRepo';

const log = createLogger('auth');

const CACHE_TTL_MS = 30_000;

let cache = createSessionVersionCache({ lookup: getSessionVersion, ttlMs: CACHE_TTL_MS });

/** True when a session issued under `sessionVersion` is still valid for this user. */
export async function isSessionCurrent(userId: string, sessionVersion: number): Promise<boolean> {
  try {
    const current = await cache.get(userId);
    return current !== null && current === sessionVersion;
  } catch (error) {
    // Nothing is known about this user and the database cannot be asked: do not let an unchecked session through
    log.error('Could not check a session against its user', { message: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

/** Ends every session issued so far for the user (sign out everywhere). Returns the new version, for signing a new session. */
export async function revokeSessions(userId: string): Promise<number> {
  const version = await bumpSessionVersion(userId);
  cache.invalidate(userId);
  return version;
}

/** For tests: forget everything that was remembered. */
export function resetRevocationCacheForTests(): void {
  cache = createSessionVersionCache({ lookup: getSessionVersion, ttlMs: CACHE_TTL_MS });
}
