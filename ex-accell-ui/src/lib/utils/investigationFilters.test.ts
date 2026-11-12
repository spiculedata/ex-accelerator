import { describe, expect, it } from 'vitest';
import type { CrossFilter } from '$lib/stores/investigationStore';
import {
  filterGdeltByCrossFilter,
  filterRadioByCrossFilter,
  filterSocialByCrossFilter,
  filterTimelineToRange
} from './investigationFilters';
import type { GdeltEvent, RadioSegment, WorkbenchPost } from './investigationTypes';

const filter = (dimension: CrossFilter['dimension'], value: string): CrossFilter => ({ dimension, value });

const event = (extra: Partial<GdeltEvent>): GdeltEvent => ({ globaleventid: 1, sqldate: '20260105', goldsteinscale: 0, avgtone: 0, ...extra });
const events: GdeltEvent[] = [
  event({ globaleventid: 1, actor1name: 'Alice', actor2name: 'Bob', actiongeo_fullname: 'Paris', avgtone: 3 }),
  event({ globaleventid: 2, actor1name: 'Carol', actiongeo_fullname: 'Rome', avgtone: -3, sqldate: '20260106' }),
  event({ globaleventid: 3, avgtone: 0.5, sqldate: '2026-01-07' })
];
const ids = (list: GdeltEvent[]) => list.map((e) => e.globaleventid);

describe('filterTimelineToRange', () => {
  const days = [{ date: '2026-01-01' }, { date: '2026-01-05' }, { date: '2026-01-09' }];

  it('keeps everything with no range or the full range, returning the same list', () => {
    expect(filterTimelineToRange(days, null, '2026-01-01', '2026-01-09')).toBe(days);
    expect(filterTimelineToRange(days, { start: '2026-01-01', end: '2026-01-09' }, '2026-01-01', '2026-01-09')).toBe(days);
  });

  it('keeps the days inside a narrower range, ends included', () => {
    expect(filterTimelineToRange(days, { start: '2026-01-05', end: '2026-01-09' }, '2026-01-01', '2026-01-09')).toEqual([
      { date: '2026-01-05' },
      { date: '2026-01-09' }
    ]);
  });
});

describe('filterGdeltByCrossFilter', () => {
  it('returns the same list without a filter or for an unsupported dimension', () => {
    expect(filterGdeltByCrossFilter(events, null)).toBe(events);
    expect(filterGdeltByCrossFilter(events, filter('source', 'x'))).toBe(events);
  });

  it('matches actors in either position, ignoring case', () => {
    expect(ids(filterGdeltByCrossFilter(events, filter('actor', 'BOB')))).toEqual([1]);
    expect(ids(filterGdeltByCrossFilter(events, filter('actor', 'carol')))).toEqual([2]);
  });

  it('matches locations and keywords across actors and location', () => {
    expect(ids(filterGdeltByCrossFilter(events, filter('location', 'rom')))).toEqual([2]);
    expect(ids(filterGdeltByCrossFilter(events, filter('keyword', 'paris')))).toEqual([1]);
    expect(ids(filterGdeltByCrossFilter(events, filter('keyword', 'alice')))).toEqual([1]);
  });

  it('classifies tone as positive above 1, negative below -1 and neutral between', () => {
    expect(ids(filterGdeltByCrossFilter(events, filter('sentiment', 'positive')))).toEqual([1]);
    expect(ids(filterGdeltByCrossFilter(events, filter('sentiment', 'negative')))).toEqual([2]);
    expect(ids(filterGdeltByCrossFilter(events, filter('sentiment', 'neutral')))).toEqual([3]);
  });

  it('falls back to avg_tone when avgtone is missing', () => {
    const list = [{ ...event({}), avgtone: undefined as unknown as number, avg_tone: 5 }];
    expect(filterGdeltByCrossFilter(list, filter('sentiment', 'positive'))).toHaveLength(1);
  });

  it('matches a date written as yyyymmdd or already dashed', () => {
    expect(ids(filterGdeltByCrossFilter(events, filter('date', '2026-01-05')))).toEqual([1]);
    expect(ids(filterGdeltByCrossFilter(events, filter('date', '2026-01-07')))).toEqual([3]);
  });
});

describe('filterRadioByCrossFilter', () => {
  const segments: RadioSegment[] = [
    { id: 1, radio_name: 'A', segment_start: '2026-01-04T10:00:00Z', duration_seconds: 1, transcript: 'Border talks today', sentiment: 'Positive' },
    { id: 2, radio_name: 'B', segment_start: '2026-01-05T10:00:00Z', duration_seconds: 1, transcript: 'Weather', sentiment: 'negative' }
  ];

  it('filters by keyword, sentiment and date, and passes other dimensions through', () => {
    expect(filterRadioByCrossFilter(segments, null)).toBe(segments);
    expect(filterRadioByCrossFilter(segments, filter('keyword', 'BORDER')).map((s) => s.id)).toEqual([1]);
    expect(filterRadioByCrossFilter(segments, filter('sentiment', 'positive')).map((s) => s.id)).toEqual([1]);
    expect(filterRadioByCrossFilter(segments, filter('date', '2026-01-05')).map((s) => s.id)).toEqual([2]);
    expect(filterRadioByCrossFilter(segments, filter('actor', 'x'))).toBe(segments);
  });
});

describe('filterSocialByCrossFilter', () => {
  const posts: WorkbenchPost[] = [
    { id: 'a', text: 'Border talks stall', sentiment_category: 'Negative', timestamp: '2026-01-03T10:00:00Z' },
    { id: 'b', text: 'Hope', sentiment_category: 'positive', timestamp: '2026-01-04T10:00:00Z' }
  ];

  it('filters by keyword, sentiment and date, and passes other dimensions through', () => {
    expect(filterSocialByCrossFilter(posts, null)).toBe(posts);
    expect(filterSocialByCrossFilter(posts, filter('keyword', 'talks')).map((p) => p.id)).toEqual(['a']);
    expect(filterSocialByCrossFilter(posts, filter('sentiment', 'negative')).map((p) => p.id)).toEqual(['a']);
    expect(filterSocialByCrossFilter(posts, filter('date', '2026-01-04')).map((p) => p.id)).toEqual(['b']);
    expect(filterSocialByCrossFilter(posts, filter('location', 'x'))).toBe(posts);
  });
});
