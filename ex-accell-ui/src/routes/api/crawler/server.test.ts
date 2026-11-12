import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GET, POST } from './+server';

const fetchMock = vi.fn();
const post = (body: unknown) =>
  POST({ request: new Request('http://localhost/api/crawler', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }) } as never);
const reply = (ok: boolean, body: unknown = {}, status = ok ? 200 : 500) => ({ ok, status, json: async () => body, text: async () => 'upstream said: secret-host:3500 failed' });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('POST /api/crawler', () => {
  it('schedules through service invocation and returns the envelope', async () => {
    fetchMock.mockResolvedValue(reply(true, { accepted: true, internalHost: 'crawler-7:9000' }));

    const response = await post({ platform: 'telegram', urls: ['@a'], crawlId: 'c1' });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, jobName: 'c1', method: 'service-invocation', data: { jobName: 'c1', method: 'service-invocation' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ platform: 'telegram', urls: ['@a'], crawlId: 'c1', maxPosts: 1000 });
  });

  it('falls back to the Dapr jobs API and does not echo the job config or the API key back', async () => {
    fetchMock.mockResolvedValueOnce(reply(false)).mockResolvedValueOnce(reply(true));

    const response = await post({ platform: 'youtube', urls: 'chan', crawlId: 'c2', youtubeApiKey: 'SECRET-KEY' });
    const text = JSON.stringify(await response.json());

    expect(response.status).toBe(200);
    expect(text).toContain('dapr-jobs');
    expect(text).not.toContain('SECRET-KEY');
    expect(fetchMock.mock.calls[1][0]).toContain('/v1.0-alpha1/jobs/c2');
    expect(JSON.parse(JSON.parse(fetchMock.mock.calls[1][1].body).data.value)).toMatchObject({ platform: 'youtube', urls: ['chan'], youtubeApiKey: 'SECRET-KEY' });
  });

  it.each([['not json'], ['[1]'], [{ urls: ['@a'] }], [{ platform: 'telegram' }], [{ platform: 'telegram', urls: [] }], [{ platform: 'telegram', urls: [5] }], [{ platform: 7, urls: ['@a'] }]])(
    'refuses %j with a 400 failure envelope and calls nothing',
    async (body) => {
      const response = await post(body);

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ success: false, data: null, error: expect.any(String) });
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it('returns a generic 500 without the upstream text when both schedulers fail', async () => {
    fetchMock.mockResolvedValue(reply(false));

    const response = await post({ platform: 'telegram', urls: ['@a'] });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, data: null, error: 'Failed to schedule crawl' });
  });

  it('returns a generic 500 without the network error when the crawler is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:3500'));

    const response = await post({ platform: 'telegram', urls: ['@a'] });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, data: null, error: 'Crawler service unavailable' });
  });
});

describe('GET /api/crawler', () => {
  it('reports running and sends nothing else from the crawler health reply', async () => {
    fetchMock.mockResolvedValue(reply(true, { status: 'weird', success: false, version: '1', host: 'crawler-7' }));

    const body = await (await GET({} as never)).json();

    expect(body).toEqual({ success: true, status: 'running', data: { status: 'running' } });
  });

  it.each([
    [() => Promise.resolve(reply(false)), 'unavailable'],
    [() => Promise.reject(new Error('down')), 'offline']
  ])('reports case %#', async (outcome, status) => {
    fetchMock.mockImplementation(outcome);

    const body = await (await GET({} as never)).json();

    expect(body).toEqual({ success: true, status, data: { status } });
  });
});
