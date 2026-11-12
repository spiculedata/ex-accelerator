import { describe, it, expect, vi, beforeEach } from 'vitest';

const query = vi.hoisted(() => vi.fn());

vi.mock('$lib/services/postgres', () => ({ postgresPool: { query } }));

import { GET } from './+server';

const call = (search = '') => GET({ url: new URL(`http://localhost/api/gdelt${search}`) } as unknown as Parameters<typeof GET>[0]);

beforeEach(() => {
  query.mockReset();
});

describe('GET /api/gdelt', () => {
  it('returns no events flagged unavailable when GDELT has not been loaded', async () => {
    query.mockRejectedValue(Object.assign(new Error('relation "gdelt_events" does not exist'), { code: '42P01' }));

    const response = await call();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ events: [], count: 0, unavailable: true });
    expect(JSON.stringify(body)).not.toContain('gdelt_events');
    expect(body).toMatchObject({ success: true, data: { events: [], count: 0 }, meta: { unavailable: true } });
  });

  it('keeps a generic 500 for a real failure', async () => {
    query.mockRejectedValue(new Error('connection terminated unexpectedly'));

    const response = await call();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, data: null, error: 'Internal server error' });
  });

  it('returns events when the table exists', async () => {
    query.mockResolvedValue([{ globaleventid: 1, actor1name: 'A', actor2name: 'B', eventcode: '010', actiongeo_countrycode: 'GB', actiongeo_fullname: 'London', actiongeo_lat: '51.5', actiongeo_long: '-0.1', goldsteinscale: '1.0', avgtone: '-2.0', sqldate: 20260101 }]);

    const body = await (await call()).json();

    expect(body.count).toBe(1);
    expect(body.unavailable).toBeUndefined();
    expect(body).toMatchObject({ success: true, data: { count: 1, events: [{ id: 1, lat: 51.5 }] } });
    expect(body.events).toEqual(body.data.events);
  });
});

describe('GET /api/gdelt date range', () => {
  it.each([
    ['an impossible day', '?dateStart=20269999'],
    ['a day that does not exist', '?dateEnd=2026-02-30'],
    ['a reversed range', '?dateStart=2026-03-01&dateEnd=2026-01-01'],
    ['text', '?dateStart=yesterday']
  ])('answers %s with a 400 before touching the database', async (_label, search) => {
    const response = await call(search);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ success: false, data: null, error: expect.any(String) });
    expect(query).not.toHaveBeenCalled();
  });

  it('still accepts dashed and plain 8-digit days and queries them as numbers', async () => {
    query.mockResolvedValue([]);
    await call('?dateStart=2026-01-01&dateEnd=20260131');
    const params = query.mock.calls[0][1] as unknown[];
    expect(params).toContain(20260101);
    expect(params).toContain(20260131);
  });
});
