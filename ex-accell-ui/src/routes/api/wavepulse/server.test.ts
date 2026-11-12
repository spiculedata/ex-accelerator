import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GET, POST } from './+server';

const fetchMock = vi.fn();
const upstream = (body: unknown) => Promise.resolve({ json: async () => body });
const get = (query: string) => GET({ url: new URL(`http://localhost/api/wavepulse${query}`) } as never);
const post = (body: unknown) =>
  POST({ request: new Request('http://localhost/api/wavepulse', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }) } as never);

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('GET /api/wavepulse', () => {
  it('defaults to status and keeps the service fields at the top level and in data', async () => {
    fetchMock.mockReturnValue(upstream({ status: 'running', streams: 2 }));

    const body = await (await get('')).json();

    expect(fetchMock.mock.calls[0][0]).toBe('http://wavepulse:8890/status');
    expect(body).toEqual({ success: true, status: 'running', streams: 2, data: { status: 'running', streams: 2 } });
  });

  it.each([['recordings'], ['transcripts'], ['health']])('proxies %s', async (action) => {
    fetchMock.mockReturnValue(upstream({ items: [] }));

    expect((await get(`?action=${action}`)).status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toBe(`http://wavepulse:8890/${action}`);
  });

  it('refuses an unknown action with 400 and does not reflect it back', async () => {
    const response = await get('?action=<script>');

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, data: null, error: 'Unknown action' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not let the service overwrite success or data', async () => {
    fetchMock.mockReturnValue(upstream({ success: false, data: 'x', status: 'idle' }));

    const body = await (await get('?action=status')).json();

    expect(body.success).toBe(true);
    expect(body.data).toEqual({ status: 'idle' });
  });

  it('is a 503 without the network error text when WavePulse is down', async () => {
    fetchMock.mockRejectedValue(new Error('getaddrinfo ENOTFOUND wavepulse'));

    const response = await get('?action=status');

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ success: false, data: null, error: 'WavePulse service unavailable' });
  });

  it('is a 502 with a generic message when WavePulse reports an error', async () => {
    fetchMock.mockReturnValue(upstream({ error: 'traceback at /app/main.py line 3' }));

    const response = await get('?action=status');

    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain('traceback');
  });
});

describe('POST /api/wavepulse', () => {
  it('starts with the supplied config', async () => {
    fetchMock.mockReturnValue(upstream({ started: true }));

    const body = await (await post({ action: 'start', config: { radioStreams: [] } })).json();

    expect(fetchMock.mock.calls[0][0]).toBe('http://wavepulse:8890/start');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ radioStreams: [] });
    expect(body).toMatchObject({ success: true, started: true });
  });

  it('stops', async () => {
    fetchMock.mockReturnValue(upstream({ stopped: true }));

    expect((await post({ action: 'stop' })).status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toBe('http://wavepulse:8890/stop');
  });

  it.each([['not json'], ['[1]'], [{ action: 'explode' }], [{}]])('refuses %j with 400', async (body) => {
    const response = await post(body);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ success: false, data: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
