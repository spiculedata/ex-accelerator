import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = vi.hoisted(() => ({
  getJobsByStatus: vi.fn(),
  updateJobStatus: vi.fn(),
  addJobLog: vi.fn()
}));
vi.mock('$lib/services/jobStateStore.js', () => ({ jobStateStore: store }));

import { GET, POST } from './+server';

const post = (body: unknown) =>
  POST({ request: new Request('http://localhost/api/log-monitor', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }) } as never);

beforeEach(() => {
  Object.values(store).forEach((fn) => fn.mockReset());
  store.getJobsByStatus.mockResolvedValue([]);
});

describe('POST /api/log-monitor', () => {
  it('counts the lines that mention a job event and returns the envelope', async () => {
    const body = await (await post({ logLines: ['Job event received! Raw data: {}', 'nothing to see'] })).json();

    expect(body).toMatchObject({ success: true, processed: 1, data: { processed: 1 } });
    expect(body.results[0].parsed.action).toBe('start');
    expect(JSON.stringify(body)).not.toContain('Raw data');
  });

  it('marks the newest active job running on a start line', async () => {
    store.getJobsByStatus.mockImplementation(async (status: string) => (status === 'running' ? [{ id: 'old', createdAt: '2026-01-01' }, { id: 'new', createdAt: '2026-02-01' }] : []));

    await post({ logLines: ['Job event received! Raw data: {}'] });

    expect(store.updateJobStatus).toHaveBeenCalledWith('new', 'running');
  });

  it.each([['not json'], ['[1]'], [{}], [{ logLines: 'x' }], [{ logLines: [1, 2] }], [{ logLines: Array.from({ length: 1001 }, () => 'x') }]])(
    'refuses %j with a 400 failure envelope',
    async (body) => {
      const response = await post(body);

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ success: false, data: null, error: expect.any(String) });
    }
  );
});

describe('POST /api/log-monitor size limit', () => {
  it('refuses an oversized body with a 413 failure envelope', async () => {
    const big = await post({ logLines: ['x'.repeat(600 * 1024)] });

    expect(big.status).toBe(413);
    expect(await big.json()).toMatchObject({ success: false, data: null });
  });
});

describe('GET /api/log-monitor', () => {
  it('describes the endpoint in the envelope', async () => {
    const body = await (await GET({} as never)).json();

    expect(body).toMatchObject({ success: true, message: 'Log Monitor API', data: { message: 'Log Monitor API' } });
  });
});
