import { describe, it, expect, afterEach } from 'vitest';
import { formatDay } from './dayFormat';

const originalTz = process.env.TZ;
afterEach(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

describe('formatDay', () => {
  it.each(['America/Los_Angeles', 'UTC', 'Pacific/Auckland'])('shows a date-only value as that calendar day in %s', (tz) => {
    process.env.TZ = tz;

    expect(formatDay('2026-08-01')).toBe('Aug 1');
    expect(formatDay('2026-12-31')).toBe('Dec 31');
  });

  it('formats a full timestamp as the day it is for the viewer, because it is an instant, not a calendar day', () => {
    process.env.TZ = 'America/Los_Angeles';

    expect(formatDay('2026-08-01T01:30:00.000Z')).toBe('Jul 31');
  });

  it('can include the year', () => {
    expect(formatDay('2026-08-01', { year: true })).toBe('Aug 1, 2026');
  });

  it.each([[''], ['not a date'], [undefined]])('returns an empty string for %j', (value) => {
    expect(formatDay(value as string)).toBe('');
  });
});
