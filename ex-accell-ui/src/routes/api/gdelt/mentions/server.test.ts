import { describe, it, expect, vi, beforeEach } from 'vitest';

const duckdbQuery = vi.hoisted(() => vi.fn());
vi.mock('$lib/services/postgres', () => ({ postgresPool: { duckdbQuery } }));

import { GET, POST } from './+server';

const get = (query: string) => GET({ url: new URL(`http://localhost/api/gdelt/mentions${query}`) } as never);
const post = (body: unknown) =>
  POST({ request: new Request('http://localhost/api/gdelt/mentions', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }) } as never);

beforeEach(() => {
  duckdbQuery.mockReset();
  duckdbQuery.mockResolvedValue([{ globaleventid: 7n, mentiondoctone: '-1.5', mentionsourcename: 'bbc.co.uk' }]);
});

describe('GET /api/gdelt/mentions', () => {
  it('returns the mentions in data and the legacy key', async () => {
    const body = await (await get('?eventId=7')).json();

    expect(body).toMatchObject({ success: true, count: 1, mentions: [{ globalEventId: 7, mentionDocTone: -1.5 }] });
    expect(body.data.mentions).toEqual(body.mentions);
    expect(duckdbQuery.mock.calls[0][1]).toEqual([7]);
  });

  it.each([[''], ['?eventId=abc']])('refuses %j with a 400 failure envelope', async (query) => {
    const response = await get(query);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ success: false, data: null, error: expect.any(String) });
    expect(duckdbQuery).not.toHaveBeenCalled();
  });

  it('returns a generic 500 without the database text', async () => {
    duckdbQuery.mockRejectedValue(new Error('password authentication failed'));

    const response = await get('?eventId=7');

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, data: null, error: 'Internal server error' });
  });
});

describe('POST /api/gdelt/mentions', () => {
  it('looks up several events', async () => {
    const body = await (await post({ eventIds: ['1', 2, 'x'] })).json();

    expect(duckdbQuery.mock.calls[0][1]).toEqual([1, 2]);
    expect(body).toMatchObject({ success: true, count: 1, data: { count: 1 } });
  });

  it.each([['not json'], ['[1]'], [{}], [{ eventIds: 'nope' }], [{ eventIds: ['x', 'y'] }], [{ eventIds: Array.from({ length: 1001 }, (_, i) => i) }]])(
    'refuses %j with 400 and does not query',
    async (body) => {
      const response = await post(body);

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ success: false, data: null });
      expect(duckdbQuery).not.toHaveBeenCalled();
    }
  );

  it('returns a generic 500 on a database failure', async () => {
    duckdbQuery.mockRejectedValue(new Error('boom 10.0.0.5'));

    const response = await post({ eventIds: [1] });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, data: null, error: 'Internal server error' });
  });
});
