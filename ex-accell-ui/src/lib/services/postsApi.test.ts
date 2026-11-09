import { describe, it, expect } from 'vitest';
import { buildPostsQuery, filtersFromParams } from './postsApi';

describe('buildPostsQuery', () => {
  it('builds a query string from the filters that are set, leaving out the rest', () => {
    const query = buildPostsQuery({ topic: 'topic-transit', sentiment: 'Very Negative', platforms: ['telegram', 'bluesky'], dateStart: '2026-11-02' }, { limit: 25, offset: 50 });

    const params = new URLSearchParams(query);
    expect(params.get('topic')).toBe('topic-transit');
    expect(params.get('sentiment')).toBe('Very Negative');
    expect(params.get('platforms')).toBe('telegram,bluesky');
    expect(params.get('date_start')).toBe('2026-11-02');
    expect(params.get('limit')).toBe('25');
    expect(params.get('offset')).toBe('50');
    expect(params.has('hashtag')).toBe(false);
    expect(params.has('date_end')).toBe(false);
  });

  it('strips a leading # from a hashtag and encodes phrases', () => {
    const params = new URLSearchParams(buildPostsQuery({ hashtag: '#TramDelays', q: 'a & b' }));

    expect(params.get('hashtag')).toBe('TramDelays');
    expect(params.get('q')).toBe('a & b');
  });

  it('omits an empty platform list so the request is not filtered to nothing', () => {
    expect(new URLSearchParams(buildPostsQuery({ platforms: [] })).has('platforms')).toBe(false);
  });
});

describe('filtersFromParams', () => {
  it('carries the shared filter bar\'s platforms and dates into a drill-down', () => {
    expect(filtersFromParams({ workspace_id: '3', platforms: 'telegram,bluesky', date_start: '2026-11-02', date_end: '2026-11-09' })).toEqual({
      platforms: ['telegram', 'bluesky'],
      dateStart: '2026-11-02',
      dateEnd: '2026-11-09'
    });
  });

  it('leaves out empty values and ignores everything else', () => {
    expect(filtersFromParams({ platforms: '', workspace_id: '3' })).toEqual({});
  });
});
