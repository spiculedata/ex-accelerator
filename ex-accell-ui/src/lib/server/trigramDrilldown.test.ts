import { describe, expect, it } from 'vitest';
import { computeTrigrams, type TrigramPost } from './trigrams';
import { buildPostSearch } from './postSearch';

// A trigram's frequency is the number of posts containing it once the text is split into words. The drill-down must open
// exactly those posts, or the number on the page and the list behind it disagree.

const TEXTS = [
  'Tram delays now, again',
  'tram — delays; now?',
  'TRAM DELAYS NOW',
  'tram2delays_now',
  "The tram's delays now are worse",
  'see https://example.com/tram-delays-now for details',
  'Another morning of tram delays and no information at the stop. #TramDelays',
  'No information at the stop, again. No information at the stop!',
  'Café délai maintenant: le tram, les délais, maintenant',
  'Schon wieder Probleme in der Stadt, wir warten auf Antworten.',
  'Encore des problèmes en ville, on attend toujours des réponses.',
  "Don't stop the bus now, don't stop the bus now",
  'fare increase hard to justify. fare... increase... hard to justify',
  '🚋 service disruption on line 4 — service disruption again',
  'Delays on the tram delays now'
];

const posts: TrigramPost[] = TEXTS.map((text, id) => ({
  id, text, platform: 'telegram', createdAt: new Date('2026-11-01T00:00:00Z'), sentiment: null, engagementRate: 0
}));

const patternFor = (phrase: string): ((text: string) => boolean) => {
  const search = buildPostSearch({ phrase });
  if (!search.ok) throw new Error(search.error);
  const pattern = String(search.params.find((p) => typeof p === 'string' && p.includes(phrase.split(' ')[0])));
  const re = new RegExp(pattern, 'i');
  // The SQL removes links before matching, as the word splitting does
  return (text) => re.test(text.replace(/https?:\/\/\S+/gi, ' '));
};

describe('a trigram and the posts behind it', () => {
  const results = computeTrigrams(posts, {
    now: new Date('2026-11-09T00:00:00Z'),
    windowStart: new Date('2026-10-01T00:00:00Z'),
    minFrequency: 1,
    maxResults: 10_000
  });

  it('has something to compare', () => {
    expect(results.length).toBeGreaterThan(20);
  });

  it('opens exactly as many posts as the count says, for every phrase', () => {
    const disagreements = results
      .map((r) => ({ phrase: r.trigram, counted: r.frequency, opened: posts.filter((p) => patternFor(r.trigram)(p.text)).length }))
      .filter((r) => r.counted !== r.opened);
    expect(disagreements).toEqual([]);
  });

  it('opens the posts that an exact-phrase search would miss because of punctuation and case', () => {
    const matches = (text: string) => patternFor('tram delays now')(text);
    expect(matches('tram — delays; now?')).toBe(true);
    expect(matches('TRAM DELAYS NOW')).toBe(true);
    expect(matches("the tram's delays now")).toBe(false);
    expect(matches('trams delays now')).toBe(false);
    expect(matches('see https://example.com/tram-delays-now')).toBe(false);
  });
});
