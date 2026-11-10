import { describe, expect, it } from 'vitest';
import { trigramDrilldownFilters } from './trigramDrilldown';

const now = new Date('2026-11-10T12:00:00.000Z');
const base = { phrase: 'tram delays now', params: {}, platform: 'all', defaultDays: 7, now };

describe('trigramDrilldownFilters', () => {
  it('opens the posts counted: the phrase, within the same default window as the counts', () => {
    expect(trigramDrilldownFilters(base)).toEqual({ phrase: 'tram delays now', dateStart: '2026-11-03T12:00:00.000Z' });
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
