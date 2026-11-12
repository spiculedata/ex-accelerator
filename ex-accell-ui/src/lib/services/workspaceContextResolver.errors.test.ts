import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const query = vi.hoisted(() => vi.fn());
vi.mock('./postgres', () => ({ postgresPool: { query } }));

import { resolveWorkspaceScopeById } from './workspaceContextResolver';

beforeEach(() => {
  query.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('resolveWorkspaceScopeById failures', () => {
  it('rethrows a database failure rather than returning null, which would mean "no workspace filter"', async () => {
    query.mockRejectedValue(new Error('connection refused'));
    await expect(resolveWorkspaceScopeById(1)).rejects.toThrow('connection refused');
  });

  it('still returns null for a workspace that does not exist', async () => {
    query.mockResolvedValue([]);
    expect(await resolveWorkspaceScopeById(1)).toBeNull();
  });
});
