import { describe, it, expect } from 'vitest';
import { computeTrigrams, sentimentScore, tokenize, type TrigramPost } from './trigrams';

const DAY = 86_400_000;
const NOW = new Date('2026-06-15T12:00:00Z');

const post = (overrides: Partial<TrigramPost> & { text: string }): TrigramPost => ({
  id: 1,
  platform: 'telegram',
  createdAt: new Date(NOW.getTime() - 2 * DAY),
  sentiment: 'Neutral',
  engagementRate: 5,
  ...overrides
});

const options = { now: NOW, windowStart: new Date(NOW.getTime() - 10 * DAY), minFrequency: 1, maxResults: 50 };

describe('tokenize', () => {
  it('lowercases, strips punctuation, urls and hash/mention marks', () => {
    expect(tokenize('The NEW tram, timetable! #MarlowTransit @city https://x.example/a')).toEqual([
      'the', 'new', 'tram', 'timetable', 'marlowtransit', 'city'
    ]);
  });

  it('keeps accented and non-latin letters', () => {
    expect(tokenize('Très bonne nouvelle für Marlow')).toEqual(['très', 'bonne', 'nouvelle', 'für', 'marlow']);
  });
});

describe('sentimentScore', () => {
  it('maps categories onto -1..1', () => {
    expect(['Very Positive', 'Positive', 'Neutral', 'Negative', 'Very Negative'].map(sentimentScore)).toEqual([1, 0.5, 0, -0.5, -1]);
  });

  it('treats unknown or missing categories as neutral', () => {
    expect(sentimentScore(null)).toBe(0);
    expect(sentimentScore('weird')).toBe(0);
  });
});

