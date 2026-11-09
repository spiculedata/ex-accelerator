import { describe, it, expect } from 'vitest';
import { isCalendarDay, validateDayRange } from './calendarDay';

describe('isCalendarDay', () => {
  it.each(['2026-08-01', '2024-02-29', '2026-12-31'])('accepts %s', (value) => {
    expect(isCalendarDay(value)).toBe(true);
  });

  it.each(['2026-02-30', '2026-13-01', '2026-02-29', '26-08-01', '2026-8-1', '2026-08-01T00:00:00Z', '', 'soon', 5, null])('rejects %j', (value) => {
    expect(isCalendarDay(value as string)).toBe(false);
  });
});

describe('validateDayRange', () => {
  it('accepts blank, one-sided, equal and ordered ranges', () => {
    for (const [start, end] of [['', ''], ['2026-08-01', ''], ['', '2026-08-01'], ['2026-08-01', '2026-08-01'], ['2026-08-01', '2026-09-01']]) {
      expect(validateDayRange(start, end)).toBeNull();
    }
  });

  it('names the field for an impossible date', () => {
    expect(validateDayRange('2026-02-30', '')).toContain('date_start');
    expect(validateDayRange('', 'nope')).toContain('date_end');
  });

  it('rejects a start after the end', () => {
    expect(validateDayRange('2026-10-01', '2026-09-01')).toBe('date_start must be on or before date_end');
  });
});
