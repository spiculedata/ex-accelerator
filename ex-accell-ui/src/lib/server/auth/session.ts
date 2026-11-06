import { createHmac, timingSafeEqual } from 'node:crypto';

export const USER_ROLES = ['admin', 'user', 'viewer'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

interface SessionPayload {
  u: SessionUser;
  exp: number;
}

function sign(payload: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(payload).digest();
}

function isSessionUser(value: unknown): value is SessionUser {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.email === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.role === 'string' &&
    (USER_ROLES as readonly string[]).includes(candidate.role)
  );
}

/** Creates a signed, expiring session token: base64url(payload).base64url(hmac). */
export function createSessionToken(
  user: SessionUser,
  secret: string,
  ttlSeconds: number,
  nowMs: number = Date.now()
): string {
  const payload: SessionPayload = { u: user, exp: Math.floor(nowMs / 1000) + ttlSeconds };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${sign(encoded, secret).toString('base64url')}`;
}

/** Returns the session user, or null if the token is missing, forged, malformed or expired. */
export function verifySessionToken(
  token: string | undefined,
  secret: string,
  nowMs: number = Date.now()
): SessionUser | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encoded, signature] = parts;
  const expected = sign(encoded, secret);
  const provided = Buffer.from(signature, 'base64url');
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Partial<SessionPayload>;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= nowMs) return null;
    return isSessionUser(payload.u) ? payload.u : null;
  } catch {
    return null;
  }
}
