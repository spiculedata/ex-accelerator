import { describe, expect, it } from 'vitest';
import { preloadFont } from './fontPreload';

describe('preloadFont', () => {
  it('preloads only the upright Latin body font, which every page needs for its first paint', () => {
    expect(preloadFont({ type: 'font', path: '/_app/immutable/assets/atkinson-hyperlegible-next-latin-wght-normal.abc123.woff2' })).toBe(true);
  });

  it('leaves the other font files to load when they are used', () => {
    for (const path of [
      '/_app/immutable/assets/atkinson-hyperlegible-next-latin-ext-wght-normal.abc123.woff2',
      '/_app/immutable/assets/atkinson-hyperlegible-next-latin-wght-italic.abc123.woff2',
      '/_app/immutable/assets/newsreader-latin-opsz-normal.abc123.woff2',
      '/_app/immutable/assets/jetbrains-mono-latin-wght-normal.abc123.woff2'
    ]) expect(preloadFont({ type: 'font', path })).toBe(false);
  });

  it('does not change what is preloaded for scripts, styles and images', () => {
    expect(preloadFont({ type: 'js', path: '/_app/immutable/entry/start.js' })).toBe(true);
    expect(preloadFont({ type: 'css', path: '/_app/immutable/assets/0.css' })).toBe(true);
    expect(preloadFont({ type: 'asset', path: '/_app/immutable/assets/logo.png' })).toBe(false);
  });
});
