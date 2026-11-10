// Sessions are signed tokens, so ending one early means checking it against something the server can change: a version
// number per user. Asking the database on every request would be costly, so answers are remembered for a short time. That
// time is the most a revoked session can keep working after the change, on another instance; on the instance that makes
// the change it ends at once.

export interface SessionVersionCacheOptions {
  lookup: (userId: string) => Promise<number | null>;
  ttlMs: number;
  /** How long an answer may still be used when the database cannot be asked. After that there is no answer. */
  maxStaleMs?: number;
  now?: () => number;
}

interface Entry {
  version: number | null;
  at: number;
}

const DEFAULT_MAX_STALE_MS = 5 * 60 * 1000;

export function createSessionVersionCache({ lookup, ttlMs, maxStaleMs = DEFAULT_MAX_STALE_MS, now = Date.now }: SessionVersionCacheOptions) {
  const entries = new Map<string, Entry>();
  const inFlight = new Map<string, Promise<number | null>>();
  // Raised by invalidate(), so an answer to a question asked before it is not kept
  const generations = new Map<string, number>();
  const generationOf = (userId: string) => generations.get(userId) ?? 0;

  async function refresh(userId: string): Promise<number | null> {
    const started = generationOf(userId);
    try {
      const version = await lookup(userId);
      if (generationOf(userId) === started) entries.set(userId, { version, at: now() });
      return version;
    } catch (error) {
      // A database blip must not sign everyone out, but an old answer is only good for so long, and nothing is known
      // about a user never seen before
      const known = entries.get(userId);
      if (known && now() - known.at < maxStaleMs) return known.version;
      throw error;
    } finally {
      if (generationOf(userId) === started) inFlight.delete(userId);
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
      generations.set(userId, generationOf(userId) + 1);
      entries.delete(userId);
      inFlight.delete(userId);
    }
  };
}
