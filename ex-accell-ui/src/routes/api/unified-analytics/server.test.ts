import { describe, it, expect, vi, beforeEach } from 'vitest';

const { duckdbQuery, healthCheck } = vi.hoisted(() => ({
  duckdbQuery: vi.fn(),
  healthCheck: vi.fn().mockResolvedValue(true)
}));

vi.mock('$lib/services/postgres', () => ({ postgresPool: { duckdbQuery, healthCheck } }));
vi.mock('$lib/services/workspaceContextResolver', () => ({
  resolveWorkspaceScope: vi.fn().mockResolvedValue(null),
  buildPlatformFilter: vi.fn().mockReturnValue(null),
  hasDataType: vi.fn().mockReturnValue(true)
}));
vi.mock('$lib/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}));

import { GET } from './+server';

const call = (type: string) =>
  GET({ url: new URL(`http://localhost/api/unified-analytics?type=${type}`) } as Parameters<typeof GET>[0]);

beforeEach(() => {
  duckdbQuery.mockReset();
});

describe('GET /api/unified-analytics error handling', () => {
  it('returns rows on success', async () => {
    duckdbQuery.mockResolvedValue([{ emotion: 'joy', count: '3' }]);

    const body = await (await call('emotion-stats')).json();

    expect(body.success).toBe(true);
    expect(body.data).toEqual([{ emotion: 'joy', count: 3 }]);
  });

  it('returns a 500 (not success with empty data) when the query fails', async () => {
    duckdbQuery.mockRejectedValue(new Error('connection terminated unexpectedly'));

    const response = await call('emotion-stats');
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(JSON.stringify(body)).not.toContain('connection terminated');
  });

  it('returns empty data flagged unavailable when the module has no table yet', async () => {
    duckdbQuery.mockRejectedValue(Object.assign(new Error('relation "emotion_analysis" does not exist'), { code: '42P01' }));

    const response = await call('emotion-stats');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, data: [], meta: { unavailable: true } });
  });
});
