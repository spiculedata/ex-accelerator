import { describe, it, expect } from 'vitest';
import {
  extractActorLocations,
  extractActorKeywords,
  extractLocationActors,
  extractLocationKeywords,
  extractKeywordActors,
  extractKeywordLocations,
  extractDateEntities,
  extractDateKeywords,
  extractSentimentEntities,
  classifySentiment,
  computeTimelineHighlightDays,
  computeHighlightSet
} from './crossFilterHelpers';

const events = [
  { actor1name: 'UNITED NATIONS', actor2name: 'FRANCE', actiongeo_fullname: 'Paris, France', sqldate: '20240301', avgtone: 5 },
  { actor1name: 'FRANCE', actor2name: '', actiongeo_fullname: 'Lyon, France', sqldate: '20240302', avgtone: -4 },
  { actor1name: 'GERMANY', actor2name: 'UNITED NATIONS', actiongeo_fullname: 'Berlin, Germany', sqldate: '2024-03-03T10:00:00', avg_tone: 0.5 }
];

describe('crossFilterHelpers extractors', () => {
  it('finds locations of an actor, matching either actor field case-insensitively', () => {
    expect([...extractActorLocations(events, ' united nations ')].sort()).toEqual(['Berlin, Germany', 'Paris, France']);
  });

  it('returns co-occurring actors and locations but not the actor itself', () => {
    const terms = extractActorKeywords(events, 'UNITED NATIONS');
    expect([...terms].sort()).toEqual(['Berlin, Germany', 'FRANCE', 'GERMANY', 'Paris, France']);
    expect(terms.has('UNITED NATIONS')).toBe(false);
  });

  it('finds actors at a location and skips empty actor names', () => {
    expect([...extractLocationActors(events, 'france')].sort()).toEqual(['FRANCE', 'UNITED NATIONS']);
    expect([...extractLocationKeywords(events, 'lyon')]).toEqual(['FRANCE']);
  });

  it('matches keywords across actors and locations', () => {
    expect([...extractKeywordActors(events, 'berlin')].sort()).toEqual(['GERMANY', 'UNITED NATIONS']);
    expect([...extractKeywordLocations(events, 'france')].sort()).toEqual(['Lyon, France', 'Paris, France']);
  });

  it('returns empty sets when nothing matches', () => {
    expect(extractActorLocations(events, 'nobody').size).toBe(0);
    expect(extractLocationActors([], 'x').size).toBe(0);
  });

  it('extracts entities for a date in both YYYYMMDD and ISO formats', () => {
    const d1 = extractDateEntities(events, '2024-03-01');
    expect([...d1.actors].sort()).toEqual(['FRANCE', 'UNITED NATIONS']);
    expect([...d1.locations]).toEqual(['Paris, France']);
    expect([...extractDateEntities(events, '2024-03-03').locations]).toEqual(['Berlin, Germany']);
    expect([...extractDateKeywords(events, '2024-03-02')].sort()).toEqual(['FRANCE', 'Lyon, France']);
  });

  it('buckets events by tone (avgtone or avg_tone) with +-1 boundaries', () => {
    const pos = extractSentimentEntities(events, 'positive');
    expect([...pos.locations]).toEqual(['Paris, France']);
    const neg = extractSentimentEntities(events, 'negative');
    expect([...neg.keywords].sort()).toEqual(['FRANCE', 'Lyon, France']);
    expect([...extractSentimentEntities(events, 'neutral').actors].sort()).toEqual(['GERMANY', 'UNITED NATIONS']);
  });
});

describe('classifySentiment', () => {
  it('uses a +-0.05 dead zone', () => {
    expect(classifySentiment(0.06)).toBe('positive');
    expect(classifySentiment(0.05)).toBe('neutral');
    expect(classifySentiment(-0.05)).toBe('neutral');
    expect(classifySentiment(-0.06)).toBe('negative');
  });
});

