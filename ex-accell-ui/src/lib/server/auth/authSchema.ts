// The users table, kept free of imports so the e2e setup (which runs outside SvelteKit) can create the same table.
export const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS app_users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email         text NOT NULL,
    name          text NOT NULL,
    role          text NOT NULL CHECK (role IN ('admin', 'user', 'viewer')),
    password_hash text NOT NULL,
    session_version integer NOT NULL DEFAULT 0,
    created_at    timestamptz NOT NULL DEFAULT now(),
    last_login_at timestamptz
  )`;
// For a table made before session versions existed
export const ADD_SESSION_VERSION_SQL = 'ALTER TABLE app_users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0';
export const CREATE_INDEX_SQL = 'CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_lower_idx ON app_users (lower(email))';
