// A simple limit on how many API requests one client may make a minute: a fixed window per key, in memory. It stops a
// runaway script or a flood from one account or address; it is not a defence against a distributed attack, and with
// several server processes each counts on its own.

export const DEFAULT_REQUESTS_PER_MINUTE = 1200;
const DEFAULT_MAX_KEYS = 20_000;

export interface RateLimiterOptions {
  /** Requests allowed per window; 0 turns the limiter off. */
  limit: number;
  windowMs: number;
  maxKeys?: number;
}

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export interface RateLimiter {
  hit(key: string, nowMs?: number): RateLimitResult;
  size(): number;
}

export function createRateLimiter({ limit, windowMs, maxKeys = DEFAULT_MAX_KEYS }: RateLimiterOptions): RateLimiter {
  const windows = new Map<string, { startedAt: number; count: number }>();

  return {
    hit(key, nowMs = Date.now()) {
      if (limit <= 0) return { allowed: true };

      const current = windows.get(key);
      const window = current && nowMs - current.startedAt < windowMs ? current : { startedAt: nowMs, count: 0 };
      window.count += 1;
      // Re-inserted so the map stays ordered by recent use, and the oldest keys are the ones dropped
      windows.delete(key);
      windows.set(key, window);
      while (windows.size > maxKeys) {
        const oldest = windows.keys().next().value;
        if (oldest === undefined) break;
        windows.delete(oldest);
      }

      if (window.count <= limit) return { allowed: true };
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((window.startedAt + windowMs - nowMs) / 1000)) };
    },
    size: () => windows.size
  };
}

/** Reads API_RATE_LIMIT_PER_MINUTE: a whole number (0 turns the limit off); anything else uses the default. */
export function parseRateLimit(value: string | undefined): number {
  if (value === undefined || !/^\d+$/.test(value)) return DEFAULT_REQUESTS_PER_MINUTE;
  return Number(value);
}
