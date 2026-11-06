import { describe, it, expect } from 'vitest';
import { escapeHtml, highlightKeywords } from './highlight';

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;'
    );
  });
});

describe('highlightKeywords', () => {
  it('wraps matching keywords in <mark>, case-insensitively', () => {
    const html = highlightKeywords('The Election result', ['election']);

    expect(html).toContain('<mark');
    expect(html).toContain('>Election</mark>');
  });

  it('returns escaped text when there are no keywords', () => {
    expect(highlightKeywords('<b>hi</b>', [])).toBe('&lt;b&gt;hi&lt;/b&gt;');
  });

  it('does not let transcript markup through (script tag)', () => {
    const html = highlightKeywords('<script>alert(1)</script> vote', ['vote']);

    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script&gt;');
  });

  it('does not let transcript markup through (event handler attribute)', () => {
    const html = highlightKeywords('<img src=x onerror=alert(1)> vote', ['vote']);

    expect(html).not.toContain('<img');
  });

  it('cannot be tricked by a keyword that matches inside an escaped entity', () => {
    const html = highlightKeywords('a < b', ['lt']);

    expect(html).toBe('a &lt; b');
  });

  it('treats regex metacharacters in keywords literally', () => {
    expect(highlightKeywords('cost is $5 (est.)', ['(est.)'])).toContain('>(est.)</mark>');
  });

  it('ignores empty keywords', () => {
    expect(highlightKeywords('abc', ['', ''])).toBe('abc');
  });
});
