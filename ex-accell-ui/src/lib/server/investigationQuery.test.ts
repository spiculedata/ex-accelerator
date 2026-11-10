import { describe, expect, it } from 'vitest';
import { investigationListQuery } from './investigationQuery';

describe('investigationListQuery', () => {
  it('lists everything, newest first, when nothing is asked for', () => {
    expect(investigationListQuery({})).toEqual({ sql: 'SELECT * FROM investigations ORDER BY updated_at DESC', params: [] });
  });

  it('filters by workspace', () => {
    const q = investigationListQuery({ workspaceId: 4 });
    expect(q.sql).toBe('SELECT * FROM investigations WHERE workspace_id = $1 ORDER BY updated_at DESC');
    expect(q.params).toEqual([4]);
  });

  it('filters by project through the workspaces that belong to it', () => {
    const q = investigationListQuery({ projectId: 2 });
    expect(q.sql).toBe('SELECT * FROM investigations WHERE workspace_id IN (SELECT id FROM workspaces WHERE project_id = $1) ORDER BY updated_at DESC');
    expect(q.params).toEqual([2]);
  });

  it('applies both when both are given, numbering parameters in order', () => {
    const q = investigationListQuery({ workspaceId: 4, projectId: 2 });
    expect(q.sql).toContain('workspace_id = $1 AND workspace_id IN (SELECT id FROM workspaces WHERE project_id = $2)');
    expect(q.params).toEqual([4, 2]);
  });
});
