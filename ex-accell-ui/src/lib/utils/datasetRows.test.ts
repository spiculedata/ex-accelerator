import { describe, it, expect } from 'vitest';
import { normalizeDataset, unlinkedDatasets } from './datasetRows';

const workspaceRow = { workspace_id: 1, dataset_id: 7, dataset_name: 'Telegram posts', description: 'd', dataset_type: 'social_media', record_count: '585', status: 'active' };
const catalogRow = { id: 7, name: 'Telegram posts', description: 'd', dataset_type: 'social_media', record_count: '585', status: 'available' };

describe('normalizeDataset', () => {
  it('gives a workspace-scoped row the id and name the page reads', () => {
    expect(normalizeDataset(workspaceRow)).toMatchObject({ id: 7, name: 'Telegram posts' });
  });

  it('leaves a catalog row as it is', () => {
    expect(normalizeDataset(catalogRow)).toMatchObject({ id: 7, name: 'Telegram posts' });
  });

  it('keeps the other fields', () => {
    expect(normalizeDataset(workspaceRow)).toMatchObject({ dataset_type: 'social_media', record_count: '585', status: 'active' });
  });
});

describe('unlinkedDatasets', () => {
  it('offers only datasets that are not already linked, comparing by dataset id', () => {
    const other = { ...catalogRow, id: 8, name: 'YouTube' };

    expect(unlinkedDatasets([catalogRow, other], [workspaceRow]).map((d) => d.id)).toEqual([8]);
  });

  it('offers everything when nothing is linked', () => {
    expect(unlinkedDatasets([catalogRow], [])).toHaveLength(1);
  });
});
