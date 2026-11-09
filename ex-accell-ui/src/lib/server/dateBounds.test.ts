import { describe, it, expect } from 'vitest';
import { dateBoundToEpochMs } from './dateBounds';

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

  it.each([['not-a-date'], [''], ['2026-13-45'], ['2026-11-9x']])('returns null for %j', (value) => {
    expect(dateBoundToEpochMs(value, 'start')).toBeNull();
  });
});
