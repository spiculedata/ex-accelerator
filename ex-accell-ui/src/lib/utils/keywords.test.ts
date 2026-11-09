import { describe, it, expect } from 'vitest';
import { commitKeywords } from './keywords';

describe('commitKeywords', () => {
  it('adds the text still in the field to the keywords, so nothing typed is lost', () => {
    expect(commitKeywords(['tram'], 'delays')).toEqual(['tram', 'delays']);
  });

  it('splits on commas, trims, and skips blanks and duplicates', () => {
    expect(commitKeywords(['tram'], ' delays , tram,, strike ')).toEqual(['tram', 'delays', 'strike']);
  });

  it('returns the keywords unchanged when the field is empty', () => {
    expect(commitKeywords(['tram'], '   ')).toEqual(['tram']);
  });

  it('does not change the original list', () => {
    const existing = ['tram'];
    commitKeywords(existing, 'delays');

    expect(existing).toEqual(['tram']);
  });
});
