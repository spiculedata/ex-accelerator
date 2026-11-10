// Ending sessions early. A session is a signed token that carries the user's session version; raising the version on the
// server makes every older token invalid. Versions are remembered for a short time (see sessionVersionCache), so a
// revocation made on another instance takes at most this long to apply; on this instance it applies at once.
import { createLogger } from '$lib/utils/logger';
import { createSessionVersionCache } from './sessionVersionCache';
import { bumpSessionVersion, ensureAuthSchema, getSessionVersion } from './userRepo';

const log = createLogger('auth');

const CACHE_TTL_MS = 30_000;

// The column may not exist yet on an install that has not signed anyone in since upgrading, so make sure it does first
const lookupVersion = async (userId: string) => {
  await ensureAuthSchema();
  return getSessionVersion(userId);
};

let cache = createSessionVersionCache({ lookup: lookupVersion, ttlMs: CACHE_TTL_MS });

/** `current`: still valid. `revoked`: ended, or the user is gone. `unknown`: the database could not be asked, so nothing can be said. */
export type SessionStatus = 'current' | 'revoked' | 'unknown';

/** Whether a session issued under `sessionVersion` is still valid for this user. */
export async function isSessionCurrent(userId: string, sessionVersion: number): Promise<SessionStatus> {
  try {
    const current = await cache.get(userId);
    return current !== null && current === sessionVersion ? 'current' : 'revoked';
  } catch (error) {
    // Not "revoked": the user may be perfectly valid. Say so, so the session is neither trusted nor thrown away
    log.error('Could not check a session against its user', { message: error instanceof Error ? error.message : String(error) });
    return 'unknown';
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
  cache = createSessionVersionCache({ lookup: lookupVersion, ttlMs: CACHE_TTL_MS });
}
