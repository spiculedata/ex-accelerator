import { postgresPool, query } from '$lib/services/postgres';
import { hashPassword, validatePasswordStrength } from './password';
import type { UserRole } from './session';
import { ADD_DISABLED_SQL, ADD_SESSION_VERSION_SQL, CREATE_INDEX_SQL, CREATE_TABLE_SQL } from './authSchema';

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  /** Raised to end every session issued before it (sign out everywhere, a password change, removing the user). */
  sessionVersion: number;
  /** A disabled account cannot sign in and has no valid sessions. */
  isDisabled: boolean;
}

/** A person as shown to an administrator: never the password hash. */
export interface UserSummary {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isDisabled: boolean;
  createdAt: string | null;
  lastLoginAt: string | null;
}

export type AccessChange = { role?: UserRole; disabled?: boolean; name?: string };
export type AccessChangeResult = 'updated' | 'not-found' | 'last-admin';

/** What an account is right now, after its password was changed: enough to sign a new session from stored facts. */
export interface CurrentAccount {
  sessionVersion: number;
  role: UserRole;
  name: string;
}

// Held while an admin's role or access is being changed, so two such changes run one after the other
const ADMIN_CHANGE_LOCK = 65001;

export interface NewUser {
  email: string;
  name: string;
  role: UserRole;
  password: string;
}

export type BootstrapResult = 'created' | 'skipped' | 'no-credentials';

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  password_hash: string;
  session_version: number | string;
  disabled_at?: string | Date | null;
}

const USER_COLUMNS = 'id, email, name, role, password_hash, session_version, disabled_at';

function toRecord(row: UserRow): UserRecord {
  return { id: row.id, email: row.email, name: row.name, role: row.role, passwordHash: row.password_hash, sessionVersion: Number(row.session_version ?? 0), isDisabled: Boolean(row.disabled_at) };
}

let schemaReady: Promise<void> | null = null;

/** Creates the users table on first use. A failed attempt is not cached, so it is retried. */
export function ensureAuthSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await query(CREATE_TABLE_SQL);
      await query(ADD_SESSION_VERSION_SQL);
      await query(ADD_DISABLED_SQL);
      await query(CREATE_INDEX_SQL);
    })().catch((error: unknown) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const rows = await query<UserRow>(`SELECT ${USER_COLUMNS} FROM app_users WHERE lower(email) = lower($1) LIMIT 1`, [email]);
  return rows.length > 0 ? toRecord(rows[0]) : null;
}

export async function createUser(input: NewUser): Promise<UserRecord> {
  const weakness = validatePasswordStrength(input.password);
  if (weakness) throw new Error(weakness);

  const passwordHash = await hashPassword(input.password);
  const rows = await query<UserRow>(
    `INSERT INTO app_users (email, name, role, password_hash) VALUES ($1, $2, $3, $4) RETURNING ${USER_COLUMNS}`,
    [input.email, input.name, input.role, passwordHash]
  );
  return toRecord(rows[0]);
}

/** The user's current session version, or null when there is no such user or the account is disabled (so their sessions end). */
export async function getSessionVersion(userId: string): Promise<number | null> {
  const rows = await query<{ session_version: number | string }>('SELECT session_version FROM app_users WHERE id = $1 AND disabled_at IS NULL', [userId]);
  return rows.length > 0 ? Number(rows[0].session_version) : null;
}

/** Ends every session issued so far for this user. One statement, so simultaneous changes each count. Returns the new version. */
export async function bumpSessionVersion(userId: string): Promise<number> {
  const rows = await query<{ session_version: number | string }>(
    'UPDATE app_users SET session_version = session_version + 1 WHERE id = $1 RETURNING session_version',
    [userId]
  );
  if (rows.length === 0) throw new Error('No such user');
  return Number(rows[0].session_version);
}

const iso = (value: string | Date | null | undefined): string | null => (value instanceof Date ? value.toISOString() : value ?? null);

