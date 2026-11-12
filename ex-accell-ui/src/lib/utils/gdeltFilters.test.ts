import { describe, expect, it } from 'vitest';
import { clampRange, filterEvents, matchesEventFilters, type GdeltEvent, type GdeltEventFilters } from './gdeltFilters';
import { averageTone, extractAvailableCountries, extractDateRange } from './gdeltEvents';

const event = (over: Partial<GdeltEvent> = {}): GdeltEvent => ({
  id: 1,
  eventCode: '40',
  country: 'US',
  goldstein: 3,
  tone: 2,
  date: 20260105,
  ...over
});

const everything = (over: Partial<GdeltEventFilters> = {}): GdeltEventFilters => ({
  eventTypes: new Set(['all']),
  goldstein: [-10, 10],
  tone: [-50, 50],
  countries: new Set(['all']),
  dateRange: ['', ''],
  ...over
});

describe('matchesEventFilters', () => {
  it('accepts everything with the open filters', () => {
    expect(matchesEventFilters(event(), everything())).toBe(true);
  });

  it('checks the event type unless all types are chosen', () => {
    expect(matchesEventFilters(event(), everything({ eventTypes: new Set(['support']) }))).toBe(true);
    expect(matchesEventFilters(event(), everything({ eventTypes: new Set(['military']) }))).toBe(false);
    expect(matchesEventFilters(event(), everything({ eventTypes: new Set() }))).toBe(false);
  });

  it('keeps the Goldstein and tone ranges inclusive and treats missing values as 0', () => {
    expect(matchesEventFilters(event({ goldstein: 3 }), everything({ goldstein: [3, 5] }))).toBe(true);
    expect(matchesEventFilters(event({ goldstein: 2.9 }), everything({ goldstein: [3, 5] }))).toBe(false);
    expect(matchesEventFilters(event({ goldstein: null }), everything({ goldstein: [-1, 1] }))).toBe(true);
    expect(matchesEventFilters(event({ tone: undefined }), everything({ tone: [1, 5] }))).toBe(false);
    expect(matchesEventFilters(event({ tone: 5 }), everything({ tone: [1, 5] }))).toBe(true);
  });

  it('checks the country unless all are chosen or the filter is left out', () => {
    expect(matchesEventFilters(event(), everything({ countries: new Set(['FR']) }))).toBe(false);
    expect(matchesEventFilters(event(), everything({ countries: new Set(['US', 'FR']) }))).toBe(true);
    expect(matchesEventFilters(event(), everything({ countries: undefined }))).toBe(true);
  });

  it('applies a date range with either end open', () => {
    const on = (dateRange: string[]) => matchesEventFilters(event({ date: 20260105 }), everything({ dateRange }));
    expect(on(['2026-01-05', '2026-01-05'])).toBe(true);
    expect(on(['2026-01-06', ''])).toBe(false);
    expect(on(['', '2026-01-04'])).toBe(false);
    expect(on(['', '2026-12-31'])).toBe(true);
  });

  it('drops an event without a date once a date range is set', () => {
    expect(matchesEventFilters(event({ date: undefined }), everything({ dateRange: ['2026-01-01', ''] }))).toBe(false);
    expect(matchesEventFilters(event({ date: undefined }), everything())).toBe(true);
  });
});

describe('filterEvents', () => {
  it('returns the matching events in order', () => {
    const events = [event({ id: 1 }), event({ id: 2, country: 'FR' }), event({ id: 3 })];
    expect(filterEvents(events, everything({ countries: new Set(['US']) })).map((e) => e.id)).toEqual([1, 3]);
  });
});

describe('clampRange', () => {
  it('orders the pair', () => {
    expect(clampRange(4, -1, -10, 10)).toEqual([-1, 4]);
  });

  it('keeps both values on the scale', () => {
    expect(clampRange(-99, 99, -50, 50)).toEqual([-50, 50]);
    expect(clampRange(99, 99, -10, 10)).toEqual([10, 10]);
  });
});

describe('event summaries', () => {
  it('lists distinct countries by name, ignoring blanks', () => {
    const events = [event({ country: 'US' }), event({ country: '' }), event({ country: 'FR' }), event({ country: 'US' })];
    expect(extractAvailableCountries(events)).toEqual(['FR', 'US']);
  });

  it('reads the date span, or nothing when no event has a date', () => {
    expect(extractDateRange([event({ date: 20260103 }), event({ date: 20260101 }), event({ date: undefined })])).toEqual(['2026-01-01', '2026-01-03']);
    expect(extractDateRange([event({ date: undefined })])).toBeNull();
    expect(extractDateRange([])).toBeNull();
  });

  it('averages the tone to two decimals', () => {
    expect(averageTone([event({ tone: 1 }), event({ tone: 2 }), event({ tone: 2 })])).toBe(1.67);
    expect(averageTone([event({ tone: undefined }), event({ tone: 4 })])).toBe(2);
    expect(averageTone([])).toBe(0);
  });
});
