import { describe, expect, it } from 'vitest';
import { toIsoTimestamp } from './timestamps';

describe('toIsoTimestamp', () => {
  it('reads epoch milliseconds given as a number or a numeric string, as the posts view stores them', () => {
    expect(toIsoTimestamp('1762530618733')).toBe('2025-11-07T15:50:18.733Z');
    expect(toIsoTimestamp(1762530618733)).toBe('2025-11-07T15:50:18.733Z');
  });

  it('keeps ISO strings and dates', () => {
    expect(toIsoTimestamp('2024-01-15T10:00:00Z')).toBe('2024-01-15T10:00:00.000Z');
    expect(toIsoTimestamp(new Date('2024-01-15T10:00:00Z'))).toBe('2024-01-15T10:00:00.000Z');
  });

  it('gives an empty string for a missing or unreadable time, never today\'s date', () => {
    for (const value of [undefined, null, '', 'not a date', NaN]) expect(toIsoTimestamp(value as any)).toBe('');
  });
});