export async function listUsers(): Promise<UserSummary[]> {
  const rows = await query<UserRow & { created_at?: string | Date | null; last_login_at?: string | Date | null }>(
    'SELECT id, email, name, role, disabled_at, created_at, last_login_at FROM app_users ORDER BY created_at, email'
  );
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    isDisabled: Boolean(row.disabled_at),
    createdAt: iso(row.created_at),
    lastLoginAt: iso(row.last_login_at)
  }));
}

/**
 * Changes a person's role, name or whether they may sign in. A role or disabled change also ends their sessions, so it applies at
 * once. One statement refuses to take admin rights from, or disable, the last active admin, so the install cannot lock itself out.
 */
export async function updateUserAccess(userId: string, change: AccessChange): Promise<AccessChangeResult> {
  const { role, disabled, name } = change;
  if (role === undefined && disabled === undefined && name === undefined) return 'updated';
  const endsSessions = role !== undefined || disabled !== undefined;

  // The last-admin check reads other rows, so two changes made at the same moment could each see the other admin as still
  // active and leave none. A transaction-level lock makes them take turns; the second then sees the first's result.
  const rows = await postgresPool.transaction(async (client) => {
    if (endsSessions) await client.query('SELECT pg_advisory_xact_lock($1)', [ADMIN_CHANGE_LOCK]);
    const result = await client.query<{ id: string }>(
      `UPDATE app_users SET
         role = COALESCE($2::text, role),
         name = COALESCE($4::text, name),
         disabled_at = CASE WHEN $3::boolean IS NULL THEN disabled_at WHEN $3::boolean THEN COALESCE(disabled_at, now()) ELSE NULL END
         ${endsSessions ? ', session_version = session_version + 1' : ''}
       WHERE id = $1
         AND (
           NOT (role = 'admin' AND disabled_at IS NULL AND (COALESCE($2::text, role) <> 'admin' OR COALESCE($3::boolean, false)))
           OR EXISTS (SELECT 1 FROM app_users other WHERE other.id <> $1 AND other.role = 'admin' AND other.disabled_at IS NULL)
         )
       RETURNING id`,
      [userId, role ?? null, disabled ?? null, name ?? null]
    );
    return result.rows;
  });
  if (rows.length > 0) return 'updated';
  const exists = await query<{ id: string }>('SELECT id FROM app_users WHERE id = $1', [userId]);
  return exists.length > 0 ? 'last-admin' : 'not-found';
}

/** Sets a new password and ends every session made with the old one. Returns the account as stored, to sign a new session from. */
export async function setUserPassword(userId: string, password: string): Promise<CurrentAccount> {
  const weakness = validatePasswordStrength(password);
  if (weakness) throw new Error(weakness);
  const passwordHash = await hashPassword(password);
  const rows = await query<{ session_version: number | string; role: UserRole; name: string }>(
    'UPDATE app_users SET password_hash = $2, session_version = session_version + 1 WHERE id = $1 RETURNING session_version, role, name',
    [userId, passwordHash]
  );
  if (rows.length === 0) throw new Error('No such user');
  return { sessionVersion: Number(rows[0].session_version), role: rows[0].role, name: rows[0].name };
}

export async function recordLogin(userId: string): Promise<void> {
  await query('UPDATE app_users SET last_login_at = now() WHERE id = $1', [userId]);
}

/** Creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD when the users table is empty. */
export async function bootstrapAdmin(env: Readonly<Record<string, string | undefined>>): Promise<BootstrapResult> {
  const rows = await query<{ count: string }>('SELECT count(*)::text AS count FROM app_users');
  if (Number(rows[0]?.count ?? 0) > 0) return 'skipped';

  const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password, ADMIN_NAME: name } = env;
  if (!email || !password) return 'no-credentials';

  await createUser({ email, name: name || 'Administrator', role: 'admin', password });
  return 'created';
}
