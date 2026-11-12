import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';

const scheduleJob = vi.hoisted(() => vi.fn());
vi.mock('$lib/services/jobSchedulerService', () => ({ jobSchedulerService: { scheduleJob } }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

import Page from './+page.svelte';

const jobState = (over: Record<string, unknown> = {}) => ({
  id: 'job-1',
  name: 'telegram-sweep',
  status: 'scheduled',
  platform: 'telegram',
  createdAt: '2026-11-01T10:00:00Z',
  scheduledFor: '2026-11-01T10:05:00Z',
  jobData: { maxPosts: 100, crawlId: 'crawl-1', urls: ['https://t.me/channel_name'] },
  executionLog: [],
  ...over
});

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

const fetchMock = vi.fn();

function serve(states: unknown[] = [jobState()]) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (init?.method === 'DELETE') return json({ success: true });
    if (init?.method === 'POST') return json({ error: 'dapr is down' }, 500);
    return json({ data: states });
  });
}

const tab = (name: string) => screen.getByRole('button', { name });

beforeEach(() => {
  fetchMock.mockReset();
  scheduleJob.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  window.history.replaceState({}, '', '/data-capture');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('data capture page: schedule tab', () => {
  it('lists crawl jobs and WavePulse streams with their counts', async () => {
    serve([jobState(), jobState({ id: 'job-2', name: 'running-one', status: 'running' })]);
    render(Page);

    expect(await screen.findByText('telegram-sweep')).toBeTruthy();
    expect(screen.getByText('running-one')).toBeTruthy();
    expect(screen.getByText('WXYZ (NY)')).toBeTruthy();
    expect(screen.getByText('1 jobs running')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/jobs?state=true'));
  });

  it('explains why the job history could not be loaded and retries', async () => {
    fetchMock.mockImplementation(() => json({ error: 'nope' }, 500));
    render(Page);

    const retry = await screen.findByRole('button', { name: 'Try again' });
    expect(screen.getByRole('alert')).toBeTruthy();

    serve();
    await fireEvent.click(retry);
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(await screen.findByText('telegram-sweep')).toBeTruthy();
  });

  it('refreshes jobs with a cache-busting parameter', async () => {
    serve();
    render(Page);
    await screen.findByText('telegram-sweep');

    await fireEvent.click(screen.getByRole('button', { name: /Refresh Jobs/ }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('&t='))).toBe(true));
  });

  it('asks for confirmation before deleting a job, then deletes it', async () => {
    serve();
    render(Page);
    await screen.findByText('telegram-sweep');

    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('heading', { name: 'Delete Job' })).toBeTruthy();

    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('heading', { name: 'Delete Job' })).toBeNull();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);

    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Delete Job' }));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'DELETE');
      expect(call?.[0]).toBe('/api/jobs?name=telegram-sweep&jobId=job-1');
    });
    await waitFor(() => expect(screen.queryByText(/Are you sure you want to delete/)).toBeNull());
  });

  it('shows an error dialog when running a job fails', async () => {
    serve();
    render(Page);
    await screen.findByText('telegram-sweep');

    await fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    expect(await screen.findByText('Job Execution Failed')).toBeTruthy();
    expect(screen.getByText('dapr is down')).toBeTruthy();

    await fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(screen.queryByText('Job Execution Failed')).toBeNull();
  });

  it('opens the log viewer for a job with logs', async () => {
    serve([jobState({ status: 'completed', executionLog: ['INFO: started', 'ERROR: broke'] })]);
    render(Page);
    await screen.findByText('telegram-sweep');

    await fireEvent.click(screen.getByRole('button', { name: /Logs/ }));
    expect(screen.getByText('Crawl Logs')).toBeTruthy();
    expect(screen.getByText('ERROR: broke')).toBeTruthy();
    expect(screen.getByText('2 log entries')).toBeTruthy();

    await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('Crawl Logs')).toBeNull();
  });

  it('opens the crawler form pre-filled when a job is edited', async () => {
    serve([jobState({ jobData: { platform: 'telegram', urls: ['https://t.me/channel_name'], maxPosts: 7 } })]);
    render(Page);
    await screen.findByText('telegram-sweep');

    await fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByText('Basic Settings', { selector: 'h2' })).toBeTruthy();
    expect((screen.getByPlaceholderText('e.g., Telegram Sentiment Analysis') as HTMLInputElement).value).toBe('telegram-sweep');
  });
});