describe('computeTrigrams', () => {
  it('counts three-word phrases across posts, most frequent first', () => {
    const posts = [
      post({ id: 1, text: 'new tram timetable helps' }),
      post({ id: 2, text: 'the new tram timetable is out' }),
      post({ id: 3, text: 'bus drivers kept running' })
    ];

    const result = computeTrigrams(posts, { ...options, minFrequency: 2 });

    expect(result.map((r) => [r.trigram, r.frequency])).toEqual([['new tram timetable', 2]]);
  });

  it('counts a phrase once per post even if it repeats inside it', () => {
    const result = computeTrigrams([post({ text: 'tram delays again tram delays again' })], options);

    expect(result.find((r) => r.trigram === 'tram delays again')?.frequency).toBe(1);
  });

  it('skips phrases made only of stop words', () => {
    const result = computeTrigrams([post({ text: 'this is the tram' })], options);

    expect(result.map((r) => r.trigram)).not.toContain('this is the');
  });

  it('averages sentiment and engagement over the posts containing the phrase', () => {
    const posts = [
      post({ id: 1, text: 'fare increase unfair', sentiment: 'Very Negative', engagementRate: 10 }),
      post({ id: 2, text: 'fare increase unfair', sentiment: 'Neutral', engagementRate: 4 })
    ];

    const [row] = computeTrigrams(posts, options);

    expect(row.sentiment).toBe(-0.5);
    expect(row.averageEngagement).toBe(7);
  });

  it('lists the platforms and first/last seen dates', () => {
    const posts = [
      post({ id: 1, text: 'harbor fireworks tonight', platform: 'bluesky', createdAt: new Date(NOW.getTime() - 5 * DAY) }),
      post({ id: 2, text: 'harbor fireworks tonight', platform: 'telegram', createdAt: new Date(NOW.getTime() - 1 * DAY) })
    ];

    const [row] = computeTrigrams(posts, options);

    expect(row.platforms).toEqual(['bluesky', 'telegram']);
    expect(row.firstSeen).toBe(new Date(NOW.getTime() - 5 * DAY).toISOString());
    expect(row.lastSeen).toBe(new Date(NOW.getTime() - 1 * DAY).toISOString());
  });

  it('flags a rising phrase when the recent half has clearly more posts than the earlier half', () => {
    const early = [post({ id: 1, text: 'water advisory update', createdAt: new Date(NOW.getTime() - 9 * DAY) })];
    const recent = [2, 3, 4, 5].map((id) => post({ id, text: 'water advisory update', createdAt: new Date(NOW.getTime() - 1 * DAY) }));

    expect(computeTrigrams([...early, ...recent], options)[0].trend).toBe('up');
  });

  it('flags a falling phrase, and a steady one as stable', () => {
    const recentOnly = post({ id: 1, text: 'water advisory update', createdAt: new Date(NOW.getTime() - 1 * DAY) });
    const earlyMany = [2, 3, 4, 5].map((id) => post({ id, text: 'water advisory update', createdAt: new Date(NOW.getTime() - 9 * DAY) }));
    expect(computeTrigrams([recentOnly, ...earlyMany], options)[0].trend).toBe('down');

    const steady = [
      post({ id: 6, text: 'bike lane safer', createdAt: new Date(NOW.getTime() - 9 * DAY) }),
      post({ id: 7, text: 'bike lane safer', createdAt: new Date(NOW.getTime() - 1 * DAY) })
    ];
    expect(computeTrigrams(steady, options)[0].trend).toBe('stable');
  });

  it('returns the most engaging posts as examples', () => {
    const posts = [
      post({ id: 1, text: 'harbor fireworks tonight a', engagementRate: 2 }),
      post({ id: 2, text: 'harbor fireworks tonight b', engagementRate: 9 }),
      post({ id: 3, text: 'harbor fireworks tonight c', engagementRate: 5 }),
      post({ id: 4, text: 'harbor fireworks tonight d', engagementRate: 1 })
    ];

    const [row] = computeTrigrams(posts, options);

    expect(row.topPosts).toEqual(['harbor fireworks tonight b', 'harbor fireworks tonight c', 'harbor fireworks tonight a']);
  });

  it('filters by search text, sentiment range and minimum frequency, and limits results', () => {
    const posts = [
      post({ id: 1, text: 'fare increase unfair', sentiment: 'Negative' }),
      post({ id: 2, text: 'fare increase unfair', sentiment: 'Negative' }),
      post({ id: 3, text: 'tram timetable improvement', sentiment: 'Very Positive' })
    ];

    expect(computeTrigrams(posts, { ...options, search: 'TIMETABLE' }).map((r) => r.trigram)).toEqual(['tram timetable improvement']);
    expect(computeTrigrams(posts, { ...options, sentimentRange: [0.5, 1] }).map((r) => r.trigram)).toEqual(['tram timetable improvement']);
    expect(computeTrigrams(posts, { ...options, minFrequency: 2 }).map((r) => r.trigram)).toEqual(['fare increase unfair']);
    expect(computeTrigrams(posts, { ...options, maxResults: 1 })).toHaveLength(1);
  });

  it('returns nothing for no posts', () => {
    expect(computeTrigrams([], options)).toEqual([]);
  });

  it('applies the sentiment filter before limiting results', () => {
    const posts = [
      ...[1, 2, 3].map((id) => post({ id, text: 'fare increase unfair', sentiment: 'Negative' })),
      post({ id: 9, text: 'tram timetable improvement', sentiment: 'Very Positive' })
    ];

    const result = computeTrigrams(posts, { ...options, maxResults: 1, sentimentRange: [0.5, 1] });

    expect(result.map((r) => r.trigram)).toEqual(['tram timetable improvement']);
  });

  it('measures the trend from the window start it is given (for example a truncated scan)', () => {
    // Window really starts 4 days ago (older posts were cut off), so 2 days ago is the early half
    const windowStart = new Date(NOW.getTime() - 4 * DAY);
    const early = post({ id: 1, text: 'water advisory update', createdAt: new Date(NOW.getTime() - 3 * DAY) });
    const late = post({ id: 2, text: 'water advisory update', createdAt: new Date(NOW.getTime() - 3 * DAY) });
    const later = [3, 4, 5].map((id) => post({ id, text: 'water advisory update', createdAt: new Date(NOW.getTime() - 1 * DAY) }));

    const [row] = computeTrigrams([early, late, ...later], { ...options, windowStart });

    expect(row.trend).toBe('stable'); // 2 early vs 3 recent is not a clear rise
  });
});
