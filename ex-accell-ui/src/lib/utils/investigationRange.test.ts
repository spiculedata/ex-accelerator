import { describe, it, expect } from 'vitest';
import { resolveInvestigationRange } from './investigationRange';

const NOW = new Date('2026-06-15T12:00:00Z');

describe('resolveInvestigationRange', () => {
  it('keeps a complete range as given', () => {
    expect(resolveInvestigationRange('2026-01-01', '2026-02-01', NOW)).toEqual({ start: '2026-01-01', end: '2026-02-01' });
  });

  it('defaults a blank range to the last 90 days ending today', () => {
    expect(resolveInvestigationRange('', '', NOW)).toEqual({ start: '2026-03-17', end: '2026-06-15' });
  });

  it('fills only the missing end with today', () => {
    expect(resolveInvestigationRange('2026-05-01', '', NOW)).toEqual({ start: '2026-05-01', end: '2026-06-15' });
  });

  it('fills only the missing start with 90 days before the end', () => {
    expect(resolveInvestigationRange('', '2026-06-01', NOW)).toEqual({ start: '2026-03-03', end: '2026-06-01' });
  });

  it('treats an invalid date as missing instead of throwing', () => {
    expect(resolveInvestigationRange('not-a-date', 'also-bad', NOW)).toEqual({ start: '2026-03-17', end: '2026-06-15' });
  });

  it('never returns a start after the end', () => {
    expect(resolveInvestigationRange('2026-07-01', '2026-06-01', NOW)).toEqual({ start: '2026-03-03', end: '2026-06-01' });
  });
});
