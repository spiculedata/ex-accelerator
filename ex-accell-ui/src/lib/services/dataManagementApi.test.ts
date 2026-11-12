import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchAvailableDatasets,
  fetchWavePulseStatus,
  fetchWorkflows,
  fetchWorkspaceDatasets,
  linkDatasetToWorkspace,
  scheduleCrawl,
  startWavePulse,
  stopWavePulse
} from './dataManagementApi';
import { defaultCrawlerConfig, defaultRadioConfig } from '$lib/utils/dataManagement';

const fetchMock = vi.fn();
const reply = (body: unknown) => ({ json: async () => body });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('datasets', () => {
  it('asks for the workspace datasets and normalises the rows', async () => {
    fetchMock.mockResolvedValue(reply({ success: true, datasets: [{ dataset_id: 3, dataset_name: 'Posts' }] }));
    const rows = await fetchWorkspaceDatasets('9');
    expect(fetchMock).toHaveBeenCalledWith('/api/datasets?workspace_id=9');
    expect(rows).toEqual([{ dataset_id: 3, dataset_name: 'Posts', id: 3, name: 'Posts' }]);
  });

  it('asks for every dataset without a workspace', async () => {
    fetchMock.mockResolvedValue(reply({ success: true }));
    expect(await fetchWorkspaceDatasets(null)).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith('/api/datasets');
  });

  it('is null when the API does not succeed, so the caller keeps what it had', async () => {
    fetchMock.mockResolvedValue(reply({ success: false }));
    expect(await fetchWorkspaceDatasets('9')).toBeNull();
    expect(await fetchAvailableDatasets()).toBeNull();
    expect(await fetchWorkflows()).toBeNull();
  });

  it('asks for the datasets that can be linked', async () => {
    fetchMock.mockResolvedValue(reply({ success: true, datasets: [{ id: 1, name: 'A' }] }));
    expect(await fetchAvailableDatasets()).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/datasets?status=available');
  });

  it('reads the workflows', async () => {
    fetchMock.mockResolvedValue(reply({ success: true, workflows: [{ id: 'a' }] }));
    expect(await fetchWorkflows()).toEqual([{ id: 'a' }]);
  });

  it('posts a link request, with workspace 0 when none is given', async () => {
    fetchMock.mockResolvedValue(reply({ success: true }));
    await linkDatasetToWorkspace('9', 4);
    await linkDatasetToWorkspace(null, 4);
    const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body));
    expect(bodies[0]).toEqual({ action: 'link', workspace_id: 9, dataset_id: 4, added_by: 'user', settings: {} });
    expect(bodies[1].workspace_id).toBe(0);
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  });
});

describe('WavePulse', () => {
  it('returns the status the service reports', async () => {
    fetchMock.mockResolvedValue(reply({ success: true, status: 'running', recordings_count: 3 }));
    expect(await fetchWavePulseStatus()).toMatchObject({ status: 'running', recordings_count: 3 });
    expect(fetchMock).toHaveBeenCalledWith('/api/wavepulse?action=status');
  });

  it('is offline when the service says no or cannot be reached', async () => {
    fetchMock.mockResolvedValueOnce(reply({ success: false }));
    expect(await fetchWavePulseStatus()).toEqual({ status: 'offline' });
    fetchMock.mockRejectedValueOnce(new Error('down'));
    expect(await fetchWavePulseStatus()).toEqual({ status: 'offline' });
  });

  it('starts with the configuration and stops without reading the answer', async () => {
    fetchMock.mockResolvedValueOnce(reply({ success: true }));
    const config = defaultRadioConfig();
    await startWavePulse(config);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ action: 'start', config });

    fetchMock.mockResolvedValueOnce({ json: async () => { throw new Error('not json'); } });
    await expect(stopWavePulse()).resolves.toBeUndefined();
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ action: 'stop' });
  });
});

describe('crawler', () => {
  it('posts the crawl request', async () => {
    fetchMock.mockResolvedValue(reply({ success: true }));
    const request = { ...defaultCrawlerConfig(), urls: ['a'], crawlId: 'x' };
    expect(await scheduleCrawl(request)).toEqual({ success: true });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/crawler');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(request);
  });
});
