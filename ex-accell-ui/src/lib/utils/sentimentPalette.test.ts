import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getSentimentColor } from './colorUtils';

// Sentiment is drawn from one colour-blind-safe scale (getSentimentColor). These pages once had their own
// greens, pinks and purples for the same three states, so negative was a different colour on each page.
const PAGES = [
  'src/routes/analytics-correlation/+page.svelte',
  'src/routes/radio-analytics/+page.svelte',
  'src/routes/text-analytics/engagement-analysis/+page.svelte',
  'src/routes/dashboards/+page.svelte'
];
const OLD_SENTIMENT_COLOURS = ['#06d6a0', '#f72585', '#ffd23f'];

describe('one sentiment palette', () => {
  it.each(PAGES)('%s does not carry its own sentiment colours', (path) => {
    const source = readFileSync(path, 'utf8');
    expect(source).toContain('getSentimentColor(');
    // Other charts may use these hues for non-sentiment categories; a line about sentiment may not
    const offending = source.split('\n').filter((line) => /positive|negative|neutral|sentiment/i.test(line) && OLD_SENTIMENT_COLOURS.some((colour) => line.toLowerCase().includes(colour)));
    expect(offending).toEqual([]);
  });

  it('keeps positive and negative distinguishable by hue, not by red versus green', () => {
    expect(getSentimentColor('positive')).not.toBe(getSentimentColor('negative'));
    for (const hex of ['positive', 'negative', 'neutral'].map((s) => getSentimentColor(s))) {
      expect(hex).not.toMatch(/^#(ef4444|22c55e|10b981|dc2626)$/i);
    }
  });
});
