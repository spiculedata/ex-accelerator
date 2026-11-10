import { describe, expect, it } from 'vitest';
import { exportRangeConditions } from './exportRange';

const params = (q: string) => new URLSearchParams(q);

describe('exportRangeConditions', () => {
  it('adds nothing when no range or confidence is asked for', () => {
    expect(exportRangeConditions(params(''), 3)).toEqual({ ok: true, conditions: [], params: [] });
  });

  it('turns a day range into inclusive epoch-millisecond bounds, numbered from the first free parameter', () => {
    const r = exportRangeConditions(params('date_start=2026-11-01&date_end=2026-11-02'), 3);
    expect(r).toEqual({
      ok: true,
      conditions: ['timestamp >= $3', 'timestamp <= $4'],
      params: [Date.UTC(2026, 10, 1), Date.UTC(2026, 10, 3) - 1]
    });
  });

  it('adds a minimum confidence', () => {
    const r = exportRangeConditions(params('minConfidence=0.8'), 1);
    expect(r).toEqual({ ok: true, conditions: ['confidence_score >= $1'], params: [0.8] });
  });

  it('rejects a bad or reversed range', () => {
    expect(exportRangeConditions(params('date_start=2026-02-30'), 1)).toMatchObject({ ok: false });
    expect(exportRangeConditions(params('date_start=2026-11-05&date_end=2026-11-01'), 1)).toMatchObject({ ok: false });
  });
});
