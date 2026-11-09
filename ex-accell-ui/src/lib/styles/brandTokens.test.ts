import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getSentimentColor } from '$lib/utils/colorUtils';
import { brandChartTheme } from '$lib/utils/echarts';

// The tokens file is the source of truth. Code that needs a literal hex (canvas charts) must match it.
const css = readFileSync(join(__dirname, 'brand-tokens.css'), 'utf8');
const token = (name: string) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];

describe('brand tokens and code stay in step', () => {
  it.each([
    ['very positive', 'se-sentiment-very-positive'],
    ['positive', 'se-sentiment-positive'],
    ['neutral', 'se-sentiment-neutral'],
    ['negative', 'se-sentiment-negative'],
    ['very negative', 'se-sentiment-very-negative']
  ])('getSentimentColor("%s") matches --%s', (level, name) => {
    expect(token(name)).toBeDefined();
    expect(getSentimentColor(level)).toBe(token(name));
  });

  it('the chart theme series order matches --se-cat-1 to --se-cat-8', () => {
    const fromCss = Array.from({ length: 8 }, (_, i) => token(`se-cat-${i + 1}`));
    expect(brandChartTheme.color).toEqual(fromCss);
  });
});
