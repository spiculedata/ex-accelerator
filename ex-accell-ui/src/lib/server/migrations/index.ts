import { postgresPool } from '$lib/services/postgres';
import { createLogger } from '$lib/utils/logger';
import { bundledMigrations } from './files';
import { runMigrations } from './runner';

const log = createLogger('migrations');

/** Brings the database schema up to date. Safe to call repeatedly and from several instances. */
export async function migrateDatabase(): Promise<void> {
  const client = await postgresPool.getClient();
  try {
    const { applied, baselined } = await runMigrations(client, bundledMigrations());
    if (baselined.length > 0) log.info(`Recorded existing schema as applied: ${baselined.join(', ')}`);
    if (applied.length > 0) log.info(`Applied migrations: ${applied.join(', ')}`);
  } finally {
    client.release();
  }
}
