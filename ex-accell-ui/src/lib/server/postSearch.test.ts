import { describe, it, expect } from 'vitest';
import { buildPostSearch } from './postSearch';

const ok = (filters: Parameters<typeof buildPostSearch>[0]) => {
  const result = buildPostSearch(filters);
  if (!result.ok) throw new Error(result.error);
  return result;
};

describe('buildPostSearch', () => {
  it('lists newest posts first with a default page of 25 and no filters', () => {
    const { sql, params } = ok({});

    expect(sql).toContain('FROM posts_with_sentiment');
    expect(sql).toMatch(/ORDER BY p\.timestamp DESC/);
    expect(sql).not.toContain('WHERE');
    expect(params.slice(-2)).toEqual([25, 0]);
  });

  it('never puts a request value into the SQL text', () => {
    const { sql } = ok({ q: "x'; DROP TABLE posts; --", hashtag: 'tram', sentiment: "Very Positive'--", platforms: ['telegram'] });

    expect(sql).not.toContain('DROP');
    expect(sql).not.toContain('tram');
    expect(sql).not.toContain("'--");
  });

  it('filters by topic slug through the document_topics link and the topics table', () => {
    const { sql, params } = ok({ topic: 'topic-transit' });

    expect(sql).toContain('document_topics');
    expect(sql).toMatch(/JOIN topics t ON t\.id = dt\.topic_id/);
    expect(sql).toContain('t.topic_id =');
    expect(params).toContain('topic-transit');
  });

  it('matches a hashtag as a whole tag, so #tram does not match #tramway', () => {
    const { params } = ok({ hashtag: 'TramDelays' });

    const pattern = String(params.find((p) => typeof p === 'string' && p.includes('TramDelays')));
    const re = new RegExp(pattern.replace(/\[:alnum:\]/g, 'A-Za-z0-9'), 'i');
    expect(re.test('Late again #TramDelays today')).toBe(true);
    expect(re.test('#tramdelays')).toBe(true);
    expect(re.test('#TramDelaysAgain')).toBe(false);
  });

  it('escapes LIKE wildcards in a phrase so a user cannot widen the match', () => {
    const { sql, params } = ok({ q: '100%_sure\\' });

    expect(sql).toContain('ILIKE');
    expect(sql).toContain("ESCAPE '\\'");
    expect(params).toContain('%100\\%\\_sure\\\\%');
  });

  it('compares dates as epoch milliseconds, with the end date covering its whole day', () => {
    const { params } = ok({ dateStart: '2026-11-02', dateEnd: '2026-11-09' });

    expect(params).toContain(Date.UTC(2026, 10, 2));
    expect(params).toContain(Date.UTC(2026, 10, 9, 23, 59, 59, 999));
  });

  it('numbers parameters consecutively across every filter', () => {
    const { sql, params } = ok({ topic: 'topic-transit', q: 'tram', sentiment: 'Negative', platforms: ['telegram', 'bluesky'], dateStart: '2026-11-02', dateEnd: '2026-11-09', limit: 10, offset: 20 });

    const placeholders = [...sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
    expect(Math.max(...placeholders)).toBe(params.length);
    expect(new Set(placeholders).size).toBe(params.length);
  });

  it.each([
    [{ limit: 5000 }, 100],
    [{ limit: 0 }, 1],
    [{ limit: -3 }, 1]
  ])('clamps the page size %j to %i', (filters, expected) => {
    expect(ok(filters).params.slice(-2)[0]).toBe(expected);
  });

  it('adds a total count so the page can say how many posts match', () => {
    expect(ok({}).sql).toContain('COUNT(*) OVER() AS total');
  });

  it.each([
    [{ topic: '' }, 'topic'],
    [{ topic: 'drop table; --' }, 'topic'],
    [{ topic: 'x'.repeat(101) }, 'topic'],
    [{ hashtag: 'not a tag' }, 'hashtag'],
    [{ hashtag: '#x' }, 'hashtag'],
    [{ q: '   ' }, 'q'],
    [{ q: 'x'.repeat(201) }, 'q'],
    [{ dateStart: 'soon' }, 'date_start'],
    [{ dateEnd: '2026-02-30' }, 'date_end'],
    [{ offset: -1 }, 'offset']
  ])('rejects invalid input %j', (filters, field) => {
    const result = buildPostSearch(filters as Parameters<typeof buildPostSearch>[0]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(field);
  });
});
