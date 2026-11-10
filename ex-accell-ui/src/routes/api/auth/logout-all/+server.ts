import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SESSION_COOKIE } from '$lib/server/auth/runtime';
import { revokeSessions } from '$lib/server/auth/revocation';
import { createLogger } from '$lib/utils/logger';

const log = createLogger('auth');

/** Ends every session of the signed-in user, on every device, including this one. */
export const POST: RequestHandler = async ({ locals, cookies }) => {
  if (!locals.user) return json({ success: false, data: null, error: 'Authentication required' }, { status: 401 });
  try {
    await revokeSessions(locals.user.id);
    cookies.delete(SESSION_COOKIE, { path: '/' });
    return json({ success: true, data: null, error: null });
  } catch (error: unknown) {
    log.error('Could not sign out everywhere', { message: error instanceof Error ? error.message : String(error) });
    return json({ success: false, data: null, error: 'Could not sign you out everywhere. Try again.' }, { status: 500 });
  }
};
