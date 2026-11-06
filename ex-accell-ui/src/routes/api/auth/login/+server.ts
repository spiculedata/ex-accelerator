import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hashPassword, verifyPassword } from '$lib/server/auth/password';
import { SESSION_COOKIE, getAuthConfig, loginThrottle, prepareAuth } from '$lib/server/auth/runtime';
import { createSessionToken, type SessionUser } from '$lib/server/auth/session';
import { findUserByEmail, recordLogin } from '$lib/server/auth/userRepo';
import { createLogger } from '$lib/utils/logger';

const log = createLogger('auth');

const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 1024;
const INVALID_CREDENTIALS = 'Invalid email or password';

// Verified against when the user does not exist, so response time doesn't reveal valid emails.
let dummyHash: Promise<string> | null = null;
const getDummyHash = (): Promise<string> => (dummyHash ??= hashPassword('dummy-password-for-timing'));

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

  const throttleKey = `${getClientAddress()}|${credentials.email.toLowerCase()}`;
  if (loginThrottle.isBlocked(throttleKey)) {
    return failure('Too many failed attempts. Try again later.', 429, { 'Retry-After': '900' });
  }

  try {
    await prepareAuth();
    const user = await findUserByEmail(credentials.email);
    const isValid = await verifyPassword(credentials.password, user?.passwordHash ?? (await getDummyHash()));

    if (!user || !isValid) {
      loginThrottle.recordFailure(throttleKey);
      log.warn('Failed login attempt', { ip: getClientAddress() });
      return failure(INVALID_CREDENTIALS, 401);
    }

    loginThrottle.reset(throttleKey);
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
    log.error('Login failed due to a server error', { message: error instanceof Error ? error.message : String(error) });
    return failure('Sign-in is temporarily unavailable', 503);
  }
};