describe('computeTimelineHighlightDays', () => {
  const timeline = [
    { date: '2024-03-01', gdelt_events: 3, gdelt_avg_tone: 50 },
    { date: '2024-03-02', radio_segments: 10, radio_positive: 1, radio_negative: 8 },
    { date: '2024-03-03', social_posts: 4, social_positive: 2, social_negative: 2 },
    { date: '2024-03-04' }
  ];

  it('returns null without a cross-filter', () => {
    expect(computeTimelineHighlightDays(null, timeline, events)).toBeNull();
  });

  it('highlights the single day for a date filter', () => {
    expect(computeTimelineHighlightDays({ dimension: 'date', value: '2024-03-02' }, timeline, events)).toEqual(new Set(['2024-03-02']));
  });

  it('averages available sources for sentiment filters', () => {
    expect(computeTimelineHighlightDays({ dimension: 'sentiment', value: 'positive' }, timeline, events)).toEqual(new Set(['2024-03-01']));
    expect(computeTimelineHighlightDays({ dimension: 'sentiment', value: 'negative' }, timeline, events)).toEqual(new Set(['2024-03-02']));
    expect(computeTimelineHighlightDays({ dimension: 'sentiment', value: 'neutral' }, timeline, events)).toEqual(new Set(['2024-03-03', '2024-03-04']));
  });

  it('finds days with GDELT events for actor, location and keyword filters', () => {
    expect(computeTimelineHighlightDays({ dimension: 'actor', value: 'germany' }, timeline, events)).toEqual(new Set(['2024-03-03']));
    expect(computeTimelineHighlightDays({ dimension: 'location', value: 'france' }, timeline, events)).toEqual(new Set(['2024-03-01', '2024-03-02']));
    expect(computeTimelineHighlightDays({ dimension: 'keyword', value: 'lyon' }, timeline, events)).toEqual(new Set(['2024-03-02']));
  });

  it('returns null (do not dim) when no GDELT event matches, and for the source dimension', () => {
    expect(computeTimelineHighlightDays({ dimension: 'actor', value: 'zzz' }, timeline, events)).toBeNull();
    expect(computeTimelineHighlightDays({ dimension: 'source', value: 'radio' }, timeline, events)).toBeNull();
  });
});

describe('computeHighlightSet', () => {
  it('is empty without a filter or without events', () => {
    expect(computeHighlightSet(null, events, 'actor').size).toBe(0);
    expect(computeHighlightSet({ dimension: 'actor', value: 'X' }, [], 'actor').size).toBe(0);
  });

  it('returns the value itself when filtering the same dimension', () => {
    expect(computeHighlightSet({ dimension: 'actor', value: 'FRANCE' }, events, 'actor')).toEqual(new Set(['FRANCE']));
  });

  it('maps each source dimension to the target dimension', () => {
    expect([...computeHighlightSet({ dimension: 'location', value: 'berlin' }, events, 'actor')].sort()).toEqual(['GERMANY', 'UNITED NATIONS']);
    expect([...computeHighlightSet({ dimension: 'keyword', value: 'lyon' }, events, 'actor')]).toEqual(['FRANCE']);
    expect([...computeHighlightSet({ dimension: 'date', value: '2024-03-02' }, events, 'actor')]).toEqual(['FRANCE']);
    expect([...computeHighlightSet({ dimension: 'sentiment', value: 'positive' }, events, 'actor')].sort()).toEqual(['FRANCE', 'UNITED NATIONS']);

    expect([...computeHighlightSet({ dimension: 'actor', value: 'GERMANY' }, events, 'location')]).toEqual(['Berlin, Germany']);
    expect([...computeHighlightSet({ dimension: 'keyword', value: 'paris' }, events, 'location')]).toEqual(['Paris, France']);
    expect([...computeHighlightSet({ dimension: 'date', value: '2024-03-01' }, events, 'location')]).toEqual(['Paris, France']);
    expect([...computeHighlightSet({ dimension: 'sentiment', value: 'negative' }, events, 'location')]).toEqual(['Lyon, France']);

    expect([...computeHighlightSet({ dimension: 'actor', value: 'GERMANY' }, events, 'keyword')].sort()).toEqual(['Berlin, Germany', 'UNITED NATIONS']);
    expect([...computeHighlightSet({ dimension: 'location', value: 'lyon' }, events, 'keyword')]).toEqual(['FRANCE']);
    expect([...computeHighlightSet({ dimension: 'date', value: '2024-03-02' }, events, 'keyword')].sort()).toEqual(['FRANCE', 'Lyon, France']);
    expect([...computeHighlightSet({ dimension: 'sentiment', value: 'negative' }, events, 'keyword')].sort()).toEqual(['FRANCE', 'Lyon, France']);
  });

  it('returns an empty set for dimensions that do not map (source)', () => {
    for (const t of ['actor', 'location', 'keyword'] as const) {
      expect(computeHighlightSet({ dimension: 'source', value: 'radio' }, events, t).size).toBe(0);
    }
  });
});
