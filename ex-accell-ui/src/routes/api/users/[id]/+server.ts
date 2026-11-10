import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validatePasswordStrength } from '$lib/server/auth/password';
import { changePassword, changeUserAccess } from '$lib/server/auth/revocation';
import { prepareAuth } from '$lib/server/auth/runtime';
import { isName, isRole, isUuid } from '$lib/server/auth/userInput';
import type { AccessChange } from '$lib/server/auth/userRepo';
import { createLogger } from '$lib/utils/logger';

const log = createLogger('users');

const failure = (error: string, status: number) => json({ success: false, data: null, error }, { status });

/**
 * PATCH /api/users/[id]: change a person's name, role, whether they may sign in, or reset their password. Admin-only.
 * A role, disabled or password change ends that person's sessions. People are disabled, not deleted, so their history stays.
 * Admins cannot demote, disable or reset the password of their own account here (use the password form), and the last
 * active admin cannot be removed.
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  if (!isUuid(params.id)) return failure('Not a valid user id', 400);

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return failure('Send a JSON object', 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return failure('Send a JSON body', 400);
  }

  const { role, disabled, name, password } = body;
  const change: AccessChange = {};
  if (role !== undefined) {
    if (!isRole(role)) return failure('Role must be admin, user or viewer', 400);
    change.role = role;
  }
  if (disabled !== undefined) {
    if (typeof disabled !== 'boolean') return failure('disabled must be true or false', 400);
    change.disabled = disabled;
  }
  if (name !== undefined) {
    if (!isName(name)) return failure('Enter a name of up to 100 characters', 400);
    change.name = name.trim();
  }
  if (password !== undefined) {
    if (typeof password !== 'string') return failure('Enter a password', 400);
    const weakness = validatePasswordStrength(password);
    if (weakness) return failure(weakness, 400);
  }
  if (Object.keys(change).length === 0 && password === undefined) return failure('Nothing to change', 400);

  const isSelf = params.id === locals.user?.id;
  if (isSelf && (change.role !== undefined || change.disabled !== undefined || password !== undefined)) {
    return failure('You cannot change your own role, disable yourself or reset your own password here', 400);
  }

  try {
    await prepareAuth();
    if (Object.keys(change).length > 0) {
      const result = await changeUserAccess(params.id, change);
      if (result === 'not-found') return failure('No such user', 404);
      if (result === 'last-admin') return failure('There must be at least one active admin', 409);
    }
    if (typeof password === 'string') await changePassword(params.id, password);
    return json({ success: true, data: null, error: null });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'No such user') return failure('No such user', 404);
    log.error('Could not change a user', { message: error instanceof Error ? error.message : String(error) });
    return failure('Could not change the account. Try again.', 500);
  }
};
