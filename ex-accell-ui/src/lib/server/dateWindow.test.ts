import { describe, expect, it } from 'vitest';
import { parseDateWindow, windowConditions } from './dateWindow';

const parse = (query: string) => parseDateWindow(new URLSearchParams(query));

describe('parseDateWindow', () => {
  it('is empty when no dates are given', () => {
    expect(parse('')).toEqual({ ok: true, window: { start: null, end: null } });
  });

  it('turns whole calendar days into inclusive UTC bounds', () => {
    expect(parse('date_start=2026-11-01&date_end=2026-11-03')).toEqual({
      ok: true,
      window: { start: '2026-11-01T00:00:00.000Z', end: '2026-11-03T23:59:59.999Z' }
    });
  });

  it('rejects a bad date or a start after the end', () => {
    expect(parse('date_start=2026-02-30')).toMatchObject({ ok: false });
    expect(parse('date_start=2026-11-05&date_end=2026-11-01')).toMatchObject({ ok: false });
  });
});

describe('windowConditions', () => {
  it('numbers parameters from the first free slot and only for bounds that exist', () => {
    const both = windowConditions('p.created_at', { start: 'S', end: 'E' }, 2);
    expect(both.conditions).toEqual(['p.created_at >= $2', 'p.created_at <= $3']);
    expect(both.params).toEqual(['S', 'E']);
    expect(windowConditions('p.created_at', { start: null, end: 'E' }, 1)).toEqual({ conditions: ['p.created_at <= $1'], params: ['E'] });
    expect(windowConditions('p.created_at', { start: null, end: null }, 1)).toEqual({ conditions: [], params: [] });
  });
});
