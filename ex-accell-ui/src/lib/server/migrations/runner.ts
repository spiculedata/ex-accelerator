export interface Migration {
  name: string;
  sql: string;
}

export interface MigrationClient {
  query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

export interface MigrationPlan {
  toRun: Migration[];
  toBaseline: string[];
}

export interface MigrationResult {
  applied: string[];
  baselined: string[];
}

/**
 * Migrations that describe tables created by hand before the runner existed. On a database that
 * already holds them we record these as applied instead of executing them, so existing data is
 * never touched.
 */
export const LEGACY_BASELINE = ['0001_core', '0002_projects_workspaces', '0003_datasets'];

/** Arbitrary constant identifying this runner's advisory lock. */
const ADVISORY_LOCK_ID = 727_001;

const byName = (a: Migration, b: Migration) => a.name.localeCompare(b.name);

/** Decides which migrations to execute and which to record without executing. Pure. */
export function planMigrations(
  available: readonly Migration[],
  applied: readonly string[],
  isLegacyInstall: boolean
): MigrationPlan {
  const done = new Set(applied);
  const pending = [...available].sort(byName).filter((migration) => !done.has(migration.name));
  const shouldBaseline = isLegacyInstall && applied.length === 0;

  const toBaseline = shouldBaseline
    ? pending.filter((migration) => LEGACY_BASELINE.includes(migration.name)).map((migration) => migration.name)
    : [];
  return { toRun: pending.filter((migration) => !toBaseline.includes(migration.name)), toBaseline };
}

const CREATE_TRACKING_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name       text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now(),
    baselined  boolean NOT NULL DEFAULT false
  )`;

const RECORD_SQL = 'INSERT INTO schema_migrations (name, baselined) VALUES ($1, $2) ON CONFLICT DO NOTHING';

async function applyOne(client: MigrationClient, migration: Migration): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query(migration.sql);
    await client.query(RECORD_SQL, [migration.name, false]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Migration ${migration.name} failed: ${reason}`);
  }
}

/** Applies pending migrations once, serialised across instances by an advisory lock. */
export async function runMigrations(
  client: MigrationClient,
  migrations: readonly Migration[]
): Promise<MigrationResult> {
  await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_ID]);
  try {
    await client.query(CREATE_TRACKING_TABLE);
    const applied = (await client.query('SELECT name FROM schema_migrations')).rows.map((row) => String(row.name));
    const legacy = (await client.query("SELECT to_regclass('public.posts') IS NOT NULL AS present")).rows[0];
    const plan = planMigrations(migrations, applied, legacy?.present === true);

    for (const name of plan.toBaseline) await client.query(RECORD_SQL, [name, true]);
    for (const migration of plan.toRun) await applyOne(client, migration);

    return { applied: plan.toRun.map((migration) => migration.name), baselined: plan.toBaseline };
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_ID]);
  }
}
