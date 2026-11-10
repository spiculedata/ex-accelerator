import { describe, expect, it } from 'vitest';
import { oklchToHex, parseBrandTokens } from './oklch';

// The brand ramps are written in OKLCH (brand-tokens.css); charts, the docs palette and chartColors need them as hex.
// These are the published values from docs-site/brand/colour.md.
describe('oklchToHex', () => {
  it.each([
    [0.21, 0.03, 255, '#0f1926'], // ink 900
    [0.985, 0.004, 255, '#f8fafd'], // ink 50
    [0.551, 0.03, 255, '#667384'], // ink 500
    [0.53, 0.115, 215, '#007b95'], // primary 600
    [0.45, 0.1, 215, '#006278'], // primary 700
    [0.73, 0.16, 78, '#de9800'], // signal 500
    [0.45, 0.095, 160, '#116543'], // success 700
    [0.53, 0.2, 27, '#c51e21'] // danger 600
  ])('oklch(%s %s %s) is %s', (l, c, h, hex) => {
    expect(oklchToHex(l, c, h)).toBe(hex);
  });

  it('clamps a colour outside the sRGB gamut instead of wrapping', () => {
    expect(oklchToHex(0.9, 0.4, 140)).toMatch(/^#[0-9a-f]{6}$/);
    expect(oklchToHex(0, 0, 0)).toBe('#000000');
    expect(oklchToHex(1, 0, 0)).toBe('#ffffff');
  });
});

describe('parseBrandTokens', () => {
  const css = `
    :root {
      --se-ink-50: oklch(0.985 0.004 255);
      --se-ink-900: oklch(0.210 0.030 255);
      --se-primary-600: oklch(0.530 0.115 215);
      --se-sentiment-positive: #56b4e9;
      --se-cat-1: #0072b2;
      --se-surface: #ffffff;
      --se-bg: var(--se-ink-50);
    }
    :root[data-theme='dark'] {
      --se-ink-50: oklch(0.130 0.028 255);
      --se-bg: var(--se-ink-950);
    }`;

  it('reads the light theme only, so the dark block does not overwrite a ramp step', () => {
    expect(parseBrandTokens(css).ramps.ink[50]).toBe('#f8fafd');
  });

  it('converts each OKLCH ramp step to hex, grouped by ramp', () => {
    const { ramps } = parseBrandTokens(css);
    expect(ramps).toEqual({ ink: { 50: '#f8fafd', 900: '#0f1926' }, primary: { 600: '#007b95' } });
  });

  it('keeps the hex tokens by name and ignores role aliases', () => {
    const { named } = parseBrandTokens(css);
    expect(named).toEqual({ 'sentiment-positive': '#56b4e9', 'cat-1': '#0072b2' });
  });
});
