import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { apiErrors, clearApiError, dismissApiErrors, reportApiError } from './apiErrors';

beforeEach(() => dismissApiErrors());

describe('apiErrors', () => {
  it('starts empty', () => {
    expect(get(apiErrors)).toEqual([]);
  });

  it('records an error with its source and message', () => {
    reportApiError('Sentiment: sentiment-trends', 'HTTP 500', 1000);

    expect(get(apiErrors)).toEqual([{ source: 'Sentiment: sentiment-trends', message: 'HTTP 500', at: 1000 }]);
  });

  it('keeps one entry per source, updated to the latest message', () => {
    reportApiError('A', 'first', 1);
    reportApiError('A', 'second', 2);

    expect(get(apiErrors)).toEqual([{ source: 'A', message: 'second', at: 2 }]);
  });

  it('clears a source once it succeeds again', () => {
    reportApiError('A', 'boom', 1);
    reportApiError('B', 'boom', 2);

    clearApiError('A');

    expect(get(apiErrors).map((e) => e.source)).toEqual(['B']);
  });

  it('clearing an unknown source does nothing', () => {
    reportApiError('A', 'boom', 1);

    clearApiError('missing');

    expect(get(apiErrors)).toHaveLength(1);
  });

  it('keeps only the five most recent sources', () => {
    ['A', 'B', 'C', 'D', 'E', 'F'].forEach((source, i) => reportApiError(source, 'x', i));

    expect(get(apiErrors).map((e) => e.source)).toEqual(['B', 'C', 'D', 'E', 'F']);
  });

  it('dismissing removes everything', () => {
    reportApiError('A', 'boom', 1);

    dismissApiErrors();

    expect(get(apiErrors)).toEqual([]);
  });
});
