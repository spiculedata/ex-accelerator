// What may be named in a data package: SQL identifiers that are quoted (never interpolated), tables that hold
// research data rather than the application's own records, and file names that stay inside one directory.

// Postgres folds unquoted names to lower case, so a lower-case name is the one that exists in the catalogue
const SQL_IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/;
const PACKAGE_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;
const SYSTEM_SCHEMA = /^(pg_|information_schema$)/;

/** Tables that hold accounts, membership, audit or bookkeeping rather than data: never exported, whatever the catalogue says. */
export const PROTECTED_TABLES: ReadonlySet<string> = new Set([
  'app_users',
  'schema_migrations',
  'activity_logs',
  'projects',
  'project_members',
  'workspaces',
  'workspace_members',
  'workspace_data_sources',
  'workspace_datasets',
  'datasets',
  'dataset_permissions',
  'dataset_tags',
  'investigations',
  'published_workflows',
  'workflow_executions',
  'ipfs_published_packages',
  'crawlers',
  'data_sources',
  // Views over the tables above (information_schema.columns lists views too)
  'project_overview',
  'workspace_overview',
  'dataset_overview',
  'workspace_dataset_overview',
  'user_dataset_access'
]);

export const PREVIEW_ROWS_DEFAULT = 100;
export const PREVIEW_ROWS_MAX = 1000;

/** True for a lower-case Postgres identifier of at most 63 characters. */
export function isSafeSqlIdentifier(value: unknown): value is string {
  return typeof value === 'string' && SQL_IDENTIFIER.test(value);
}

/** True for a schema a dataset may live in: a plain identifier that is not one of Postgres's own. */
export function isSafeSourceSchema(value: unknown): value is string {
  return isSafeSqlIdentifier(value) && !SYSTEM_SCHEMA.test(value);
}

export function isProtectedTable(table: string): boolean {
  return PROTECTED_TABLES.has(table);
}

/** The identifier double-quoted for SQL. Throws rather than escaping: a name that needs escaping is not one we use. */
export function quoteIdentifier(value: string): string {
  if (!isSafeSqlIdentifier(value)) throw new Error(`Not a safe SQL identifier: ${JSON.stringify(value)}`);
  return `"${value}"`;
}

/** `"schema"."table"`, both checked. */
export function qualifiedTable(schema: string, table: string): string {
  if (!isSafeSourceSchema(schema)) throw new Error(`Not a safe schema name: ${JSON.stringify(schema)}`);
  return `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
}

/** How many preview rows to keep: the request's number when it is a sensible one, else the default; never above the cap. */
export function clampPreviewRows(value: unknown): number {
  const requested = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(requested) || requested < 1) return PREVIEW_ROWS_DEFAULT;
  return Math.min(Math.floor(requested), PREVIEW_ROWS_MAX);
}

/** True for a plain file name (no path separators, no leading dot, no control characters) of at most 255 characters. */
export function isSafePackageFileName(value: unknown): value is string {
  return typeof value === 'string' && PACKAGE_FILE_NAME.test(value);
}
