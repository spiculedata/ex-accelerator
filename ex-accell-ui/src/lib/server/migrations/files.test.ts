import { describe, it, expect } from 'vitest';
import { bundledMigrations } from './files';
import { LEGACY_BASELINE } from './runner';

describe('bundledMigrations', () => {
  it('includes every legacy baseline migration, in order', () => {
    const names = bundledMigrations().map((migration) => migration.name);

    expect(names.slice(0, Object.keys(LEGACY_BASELINE).length)).toEqual(Object.keys(LEGACY_BASELINE));
  });

  it('ships DDL only: no INSERT, DROP TABLE or DELETE statements', () => {
    for (const migration of bundledMigrations()) {
      const sql = migration.sql.replace(/--.*$/gm, '');
      expect(sql, migration.name).not.toMatch(/^\s*(INSERT|DELETE|DROP\s+TABLE|TRUNCATE)\b|\bDROP\s+COLUMN\b/im);
    }
  });
});
