import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// New code takes colours from the brand tokens or getSentimentColor, not hex values written into a page. About this many
// hard-coded hex colours remain in pages and components (chart series, canvas and portals); the count may only go down.
// When you remove some, lower BASELINE to the new count so the gain is kept.
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
      .filter((path) => !EXEMPT.some((pattern) => pattern.test(path)))
      .reduce((total, path) => total + (readFileSync(path, 'utf8').match(HEX)?.length ?? 0), 0);
    expect(count).toBeLessThanOrEqual(BASELINE);
  });
});
