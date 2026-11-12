import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const query = vi.hoisted(() => vi.fn());
vi.mock('./postgres', () => ({ postgresPool: { query } }));

import { resolveWorkspaceScope, resolveFilters } from './workspaceContextResolver';

const at = (search: string) => new URL(`http://localhost/api/x${search}`);

beforeEach(() => {
  query.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('resolveWorkspaceScope', () => {
  it('answers kind none, without touching the database, when no workspace was asked for', async () => {
    expect(await resolveWorkspaceScope(at(''))).toEqual({ kind: 'none' });
    expect(await resolveWorkspaceScope(at('?workspace_id='))).toEqual({ kind: 'none' });
    expect(query).not.toHaveBeenCalled();
  });

  it('answers kind scoped with the scope for a workspace that exists', async () => {
    query
      .mockResolvedValueOnce([{ name: 'Ws' }])
      .mockResolvedValueOnce([{ id: 1, name: 'd', dataset_type: 'social_media', source_platform: 'Telegram', date_range_start: null, date_range_end: null }]);

    const result = await resolveWorkspaceScope(at('?workspace_id=7'));

    expect(result.kind).toBe('scoped');
    if (result.kind === 'scoped') {
      expect(result.scope.workspaceId).toBe(7);
      expect(result.scope.socialPlatforms).toEqual(['telegram']);
    }
  });

  it('reads the legacy workspace parameter too', async () => {
    query.mockResolvedValueOnce([{ name: 'Ws' }]).mockResolvedValueOnce([]);
    expect((await resolveWorkspaceScope(at('?workspace=7'))).kind).toBe('scoped');
  });

  it('answers kind missing, never none, for a workspace that does not exist', async () => {
    query.mockResolvedValue([]);
    expect(await resolveWorkspaceScope(at('?workspace_id=99'))).toEqual({ kind: 'missing', workspaceId: 99 });
  });

  it.each(['abc', '12abc', '-1', '1.5', '0x10'])('answers kind missing for the malformed id %s, without a query', async (bad) => {
    expect(await resolveWorkspaceScope(at(`?workspace_id=${bad}`))).toEqual({ kind: 'missing', workspaceId: null });
    expect(query).not.toHaveBeenCalled();
  });

  it('throws on a database failure rather than answering none or missing', async () => {
    query.mockRejectedValue(new Error('connection refused'));
    await expect(resolveWorkspaceScope(at('?workspace_id=1'))).rejects.toThrow('connection refused');
  });
});

describe('resolveFilters', () => {
  it('carries a null scope only when no workspace was requested', async () => {
    expect((await resolveFilters(at(''))).scope).toBeNull();
  });

  it('throws for a workspace that is not found instead of returning unscoped filters', async () => {
    query.mockResolvedValue([]);
    await expect(resolveFilters(at('?workspace_id=99'))).rejects.toThrow(/not found/i);
  });
});
