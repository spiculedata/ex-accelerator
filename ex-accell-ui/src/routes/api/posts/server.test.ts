import { describe, it, expect, vi, beforeEach } from 'vitest';

const query = vi.hoisted(() => vi.fn());

const resolveWorkspaceScope = vi.hoisted(() => vi.fn());

vi.mock('$lib/services/postgres', () => ({ postgresPool: { query } }));
vi.mock('$lib/services/workspaceContextResolver', () => ({ resolveWorkspaceScope }));
vi.mock('$lib/utils/logger', () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

import { GET } from './+server';

const call = (search = '') => GET({ url: new URL(`http://localhost/api/posts${search}`) } as unknown as Parameters<typeof GET>[0]);

const row = (id: number, total = 3) => ({
  id, timestamp: String(1731146400000 - id * 1000), text: `post ${id}`, platform: 'telegram', author: 'a', created_at: '2026-11-09T10:00:00.000Z',
  sentiment_category: 'Negative', confidence_score: '0.91', engagement_likes: 5, engagement_shares: 1, engagement_comments: 2, total: String(total)
});

beforeEach(() => {
  resolveWorkspaceScope.mockReset();
  resolveWorkspaceScope.mockResolvedValue(null);
  query.mockReset();
  query.mockResolvedValue([row(1), row(2), row(3)]);
});

describe('GET /api/posts', () => {
  it('returns one page, the total that match, and a cursor for the next page', async () => {
    const body = await (await call('?topic=topic-transit&limit=2')).json();

    expect(body.success).toBe(true);
    expect(body.data.total).toBe(3);
    expect(body.data.limit).toBe(2);
    expect(body.data.posts).toHaveLength(2); // the extra row only says that there is more
    expect(body.data.nextCursor).toBe(`${1731146400000 - 2000}_2`);
    expect(body.data.posts[0]).toMatchObject({ id: 1, text: 'post 1', platform: 'telegram', confidence: 0.91 });
    expect(body.data.posts[0]).not.toHaveProperty('total');
  });

  it('has no next cursor on the last page', async () => {
    query.mockResolvedValue([row(1), row(2)]);
    const body = await (await call('?limit=2')).json();
    expect(body.data.posts).toHaveLength(2);
    expect(body.data.nextCursor).toBeNull();
  });

  it('continues after a cursor without counting again', async () => {
    const body = await (await call(`?limit=2&cursor=${1731146400000 - 2000}_2`)).json();

    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).not.toContain('COUNT(');
    expect(params).toContain(2);
    expect(body.data.total).toBeNull();
  });

  it('passes the filters to the query as parameters', async () => {
    await call('?hashtag=TramDelays&sentiment=Negative&platforms=telegram,youtube&date_start=2026-11-02');

    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toContain('posts_with_sentiment');
    expect(params).toContain('negative');
    expect(params).toContainEqual(['telegram', 'youtube']);
    expect(params).toContain(Date.UTC(2026, 10, 2));
  });

  it('returns zero posts and a zero total when nothing matches', async () => {
    query.mockResolvedValue([]);

    const body = await (await call('?q=nothing')).json();

    expect(body.data).toMatchObject({ posts: [], total: 0 });
  });

  it.each([['?topic=a%20b'], ['?hashtag=a%20b'], ['?date_end=nope'], ['?limit=abc'], ['?cursor=nope'], ['?phrase=one'], ['?phrase=a%3B%20b%20c'], ['?cursor=1_2_3']])('answers 400 for invalid input %s without touching the database', async (search) => {
    const response = await call(search);

    expect(response.status).toBe(400);
    expect((await response.json()).success).toBe(false);
    expect(query).not.toHaveBeenCalled();
  });

  it('flags the result unavailable when the posts view does not exist yet', async () => {
    query.mockRejectedValue(Object.assign(new Error('relation "posts_with_sentiment" does not exist'), { code: '42P01' }));

    const response = await call();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, data: { posts: [], total: 0 }, meta: { unavailable: true } });
  });

  it('returns a generic 500 without leaking the database error', async () => {
    query.mockRejectedValue(new Error('password authentication failed for user postgres'));

    const response = await call();

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('password');
  });

  describe('workspace scope', () => {
    it("uses the workspace's social platforms when none are chosen, like the page endpoints", async () => {
      resolveWorkspaceScope.mockResolvedValue({ hasSocialMedia: true, socialPlatforms: ['Telegram'] });

      await call('?workspace_id=3&hashtag=TramDelays');

      expect(query.mock.calls[0][1]).toContainEqual(['telegram']);
    });

    it('lets an explicit platform choice override the workspace', async () => {
      resolveWorkspaceScope.mockResolvedValue({ hasSocialMedia: true, socialPlatforms: ['telegram'] });

      await call('?workspace_id=3&platforms=bluesky');

      expect(query.mock.calls[0][1]).toContainEqual(['bluesky']);
      expect(query.mock.calls[0][1]).not.toContainEqual(['telegram']);
    });

    it('returns nothing, without querying, for a workspace with no social datasets', async () => {
      resolveWorkspaceScope.mockResolvedValue({ hasSocialMedia: false, socialPlatforms: [] });

      const body = await (await call('?workspace_id=3')).json();

      expect(body.data).toMatchObject({ posts: [], total: 0 });
      expect(query).not.toHaveBeenCalled();
    });

    it('returns nothing when every platform is switched off (platforms present but empty)', async () => {
      const body = await (await call('?platforms=')).json();

      expect(body.data).toMatchObject({ posts: [], total: 0 });
      expect(query).not.toHaveBeenCalled();
    });
  });

  it('reports the page size that was applied, not the one requested', async () => {
    const body = await (await call('?limit=500')).json();

    expect(body.data.limit).toBe(100);
  });

  it('rejects an over-long sentiment value', async () => {
    const response = await call(`?sentiment=${'x'.repeat(60)}`);

    expect(response.status).toBe(400);
  });

  it('reports the default page size on early empty responses too', async () => {
    const body = await (await call('?platforms=')).json();

    expect(body.data.limit).toBe(25);
  });
});
