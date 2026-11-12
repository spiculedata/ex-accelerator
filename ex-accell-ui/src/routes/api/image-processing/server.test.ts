import { describe, it, expect, vi, beforeEach } from 'vitest';

const query = vi.hoisted(() => vi.fn());

vi.mock('$lib/services/postgres', () => ({ postgresPool: { query } }));
vi.mock('$lib/utils/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

import { GET, POST } from './+server';

const call = (action: string) =>
  GET({ url: new URL(`http://localhost/api/image-processing?action=${action}`) } as unknown as Parameters<typeof GET>[0]);

const missingTable = () => Object.assign(new Error('relation "image_objects" does not exist'), { code: '42P01' });

beforeEach(() => {
  query.mockReset();
});

describe('GET /api/image-processing when the image tables are not provisioned', () => {
  it.each([
    ['stats', { totalImages: 0, totalObjects: 0 }],
    ['object-stats', { topClasses: [], timeline: [], cooccurrence: [] }],
    ['face-stats', { distribution: [], summary: { total: 0, total_faces: 0, avg_faces: 0 } }],
    ['classification-stats', { topTags: [], categories: [], treemap: [] }],
    ['object-results', []],
    ['moderation-results', []]
  ])('answers %s with 200, an empty result and meta.unavailable, without leaking the table name', async (action, expected) => {
    query.mockRejectedValue(missingTable());

    const response = await call(action);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, data: expected, meta: { unavailable: true } });
    expect(JSON.stringify(body)).not.toContain('image_objects');
  });

  it('still returns a generic 500 for a real failure, without the database message', async () => {
    query.mockRejectedValue(new Error('password authentication failed for user postgres'));

    const response = await call('object-stats');

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('password');
  });

  it('still returns the data when the tables exist', async () => {
    query.mockResolvedValue([{ object_class: 'car', count: '3' }]);

    const body = await (await call('object-stats')).json();

    expect(body.success).toBe(true);
    expect(body.meta).toBeUndefined();
  });
});

const send = (body: unknown) =>
  POST({ request: new Request('http://localhost/api/image-processing', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }) } as unknown as Parameters<typeof POST>[0]);

describe('GET /api/image-processing?action=models', () => {
  it('returns the tiers in data and the legacy key', async () => {
    const body = await (await call('models')).json();

    expect(body.success).toBe(true);
    expect(Object.keys(body.data.tiers)).toEqual(['fast', 'standard', 'accurate']);
    expect(body.tiers).toEqual(body.data.tiers);
  });
});

describe('POST /api/image-processing', () => {
  it.each([['not json'], ['[1]']])('refuses the body %s with a 400 envelope instead of failing', async (raw) => {
    const response = await send(raw);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ success: false, data: null });
  });

  it('refuses an unknown action with 400', async () => {
    const response = await send({ action: 'explode' });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ success: false, error: 'Unknown action: explode' });
  });

  it('updates a moderation review', async () => {
    query.mockResolvedValue([]);

    const response = await send({ action: 'moderation-review', image_id: 'i1', review_status: 'approved' });

    expect(response.status).toBe(200);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE image_moderation'), ['approved', 'user', 'i1']);
    expect((await response.json()).success).toBe(true);
  });

  it('requires image_id and review_status for a moderation review', async () => {
    expect((await send({ action: 'moderation-review', image_id: 'i1' })).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('returns a generic 500 without the database message when the review update fails', async () => {
    query.mockRejectedValue(new Error('password authentication failed for user postgres'));

    const response = await send({ action: 'moderation-review', image_id: 'i1', review_status: 'approved' });

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('password');
  });
});
