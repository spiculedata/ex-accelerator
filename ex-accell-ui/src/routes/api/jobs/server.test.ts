import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = vi.hoisted(() => ({
  createJobState: vi.fn(),
  saveJobState: vi.fn(),
  updateJobStatus: vi.fn(),
  addJobLog: vi.fn(),
  getAllJobStates: vi.fn(),
  getJobState: vi.fn(),
  deleteJobState: vi.fn()
}));
const invoke = vi.hoisted(() => vi.fn());

vi.mock('$lib/services/jobStateStore.js', () => ({ jobStateStore: store }));
vi.mock('@dapr/dapr', () => ({
  DaprClient: class {
    invoker = { invoke };
  },
  CommunicationProtocolEnum: { HTTP: 'http' },
  HttpMethod: { POST: 'POST' }
}));

import { DELETE, GET, POST } from './+server';

const post = (body: unknown) =>
  POST({ request: new Request('http://localhost/api/jobs', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }) } as never);
const get = (query = '') => GET({ url: new URL(`http://localhost/api/jobs${query}`) } as never);
const del = (query: string) => DELETE({ url: new URL(`http://localhost/api/jobs${query}`) } as never);

const valid = { name: 'crawl-1', dueTime: 'now', data: { platform: 'telegram', urls: ['@a'], youtubeApiKey: 'SECRET-KEY' } };
const dapr503 = () => Object.assign(new Error('Dapr sidecar at 10.0.0.5:3500 not responding'), { name: 'DaprConnectionError' });

beforeEach(() => {
  Object.values(store).forEach((fn) => fn.mockReset());
  invoke.mockReset();
  store.createJobState.mockReturnValue({ id: 'crawl-1-1', name: 'crawl-1', status: 'scheduled' });
  store.saveJobState.mockResolvedValue(undefined);
  store.addJobLog.mockResolvedValue(undefined);
  store.getAllJobStates.mockResolvedValue([{ id: 'j1', name: 'crawl-1' }]);
  store.deleteJobState.mockResolvedValue(undefined);
  invoke.mockResolvedValue({});
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] }));
});

describe('POST /api/jobs', () => {
  it('schedules the job and returns the envelope with the legacy keys', async () => {
    const response = await post(valid);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, job: { scheduled: true }, jobId: expect.any(String), message: 'Job scheduled successfully' });
    expect(body.data).toMatchObject({ jobId: body.jobId, job: body.job });
    expect(invoke).toHaveBeenCalledWith('telegram-scraper', 'scheduleJob', 'POST', expect.objectContaining({ jobName: 'telegram-crawl' }));
  });

  it.each([['not json'], ['[1]'], [{ name: 'x' }], [{ ...valid, dueTime: 'soon' }], [{ ...valid, dueTime: '-5' }], [{ ...valid, name: 7 }]])(
    'refuses %j with a 400 failure envelope before scheduling',
    async (body) => {
      const response = await post(body);

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ success: false, data: null, error: expect.any(String) });
      expect(invoke).not.toHaveBeenCalled();
    }
  );

  it('reports Dapr being down as 503 with the start hint but no internal address', async () => {
    store.saveJobState.mockRejectedValue(dapr503());

    const response = await post(valid);

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('npm run dev:dapr');
    expect(JSON.stringify(body)).not.toContain('10.0.0.5');
  });

  it('marks the job failed and returns a generic 500 when scheduling fails', async () => {
    invoke.mockRejectedValue(new Error('scheduler exploded at /srv/app/crawler.ts:9'));

    const response = await post(valid);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, data: null, error: 'Failed to schedule the job' });
    expect(store.updateJobStatus).toHaveBeenCalledWith(expect.stringMatching(/^crawl-1-/), 'failed', expect.anything());
  });

  it('still schedules when only the state store save fails for a non-connection reason', async () => {
    store.saveJobState.mockRejectedValue(new Error('disk full'));

    const body = await (await post(valid)).json();

    expect(body).toMatchObject({ success: true, jobState: null, message: 'Job scheduled (state tracking unavailable)' });
  });
});

describe('GET /api/jobs', () => {
  it('state=true returns the job states in data', async () => {
    const body = await (await get('?state=true')).json();

    expect(body).toEqual({ success: true, data: [{ id: 'j1', name: 'crawl-1' }] });
  });

  it('state=true&name returns that job, or a 404 envelope when it does not exist', async () => {
    store.getJobState.mockResolvedValueOnce({ id: 'j1' });
    expect((await (await get('?state=true&name=j1')).json()).data).toEqual({ id: 'j1' });

    store.getJobState.mockResolvedValueOnce(null);
    const missing = await get('?state=true&name=nope');
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ success: false, data: null, error: 'Job not found' });
  });

  it('combines Dapr and stored states with the legacy keys beside data', async () => {
    const body = await (await get()).json();

    expect(body).toMatchObject({ success: true, jobStates: [{ id: 'j1' }], combined: [{ id: 'j1' }], serviceStatus: { stateAvailable: true } });
    expect(body.data.jobStates).toEqual(body.jobStates);
  });

  it('is a 503 only when both Dapr and the state store are down, without internal text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    store.getAllJobStates.mockRejectedValue(dapr503());

    const response = await get();

    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain('10.0.0.5');
  });

  it('returns a generic 500 envelope on an unexpected failure', async () => {
    store.getAllJobStates.mockRejectedValue(new Error('relation "jobs" does not exist'));

    const response = await get('?state=true');

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, data: null, error: 'Internal server error while retrieving job(s)' });
  });
});

describe('DELETE /api/jobs', () => {
  it('requires a name or jobId', async () => {
    const response = await del('');

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ success: false, data: null });
  });

  it('deletes by jobId and reports what was removed', async () => {
    const body = await (await del('?jobId=j1')).json();

    expect(store.deleteJobState).toHaveBeenCalledWith('j1');
    expect(body).toMatchObject({ success: true, deletedFromState: true, data: { deletedFromState: true } });
  });

  it('is a 503 when the state store is unreachable, without internal text', async () => {
    store.deleteJobState.mockRejectedValue(dapr503());

    const response = await del('?jobId=j1');

    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain('10.0.0.5');
  });
});
