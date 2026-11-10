// Sessions are signed tokens, so ending one early means checking it against something the server can change: a version
// number per user. Asking the database on every request would be costly, so answers are remembered for a short time. That
// time is the most a revoked session can keep working after the change, on another instance; on the instance that makes
// the change it ends at once.

export interface SessionVersionCacheOptions {
  lookup: (userId: string) => Promise<number | null>;
  ttlMs: number;
  now?: () => number;
}

interface Entry {
  version: number | null;
  at: number;
}

export function createSessionVersionCache({ lookup, ttlMs, now = Date.now }: SessionVersionCacheOptions) {
  const entries = new Map<string, Entry>();
  const inFlight = new Map<string, Promise<number | null>>();

  async function refresh(userId: string): Promise<number | null> {
    try {
      const version = await lookup(userId);
      entries.set(userId, { version, at: now() });
      return version;
    } catch (error) {
      // A database blip must not sign everyone out, but nothing is known about a user never seen before
      const known = entries.get(userId);
      if (known) return known.version;
      throw error;
    } finally {
      inFlight.delete(userId);
    }
  }

  return {
    lookup,
    /** The user's current session version, or null when the user no longer exists. */
    async get(userId: string): Promise<number | null> {
      const entry = entries.get(userId);
      if (entry && now() - entry.at < ttlMs) return entry.version;
      let pending = inFlight.get(userId);
      if (!pending) {
        pending = refresh(userId);
        inFlight.set(userId, pending);
      }
      return pending;
    },
    /** Forgets what is known about a user, so the next check asks the database. */
    invalidate(userId: string): void {
      entries.delete(userId);
    }
  };
}
