import { describe, it, expect, vi, beforeEach } from 'vitest';

const query = vi.hoisted(() => vi.fn());

vi.mock('$lib/services/postgres', () => ({ postgresPool: { query } }));

import { POST } from './+server';

const call = (body: unknown, email: string | null = 'ada@example.com') =>
  POST({
    request: new Request('http://localhost/api/investigations', { method: 'POST', body: JSON.stringify(body) }),
    locals: { user: email ? { email } : null }
  } as unknown as Parameters<typeof POST>[0]);

const insertCall = () => query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO investigations'))!;

beforeEach(() => {
  query.mockReset();
  query.mockImplementation(async (sql: string) => (String(sql).includes('INSERT INTO investigations') ? [{ id: 7 }] : []));
});

describe('POST /api/investigations', () => {
  it('builds the stored query from the fields the New Investigation form sends', async () => {
    const response = await call({
      name: 'Tram delays', description: 'why', keywords: ['tram', 'delays'],
      date_start: '2026-10-01', date_end: '2026-10-31', sources: ['social']
    });

    expect(response.status).toBe(200);
    const [, params] = insertCall();
    expect(JSON.parse(params[2])).toEqual({
      keywords: ['tram', 'delays'], dateStart: '2026-10-01', dateEnd: '2026-10-31', sources: ['social']
    });
  });

  it('still accepts an explicit query_config', async () => {
    await call({ name: 'x', query_config: { keywords: ['a'], dateStart: '2026-01-01' } });

    expect(JSON.parse(insertCall()[1][2])).toEqual({ keywords: ['a'], dateStart: '2026-01-01' });
  });

  it('defaults to an empty query when only a name is given', async () => {
    const response = await call({ name: 'Just a name' });

    expect(response.status).toBe(200);
    expect(JSON.parse(insertCall()[1][2])).toEqual({ keywords: [], dateStart: '', dateEnd: '', sources: [] });
  });

  it('records the signed-in user and ignores a created_by in the body', async () => {
    await call({ name: 'x', created_by: 'forged@example.com' });

    expect(insertCall()[1][4]).toBe('ada@example.com');
  });

  it('requires a name', async () => {
    expect((await call({ keywords: ['a'] })).status).toBe(400);
  });
});
