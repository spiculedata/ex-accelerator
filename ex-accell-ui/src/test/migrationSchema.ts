import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Table name -> column names, parsed from the CREATE TABLE and ALTER TABLE ... ADD COLUMN statements in db/migrations. For schema-drift tests. */
export function migrationColumns(): Map<string, Set<string>> {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'db', 'migrations');
  const sql = readdirSync(dir)
    .sort()
    .map((file) => readFileSync(join(dir, file), 'utf8'))
    .join('\n')
    .replace(/--.*$/gm, '');
  const tables = new Map<string, Set<string>>();
  for (const match of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\(([\s\S]*?)\n\);/g)) {
    const columns = new Set<string>();
    for (const line of match[2].split('\n')) {
      const name = line.trim().match(/^([a-z_][a-z0-9_]*)\s+[A-Za-z]/)?.[1];
      if (name && !/^(unique|primary|foreign|constraint|check)$/i.test(name)) columns.add(name);
    }
    tables.set(match[1], columns);
  }
  // Columns added later: ALTER TABLE t ADD COLUMN [IF NOT EXISTS] c ..., [ADD COLUMN ...];
  for (const match of sql.matchAll(/ALTER TABLE (?:IF EXISTS )?(\w+)([^;]*);/g)) {
    for (const added of match[2].matchAll(/ADD COLUMN (?:IF NOT EXISTS )?(\w+)/g)) tables.get(match[1])?.add(added[1]);
  }
  return tables;
}
