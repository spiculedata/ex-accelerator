import { describe, expect, it } from 'vitest';
import { BodyTooLargeError, readJsonLimited } from './requestBody';

const post = (body: string, headers: Record<string, string> = {}) => new Request('http://localhost/x', { method: 'POST', body, headers });

describe('readJsonLimited', () => {
  it('parses a body under the limit', async () => {
    expect(await readJsonLimited(post('{"a":1}'), 100)).toEqual({ a: 1 });
  });

  it('refuses a body over the limit, whether declared or not', async () => {
    await expect(readJsonLimited(post('x'.repeat(200), { 'content-length': '200' }), 100)).rejects.toBeInstanceOf(BodyTooLargeError);
    // A client may omit or understate the length; the text itself is measured too
    await expect(readJsonLimited(post(JSON.stringify({ big: 'x'.repeat(200) }), { 'content-length': '5' }), 100)).rejects.toBeInstanceOf(BodyTooLargeError);
  });

  it('measures bytes, not characters', async () => {
    await expect(readJsonLimited(post(JSON.stringify({ s: '€'.repeat(40) })), 100)).rejects.toBeInstanceOf(BodyTooLargeError);
  });

  it('still reports bad JSON as a syntax error, so callers can answer 400', async () => {
    await expect(readJsonLimited(post('{nope'), 100)).rejects.toBeInstanceOf(SyntaxError);
  });
});
