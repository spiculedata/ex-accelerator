import { describe, it, expect, vi, beforeEach } from 'vitest';

const query = vi.hoisted(() => vi.fn());

vi.mock('$lib/services/postgres', () => ({ postgresPool: { query } }));

import { POST, PATCH } from './+server';

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

  it('files the investigation under an existing workspace', async () => {
    query.mockImplementation(async (sql: string) =>
      String(sql).includes('INSERT INTO investigations') ? [{ id: 7 }] : String(sql).includes('FROM workspaces') ? [{ id: 3 }] : []
    );

    const response = await call({ name: 'x', workspace_id: 3 });

    expect(response.status).toBe(200);
    expect(insertCall()[1][3]).toBe(3);
  });

  it.each([['abc'], [0], [-1], [1.5]])('rejects workspace_id %j', async (workspace_id) => {
    const response = await call({ name: 'x', workspace_id });

    expect(response.status).toBe(400);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO investigations'))).toBe(false);
  });

  it('rejects a workspace that does not exist', async () => {
    const response = await call({ name: 'x', workspace_id: 99 });

    expect(response.status).toBe(404);
  });
});

describe('PATCH /api/investigations annotations', () => {
  const patch = (body: unknown) =>
    PATCH({
      request: new Request('http://localhost/api/investigations', { method: 'PATCH', body: JSON.stringify(body) }),
      locals: { user: { email: 'ada@example.com' } }
    } as unknown as Parameters<typeof PATCH>[0]);
  const updateCall = () => query.mock.calls.find(([sql]) => String(sql).includes('UPDATE investigations'))!;
  const note = { id: 'a1', text: 'note', timestamp: '2026-11-09T10:00:00.000Z' };

  beforeEach(() => {
    query.mockImplementation(async (sql: string) => (String(sql).includes('UPDATE investigations') ? [{ id: 1 }] : []));
  });

  it('stores an annotations array as one JSON document', async () => {
    await patch({ id: 1, annotations: [note] });

    expect(updateCall()[1][0]).toBe(JSON.stringify([note]));
  });

  it('does not encode twice when an older client sends a JSON string', async () => {
    await patch({ id: 1, annotations: JSON.stringify([note]) });

    expect(updateCall()[1][0]).toBe(JSON.stringify([note]));
  });
});
