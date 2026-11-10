import { describe, it, expect, vi, beforeEach } from 'vitest';

const query = vi.hoisted(() => vi.fn());

const access = vi.hoisted(() => ({ checkAccess: vi.fn() }));
vi.mock('$lib/services/postgres', () => ({ postgresPool: { query } }));
vi.mock('$lib/server/auth/accessCheck', () => access);

import { GET, POST, PATCH, DELETE } from './+server';

const call = (body: unknown, email: string | null = 'ada@example.com') =>
  POST({
    request: new Request('http://localhost/api/investigations', { method: 'POST', body: JSON.stringify(body) }),
    locals: { user: email ? { email } : null }
  } as unknown as Parameters<typeof POST>[0]);

const insertCall = () => query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO investigations'))!;

beforeEach(() => {
  access.checkAccess.mockReset();
  access.checkAccess.mockResolvedValue({ allowed: true });
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

describe('POST /api/investigations date range', () => {
  it.each([
    [{ date_start: '2026-10-01', date_end: '2026-09-01' }, 'on or before'],
    [{ date_start: 'tomorrow' }, 'date_start'],
    [{ date_end: '2026-02-30' }, 'date_end']
  ])('rejects %j', async (dates, mention) => {
    const response = await call({ name: 'x', ...dates });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain(mention);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO investigations'))).toBe(false);
  });

  it('applies the same rules to dates sent inside query_config', async () => {
    const response = await call({ name: 'x', query_config: { keywords: [], dateStart: '2026-10-01', dateEnd: '2026-09-01' } });

    expect(response.status).toBe(400);
  });

  it('accepts a valid range, an equal start and end, and blank dates', async () => {
    for (const dates of [{ date_start: '2026-10-01', date_end: '2026-10-31' }, { date_start: '2026-10-01', date_end: '2026-10-01' }, { date_start: '', date_end: '' }]) {
      const response = await call({ name: 'x', ...dates });
      expect(response.status).toBe(200);
    }
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

  it.each([[42], [{}], ['hello'], [true]])('rejects annotations that are not a list (%j)', async (annotations) => {
    const response = await patch({ id: 1, annotations });

    expect(response.status).toBe(400);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('UPDATE investigations'))).toBe(false);
  });

  it('still encodes query_config exactly once when sent with annotations', async () => {
    await patch({ id: 1, query_config: { keywords: ['tram'] }, annotations: [note] });

    const params = updateCall()[1];
    expect(params).toContain(JSON.stringify({ keywords: ['tram'] }));
    expect(params).toContain(JSON.stringify([note]));
  });
});

describe('investigations API failures', () => {
  it('answers a database failure with a generic 500 and never the database message', async () => {
    const mod = await import('./+server');
    const failing = vi.fn().mockRejectedValue(new Error('relation "investigations" does not exist at 10.0.0.5'));
    const { postgresPool } = await import('$lib/services/postgres');
    const original = postgresPool.query;
    (postgresPool as any).query = failing;
    try {
      const response = await mod.GET({ url: new URL('http://localhost/api/investigations') } as any);
      expect(response.status).toBe(500);
      const text = JSON.stringify(await response.json());
      expect(text).not.toContain('relation');
      expect(text).not.toContain('10.0.0.5');
    } finally {
      (postgresPool as any).query = original;
    }
  });
});

describe('investigations ownership', () => {
  const asUser = (email: string, role = 'analyst') => ({ email, role });
  const patch = (user: unknown, body: unknown) =>
    PATCH({ request: new Request('http://localhost/api/investigations', { method: 'PATCH', body: JSON.stringify(body) }), locals: { user } } as unknown as Parameters<typeof PATCH>[0]);

  it('refuses a change by someone who is not the creator or an admin, before changing anything', async () => {
    query.mockImplementation(async (sql: string) => (String(sql).startsWith('SELECT created_by') ? [{ created_by: 'ada@example.com' }] : [{ id: 7 }]));
    const response = await patch(asUser('bob@example.com'), { id: 7, name: 'Taken over' });
    expect(response.status).toBe(403);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('UPDATE investigations'))).toBe(false);
  });

  it('lets the creator and an admin through', async () => {
    query.mockImplementation(async (sql: string) => (String(sql).startsWith('SELECT created_by') ? [{ created_by: 'ada@example.com' }] : [{ id: 7 }]));
    expect((await patch(asUser('ada@example.com'), { id: 7, name: 'Mine' })).status).toBe(200);
    expect((await patch(asUser('root@example.com', 'admin'), { id: 7, name: 'Admin edit' })).status).toBe(200);
  });
});

