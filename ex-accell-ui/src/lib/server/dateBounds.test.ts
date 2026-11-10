import { describe, it, expect } from 'vitest';
import { dateBoundToEpochMs, validateDateParams } from './dateBounds';

describe('dateBoundToEpochMs', () => {
  it('turns a start date into midnight UTC in epoch milliseconds', () => {
    expect(dateBoundToEpochMs('2026-11-02', 'start')).toBe(Date.UTC(2026, 10, 2, 0, 0, 0, 0));
  });

  it('turns an end date into the last millisecond of that day, so the range is inclusive', () => {
    expect(dateBoundToEpochMs('2026-11-09', 'end')).toBe(Date.UTC(2026, 10, 9, 23, 59, 59, 999));
  });

  it('keeps the time of a full ISO timestamp', () => {
    expect(dateBoundToEpochMs('2026-11-09T14:02:11.000Z', 'start')).toBe(Date.parse('2026-11-09T14:02:11.000Z'));
    expect(dateBoundToEpochMs('2026-11-09T14:02:11.000Z', 'end')).toBe(Date.parse('2026-11-09T14:02:11.000Z'));
  });

  it('accepts a real leap day and rejects a fake one', () => {
    expect(dateBoundToEpochMs('2024-02-29', 'start')).toBe(Date.UTC(2024, 1, 29));
    expect(dateBoundToEpochMs('2026-02-29', 'start')).toBeNull();
  });

  it('accepts a timestamp with an offset and rejects one with no zone or an impossible day', () => {
    expect(dateBoundToEpochMs('2026-11-09T14:02:11+01:00', 'start')).toBe(Date.parse('2026-11-09T13:02:11Z'));
    expect(dateBoundToEpochMs('2026-11-09T14:02', 'start')).toBeNull();
    expect(dateBoundToEpochMs('2026-02-30T00:00:00Z', 'start')).toBeNull();
    expect(dateBoundToEpochMs('2026-11-09T25:00:00Z', 'start')).toBeNull();
    expect(dateBoundToEpochMs('2026-11-09T1:2Z', 'start')).toBeNull();
    expect(dateBoundToEpochMs('2026-11-09T14:02Z', 'start')).toBe(Date.parse('2026-11-09T14:02:00Z'));
  });

  it.each([['not-a-date'], [''], ['2026-13-45'], ['2026-11-9x']])('returns null for %j', (value) => {
    expect(dateBoundToEpochMs(value, 'start')).toBeNull();
  });
});

describe('validateDateParams', () => {
  const check = (query: string) => validateDateParams(new URLSearchParams(query));

  it('accepts no dates, whole days, and timestamps with a zone', () => {
    expect(check('')).toBeNull();
    expect(check('date_start=2026-11-01&date_end=2026-11-30')).toBeNull();
    expect(check('date_start=2026-11-01T00:00:00Z&date_end=2026-11-02T00:00:00Z')).toBeNull();
    expect(check('date_start=2026-11-01')).toBeNull();
  });

  it('names the parameter that is not a real date', () => {
    expect(check('date_start=2026-02-30')).toBe('date_start must be a date (YYYY-MM-DD)');
    expect(check('date_end=yesterday')).toBe('date_end must be a date (YYYY-MM-DD)');
  });

  it('applies the same rules to the camel-case names the GDELT endpoints use', () => {
    expect(check('dateStart=2026-11-01&dateEnd=2026-11-30')).toBeNull();
    expect(check('dateStart=2026-13-01')).toBe('dateStart must be a date (YYYY-MM-DD)');
    expect(check('dateStart=2026-11-05&dateEnd=2026-11-01')).toBe('dateStart must be on or before dateEnd');
  });

  it('rejects a start after the end, whichever form each is written in', () => {
    expect(check('date_start=2026-11-05&date_end=2026-11-01')).toBe('date_start must be on or before date_end');
    expect(check('date_start=2026-11-05T12:00:00Z&date_end=2026-11-05T11:00:00Z')).toBe('date_start must be on or before date_end');
  });
});
