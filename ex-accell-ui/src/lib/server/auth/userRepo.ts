import { query } from '$lib/services/postgres';
import { hashPassword, validatePasswordStrength } from './password';
import type { UserRole } from './session';

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
}

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
}

const USER_COLUMNS = 'id, email, name, role, password_hash';

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS app_users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email         text NOT NULL,
    name          text NOT NULL,
    role          text NOT NULL CHECK (role IN ('admin', 'user', 'viewer')),
    password_hash text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    last_login_at timestamptz
  )`;
const CREATE_INDEX_SQL = 'CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_lower_idx ON app_users (lower(email))';

function toRecord(row: UserRow): UserRecord {
  return { id: row.id, email: row.email, name: row.name, role: row.role, passwordHash: row.password_hash };
}

let schemaReady: Promise<void> | null = null;

/** Creates the users table on first use. A failed attempt is not cached, so it is retried. */
export function ensureAuthSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await query(CREATE_TABLE_SQL);
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