describe('investigations and project membership', () => {
  const deny = () => access.checkAccess.mockResolvedValue({ allowed: false, what: 'workspace' });

  it('refuses to create an investigation in a workspace of a project the person is not in', async () => {
    query.mockImplementation(async (sql: string) => (String(sql).includes('FROM workspaces') ? [{ id: 3 }] : []));
    deny();
    const response = await call({ name: 'Probe', workspace_id: 3, keywords: ['x'] });
    expect(response.status).toBe(403);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO investigations'))).toBe(false);
  });

  it('refuses to open one from such a workspace', async () => {
    query.mockResolvedValue([{ id: 7, workspace_id: 3, created_by: 'ada@example.com' }]);
    deny();
    const response = await GET({ url: new URL('http://localhost/api/investigations?id=7'), locals: { user: { email: 'bob@example.com', role: 'user' } } } as any);
    expect(response.status).toBe(403);
  });

  it('lists only the investigations of workspaces the person may see', async () => {
    query.mockResolvedValue([{ id: 1, workspace_id: 10 }, { id: 2, workspace_id: 20 }, { id: 3, workspace_id: null }]);
    access.checkAccess.mockImplementation(async (_u: unknown, r: { workspaces: number[] }) => (r.workspaces[0] === 10 ? { allowed: true } : { allowed: false, what: 'workspace' }));
    const response = await GET({ url: new URL('http://localhost/api/investigations'), locals: { user: { email: 'bob@example.com', role: 'user' } } } as any);
    expect((await response.json()).investigations.map((i: { id: number }) => i.id)).toEqual([1, 3]);
  });

  it('refuses to change or delete an investigation in a workspace the person is not in, even their own', async () => {
    query.mockResolvedValue([{ created_by: 'bob@example.com', workspace_id: 3 }]);
    deny();
    const response = await PATCH({ request: new Request('http://localhost/api/investigations', { method: 'PATCH', body: JSON.stringify({ id: 7, name: 'x' }) }), locals: { user: { email: 'bob@example.com', role: 'user' } } } as any);
    expect(response.status).toBe(403);
  });
});

describe('investigation ids are read one way for the check and the change', () => {
  const user = { email: 'bob@example.com', role: 'user' };
  const noWrites = () => query.mock.calls.every(([sql]) => !/UPDATE investigations|DELETE FROM investigations/.test(String(sql)));

  // Number('1e1') is 10 but parseInt('1e1') is 1: checking one row and changing another
  it.each(['1e1', '10e-1', ' 7', '7abc', '+7', '07', '0x7', '7.0'])('refuses a PATCH with id %j before any change', async (id) => {
    const response = await PATCH({ request: new Request('http://localhost/api/investigations', { method: 'PATCH', body: JSON.stringify({ id, name: 'x' }) }), locals: { user } } as any);
    expect(response.status).toBe(400);
    expect(noWrites()).toBe(true);
  });

  it.each(['1e1', '10e-1', ' 7', '7abc', '+7', '07', '0x7', '7.0'])('refuses a DELETE with id %j before any change', async (id) => {
    const response = await DELETE({ url: new URL(`http://localhost/api/investigations?id=${encodeURIComponent(id)}`), locals: { user } } as any);
    expect(response.status).toBe(400);
    expect(noWrites()).toBe(true);
  });

  it('refuses a GET by id that is not a plain whole number', async () => {
    const response = await GET({ url: new URL('http://localhost/api/investigations?id=1e1'), locals: { user } } as any);
    expect(response.status).toBe(400);
  });

  it('changes exactly the row it checked', async () => {
    query.mockImplementation(async (sql: string) => (String(sql).startsWith('SELECT created_by') ? [{ created_by: user.email, workspace_id: null }] : [{ id: 7 }]));
    await DELETE({ url: new URL('http://localhost/api/investigations?id=7'), locals: { user } } as any);
    const check = query.mock.calls.find(([sql]) => String(sql).startsWith('SELECT created_by'))!;
    const del = query.mock.calls.find(([sql]) => String(sql).includes('DELETE FROM investigations'))!;
    expect(check[1]).toEqual([7]);
    expect(del[1]).toEqual([7]);
  });
});
