import { describe, expect, it } from 'vitest';
import { formatGdeltDate, formatPostDate, goldsteinColor, sentimentDotColor, toneBarWidth } from './investigationFormat';

describe('formatGdeltDate', () => {
  it('formats yyyymmdd as month and day, and leaves other shapes alone', () => {
    expect(formatGdeltDate('20260105')).toBe('Jan 5');
    expect(formatGdeltDate(20261231)).toBe('Dec 31');
    expect(formatGdeltDate('2026-01-05')).toBe('2026-01-05');
  });
});

describe('formatPostDate', () => {
  it('reads epoch milliseconds, epoch seconds, ISO text and numeric text', () => {
    expect(formatPostDate(1767434400000)).toBe('Jan 3');
    expect(formatPostDate(1767434400)).toBe('Jan 3');
    expect(formatPostDate('2026-01-03T10:00:00Z')).toBe('Jan 3');
    expect(formatPostDate('1767434400000')).toBe('Jan 3');
  });

  it('gives nothing for missing, tiny or unreadable values', () => {
    expect(formatPostDate(undefined)).toBe('');
    expect(formatPostDate('')).toBe('');
    expect(formatPostDate(5)).toBe('');
    expect(formatPostDate('not a date')).toBe('');
  });
});

describe('goldsteinColor', () => {
  it.each([
    [6, 'bg-emerald-600/80 text-emerald-100'],
    [5, 'bg-emerald-600/80 text-emerald-100'],
    [2, 'bg-emerald-700/60 text-emerald-200'],
    [0.5, 'bg-emerald-800/40 text-emerald-300'],
    [0, 'bg-slate-700/50 text-slate-300'],
    [-0.5, 'bg-rose-800/40 text-rose-300'],
    [-2, 'bg-rose-700/60 text-rose-200'],
    [-5, 'bg-rose-600/80 text-rose-100']
  ])('colours %d as %s', (value, classes) => {
    expect(goldsteinColor(value)).toBe(classes);
  });
});

describe('toneBarWidth', () => {
  it.each([
    [-10, 0],
    [0, 50],
    [10, 100],
    [-20, 0],
    [30, 100]
  ])('maps tone %d to %d percent', (tone, width) => {
    expect(toneBarWidth(tone)).toBe(width);
  });
});

describe('sentimentDotColor', () => {
  it('maps positive and negative, in any case, and everything else to neutral', () => {
    expect(sentimentDotColor('Positive')).toBe('bg-sentiment-positive');
    expect(sentimentDotColor('negative')).toBe('bg-sentiment-negative');
    expect(sentimentDotColor('mixed')).toBe('bg-sentiment-neutral');
    expect(sentimentDotColor(undefined)).toBe('bg-sentiment-neutral');
  });
});
