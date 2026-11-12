import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({ getWorkspaceDatasets: vi.fn() }));
vi.mock('$lib/services/datasetsDb', () => ({ datasetsDb: db }));

import { GET } from './+server';

const get = (id = '4') => GET({ params: { id } } as never);

beforeEach(() => {
  db.getWorkspaceDatasets.mockReset();
});

describe('GET /api/workspaces/[id]/dataset-summary', () => {
  it('summarises types, platforms and records, with the summary in data and the legacy key', async () => {
    db.getWorkspaceDatasets.mockResolvedValue([
      { dataset_type: 'social_media', source_platform: 'telegram', record_count: '10', last_updated: new Date().toISOString() },
      { dataset_type: 'social_media', source_platform: 'bluesky', record_count: 5 }
    ]);

    const body = await (await get()).json();

    expect(body.success).toBe(true);
    expect(body.summary).toMatchObject({ types: ['social_media'], platforms: ['telegram', 'bluesky'], recordCount: 15, datasetCount: 2, lastSync: 'Just now' });
    expect(body.data).toEqual(body.summary);
  });

  it('adds record counts that the database returns as strings and treats a missing count as zero', async () => {
    db.getWorkspaceDatasets.mockResolvedValue([
      { dataset_type: 'social_media', source_platform: 'youtube', record_count: '336' },
      { dataset_type: 'social_media', source_platform: 'telegram', record_count: '585' },
      { dataset_type: 'gdelt_events', source_platform: 'gdelt', record_count: null }
    ]);

    const body = await (await get()).json();

    expect(body.summary.recordCount).toBe(921);
    expect(body.summary.datasetCount).toBe(3);
    expect([...body.summary.platforms].sort()).toEqual(['gdelt', 'telegram', 'youtube']);
  });

  it('returns an empty summary when there are no datasets', async () => {
    db.getWorkspaceDatasets.mockResolvedValue([]);

    const body = await (await get()).json();

    expect(body.data).toEqual({ types: [], platforms: [], recordCount: 0, datasetCount: 0, lastSync: null });
  });

  it('refuses a non-numeric id with a failure envelope', async () => {
    const response = await get('abc');

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, data: null, error: 'Invalid workspace ID' });
    expect(db.getWorkspaceDatasets).not.toHaveBeenCalled();
  });

  it('returns a generic 500 without the database message', async () => {
    db.getWorkspaceDatasets.mockRejectedValue(new Error('password authentication failed'));

    const response = await get();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, data: null, error: 'Failed to retrieve dataset summary' });
  });
});
