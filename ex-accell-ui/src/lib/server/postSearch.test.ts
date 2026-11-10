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
    expect(params.at(-1)).toBe(26); // one more than the page, to know whether there is a next page
    expect(sql).not.toContain('OFFSET');
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

  // The pattern is run by Postgres, whose \uXXXX escapes JavaScript also understands, so it can be exercised here. It was
  // checked against a UTF-8 and a C-locale database, which agree.
  const hashtagPattern = (tag: string) => {
    const { params } = ok({ hashtag: tag });
    const pattern = String(params.find((p) => typeof p === 'string' && p.includes('#')));
    return new RegExp(pattern, 'i');
  };

  it('matches a hashtag as a whole tag, so #tram does not match #tramway', () => {
    const re = hashtagPattern('TramDelays');
    expect(re.test('Late again #TramDelays today')).toBe(true);
    expect(re.test('#tramdelays')).toBe(true);
    expect(re.test('#TramDelaysAgain')).toBe(false);
  });

  it.each(['टैग', 'وَسْم', 'café', 'ტრამვაი', 'трамвай', '電車', 'tram_2'])('accepts the tag %s, whatever script or combining marks it uses', (tag) => {
    expect(buildPostSearch({ hashtag: tag }).ok).toBe(true);
  });

  it('treats letters of any script as part of the tag, so #tram does not match #tramé or é#tram', () => {
    const re = hashtagPattern('tram');
    for (const text of ['x #tramé y', 'é#tram', '日本#tram', 'привет#tram', 'x#tram', '#tram1']) expect(re.test(text)).toBe(false);
  });

  it('still treats punctuation, quotes and emoji around a tag as a boundary', () => {
    const re = hashtagPattern('tram');
    for (const text of ['“#tram”', '#tram…', '🚋#tram', '(#tram)', '#tram—now', '#tram, ok', '#TRAM!']) expect(re.test(text)).toBe(true);
  });

  it('does not depend on the database locale, which decides what [:alnum:] means', () => {
    const { params } = ok({ hashtag: 'tram' });
    expect(String(params.find((p) => typeof p === 'string' && p.includes('#')))).not.toContain('[:alnum:]');
  });

  it('matches a phrase by its words, ignoring punctuation, case and links, as the phrase counts do', () => {
    const { sql, params } = ok({ phrase: 'Tram Delays Now' });

    expect(sql).toContain("regexp_replace(p.text, 'https?://\\S+', ' ', 'gi')");
    expect(sql).toContain('~*');
    expect(params.some((p) => typeof p === 'string' && p.includes('tram') && p.includes('delays') && p.includes('now'))).toBe(true);
    expect(sql).not.toContain('delays');
  });

  it.each([
    [{ phrase: 'tram' }, 'phrase'],
    [{ phrase: 'a b c d e f g' }, 'phrase'],
    [{ phrase: 'tram delays 5' }, 'phrase'],
    [{ phrase: 'tram; DROP TABLE posts' }, 'phrase'],
    [{ phrase: `${'word '.repeat(60)}end` }, 'phrase'],
    [{ phrase: '   ' }, 'phrase']
  ])('rejects invalid phrase %j', (filters, field) => {
    const result = buildPostSearch(filters);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(field);
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
    expect(ok(filters).limit).toBe(expected);
  });

  it('returns the page size it actually applied, and whether this page counts the matches', () => {
    const first = ok({ limit: 500 });
    expect(first.limit).toBe(100);
    expect(first.withTotal).toBe(true);
    expect(ok({ cursor: '1731146400000_42' }).withTotal).toBe(false);
  });

  it('counts the matches on the first page only, so later pages are not made to count them again', () => {
    expect(ok({}).sql).toContain('COUNT(*) OVER() AS total');
    expect(ok({ cursor: '1731146400000_42' }).sql).not.toContain('COUNT(');
  });

  it('continues after a cursor with a keyset condition instead of skipping rows', () => {
    const { sql, params } = ok({ cursor: '1731146400000_42', q: 'tram' });

    expect(sql).toMatch(/\(p\.timestamp, p\.id\) < \(\$\d+, \$\d+\)/);
    expect(sql).not.toContain('OFFSET');
    expect(params).toContain(1731146400000);
    expect(params).toContain(42);
    expect(sql).not.toContain('1731146400000'); // bound, never written into the SQL
  });

  it('accepts the largest id the posts table can hold', () => {
    expect(ok({ cursor: '1731146400000_2147483647' }).ok).toBe(true);
  });

  it('limits to the last N days by the database clock, the way the phrase counts do', () => {
    const { sql, params } = ok({ withinDays: 7 });
    expect(sql).toContain('p.created_at >= CURRENT_TIMESTAMP - make_interval(days =>');
    expect(params).toContain(7);
  });

  it('selects the timestamp so the next cursor can be built from the last row', () => {
    expect(ok({}).sql).toMatch(/p\.timestamp/);
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
    [{ sentiment: 'x'.repeat(51) }, 'sentiment'],
    [{ cursor: 'abc' }, 'cursor'],
    [{ cursor: '12_' }, 'cursor'],
    [{ cursor: '1_2; DROP TABLE posts' }, 'cursor'],
    [{ cursor: '0_5' }, 'cursor'],
    [{ cursor: '1731146400000_2147483648' }, 'cursor'],
    [{ cursor: '1731146400000000000_5' }, 'cursor'],
    [{ withinDays: 0 }, 'within_days'],
    [{ withinDays: 1.5 }, 'within_days'],
    [{ withinDays: 400 }, 'within_days']
  ])('rejects invalid input %j', (filters, field) => {
    const result = buildPostSearch(filters as Parameters<typeof buildPostSearch>[0]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(field);
  });
});
