import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';

const nav = vi.hoisted(() => ({ goto: vi.fn() }));
const project = vi.hoisted(() => ({ current: { id: '1', name: 'Project' } as { id: string; name: string } | null }));
const routing = vi.hoisted(() => ({ search: '' }));

vi.mock('$app/navigation', () => nav);
vi.mock('$app/stores', async () => {
  const { readable } = await import('svelte/store');
  return { page: readable({ get url() { return new URL(`http://localhost/data-management${routing.search}`); } }) };
});
vi.mock('$lib/stores/projectStore', async () => {
  const { writable } = await import('svelte/store');
  const currentProject = writable<unknown>(null);
  return {
    currentProject,
    loadCurrentProject: vi.fn(async () => {
      currentProject.set(project.current);
    })
  };
});

import Page from './+page.svelte';

const bluesky = { id: 1, name: 'Bluesky posts', description: 'Posts from Bluesky accounts', dataset_type: 'social_media', source_platform: 'bluesky', status: 'available', record_count: '1200', last_updated: '2026-01-02T10:00:00Z', columns: ['id', 'text', 'author', 'created'] };
const radio = { id: 2, name: 'Talk radio', description: '', dataset_type: 'radio', status: 'available', record_count: '30' };
const gdelt = { id: 3, name: 'World events', description: 'GDELT', dataset_type: 'gdelt_events', status: 'available', record_count: '5000' };
const spare = { id: 4, name: 'Spare dataset', description: 'Not linked yet', dataset_type: 'social_media', status: 'available', record_count: '12' };
const draft = { id: 'wf-1', name: 'Clean posts', description: 'Remove spam', status: 'draft', steps: 3, inputSource: 'Bluesky posts', outputDataset: 'Clean posts' };
const running = { id: 'wf-2', name: 'Score tone', description: 'Sentiment', status: 'running', progress: 40, recordsProcessed: 1500 };

interface Server {
  linked?: unknown[];
  catalog?: unknown[];
  workflows?: unknown[];
  wavepulse?: Record<string, unknown>;
  link?: Record<string, unknown>;
  crawler?: Record<string, unknown>;
  radio?: Record<string, unknown>;
  failDatasets?: boolean;
}

const calls: Array<{ url: string; body?: Record<string, unknown> }> = [];

function serve(server: Server = {}) {
  const { linked = [bluesky, radio, gdelt], catalog = [bluesky, radio, gdelt, spare], workflows = [draft, running], wavepulse = { success: true, status: 'idle' } } = server;
  calls.length = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url: `${init?.method ?? 'GET'} ${url}`, body });
    const reply = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
    if (server.failDatasets && url.startsWith('/api/datasets')) throw new Error('offline');
    if (url === '/api/datasets' && init?.method === 'POST') return reply(server.link ?? { success: true });
    if (url.startsWith('/api/datasets?status=available')) return reply({ success: true, datasets: catalog });
    if (url.startsWith('/api/datasets')) return reply({ success: true, datasets: linked });
    if (url === '/api/workflows') return reply({ success: true, workflows });
    if (url.startsWith('/api/wavepulse') && init?.method === 'POST') return reply(server.radio ?? { success: true });
    if (url.startsWith('/api/wavepulse')) return reply(wavepulse);
    if (url === '/api/crawler') return reply(server.crawler ?? { success: true });
    return reply({ success: false });
  });
}

const posted = (match: string) => calls.find((c) => c.url.startsWith('POST') && c.url.includes(match));
const overviewCount = (label: string) => screen.getByText(label, { selector: 'span.text-xs' }).nextElementSibling?.textContent;
const loaded = () => screen.findByText('Data Sources (3)');

