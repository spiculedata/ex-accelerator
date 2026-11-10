import { describe, expect, it } from 'vitest';
import { workspaceIdFromRoute } from './workspaceRoute';

const search = (query: string) => new URLSearchParams(query);

describe('workspaceIdFromRoute', () => {
  it('is the id of a workspace page', () => {
    expect(workspaceIdFromRoute('/workspaces/[id]', { id: '7' }, search(''))).toBe('7');
  });

  it('is the workspace an analysis page was opened for', () => {
    expect(workspaceIdFromRoute('/text-analytics/trigrams', {}, search('workspace=3&date_start=2026-11-01'))).toBe('3');
  });

  it('ignores anything that is not a whole number, and pages with no workspace', () => {
    expect(workspaceIdFromRoute('/workspaces/[id]', { id: 'abc' }, search(''))).toBeNull();
    expect(workspaceIdFromRoute('/projects/[id]', { id: '7' }, search(''))).toBeNull();
    expect(workspaceIdFromRoute('/dashboards', {}, search('workspace=1;drop'))).toBeNull();
    expect(workspaceIdFromRoute(null, {}, search(''))).toBeNull();
  });
});
