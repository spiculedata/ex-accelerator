import { describe, expect, it } from 'vitest';
import { buildInvestigationQuery, normalizeTimeline } from './investigationQuery';

describe('buildInvestigationQuery', () => {
  it('puts the type first, then limit, keywords and dates', () => {
    expect(buildInvestigationQuery('investigation-gdelt-events', ['border', 'talks'], '2026-01-01', '2026-01-31', 200)).toBe(
      '/api/unified-analytics?type=investigation-gdelt-events&limit=200&keywords=border%2Ctalks&date_start=2026-01-01&date_end=2026-01-31'
    );
  });

  it('leaves out what is empty', () => {
    expect(buildInvestigationQuery('investigation-timeline', [], '', '')).toBe('/api/unified-analytics?type=investigation-timeline');
    expect(buildInvestigationQuery('investigation-timeline', [], '2026-01-01', '')).toBe(
      '/api/unified-analytics?type=investigation-timeline&date_start=2026-01-01'
    );
  });
});

describe('normalizeTimeline', () => {
  it('cuts timestamps to the day and turns counts into numbers', () => {
    const [row] = normalizeTimeline([{ date: '2026-01-02T00:00:00Z', gdelt_events: '3', social_posts: 2 }]);
    expect(row.date).toBe('2026-01-02');
    expect(row.gdelt_events).toBe(3);
    expect(row.social_posts).toBe(2);
    expect(row.radio_segments).toBe(0);
  });

  it('accepts the shorter column names and keeps a plain date', () => {
    const [row] = normalizeTimeline([{ date: '2026-01-02', events: 4, avg_goldstein: '1.5', avg_tone: -2 }]);
    expect(row).toMatchObject({ date: '2026-01-02', gdelt_events: 4, gdelt_avg_goldstein: 1.5, gdelt_avg_tone: -2 });
  });

  it('gives an empty list for no rows', () => {
    expect(normalizeTimeline([])).toEqual([]);
  });
});