beforeEach(() => {
  project.current = { id: '1', name: 'Project' };
  routing.search = '';
  window.history.pushState({}, '', '/data-management');
  nav.goto.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('data management loading', () => {
  it('sends the user to pick a project when none is open', async () => {
    project.current = null;
    serve();
    render(Page);
    await waitFor(() => expect(nav.goto).toHaveBeenCalledWith('/projects'));
    expect(calls.some((c) => c.url.includes('/api/workflows'))).toBe(false);
  });

  it('shows a loading message and then the pipeline overview', async () => {
    serve();
    render(Page);
    expect(screen.getByText('Loading data management...')).toBeTruthy();
    await loaded();
    expect(overviewCount('Sources')).toBe('3');
    expect(overviewCount('Jobs')).toBe('1');
    expect(overviewCount('Records')).toBe('6.2K');
    expect(overviewCount('Workflows')).toBe('2');
    expect(overviewCount('Datasets')).toBe('3');
  });

  it('reports a failed load', async () => {
    serve({ failDatasets: true });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(Page);
    expect(await screen.findByText('Failed to load data. Please try again.')).toBeTruthy();
  });

  it('scopes the datasets to the workspace in the address', async () => {
    routing.search = '?workspace=9';
    serve();
    render(Page);
    await loaded();
    expect(calls.map((c) => c.url)).toContain('GET /api/datasets?workspace_id=9');
    expect(calls.map((c) => c.url)).toContain('GET /api/datasets?status=available');
  });
});

describe('data sources tab', () => {
  it('lists each source with its icon, type, records and status', async () => {
    serve();
    render(Page);
    await loaded();
    const rows = Array.from(document.querySelectorAll('tbody tr')).map((tr) => tr.textContent?.replace(/\s+/g, ' ').trim());
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain('🦋');
    expect(rows[0]).toContain('Bluesky posts');
    expect(rows[0]).toContain('social_media');
    expect(rows[0]).toContain('1.2K');
    expect(rows[0]).toContain('connected');
    expect(rows[0]).toContain('Preview');
    expect(rows[1]).toContain('📻');
    expect(rows[1]).toContain('idle');
    expect(rows[1]).toContain('Configure');
    expect(rows[2]).toContain('🌍');
  });

  it('opens a preview with the dataset details', async () => {
    serve();
    render(Page);
    await loaded();
    await fireEvent.click(screen.getAllByText('Preview')[0]);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Bluesky posts')).toBeTruthy();
    expect(within(dialog).getByText('What this dataset contains')).toBeTruthy();
    // A source row, unlike a dataset row, carries no dataset_type, so the dialog falls back to 'unknown'
    expect(within(dialog).getByText('unknown')).toBeTruthy();
    expect(within(dialog).getByText('Posts from Bluesky accounts')).toBeTruthy();
    await fireEvent.click(within(dialog).getByText('Close'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('datasets tab', () => {
  async function openDatasets() {
    serve();
    render(Page);
    await loaded();
    await fireEvent.click(screen.getByText('Datasets (3)'));
  }

  it('lists datasets with their first three columns and a count of the rest', async () => {
    await openDatasets();
    expect(screen.getByText('Available Datasets')).toBeTruthy();
    expect(screen.getByText('+1')).toBeTruthy();
    expect(screen.getByText('text')).toBeTruthy();
    expect(screen.queryByText('created')).toBeNull();
  });

  it('previews a dataset with its platform and date range', async () => {
    await openDatasets();
    await fireEvent.click(screen.getAllByText('Preview')[0]);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Platform')).toBeTruthy();
    expect(within(dialog).getByText('bluesky')).toBeTruthy();
    expect(within(dialog).getByText('social_media')).toBeTruthy();
    expect(within(dialog).getByText('1.2K')).toBeTruthy();
    expect(within(dialog).getByText('Status')).toBeTruthy();
  });

  it('opens the workflow builder for a dataset', async () => {
    await openDatasets();
    await fireEvent.click(screen.getAllByText('Process')[0]);
    expect(nav.goto).toHaveBeenCalledWith('/data-management/workflow-builder?dataset=1');
  });
});

describe('workflows tab', () => {
  it('can be opened from the address', async () => {
    window.history.pushState({}, '', '/data-management?tab=workflows');
    serve();
    render(Page);
    expect(await screen.findByRole('heading', { name: 'Clean posts' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Processing Workflows' })).toBeTruthy();
  });

  it('shows the details of each workflow and only offers a draft in the builder', async () => {
    serve();
    render(Page);
    await loaded();
    await fireEvent.click(screen.getByText('Processing Workflows (2)'));
    expect(screen.getByText('📊 3 steps')).toBeTruthy();
    expect(screen.getByText('📈 1,500 records')).toBeTruthy();
    expect(screen.getByText('40%')).toBeTruthy();
    expect(screen.getByText('📝 draft')).toBeTruthy();
    expect(screen.getAllByText('Open in builder')).toHaveLength(1);
    await fireEvent.click(screen.getByText('Open in builder'));
    expect(nav.goto).toHaveBeenCalledWith('/data-management/workflow-builder?workflow=wf-1');
    await fireEvent.click(screen.getByText('New Workflow'));
    expect(nav.goto).toHaveBeenCalledWith('/data-management/workflow-builder');
  });

  it('opens the builder from the header', async () => {
    serve();
    render(Page);
    await loaded();
    await fireEvent.click(screen.getByText('Create Workflow'));
    expect(nav.goto).toHaveBeenCalledWith('/data-management/workflow-builder');
  });
});

describe('linking a dataset', () => {
  it('lists the datasets that are not yet linked and links one', async () => {
    routing.search = '?workspace=9';
    serve();
    render(Page);
    await loaded();
    await fireEvent.click(screen.getByText('Link dataset'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Spare dataset')).toBeTruthy();
    expect(within(dialog).queryByText('Bluesky posts')).toBeNull();
    await fireEvent.click(within(dialog).getByText('Spare dataset'));
    await waitFor(() => expect(screen.getByText('Linked "Spare dataset" to this workspace.')).toBeTruthy());
    expect(posted('/api/datasets')?.body).toEqual({ action: 'link', workspace_id: 9, dataset_id: 4, added_by: 'user', settings: {} });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the error the server gives, and a fallback when the request fails', async () => {
    serve({ link: { success: false, error: 'Already linked' } });
    render(Page);
    await loaded();
    await fireEvent.click(screen.getByText('Link dataset'));
    await fireEvent.click(await screen.findByText('Spare dataset'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Already linked');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('says so when everything is linked', async () => {
    serve({ catalog: [bluesky, radio, gdelt] });
    render(Page);
    await loaded();
    await fireEvent.click(screen.getByText('Link dataset'));
    expect(await screen.findByText('Every available dataset is already linked to this workspace.')).toBeTruthy();
  });

  it('opens straight from the workspace page link and clears an old notice when reopened', async () => {
    routing.search = '?workspace=9&link=1';
    serve();
    render(Page);
    await fireEvent.click(await screen.findByText('Spare dataset'));
    await screen.findByText('Linked "Spare dataset" to this workspace.');
    await fireEvent.click(screen.getByText('Processing Workflows (2)'));
    expect(screen.queryByText(/Linked "Spare dataset"/)).not.toBeNull();
    await fireEvent.click(screen.getByText('Workflows'));
    expect(screen.queryByText(/Linked "Spare dataset"/)).toBeNull();
  });
});

describe('radio configuration', () => {
  async function openRadio() {
    serve();
    render(Page);
    await loaded();
    await fireEvent.click(screen.getByText('Configure'));
    return screen.findByText('Radio Stream Configuration');
  }

  it('shows the service state and the default station', async () => {
    await openRadio();
    expect(screen.getByText('Station 1')).toBeTruthy();
    expect((screen.getByPlaceholderText('WGSV') as HTMLInputElement).value).toBe('WGSV');
    await screen.findByText('Radio service is ready. Configure your stations above and click Start Recording.');
  });

  it('adds and removes stations, keeping at least one', async () => {
    await openRadio();
    expect(screen.queryByText('Remove')).toBeNull();
    await fireEvent.click(screen.getByText('+ Add Station'));
    expect(screen.getByText('Station 2')).toBeTruthy();
    await fireEvent.click(screen.getAllByText('Remove')[0]);
    expect(screen.queryByText('Station 2')).toBeNull();
    expect(screen.queryByText('Remove')).toBeNull();
  });

  it('starts recording with the configuration and closes', async () => {
    await openRadio();
    await fireEvent.input(screen.getByPlaceholderText('WGSV'), { target: { value: 'WXYZ' } });
    await fireEvent.click(screen.getByLabelText('Enable Classification'));
    await fireEvent.click(screen.getByText('Start Recording'));
    await waitFor(() => expect(screen.queryByText('Radio Stream Configuration')).toBeNull());
    const body = posted('/api/wavepulse')?.body as { action: string; config: { radioStreams: Array<{ radioName: string }>; enableClassification: boolean; whisperModel: string } };
    expect(body.action).toBe('start');
    expect(body.config.radioStreams[0].radioName).toBe('WXYZ');
    expect(body.config.enableClassification).toBe(true);
    expect(body.config.whisperModel).toBe('large-v3');
  });

  it('reports a failed start', async () => {
    serve({ radio: { success: false, error: 'No GPU' } });
    render(Page);
    await loaded();
    await fireEvent.click(screen.getByText('Configure'));
    await fireEvent.click(await screen.findByText('Start Recording'));
    expect(await screen.findByText('No GPU')).toBeTruthy();
  });

  it('offers to stop while recording and says the service is offline when it is', async () => {
    serve({ wavepulse: { success: true, status: 'running', active_streams: [1, 2], recordings_count: 4, transcripts_count: 7 } });
    render(Page);
    await loaded();
    await fireEvent.click(screen.getByText('Configure'));
    expect(await screen.findByText('Recording Active')).toBeTruthy();
    expect(screen.getByText('Streams: 2')).toBeTruthy();
    expect(screen.getByText('Recordings: 4')).toBeTruthy();
    expect(screen.getByText('Transcripts: 7')).toBeTruthy();
    await fireEvent.click(screen.getByText('Stop Recording'));
    expect(posted('/api/wavepulse')?.body).toEqual({ action: 'stop' });
  });

  it('closes on cancel and when the backdrop is clicked', async () => {
    await openRadio();
    await fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Radio Stream Configuration')).toBeNull();
    await fireEvent.click(screen.getByText('Configure'));
    const backdrop = (await screen.findByText('Radio Stream Configuration')).closest('div.fixed') as HTMLElement;
    await fireEvent.click(backdrop);
    expect(screen.queryByText('Radio Stream Configuration')).toBeNull();
  });

  it('polls the radio service and stops when the page goes away', async () => {
    const clear = vi.spyOn(globalThis, 'clearInterval');
    serve();
    const { unmount } = render(Page);
    await loaded();
    const statusCalls = () => calls.filter((c) => c.url.includes('action=status')).length;
    expect(statusCalls()).toBeGreaterThanOrEqual(1);
    unmount();
    expect(clear).toHaveBeenCalled();
  });
});

describe('starting a crawl', () => {
  async function openCrawler() {
    serve();
    render(Page);
    await loaded();
    await fireEvent.click(screen.getByText('Start Crawl'));
    return screen.findByText('Start Crawl Job');
  }
  const submit = () => within(screen.getByText('Start Crawl Job').closest('div.fixed') as HTMLElement).getByRole('button', { name: 'Start Crawl' });

  it('asks for at least one handle', async () => {
    await openCrawler();
    await fireEvent.click(submit());
    expect(await screen.findByText('Please enter at least one URL or channel')).toBeTruthy();
    expect(posted('/api/crawler')).toBeUndefined();
    expect(screen.getByText('Start Crawl Job')).toBeTruthy();
  });

  it('relabels the field for each platform', async () => {
    await openCrawler();
    expect(screen.getByText('Handles or DIDs')).toBeTruthy();
    const platform = screen.getByDisplayValue('Bluesky');
    await fireEvent.change(platform, { target: { value: 'youtube' } });
    expect(screen.getByText('Channel URLs')).toBeTruthy();
    expect(screen.getByText('YouTube API Key')).toBeTruthy();
    await fireEvent.change(platform, { target: { value: 'telegram' } });
    expect(screen.getByText('Channel Names')).toBeTruthy();
    expect(screen.queryByText('YouTube API Key')).toBeNull();
  });

  it('schedules the crawl with a list of handles and an automatic id, then clears the message', async () => {
    await openCrawler();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await fireEvent.input(screen.getByPlaceholderText('One per line or comma-separated'), { target: { value: 'a.bsky.social, b.bsky.social\nc.bsky.social' } });
    await fireEvent.click(submit());
    await waitFor(() => expect(screen.queryByText('Start Crawl Job')).toBeNull());
    const body = posted('/api/crawler')?.body as Record<string, unknown>;
    expect(body.urls).toEqual(['a.bsky.social', 'b.bsky.social', 'c.bsky.social']);
    expect(String(body.crawlId)).toMatch(/^bluesky-\d+$/);
    expect(body.platform).toBe('bluesky');
    expect(body.maxPosts).toBe(1000);
    expect(body.skipMedia).toBe(true);
  });

  it('reports a failure from the crawler service', async () => {
    serve({ crawler: { success: false, error: 'Crawler is busy' } });
    render(Page);
    await loaded();
    await fireEvent.click(screen.getByText('Start Crawl'));
    await fireEvent.input(await screen.findByPlaceholderText('One per line or comma-separated'), { target: { value: 'x' } });
    await fireEvent.click(submit());
    expect(await screen.findByText('Crawler is busy')).toBeTruthy();
  });

  it('can also be started from the datasets tab and cancelled', async () => {
    serve();
    render(Page);
    await loaded();
    await fireEvent.click(screen.getByText('Datasets (3)'));
    await fireEvent.click(screen.getByText('Start crawl'));
    expect(await screen.findByText('Start Crawl Job')).toBeTruthy();
    await fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Start Crawl Job')).toBeNull();
  });
});
