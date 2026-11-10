import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CATEGORICAL, CHART } from './chartColors';
import { getSentimentColor } from './colorUtils';
import { brandChartTheme } from './echarts';
import { parseBrandTokens } from './oklch';

// brand-tokens.css is the single source of the brand colours. Everything that holds a copy as hex (chartColors.ts,
// the ECharts theme, the docs palette and the swatch tables in the brand guide) is checked against it here, so a
// token can change without a copy quietly drifting. Regenerate the docs palette with `npm run brand:palette`.
const tokens = parseBrandTokens(readFileSync('src/lib/styles/brand-tokens.css', 'utf8'));
const RAMPS = ['ink', 'primary', 'signal', 'success', 'danger'];
const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
const HEX = /#[0-9a-f]{6}\b/gi;

const allTokenHexes = new Set([...Object.values(tokens.ramps).flatMap((ramp) => Object.values(ramp)), ...Object.values(tokens.named)]);

describe('brand tokens', () => {
  it('define five ramps of eleven steps and the sentiment and categorical colours', () => {
    expect(Object.keys(tokens.ramps).sort()).toEqual([...RAMPS].sort());
    for (const ramp of RAMPS) expect(Object.keys(tokens.ramps[ramp])).toEqual(STEPS);
    expect(Object.keys(tokens.named)).toEqual([
      'sentiment-very-positive', 'sentiment-positive', 'sentiment-neutral', 'sentiment-negative', 'sentiment-very-negative',
      'cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5', 'cat-6', 'cat-7', 'cat-8'
    ]);
  });
});

describe('the docs palette', () => {
  it('is the tokens converted to hex (run npm run brand:palette after changing a token)', () => {
    const palette = JSON.parse(readFileSync('../docs-site/.vitepress/theme/palette.json', 'utf8'));
    expect(palette).toEqual(tokens.ramps);
  });

  it('matches the swatch tables in docs-site/brand/colour.md', () => {
    const sections = readFileSync('../docs-site/brand/colour.md', 'utf8').split(/^### /m);
    const headings: Record<string, string> = { Ink: 'ink', 'Primary: Tidewater': 'primary', Signal: 'signal', Success: 'success', Danger: 'danger' };
    for (const [heading, ramp] of Object.entries(headings)) {
      const section = sections.find((s) => s.startsWith(heading));
      expect(section, `section ${heading}`).toBeDefined();
      const hexRow = section!.split('\n').find((line) => line.startsWith('| Hex |'));
      expect(hexRow?.match(HEX), `hex row of ${heading}`).toEqual(Object.values(tokens.ramps[ramp]));
    }
  });

  it('matches the sentiment and categorical hexes in docs-site/brand/data-visualisation.md', () => {
    const doc = readFileSync('../docs-site/brand/data-visualisation.md', 'utf8').toLowerCase();
    for (const [name, hex] of Object.entries(tokens.named)) expect(doc, name).toContain(hex);
  });
});

describe('chart colours', () => {
  it('CHART ramp steps equal the tokens', () => {
    const steps = Object.entries(CHART).filter(([key]) => /^(ink|primary|signal|success|danger)\d+$/.test(key));
    expect(steps.length).toBeGreaterThan(10);
    for (const [key, hex] of steps) {
      const [, ramp, step] = key.match(/^([a-z]+)(\d+)$/)!;
      expect(hex, key).toBe(tokens.ramps[ramp][step]);
    }
  });

  it('CATEGORICAL is --se-cat-1 to --se-cat-8 in order', () => {
    expect([...CATEGORICAL]).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map((i) => tokens.named[`cat-${i}`]));
  });

  it('getSentimentColor equals the sentiment tokens', () => {
    for (const level of ['very positive', 'positive', 'neutral', 'negative', 'very negative']) {
      expect(getSentimentColor(level)).toBe(tokens.named[`sentiment-${level.replace(' ', '-')}`]);
    }
  });

  it('the ECharts theme only uses token colours', () => {
    const used = JSON.stringify(brandChartTheme).match(HEX) ?? [];
    expect(used.length).toBeGreaterThan(8);
    for (const hex of used) expect(allTokenHexes.has(hex.toLowerCase()), hex).toBe(true);
  });
});
