export interface LoginThrottleOptions {
  maxAttempts: number;
  windowMs: number;
  maxKeys?: number;
}

export interface LoginThrottle {
  isBlocked(key: string, nowMs?: number): boolean;
  recordFailure(key: string, nowMs?: number): void;
  reset(key: string): void;
  /** Removes the most recent attempt for a key (an attempt that turned out not to count). */
  forgive(key: string): void;
  size(): number;
}

const DEFAULT_MAX_KEYS = 10_000;

/** In-memory failed-login limiter. Single-process only; swap for a shared store if scaled out. */
export function createLoginThrottle({ maxAttempts, windowMs, maxKeys = DEFAULT_MAX_KEYS }: LoginThrottleOptions): LoginThrottle {
  const failures = new Map<string, number[]>();

  const recent = (key: string, nowMs: number): number[] =>
    (failures.get(key) ?? []).filter((timestamp) => nowMs - timestamp < windowMs);

  return {
    isBlocked: (key, nowMs = Date.now()) => recent(key, nowMs).length >= maxAttempts,
    recordFailure: (key, nowMs = Date.now()) => {
      const updated = [...recent(key, nowMs), nowMs];
      failures.delete(key);
      failures.set(key, updated);
      while (failures.size > maxKeys) {
        const oldest = failures.keys().next().value;
        if (oldest === undefined) break;
        failures.delete(oldest);
      }
    },
    reset: (key) => {
      failures.delete(key);
    },
    forgive: (key) => {
      const attempts = failures.get(key);
      if (!attempts) return;
      if (attempts.length <= 1) failures.delete(key);
      else failures.set(key, attempts.slice(0, -1));
    },
    size: () => failures.size
  };
}
