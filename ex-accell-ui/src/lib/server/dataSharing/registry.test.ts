import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrationColumns } from '../../../test/migrationSchema';

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'registry.ts'), 'utf8');

/** Columns named in an INSERT column list or an `ON CONFLICT ... DO UPDATE SET` clause of the registry source. */
function writtenColumns(): string[] {
  const inserts = [...source.matchAll(/INSERT INTO ipfs_published_packages\s*\(([^)]*)\)/g)].flatMap((m) => m[1].split(','));
  const updates = [...source.matchAll(/DO UPDATE SET([\s\S]*?)`/g)].flatMap((m) => [...m[1].matchAll(/(?:^|,)\s*([a-z_]+)\s*=/g)].map((c) => c[1]));
  const sets = [...source.matchAll(/UPDATE ipfs_published_packages\s+SET([\s\S]*?)WHERE/g)].flatMap((m) => [...m[1].matchAll(/(?:^|,)\s*([a-z_]+)\s*=/g)].map((c) => c[1]));
  return [...new Set([...inserts, ...updates, ...sets].map((c) => c.trim()).filter(Boolean))];
}

/** Columns named in the SELECT lists of the registry source. */
function selectedColumns(): string[] {
  const publicColumns = source.match(/PUBLIC_COLUMNS =\s*'([^']*)'/)?.[1] ?? '';
  return [...publicColumns.split(','), 'published_by', 'withdrawn_by'].map((c) => c.trim());
}

describe('the ipfs_published_packages registry schema', () => {
  const columns = migrationColumns().get('ipfs_published_packages');

  it('is created by a migration, not at runtime', () => {
    expect(columns, 'ipfs_published_packages is not defined in db/migrations').toBeDefined();
    expect(source).not.toMatch(/CREATE TABLE|ALTER TABLE/i);
    expect(source).not.toMatch(/ensureRegistryTable/);
  });

  it('defines every column the registry writes', () => {
    for (const column of writtenColumns()) expect(columns!.has(column), `ipfs_published_packages.${column}`).toBe(true);
  });

  it('defines every column the registry reads', () => {
    for (const column of selectedColumns()) expect(columns!.has(column), `ipfs_published_packages.${column}`).toBe(true);
  });
});