describe('data capture page: tabs', () => {
  it('opens the tab named in the query string', async () => {
    serve();
    window.history.replaceState({}, '', '/data-capture?tab=upload');
    render(Page);
    expect(await screen.findByText('Upload Data Files')).toBeTruthy();
  });

  it('switches between the file upload, Princeton SMART, WavePulse and analytics tabs', async () => {
    serve();
    render(Page);
    await screen.findByText('telegram-sweep');

    await fireEvent.click(tab('File Upload'));
    expect(screen.getByText('Upload Data Files')).toBeTruthy();

    await fireEvent.click(tab('Princeton SMART'));
    expect(screen.getByText('Connection Settings')).toBeTruthy();
    expect(screen.queryByText('Upload Data Files')).toBeNull();

    await fireEvent.click(tab('WavePulse'));
    expect(screen.getByDisplayValue('WXYZ')).toBeTruthy();

    await fireEvent.click(tab('Analytics'));
    expect(screen.queryByDisplayValue('WXYZ')).toBeNull();
  });
});

describe('data capture page: crawler wizard', () => {
  async function openCrawler() {
    serve();
    render(Page);
    await screen.findByText('telegram-sweep');
    await fireEvent.click(tab('Web Crawler'));
  }

  it('blocks the first step until a unique job name is given', async () => {
    await openCrawler();

    await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Please fix the following errors before proceeding:')).toBeTruthy();
    expect(screen.getByText('Job name is required')).toBeTruthy();

    const name = screen.getByPlaceholderText('e.g., Telegram Sentiment Analysis');
    await fireEvent.input(name, { target: { value: 'Telegram-Sweep' } });
    expect(screen.getByText('Job name already exists. Please choose a unique name.', { selector: 'p' })).toBeTruthy();
  });

  it('walks through the steps and back', async () => {
    await openCrawler();

    await fireEvent.input(screen.getByPlaceholderText('e.g., Telegram Sentiment Analysis'), { target: { value: 'fresh job' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Platform & URLs', { selector: 'h2' })).toBeTruthy();

    // The platform step needs URLs and a TDLib database for Telegram
    await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('At least one URL or URL file is required')).toBeTruthy();
    expect(screen.getByText('At least one TDLib database URL is required for Telegram crawling', { selector: 'li' })).toBeTruthy();

    await fireEvent.click(screen.getByRole('button', { name: 'Add URL' }));
    await fireEvent.input(screen.getByPlaceholderText('https://t.me/channel_name'), { target: { value: 'https://t.me/channel_name' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Add TDLib URL' }));
    await fireEvent.input(screen.getByPlaceholderText('https://example.com/database.tar.gz'), { target: { value: 'https://x.test/db.tgz' } });

    await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Filters & Limits', { selector: 'h2' })).toBeTruthy();

    await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Review & Schedule', { selector: 'h2' })).toBeTruthy();
    expect(screen.getByText('fresh job')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Schedule Crawler Job' })).toBeTruthy();

    await fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByText('Filters & Limits', { selector: 'h2' })).toBeTruthy();
  });

  it('schedules the job and returns to the schedule tab', async () => {
    scheduleJob.mockResolvedValue({ ok: true });
    await openCrawler();

    await fireEvent.input(screen.getByPlaceholderText('e.g., Telegram Sentiment Analysis'), { target: { value: 'fresh job' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Add URL' }));
    await fireEvent.input(screen.getByPlaceholderText('https://t.me/channel_name'), { target: { value: 'https://t.me/channel_name' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Add TDLib URL' }));
    await fireEvent.input(screen.getByPlaceholderText('https://example.com/database.tar.gz'), { target: { value: 'https://x.test/db.tgz' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Schedule Crawler Job' }));

    await waitFor(() => expect(scheduleJob).toHaveBeenCalledTimes(1));
    const request = scheduleJob.mock.calls[0][0];
    expect(request.name).toMatch(/^fresh-job-/);
    expect(request.dueTime).toBe('10s');
    expect(request.data).toMatchObject({ platform: 'telegram', urls: ['https://t.me/channel_name'] });
    expect(await screen.findByText('Radio Streams')).toBeTruthy();
  });
});
