import { describe, expect, it } from 'vitest';
import { gdeltDateToInputDate, inputDateToGdeltDate } from './gdeltDates';

describe('gdeltDateToInputDate', () => {
  it('formats a day', () => {
    expect(gdeltDateToInputDate(20260105)).toBe('2026-01-05');
  });

  it('adds the time to 12 and 14 digit stamps', () => {
    expect(gdeltDateToInputDate(202601050930)).toBe('2026-01-05 09:30');
    expect(gdeltDateToInputDate(20260105093015)).toBe('2026-01-05 09:30:15');
  });

  it('is empty for a missing date and keeps an unknown length as it is', () => {
    expect(gdeltDateToInputDate(0)).toBe('');
    expect(gdeltDateToInputDate(NaN)).toBe('');
    expect(gdeltDateToInputDate(2026)).toBe('2026');
  });
});

describe('inputDateToGdeltDate', () => {
  it('turns an input value into a GDELT number', () => {
    expect(inputDateToGdeltDate('2026-01-05')).toBe(20260105);
  });

  it('is 0 for an empty value', () => {
    expect(inputDateToGdeltDate('')).toBe(0);
  });

  it('round-trips with the formatter', () => {
    expect(inputDateToGdeltDate(gdeltDateToInputDate(20251231))).toBe(20251231);
  });
});
