import type { Migration } from './runner';

// Bundled at build time so the production image needs no extra files.
const files = import.meta.glob('/db/migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>;

/** Migration SQL shipped with the app, ordered by file name. */
export function bundledMigrations(): Migration[] {
  return Object.entries(files)
    .map(([path, sql]) => ({ name: path.split('/').pop()!.replace(/\.sql$/, ''), sql }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
