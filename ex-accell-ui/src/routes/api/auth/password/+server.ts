import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { MAX_PASSWORD_LENGTH, validatePasswordStrength, verifyPassword } from '$lib/server/auth/password';
import { changePassword } from '$lib/server/auth/revocation';
import { SESSION_COOKIE, getAuthConfig, loginThrottle, prepareAuth } from '$lib/server/auth/runtime';
import { createSessionToken } from '$lib/server/auth/session';
import { findUserByEmail } from '$lib/server/auth/userRepo';
import { createLogger } from '$lib/utils/logger';

const log = createLogger('auth');

const failure = (error: string, status: number, headers?: HeadersInit) => json({ success: false, data: null, error }, { status, headers });

const isPassword = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= MAX_PASSWORD_LENGTH;

/**
 * Changes the signed-in person's own password. The current one must be given, so a stolen session cannot lock the owner out,
 * and guesses at it are throttled like sign-in. Every other session ends; this one continues under the new version.
 */
export const POST: RequestHandler = async ({ request, locals, cookies }) => {
  const sessionUser = locals.user;
  if (!sessionUser) return failure('Authentication required', 401);

  let body: Record<string, unknown>;
  try {
    body = ((await request.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return failure('Send a JSON body', 400);
  }
  const { currentPassword, newPassword } = body;
  if (!isPassword(currentPassword) || !isPassword(newPassword)) return failure('Current and new password are required', 400);
  const weakness = validatePasswordStrength(newPassword);
  if (weakness) return failure(weakness, 400);
  if (newPassword === currentPassword) return failure('Choose a password that is different from the current one', 400);

  const throttleKey = `password|${sessionUser.id}`;
  if (loginThrottle.isBlocked(throttleKey)) return failure('Too many failed attempts. Try again later.', 429, { 'Retry-After': '900' });

  try {
    await prepareAuth();
    const stored = await findUserByEmail(sessionUser.email);
    // Counted before the slow check so parallel guesses cannot all pass the limit; cleared on success
    loginThrottle.recordFailure(throttleKey);
    if (!stored || stored.id !== sessionUser.id || stored.isDisabled || !(await verifyPassword(currentPassword, stored.passwordHash))) {
      log.warn('Failed password change', { userId: sessionUser.id });
      return failure('The current password is not correct', 401);
    }

    const version = await changePassword(stored.id, newPassword);
    loginThrottle.reset(throttleKey);

    const config = getAuthConfig();
    cookies.set(SESSION_COOKIE, createSessionToken(sessionUser, config.sessionSecret, config.sessionTtlSeconds, Date.now(), version), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: config.secureCookies,
      maxAge: config.sessionTtlSeconds
    });
    return json({ success: true, data: null, error: null });
  } catch (error: unknown) {
    // A server problem is not a wrong guess
    loginThrottle.forgive(throttleKey);
    log.error('Could not change the password', { message: error instanceof Error ? error.message : String(error) });
    return failure('Could not change the password. Try again.', 500);
  }
};
