import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// New code takes colours from the brand tokens or getSentimentColor, not hex values written into a page. About this many
// hard-coded hex colours remain in pages and components (chart series, canvas and portals); the count may only go down.
// When you remove some, lower BASELINE to the new count so the gain is kept (the test is exact, so it tells you).
const BASELINE = 372;
const HEX = /#[0-9a-fA-F]{6}\b/g;
const EXEMPT = [/\.test\.ts$/, /brand-tokens\.css$/, /colorUtils\.ts$/, /utils\/echarts\.ts$/, /static\//];

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
