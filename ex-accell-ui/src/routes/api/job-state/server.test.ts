import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = vi.hoisted(() => ({
  updateJobStatus: vi.fn(),
  addJobLog: vi.fn(),
  getJobState: vi.fn(),
  getJobsByStatus: vi.fn(),
  getAllJobStates: vi.fn(),
  deleteJobState: vi.fn()
}));
vi.mock('$lib/services/jobStateStore.js', () => ({ jobStateStore: store }));

import { DELETE, GET, POST, PUT } from './+server';

const send = (handler: typeof POST | typeof PUT, body: unknown) =>
  handler({ request: new Request('http://localhost/api/job-state', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }) } as never);
const get = (query = '') => GET({ url: new URL(`http://localhost/api/job-state${query}`) } as never);
const del = (query = '') => DELETE({ url: new URL(`http://localhost/api/job-state${query}`) } as never);

beforeEach(() => {
  Object.values(store).forEach((fn) => fn.mockReset());
  store.updateJobStatus.mockResolvedValue(undefined);
  store.addJobLog.mockResolvedValue(undefined);
  store.deleteJobState.mockResolvedValue(undefined);
  store.getJobState.mockResolvedValue({ id: 'j1', status: 'running' });
  store.getJobsByStatus.mockResolvedValue([{ id: 'j1' }]);
  store.getAllJobStates.mockResolvedValue([{ id: 'j1' }, { id: 'j2' }]);
});

describe('POST /api/job-state', () => {
  it.each([
    ['start', 'running'],
    ['progress', 'running'],
    ['complete', 'completed'],
    ['fail', 'failed']
  ])('%s sets the job to %s and returns the envelope', async (action, status) => {
    const response = await send(POST, { action, jobId: 'j1', message: 'm' });

    expect(response.status).toBe(200);
    expect(store.updateJobStatus).toHaveBeenCalledWith('j1', status, expect.anything());
    expect(await response.json()).toEqual({ success: true, action, jobId: 'j1', data: { action, jobId: 'j1' } });
  });

  it('log adds a log line without changing status', async () => {
    await send(POST, { action: 'log', jobId: 'j1', logMessage: 'hello' });

    expect(store.addJobLog).toHaveBeenCalledWith('j1', 'hello');
    expect(store.updateJobStatus).not.toHaveBeenCalled();
  });

  it.each([['not json', 'a'], ['[1]', 'b'], [{ action: 'start' }, 'c'], [{ action: 'explode', jobId: 'j1' }, 'd'], [{ action: 5, jobId: 'j1' }, 'e']])(
    'refuses %j with a 400 envelope as a client error, not a 500',
    async (body) => {
      const response = await send(POST, body);

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ success: false, data: null, error: expect.any(String) });
    }
  );

  it('returns a generic 500 without the store error text', async () => {
    store.updateJobStatus.mockRejectedValue(new Error('Dapr state store at 10.0.0.5 failed'));

    const response = await send(POST, { action: 'start', jobId: 'j1' });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, data: null, error: 'Internal server error while updating job state' });
  });
});

describe('GET /api/job-state', () => {
  it('returns one job in data', async () => {
    expect(await (await get('?jobId=j1')).json()).toEqual({ success: true, data: { id: 'j1', status: 'running' } });
  });

  it('returns 404 for an unknown job, not a 500', async () => {
    store.getJobState.mockResolvedValue(null);

    const response = await get('?jobId=nope');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ success: false, data: null, error: 'Job not found' });
  });

  it('filters by a valid status and refuses an invalid one', async () => {
    expect((await (await get('?status=running')).json()).data).toEqual([{ id: 'j1' }]);
    expect(store.getJobsByStatus).toHaveBeenCalledWith('running');

    expect((await get('?status=weird')).status).toBe(400);
  });

  it('lists every job when no filter is given', async () => {
    expect((await (await get()).json()).data).toHaveLength(2);
  });

  it('returns a generic 500 envelope on failure', async () => {
    store.getAllJobStates.mockRejectedValue(new Error('boom 10.0.0.5'));

    const response = await get();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, data: null, error: 'Internal server error while retrieving job state' });
  });
});

describe('PUT /api/job-state', () => {
  it('updates the status', async () => {
    const response = await send(PUT, { jobId: 'j1', status: 'completed', result: { success: true } });

    expect(store.updateJobStatus).toHaveBeenCalledWith('j1', 'completed', { result: { success: true } });
    expect(await response.json()).toMatchObject({ success: true, jobId: 'j1', status: 'completed', data: { jobId: 'j1', status: 'completed' } });
  });

  it.each([[{ jobId: 'j1' }], [{ jobId: 'j1', status: 'bogus' }], [{ jobId: 4, status: 'running' }], ['not json']])('refuses %j with 400', async (body) => {
    const response = await send(PUT, body);

    expect(response.status).toBe(400);
    expect(store.updateJobStatus).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/job-state', () => {
  it('deletes a job state', async () => {
    const body = await (await del('?jobId=j1')).json();

    expect(store.deleteJobState).toHaveBeenCalledWith('j1');
    expect(body).toMatchObject({ success: true, data: null });
  });

  it('requires a jobId and returns a generic 500 on failure', async () => {
    expect((await del()).status).toBe(400);

    store.deleteJobState.mockRejectedValue(new Error('x 10.0.0.5'));
    const response = await del('?jobId=j1');
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, data: null, error: 'Internal server error while deleting job state' });
  });
});
