// @vitest-environment node
import { describe, expect, it } from 'vitest';
import config from '../../../svelte.config.js';

const csp = config.kit?.csp;
const directives = (csp?.directives ?? {}) as Record<string, string[] | undefined>;

describe('Content-Security-Policy', () => {
  it('is on, with nonces for the framework scripts', () => {
    expect(csp?.mode).toBe('auto');
  });

  it('only runs scripts from this site, never inline or eval', () => {
    expect(directives['script-src']).toEqual(['self']);
    expect(Object.values(directives).flat()).not.toContain('unsafe-eval');
  });

  it('blocks plugins, base tag changes, form posts elsewhere and framing by other sites', () => {
    expect(directives['object-src']).toEqual(['none']);
    expect(directives['base-uri']).toEqual(['self']);
    expect(directives['form-action']).toEqual(['self']);
    expect(directives['frame-ancestors']).toEqual(['self']);
  });

  it('only lets the page call its own server', () => {
    expect(directives['connect-src']).toEqual(['self']);
    expect(directives['default-src']).toEqual(['self']);
  });

  it('allows what the app needs: images and map tiles, fonts, embedded Jupyter, radio audio', () => {
    expect(directives['img-src']).toEqual(expect.arrayContaining(['self', 'data:', 'blob:', 'https:']));
    expect(directives['font-src']).toEqual(expect.arrayContaining(['self', 'data:']));
    expect(directives['frame-src']).toEqual(expect.arrayContaining(['self', 'http:', 'https:']));
    expect(directives['media-src']).toEqual(expect.arrayContaining(['self', 'https:']));
  });
});
