import { randomBytes } from 'node:crypto';

export interface AuthConfig {
  sessionSecret: string;
  sessionTtlSeconds: number;
  secureCookies: boolean;
}

const MIN_SECRET_LENGTH = 32;
const DEFAULT_TTL_HOURS = 12;
const SECONDS_PER_HOUR = 3600;

type Env = Readonly<Record<string, string | undefined>>;

function resolveTtlSeconds(raw: string | undefined): number {
  const hours = Number(raw);
  return Number.isFinite(hours) && hours > 0 ? Math.round(hours * SECONDS_PER_HOUR) : DEFAULT_TTL_HOURS * SECONDS_PER_HOUR;
}

/**
 * Production requires a strong SESSION_SECRET (fail fast at startup).
 * Development generates an ephemeral one, so sessions reset on restart.
 */
export function resolveAuthConfig(
  env: Env,
  isProduction: boolean,
  generateSecret: () => string = () => randomBytes(32).toString('hex')
): AuthConfig {
  const configured = env.SESSION_SECRET;

  if (isProduction && !configured) {
    throw new Error('SESSION_SECRET must be set in production (generate one with: openssl rand -hex 32)');
  }
  if (configured && configured.length < MIN_SECRET_LENGTH) {
    throw new Error(`SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
  }

  return {
    sessionSecret: configured ?? generateSecret(),
    sessionTtlSeconds: resolveTtlSeconds(env.SESSION_TTL_HOURS),
    secureCookies: isProduction && env.COOKIE_SECURE !== 'false'
  };
}
