import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { jobStateStore } from './jobStateStore';

const res = (status: number, body = '') => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: String(status),
  text: async () => body,
  json: async () => JSON.parse(body || 'null')
});

/** The first call is the Dapr health probe; the rest are answered in order. */
function stubFetch(...responses: ReturnType<typeof res>[]) {
  const fetchMock = vi.fn();
  fetchMock.mockResolvedValueOnce(res(204));
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
  vi.stubGlobal('fetch', fetchMock);
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('getAllJobStates', () => {
  it('returns an empty list when no job has ever been registered (404)', async () => {
    stubFetch(res(404));
    expect(await jobStateStore.getAllJobStates()).toEqual([]);
  });

  it('returns an empty list when the registry is empty', async () => {
    stubFetch(res(204));
    expect(await jobStateStore.getAllJobStates()).toEqual([]);
  });

  it('throws when the state store fails to answer, rather than reporting no jobs', async () => {
    stubFetch(res(500, 'redis unavailable'));
    await expect(jobStateStore.getAllJobStates()).rejects.toThrow(/500/);
  });

  it('throws when the registry cannot be parsed', async () => {
    stubFetch(res(200, '{not json'));
    await expect(jobStateStore.getAllJobStates()).rejects.toThrow();
  });

  it('returns the stored jobs, newest first', async () => {
    stubFetch(
      res(200, JSON.stringify({ jobIds: ['a', 'b'] })),
      res(
        200,
        JSON.stringify([
          { key: 'job:a', data: { id: 'a', createdAt: '2026-01-01T00:00:00Z' } },
          { key: 'job:b', data: { id: 'b', createdAt: '2026-02-01T00:00:00Z' } }
        ])
      )
    );
    const jobs = await jobStateStore.getAllJobStates();
    expect(jobs.map((job) => job.id)).toEqual(['b', 'a']);
  });
});
