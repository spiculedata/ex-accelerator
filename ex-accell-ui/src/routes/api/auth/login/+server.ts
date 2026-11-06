import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { MAX_PASSWORD_LENGTH, hashPassword, verifyPassword } from '$lib/server/auth/password';
import { SESSION_COOKIE, getAuthConfig, loginIpThrottle, loginThrottle, prepareAuth } from '$lib/server/auth/runtime';
import { createSessionToken, type SessionUser } from '$lib/server/auth/session';
import { findUserByEmail, recordLogin } from '$lib/server/auth/userRepo';
import { createLogger } from '$lib/utils/logger';

const log = createLogger('auth');

const MAX_EMAIL_LENGTH = 254;
const INVALID_CREDENTIALS = 'Invalid email or password';

// Verified against when the user does not exist, so response time doesn't reveal valid emails.
// Computed when the module loads so the first unknown-email login isn't measurably slower.
const dummyHash: Promise<string> = hashPassword('dummy-password-for-timing');
// Avoid an unhandled rejection at load; a failure still surfaces (as a 503) when it is awaited in the handler
dummyHash.catch(() => undefined);

const failure = (error: string, status: number, headers?: HeadersInit) =>
  json({ success: false, data: null, error }, { status, headers });

async function readCredentials(request: Request): Promise<{ email: string; password: string } | null> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }
  const { email, password } = (body ?? {}) as Record<string, unknown>;
  const isValid =
    typeof email === 'string' &&
    typeof password === 'string' &&
    email.length > 0 &&
    email.length <= MAX_EMAIL_LENGTH &&
    password.length > 0 &&
    password.length <= MAX_PASSWORD_LENGTH;
  return isValid ? { email: email.trim(), password } : null;
}

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
  const credentials = await readCredentials(request);
  if (!credentials) return failure('Email and password are required', 400);

  const clientAddress = getClientAddress();
  const throttleKey = `${clientAddress}|${credentials.email.toLowerCase()}`;
  if (loginIpThrottle.isBlocked(clientAddress) || loginThrottle.isBlocked(throttleKey)) {
    return failure('Too many failed attempts. Try again later.', 429, { 'Retry-After': '900' });
  }

  // Count the attempt before the slow password check: otherwise N parallel requests would all pass
  // the limit before any failure was recorded. It is given back on success or a server error.
  loginThrottle.recordFailure(throttleKey);
  loginIpThrottle.recordFailure(clientAddress);

  try {
    await prepareAuth();
    const user = await findUserByEmail(credentials.email);
    const isValid = await verifyPassword(credentials.password, user?.passwordHash ?? (await dummyHash));

    if (!user || !isValid) {
      log.warn('Failed login attempt', { ip: clientAddress });
      return failure(INVALID_CREDENTIALS, 401);
    }

    loginThrottle.reset(throttleKey);
    loginIpThrottle.forgive(clientAddress);
    await recordLogin(user.id);

    const sessionUser: SessionUser = { id: user.id, email: user.email, name: user.name, role: user.role };
    const config = getAuthConfig();
    cookies.set(SESSION_COOKIE, createSessionToken(sessionUser, config.sessionSecret, config.sessionTtlSeconds), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: config.secureCookies,
      maxAge: config.sessionTtlSeconds
    });

    return json({ success: true, data: { user: sessionUser }, error: null });
  } catch (error: unknown) {
    // A server problem is not the user's failed guess
    loginThrottle.forgive(throttleKey);
    loginIpThrottle.forgive(clientAddress);
    log.error('Login failed due to a server error', { message: error instanceof Error ? error.message : String(error) });
    return failure('Sign-in is temporarily unavailable', 503);
  }
};
