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

export interface RunOptions {
  /** How long to wait for another instance to finish migrating. */
  lockTimeoutMs?: number;
  lockRetryMs?: number;
}

/**
 * Migrations that describe tables created by hand before the runner existed, each with a table
 * that proves it was applied. On a database that already holds that table we record the migration
 * as applied instead of executing it, so existing data is never touched.
 */
export const LEGACY_BASELINE: Readonly<Record<string, string>> = {
  '0001_core': 'public.posts',
  '0002_projects_workspaces': 'public.projects',
  '0003_datasets': 'public.datasets'
};

/** Arbitrary constant identifying this runner's advisory lock. */
const ADVISORY_LOCK_ID = 727_001;
const DEFAULT_LOCK_TIMEOUT_MS = 60_000;
const DEFAULT_LOCK_RETRY_MS = 500;

const compareNames = (a: Migration, b: Migration) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Decides which migrations to execute and which to record without executing. Pure. */
export function planMigrations(
  available: readonly Migration[],
  applied: readonly string[],
  existingTables: readonly string[]
): MigrationPlan {
  const done = new Set(applied);
  const pending = [...available].sort(compareNames).filter((migration) => !done.has(migration.name));
  const canBaseline = applied.length === 0;

  const toBaseline = canBaseline
    ? pending
        .filter((migration) => {
          const sentinel = LEGACY_BASELINE[migration.name];
          return sentinel !== undefined && existingTables.includes(sentinel);
        })
        .map((migration) => migration.name)
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

async function acquireLock(client: MigrationClient, timeoutMs: number, retryMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [ADVISORY_LOCK_ID]);
    if (rows[0]?.locked === true) return;
    if (Date.now() >= deadline) {
      throw new Error('Timed out waiting for another instance to finish migrating the database (advisory lock held)');
    }
    await sleep(retryMs);
  }
}

async function existingLegacyTables(client: MigrationClient): Promise<string[]> {
  const present: string[] = [];
  for (const table of Object.values(LEGACY_BASELINE)) {
    const { rows } = await client.query('SELECT to_regclass($1) IS NOT NULL AS present', [table]);
    if (rows[0]?.present === true) present.push(table);
  }
  return present;
}

async function applyOne(client: MigrationClient, migration: Migration): Promise<void> {
  await client.query('BEGIN');
  try {
    // No parameters on purpose: that uses the simple protocol, which allows multi-statement files
    await client.query(migration.sql);
    await client.query(RECORD_SQL, [migration.name, false]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined); // keep the original error if the connection is gone
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Migration ${migration.name} failed: ${reason}`);
  }
}

/** Applies pending migrations once, serialised across instances by an advisory lock. */
export async function runMigrations(
  client: MigrationClient,
  migrations: readonly Migration[],
  options: RunOptions = {}
): Promise<MigrationResult> {
  await acquireLock(
    client,
    options.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS,
    options.lockRetryMs ?? DEFAULT_LOCK_RETRY_MS
  );
  let failure: unknown;
  try {
    await client.query(CREATE_TRACKING_TABLE);
    const applied = (await client.query('SELECT name FROM schema_migrations')).rows.map((row) => String(row.name));
    const plan = planMigrations(migrations, applied, await existingLegacyTables(client));

    for (const name of plan.toBaseline) await client.query(RECORD_SQL, [name, true]);
    for (const migration of plan.toRun) await applyOne(client, migration);

    return { applied: plan.toRun.map((migration) => migration.name), baselined: plan.toBaseline };
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_ID]);
    } catch (unlockError) {
      if (failure === undefined) throw unlockError; // otherwise keep the original error
    }
  }
}
