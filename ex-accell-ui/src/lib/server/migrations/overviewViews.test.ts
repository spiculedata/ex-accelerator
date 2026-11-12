import { describe, it, expect } from 'vitest';
import { bundledMigrations } from './files';
import { WORKSPACE_SOURCES_SQL } from '$lib/server/workspaceSources';

describe('overview views migration', () => {
  const migration = bundledMigrations().find((m) => m.name === '0008_overview_views_linked_datasets');

  it('is shipped after the baseline migrations that created the views', () => {
    expect(migration).toBeDefined();
  });

  it('rebuilds both overview views over captured sources and linked datasets', () => {
    const sql = migration!.sql;

    expect(sql).toMatch(/CREATE OR REPLACE VIEW project_overview/);
    expect(sql).toMatch(/CREATE OR REPLACE VIEW workspace_overview/);
    expect(sql).toContain('workspace_data_sources');
    expect(sql).toContain('workspace_datasets');
  });

  it('counts workspace members by workspace_id, not by row id', () => {
    const sql = migration!.sql.replace(/--.*$/gm, '');

    expect(sql).toContain('wm.workspace_id = w.id');
    expect(sql).not.toMatch(/w\.id\s*=\s*wm\.id/);
  });

  it('defines workspace_sources with the same union the API uses, so the two cannot drift', () => {
    const normalise = (sql: string) => sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim();

    expect(normalise(migration!.sql)).toContain(normalise(WORKSPACE_SOURCES_SQL));
  });
});
