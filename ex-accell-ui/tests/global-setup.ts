import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import pg from 'pg';
import { runMigrations, type Migration } from '../src/lib/server/migrations/runner';
import { createSessionToken } from '../src/lib/server/auth/session';
import { ADD_SESSION_VERSION_SQL, CREATE_INDEX_SQL, CREATE_TABLE_SQL } from '../src/lib/server/auth/authSchema';
import { E2E_SESSION_SECRET, E2E_STORAGE_STATE } from './e2e-auth';

const SESSION_TTL_SECONDS = 60 * 60;
// A fixed id, so every run reuses the same row
const E2E_ADMIN = { id: '00000000-0000-4000-8000-000000e2e001', email: 'e2e@example.com', name: 'E2E Admin', role: 'admin' as const };

const MIGRATIONS_DIR = 'db/migrations';

/** The shipped migrations, read from disk: the app only applies them on a sign-in, which the e2e tests skip. */
async function shippedMigrations(): Promise<Migration[]> {
  const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith('.sql')).sort();
  return Promise.all(files.map(async (file) => ({ name: file.replace(/\.sql$/, ''), sql: await readFile(join(MIGRATIONS_DIR, file), 'utf8') })));
}

/**
 * Makes sure the e2e admin exists in the users table. The app checks every session against its user, so a signed cookie
 * for a user who is not in the database is refused. The password hash is not a real hash: nobody can sign in as this user.
 * Returns the user's current session version, which the cookie must carry.
 */
async function ensureE2eAdmin(): Promise<number> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('The e2e tests need DATABASE_URL: sessions are checked against the users table.');
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    // Tests that create projects and workspaces need the schema; this is idempotent and shares the app's tracking table
    await runMigrations(client, await shippedMigrations());
    await client.query(CREATE_TABLE_SQL);
    await client.query(ADD_SESSION_VERSION_SQL);
    await client.query(CREATE_INDEX_SQL);
    await client.query(
      `INSERT INTO app_users (id, email, name, role, password_hash) VALUES ($1, $2, $3, $4, 'e2e-not-a-real-hash')
       ON CONFLICT DO NOTHING`,
      [E2E_ADMIN.id, E2E_ADMIN.email, E2E_ADMIN.name, E2E_ADMIN.role]
    );
    const rows = await client.query('SELECT session_version FROM app_users WHERE id = $1', [E2E_ADMIN.id]);
    return Number(rows.rows[0]?.session_version ?? 0);
  } finally {
    await client.end();
  }
}

/** Writes a storageState holding a signed admin session for a real (database) user, so tests need no login flow. */
export default async function globalSetup(): Promise<void> {
  const sessionVersion = await ensureE2eAdmin();
  const token = createSessionToken(E2E_ADMIN, E2E_SESSION_SECRET, SESSION_TTL_SECONDS, Date.now(), sessionVersion);

  const state = {
    cookies: [
      {
        name: 'ex_session',
        value: token,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
        expires: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
      }
    ],
    origins: []
  };

  await mkdir(dirname(E2E_STORAGE_STATE), { recursive: true });
  await writeFile(E2E_STORAGE_STATE, JSON.stringify(state, null, 2));
}
