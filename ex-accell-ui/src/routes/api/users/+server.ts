import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validatePasswordStrength } from '$lib/server/auth/password';
import { prepareAuth } from '$lib/server/auth/runtime';
import { isAdmin, isEmail, isName, isRole } from '$lib/server/auth/userInput';
import { createUser, listUsers, type UserRecord } from '$lib/server/auth/userRepo';
import { createLogger } from '$lib/utils/logger';

const log = createLogger('users');

const failure = (error: string, status: number) => json({ success: false, data: null, error }, { status });
const UNIQUE_VIOLATION = '23505';

/** A person as the admin pages show them. The hash and session version never leave the server. */
const publicUser = (user: UserRecord) => ({ id: user.id, email: user.email, name: user.name, role: user.role, isDisabled: user.isDisabled });

/** GET /api/users: everyone with an account. Admin-only (see the access guard). */
export const GET: RequestHandler = async ({ locals }) => {
  if (!isAdmin(locals.user)) return failure('Only an admin can manage users', 403);
  try {
    await prepareAuth();
    return json({ success: true, data: { users: await listUsers() }, error: null });
  } catch (error: unknown) {
    log.error('Could not list users', { message: error instanceof Error ? error.message : String(error) });
    return failure('Could not load the users. Try again.', 500);
  }
};

/** POST /api/users: creates an account. Admin-only. */
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!isAdmin(locals.user)) return failure('Only an admin can manage users', 403);
  let body: Record<string, unknown>;
  try {
    body = ((await request.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return failure('Send a JSON body', 400);
  }
  const { email, name, role, password } = body;
  if (!isEmail(email)) return failure('Enter a valid email address', 400);
  if (!isName(name)) return failure('Enter a name of up to 100 characters', 400);
  if (!isRole(role)) return failure('Role must be admin, user or viewer', 400);
  if (typeof password !== 'string') return failure('Enter a password', 400);
  const weakness = validatePasswordStrength(password);
  if (weakness) return failure(weakness, 400);

  try {
    await prepareAuth();
    const user = await createUser({ email: email.trim(), name: name.trim(), role, password });
    return json({ success: true, data: { user: publicUser(user) }, error: null }, { status: 201 });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === UNIQUE_VIOLATION) return failure('Someone with that email already has an account', 409);
    log.error('Could not create a user', { message: error instanceof Error ? error.message : String(error) });
    return failure('Could not create the account. Try again.', 500);
  }
};
