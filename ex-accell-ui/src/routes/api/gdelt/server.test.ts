import { describe, it, expect, vi, beforeEach } from 'vitest';

const query = vi.hoisted(() => vi.fn());

vi.mock('$lib/services/postgres', () => ({ postgresPool: { query } }));

import { GET } from './+server';

const call = () => GET({ url: new URL('http://localhost/api/gdelt') } as unknown as Parameters<typeof GET>[0]);

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
  });

  it('keeps a generic 500 for a real failure', async () => {
    query.mockRejectedValue(new Error('connection terminated unexpectedly'));

    const response = await call();

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('connection');
  });

  it('returns events when the table exists', async () => {
    query.mockResolvedValue([{ globaleventid: 1, actor1name: 'A', actor2name: 'B', eventcode: '010', actiongeo_countrycode: 'GB', actiongeo_fullname: 'London', actiongeo_lat: '51.5', actiongeo_long: '-0.1', goldsteinscale: '1.0', avgtone: '-2.0', sqldate: 20260101 }]);

    const body = await (await call()).json();

    expect(body.count).toBe(1);
    expect(body.unavailable).toBeUndefined();
  });
});
