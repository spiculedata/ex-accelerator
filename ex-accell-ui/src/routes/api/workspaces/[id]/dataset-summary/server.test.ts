import { describe, it, expect, vi, beforeEach } from 'vitest';

const getWorkspaceDatasets = vi.hoisted(() => vi.fn());

vi.mock('$lib/services/datasetsDb', () => ({ datasetsDb: { getWorkspaceDatasets } }));

import { GET } from './+server';

const call = (id = '4') => GET({ params: { id } } as unknown as Parameters<typeof GET>[0]);

beforeEach(() => getWorkspaceDatasets.mockReset());

describe('GET /api/workspaces/:id/dataset-summary', () => {
  it('adds record counts that the database returns as strings', async () => {
    getWorkspaceDatasets.mockResolvedValue([
      { dataset_type: 'social_media', source_platform: 'youtube', record_count: '336' },
      { dataset_type: 'social_media', source_platform: 'telegram', record_count: '585' }
    ]);

    const body = await (await call()).json();

    expect(body.summary.recordCount).toBe(921);
    expect(body.summary.datasetCount).toBe(2);
    expect(body.summary.platforms.sort()).toEqual(['telegram', 'youtube']);
  });

  it('treats a missing count as zero', async () => {
    getWorkspaceDatasets.mockResolvedValue([{ dataset_type: 'gdelt_events', source_platform: 'gdelt', record_count: null }]);

    expect((await (await call()).json()).summary.recordCount).toBe(0);
  });

  it('returns an empty summary for a workspace with no datasets', async () => {
    getWorkspaceDatasets.mockResolvedValue([]);

    expect((await (await call()).json()).summary).toMatchObject({ recordCount: 0, datasetCount: 0 });
  });

  it('rejects a non-numeric workspace id', async () => {
    expect((await call('abc')).status).toBe(400);
  });
});
