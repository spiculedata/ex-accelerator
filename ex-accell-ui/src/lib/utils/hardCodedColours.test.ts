import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// Pages and components take colours from the brand tokens, chartColors.ts or getSentimentColor, never from a hex value written
// into the page. None remain; this keeps it that way. Add a colour to chartColors.ts if a chart needs one the brand has.
const BASELINE = 0;
const HEX = /#[0-9a-fA-F]{6}\b/g;
const EXEMPT = [/\.test\.ts$/, /brand-tokens\.css$/, /colorUtils\.ts$/, /utils\/echarts\.ts$/, /utils\/chartColors\.ts$/, /server\/demo\//, /static\//];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(svelte|ts)$/.test(path) ? [path] : [];
  });
}

describe('hard-coded colours', () => {
  it('do not increase', () => {
    const count = sourceFiles('src')
      .map((path) => path.split(sep).join('/'))
      .filter((path) => !EXEMPT.some((pattern) => pattern.test(path)))
      .reduce((total, path) => total + (readFileSync(path, 'utf8').match(HEX)?.length ?? 0), 0);
    // Exact, so removing colours forces BASELINE down and the gain cannot be spent again later
    expect(count, `hard-coded hex colours: found ${count}, baseline ${BASELINE}. Lower BASELINE if you removed some; use tokens if you added some.`).toBe(BASELINE);
  });
});

// Sentiment is blue to orange (getSentimentColor, sentiment-* utilities), never green and red, which many people cannot tell
// apart. The one line left names a confidence figure next to a sentiment total, not a sentiment colour.
const SENTIMENT_CLASS_BASELINE = 1;
const GREEN_RED_CLASS = /(text|bg|border)-(green|red|emerald|rose)-\d+/;

describe('sentiment colours', () => {
  it('do not use green and red classes', () => {
    const lines = sourceFiles('src')
      .filter((path) => path.endsWith('.svelte'))
      .flatMap((path) => readFileSync(path, 'utf8').split('\n').filter((line) => /sentiment/i.test(line) && GREEN_RED_CLASS.test(line)));
    expect(lines.length, `lines colouring sentiment green or red: ${lines.length}, allowed ${SENTIMENT_CLASS_BASELINE}`).toBe(SENTIMENT_CLASS_BASELINE);
  });
});
