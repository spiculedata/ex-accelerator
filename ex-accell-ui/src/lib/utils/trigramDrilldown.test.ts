import { describe, expect, it } from 'vitest';
import { trigramDrilldownFilters } from './trigramDrilldown';

const base = { phrase: 'tram delays now', params: {}, platform: 'all', defaultDays: 7 };

describe('trigramDrilldownFilters', () => {
  it('opens the posts counted: the phrase, within the same default window as the counts (by the database clock, not the browser\'s)', () => {
    expect(trigramDrilldownFilters(base)).toEqual({ phrase: 'tram delays now', withinDays: 7 });
  });

  it('uses the date range chosen on the date bar instead of the default window', () => {
    const filters = trigramDrilldownFilters({ ...base, params: { date_start: '2026-10-01', date_end: '2026-10-31' } });
    expect(filters).toEqual({ phrase: 'tram delays now', dateStart: '2026-10-01', dateEnd: '2026-10-31' });
  });

  it('keeps the window open-ended when only an end date was chosen, as the counts do', () => {
    const filters = trigramDrilldownFilters({ ...base, params: { date_end: '2026-10-31' } });
    expect(filters.dateStart).toBeUndefined();
    expect(filters.dateEnd).toBe('2026-10-31');
  });

  it('limits to the platform chosen on the page, and to the workspace', () => {
    const filters = trigramDrilldownFilters({ ...base, platform: 'telegram', params: { workspace_id: '4' } });
    expect(filters.platforms).toEqual(['telegram']);
    expect(filters.workspaceId).toBe('4');
  });

  it('adds no platform filter for "all"', () => {
    expect(trigramDrilldownFilters(base).platforms).toBeUndefined();
  });
});
