/**
 * Loads a synthetic demo dataset (a fictional city, no real content) into the configured database.
 *
 *   npm run seed:demo                      load into an empty database
 *   ALLOW_DEMO_RESET=1 npm run seed:demo -- --reset   wipe the demo tables first (destructive)
 */
import 'dotenv/config';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { TABLE_ORDER, generateDemoData } from '../src/lib/server/demo/generateDemoData';
import { toInsertStatements } from '../src/lib/server/demo/insertStatements';
import { runMigrations } from '../src/lib/server/migrations/runner';

const SERIAL_TABLES = ['projects', 'project_members', 'workspaces', 'workspace_data_sources', 'datasets', 'dataset_tags'];

function loadMigrations() {
  const dir = join(process.cwd(), 'db', 'migrations');
  return readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => ({ name: file.replace(/\.sql$/, ''), sql: readFileSync(join(dir, file), 'utf8') }));
}

async function occupiedTables(client: pg.Client): Promise<string[]> {
  const found: string[] = [];
  for (const table of ['posts', 'projects', 'workspaces', 'datasets']) {
    const { rows } = await client.query(`SELECT EXISTS (SELECT 1 FROM ${table}) AS present`);
    if (rows[0].present) found.push(table);
  }
  return found;
}

async function main() {
  const reset = process.argv.includes('--reset');
  if (reset && process.env.ALLOW_DEMO_RESET !== '1') {
    throw new Error('--reset deletes data. Re-run with ALLOW_DEMO_RESET=1 if you are sure.');
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Set DATABASE_URL so the loader cannot fall back to an unintended database.');

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const { applied } = await runMigrations(client, loadMigrations());
    if (applied.length > 0) console.log(`Applied migrations: ${applied.join(', ')}`);

    const occupied = await occupiedTables(client);
    if (occupied.length > 0 && !reset) {
      // scripts/demo.sh recognises this message to tell a resumed demo from a failure; keep the wording in step
      throw new Error(`Demo data only loads into an empty database, but ${occupied.join(', ')} already contain rows.`);
    }

    const data = generateDemoData();
    await client.query('BEGIN');
    if (reset) await client.query(`TRUNCATE ${[...TABLE_ORDER].reverse().join(', ')} RESTART IDENTITY CASCADE`);
    for (const table of data.tables) {
      for (const statement of toInsertStatements(table)) await client.query(statement.text, statement.values as unknown[]);
    }
    for (const table of SERIAL_TABLES) {
      await client.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), (SELECT max(id) FROM ${table}))`);
    }
    await client.query('COMMIT');

    const posts = data.tables.find((t) => t.name === 'posts')!.rows.length;
    console.log(`Loaded demo dataset: ${posts} posts across ${data.tables.length} tables.`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
