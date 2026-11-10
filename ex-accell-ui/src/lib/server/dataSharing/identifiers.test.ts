import { describe, it, expect } from 'vitest';
import {
  clampPreviewRows,
  isProtectedTable,
  isSafePackageFileName,
  isSafeSqlIdentifier,
  isSafeSourceSchema,
  qualifiedTable,
  quoteIdentifier,
  PREVIEW_ROWS_DEFAULT,
  PREVIEW_ROWS_MAX
} from './identifiers';

describe('isSafeSqlIdentifier', () => {
  it.each(['posts', 'gdelt_events', '_tmp', 'a1', 'ipfs_bafybeig6xv5'])('accepts %s', (name) => {
    expect(isSafeSqlIdentifier(name)).toBe(true);
  });

  it.each([
    '',
    'Posts',
    '1abc',
    'posts; DROP TABLE app_users; --',
    'posts"',
    'public.posts',
    'a'.repeat(64),
    null,
    undefined,
    42
  ])('rejects %j', (name) => {
    expect(isSafeSqlIdentifier(name)).toBe(false);
  });
});

describe('quoteIdentifier', () => {
  it('double-quotes a safe identifier', () => {
    expect(quoteIdentifier('posts')).toBe('"posts"');
  });

  it('throws for anything that is not a safe identifier rather than escaping it', () => {
    expect(() => quoteIdentifier('po"sts')).toThrow(/identifier/i);
  });
});

describe('qualifiedTable', () => {
  it('quotes both parts', () => {
    expect(qualifiedTable('bronze', 'posts')).toBe('"bronze"."posts"');
  });

  it('refuses an unsafe schema or table', () => {
    expect(() => qualifiedTable('public', 'x; DROP TABLE y')).toThrow();
    expect(() => qualifiedTable('pg_catalog', 'pg_shadow')).toThrow();
  });
});

describe('isSafeSourceSchema', () => {
  it.each(['public', 'bronze', 'silver', 'gold'])('accepts %s', (schema) => {
    expect(isSafeSourceSchema(schema)).toBe(true);
  });

  it.each(['pg_catalog', 'information_schema', 'pg_toast', 'Public'])('rejects system schema %s', (schema) => {
    expect(isSafeSourceSchema(schema)).toBe(false);
  });
});

describe('isProtectedTable', () => {
  it.each([
    'app_users',
    'schema_migrations',
    'project_members',
    'dataset_permissions',
    'ipfs_published_packages',
    'activity_logs',
    'published_workflows',
    'user_dataset_access',
    'project_overview'
  ])('keeps the application table or view %s out of packages', (table) => {
    expect(isProtectedTable(table)).toBe(true);
  });

  it.each(['posts', 'gdelt_events', 'sentiment_classifications'])('lets the data table %s be packaged', (table) => {
    expect(isProtectedTable(table)).toBe(false);
  });
});

describe('clampPreviewRows', () => {
  it('uses the default when the value is missing or not a number', () => {
    expect(clampPreviewRows(undefined)).toBe(PREVIEW_ROWS_DEFAULT);
    expect(clampPreviewRows('lots')).toBe(PREVIEW_ROWS_DEFAULT);
    expect(clampPreviewRows(null)).toBe(PREVIEW_ROWS_DEFAULT);
  });

  it('keeps a reasonable request', () => {
    expect(clampPreviewRows(25)).toBe(25);
    expect(clampPreviewRows('25')).toBe(25);
  });

  it('caps a huge request and refuses zero or negative ones', () => {
    expect(clampPreviewRows(10_000_000)).toBe(PREVIEW_ROWS_MAX);
    expect(clampPreviewRows(0)).toBe(PREVIEW_ROWS_DEFAULT);
    expect(clampPreviewRows(-5)).toBe(PREVIEW_ROWS_DEFAULT);
    expect(clampPreviewRows(2.7)).toBe(2);
  });
});

describe('isSafePackageFileName', () => {
  it.each(['datapackage.json', 'posts.csv', 'posts-preview.csv', 'README.md', 'a_b.1'])('accepts %s', (name) => {
    expect(isSafePackageFileName(name)).toBe(true);
  });

  it.each(['', '..', '.', '../etc/passwd', 'a/b.csv', 'a\\b.csv', '.hidden', 'x\0y', ' lead', 'a'.repeat(256), 7, null])(
    'rejects %j',
    (name) => {
      expect(isSafePackageFileName(name)).toBe(false);
    }
  );
});
