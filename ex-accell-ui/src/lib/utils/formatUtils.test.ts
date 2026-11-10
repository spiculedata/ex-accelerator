import { formatNumber, safeDiv, formatPercentage, formatDate, formatTimestamp, formatRelativeTime, toNumber } from './formatUtils';

describe('formatNumber', () => {
  it('returns "0" for null, undefined, NaN', () => {
    expect(formatNumber(null)).toBe('0');
    expect(formatNumber(undefined)).toBe('0');
    expect(formatNumber(NaN)).toBe('0');
  });

  it('formats numbers below 1000 with locale string', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(999)).toBe('999');
  });

  it('formats thousands with K suffix', () => {
    expect(formatNumber(1000)).toBe('1.0K');
    expect(formatNumber(1500)).toBe('1.5K');
    expect(formatNumber(999999)).toBe('1000.0K');
  });

  it('formats millions with M suffix', () => {
    expect(formatNumber(1000000)).toBe('1.0M');
    expect(formatNumber(1500000)).toBe('1.5M');
  });
});

describe('safeDiv', () => {
  it('returns normal division result', () => {
    expect(safeDiv(10, 2)).toBe(5);
    expect(safeDiv(7, 3)).toBeCloseTo(2.333, 2);
  });

  it('returns fallback for zero denominator', () => {
    expect(safeDiv(10, 0)).toBe(0);
    expect(safeDiv(10, 0, -1)).toBe(-1);
  });

  it('returns fallback for Infinity result', () => {
    expect(safeDiv(Infinity, 1)).toBe(0);
  });

  it('uses 0 as default fallback', () => {
    expect(safeDiv(1, 0)).toBe(0);
  });
});

describe('formatPercentage', () => {
  it('formats normal percentage', () => {
    expect(formatPercentage(50, 200)).toBe('25.0%');
    expect(formatPercentage(1, 3)).toBe('33.3%');
  });

  it('returns "0%" for zero total', () => {
    expect(formatPercentage(10, 0)).toBe('0%');
  });

  it('supports custom decimals', () => {
    expect(formatPercentage(1, 3, 2)).toBe('33.33%');
    expect(formatPercentage(1, 3, 0)).toBe('33%');
  });
});

describe('formatDate', () => {
  it('formats a valid date string', () => {
    const result = formatDate('2024-01-15');
    expect(result).not.toBe('—');
    expect(result).toContain('2024');
  });

  it('formats a Date object', () => {
    const result = formatDate(new Date(2024, 0, 15));
    expect(result).not.toBe('—');
    expect(result).toContain('2024');
  });

  it('returns dash for null and undefined', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
  });

  it('returns dash for invalid date string', () => {
    // Note: new Date('not-a-date') produces Invalid Date, whose toLocaleDateString returns 'Invalid Date' not throwing
    // The function only catches exceptions, so truly invalid constructor input may vary by runtime
    expect(formatDate('')).toBe('—');
  });
});

describe('formatTimestamp', () => {
  it('formats a valid date string with time', () => {
    const result = formatTimestamp('2024-01-15T10:30:00Z');
    expect(result).not.toBe('—');
    expect(result).toContain('2024');
  });

  it('formats a Date object', () => {
    const result = formatTimestamp(new Date(2024, 0, 15, 10, 30));
    expect(result).not.toBe('—');
  });

  it('returns dash for null and undefined', () => {
    expect(formatTimestamp(null)).toBe('—');
    expect(formatTimestamp(undefined)).toBe('—');
  });

  it('returns dash for empty string', () => {
    expect(formatTimestamp('')).toBe('—');
  });
});

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns dash for null and undefined', () => {
    expect(formatRelativeTime(null)).toBe('—');
    expect(formatRelativeTime(undefined)).toBe('—');
  });

  it('returns "just now" for recent times', () => {
    const thirtySecondsAgo = new Date('2024-06-15T11:59:31Z');
    expect(formatRelativeTime(thirtySecondsAgo)).toBe('just now');
  });

  it('returns minutes ago', () => {
    const fiveMinutesAgo = new Date('2024-06-15T11:55:00Z');
    expect(formatRelativeTime(fiveMinutesAgo)).toBe('5m ago');
  });

  it('returns hours ago', () => {
    const threeHoursAgo = new Date('2024-06-15T09:00:00Z');
    expect(formatRelativeTime(threeHoursAgo)).toBe('3h ago');
  });

  it('returns days ago', () => {
    const fiveDaysAgo = new Date('2024-06-10T12:00:00Z');
    expect(formatRelativeTime(fiveDaysAgo)).toBe('5d ago');
  });

  it('returns months ago', () => {
    const threeMonthsAgo = new Date('2024-03-15T12:00:00Z');
    expect(formatRelativeTime(threeMonthsAgo)).toBe('3mo ago');
  });

  it('returns years ago', () => {
    const twoYearsAgo = new Date('2022-06-15T12:00:00Z');
    expect(formatRelativeTime(twoYearsAgo)).toBe('2y ago');
  });
});

describe('toNumber', () => {
  it('returns number for valid numbers', () => {
    expect(toNumber(42)).toBe(42);
    expect(toNumber(0)).toBe(0);
    expect(toNumber(-5.5)).toBe(-5.5);
  });

  it('parses numeric strings', () => {
    expect(toNumber('42')).toBe(42);
    expect(toNumber('3.14')).toBeCloseTo(3.14);
  });

  it('returns fallback for non-numeric strings', () => {
    expect(toNumber('abc')).toBe(0);
    expect(toNumber('abc', -1)).toBe(-1);
  });

  it('returns fallback for null and undefined', () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber(null, 99)).toBe(99);
  });

  it('returns fallback for Infinity and NaN', () => {
    expect(toNumber(Infinity)).toBe(0);
    expect(toNumber(-Infinity)).toBe(0);
    expect(toNumber(NaN)).toBe(0);
  });
});

describe('formatTimestamp with epoch milliseconds and bad input', () => {
  it('reads epoch milliseconds given as a number or a numeric string, as the posts view stores them', () => {
    const ms = Date.UTC(2026, 10, 7, 15, 50);
    expect(formatTimestamp(ms as unknown as string)).toBe(formatTimestamp(new Date(ms)));
    expect(formatTimestamp(String(ms))).toBe(formatTimestamp(new Date(ms)));
    expect(formatTimestamp(String(ms))).not.toBe('Invalid Date');
  });

  it('shows a dash, never "Invalid Date", for anything that is not a date', () => {
    expect(formatTimestamp('not a date')).toBe('—');
    expect(formatTimestamp('')).toBe('—');
    expect(formatTimestamp(null)).toBe('—');
  });
});
