import { normalizeDataset, type DatasetRow } from '$lib/utils/datasetRows';
import type { CrawlRequest, RadioConfig, WavePulseStatus } from '$lib/utils/dataManagement';

// The data management endpoints answer { success, ... } and these helpers hand that answer back as it is, so the page
// decides what a failed answer means. A network error or an unreadable body still throws.
export interface ApiResult {
  success?: boolean;
  error?: string;
  [key: string]: unknown;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function postJson(url: string, body: unknown): Promise<ApiResult> {
  const response = await fetch(url, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) });
  return response.json();
}

async function fetchDatasetRows(url: string): Promise<DatasetRow[] | null> {
  const result = await (await fetch(url)).json();
  return result.success ? (result.datasets || []).map(normalizeDataset) : null;
}

/** The datasets linked to the workspace, or all of them without one. Null when the API says no. */
export function fetchWorkspaceDatasets(workspaceId: string | null): Promise<DatasetRow[] | null> {
  return fetchDatasetRows(`/api/datasets${workspaceId ? `?workspace_id=${workspaceId}` : ''}`);
}

/** Every dataset that can be linked. Null when the API says no. */
export function fetchAvailableDatasets(): Promise<DatasetRow[] | null> {
  return fetchDatasetRows('/api/datasets?status=available');
}

/** The workflows, or null when the API says no. */
export async function fetchWorkflows(): Promise<Record<string, unknown>[] | null> {
  const result = await (await fetch('/api/workflows')).json();
  return result.success ? result.workflows || [] : null;
}

export function linkDatasetToWorkspace(workspaceId: string | null, datasetId: number): Promise<ApiResult> {
  return postJson('/api/datasets', {
    action: 'link',
    workspace_id: parseInt(workspaceId || '0'),
    dataset_id: datasetId,
    added_by: 'user',
    settings: {}
  });
}

/** The WavePulse radio service status; offline when it cannot be reached. */
export async function fetchWavePulseStatus(): Promise<WavePulseStatus> {
  try {
    const response = await fetch('/api/wavepulse?action=status');
    const result = await response.json();
    return result.success ? result : { status: 'offline' };
  } catch {
    return { status: 'offline' };
  }
}

export function startWavePulse(config: RadioConfig): Promise<ApiResult> {
  return postJson('/api/wavepulse', { action: 'start', config });
}

/** Stops the recording. The answer is not read: the caller checks the status afterwards. */
export async function stopWavePulse(): Promise<void> {
  await fetch('/api/wavepulse', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ action: 'stop' }) });
}

export function scheduleCrawl(request: CrawlRequest): Promise<ApiResult> {
  return postJson('/api/crawler', request);
}
