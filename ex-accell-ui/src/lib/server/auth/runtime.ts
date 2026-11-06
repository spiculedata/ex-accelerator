import { dev } from '$app/environment';
import { createLogger } from '$lib/utils/logger';
import { resolveAuthConfig, type AuthConfig } from './config';
import { migrateDatabase } from '$lib/server/migrations';
import { createLoginThrottle } from './throttle';
import { bootstrapAdmin, ensureAuthSchema } from './userRepo';

const log = createLogger('auth');

const THROTTLE_MAX_ATTEMPTS = 5;
const THROTTLE_WINDOW_MS = 15 * 60 * 1000;

export const SESSION_COOKIE = 'ex_session';

export const loginThrottle = createLoginThrottle({
  maxAttempts: THROTTLE_MAX_ATTEMPTS,
  windowMs: THROTTLE_WINDOW_MS
});

let cachedConfig: AuthConfig | null = null;

/** Resolves (once) and returns auth config. Throws in production if SESSION_SECRET is unsafe. */
export function getAuthConfig(): AuthConfig {
  if (!cachedConfig) {
    cachedConfig = resolveAuthConfig(process.env, !dev);
    if (!process.env.SESSION_SECRET) {
      log.warn('SESSION_SECRET not set; using an ephemeral secret, sessions reset on restart');
    }
  }
  return cachedConfig;
}

let preparation: Promise<void> | null = null;

/** Migrates the schema, ensures the users table exists and bootstraps the first admin. Retried after failure. */
export function prepareAuth(): Promise<void> {
  if (!preparation) {
    preparation = (async () => {
      await migrateDatabase();
      await ensureAuthSchema();
      const result = await bootstrapAdmin(process.env);
      if (result === 'created') log.info('Created initial admin user from ADMIN_EMAIL');
      if (result === 'no-credentials') {
        log.warn('No users exist. Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ chars) to create the first admin');
      }
    })().catch((error: unknown) => {
      preparation = null;
      throw error;
    });
  }
  return preparation;
}
