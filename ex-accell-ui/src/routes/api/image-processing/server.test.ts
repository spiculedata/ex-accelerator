import { describe, it, expect, vi, beforeEach } from 'vitest';

const query = vi.hoisted(() => vi.fn());

vi.mock('$lib/services/postgres', () => ({ postgresPool: { query } }));
vi.mock('$lib/utils/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

import { GET } from './+server';

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
