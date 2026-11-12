import { describe, it, expect } from 'vitest';
import { apiFail, apiOk, apiServerError, readJsonObject } from './apiResponse';

const post = (body: string) => new Request('http://localhost/x', { method: 'POST', body });

describe('apiOk', () => {
  it('wraps the payload in the envelope and keeps legacy keys beside it', async () => {
    const response = apiOk([1, 2], { items: [1, 2], count: 2 });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, items: [1, 2], count: 2, data: [1, 2] });
  });
});

describe('apiFail', () => {
  it('returns success false, null data and the message at the given status', async () => {
    const response = apiFail('Not found', 404);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ success: false, data: null, error: 'Not found' });
  });
});

describe('apiServerError', () => {
  it('returns a generic 500 and never the error detail', async () => {
    const response = apiServerError('thing', new Error('password authentication failed'), 'Failed to do thing');

    expect(response.status).toBe(500);
    const text = JSON.stringify(await response.json());
    expect(text).toContain('Failed to do thing');
    expect(text).not.toContain('password');
  });
});

describe('readJsonObject', () => {
  it('returns the parsed object', async () => {
    expect(await readJsonObject(post('{"a":1}'), 100)).toEqual({ body: { a: 1 } });
  });

  it.each([['not json'], ['[1]'], ['null'], ['"x"']])('rejects %s with 400', async (raw) => {
    const result = await readJsonObject(post(raw), 100);

    expect('failure' in result && result.failure.status).toBe(400);
  });

  it('rejects an oversized body with 413', async () => {
    const result = await readJsonObject(post(JSON.stringify({ a: 'x'.repeat(200) })), 100);

    expect('failure' in result && result.failure.status).toBe(413);
  });
});
