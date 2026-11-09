import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyRangeToParams, readRange, STORAGE_KEY } from './filterRange';

const memory = (initial: Record<string, string> = {}) => {
  const data = { ...initial };
  return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v), removeItem: (k: string) => void delete data[k], data };
};

describe('readRange', () => {
  it('prefers the URL over what was remembered', () => {
    const store = memory({ [STORAGE_KEY]: JSON.stringify({ dateStart: '2026-01-01', dateEnd: '2026-01-31' }) });
    const range = readRange(new URLSearchParams('date_start=2026-02-01&date_end=2026-02-28'), store);
    expect(range).toEqual({ dateStart: '2026-02-01', dateEnd: '2026-02-28' });
  });

  it('falls back to the remembered range when the URL has none', () => {
    const store = memory({ [STORAGE_KEY]: JSON.stringify({ dateStart: '2026-01-01', dateEnd: '2026-01-31' }) });
    expect(readRange(new URLSearchParams(''), store)).toEqual({ dateStart: '2026-01-01', dateEnd: '2026-01-31' });
  });

  it('ignores values that are not real calendar days or are back to front', () => {
    expect(readRange(new URLSearchParams('date_start=2026-02-30&date_end=nope'), memory())).toEqual({ dateStart: '', dateEnd: '' });
    expect(readRange(new URLSearchParams('date_start=2026-03-10&date_end=2026-03-01'), memory())).toEqual({ dateStart: '', dateEnd: '' });
  });

  it('survives corrupt or unavailable storage', () => {
    expect(readRange(new URLSearchParams(''), memory({ [STORAGE_KEY]: '{oops' }))).toEqual({ dateStart: '', dateEnd: '' });
    expect(readRange(new URLSearchParams(''), null)).toEqual({ dateStart: '', dateEnd: '' });
  });
});

describe('applyRangeToParams', () => {
  it('sets both bounds and keeps unrelated parameters', () => {
    const next = applyRangeToParams(new URLSearchParams('workspace=3'), { dateStart: '2026-01-01', dateEnd: '2026-01-31' });
    expect(next.toString()).toBe('workspace=3&date_start=2026-01-01&date_end=2026-01-31');
  });

  it('removes the bounds when the range is cleared, without mutating its input', () => {
    const input = new URLSearchParams('workspace=3&date_start=2026-01-01&date_end=2026-01-31');
    const next = applyRangeToParams(input, { dateStart: '', dateEnd: '' });
    expect(next.toString()).toBe('workspace=3');
    expect(input.get('date_start')).toBe('2026-01-01');
  });
});

describe('rangeQuery', () => {
  it('lists only the bounds that are set', async () => {
    const { rangeQuery } = await import('./filterRange');
    expect(rangeQuery({ dateStart: '2026-01-01', dateEnd: '' })).toEqual({ date_start: '2026-01-01' });
    expect(rangeQuery({ dateStart: '', dateEnd: '' })).toEqual({});
  });
});

describe('currentRangeQuery', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the range from the page URL', async () => {
    vi.stubGlobal('window', { location: { search: '?workspace=3&date_start=2026-11-01&date_end=2026-11-07' }, sessionStorage: memory() });
    const { currentRangeQuery } = await import('./filterRange');
    expect(currentRangeQuery()).toEqual({ date_start: '2026-11-01', date_end: '2026-11-07' });
  });

  it('is empty outside a browser', async () => {
    const { currentRangeQuery } = await import('./filterRange');
    expect(currentRangeQuery()).toEqual({});
  });
});
