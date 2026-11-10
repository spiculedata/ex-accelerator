import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// text-gray-400 is 2.6:1 on white, below the 4.5:1 that WCAG AA asks of body text; text-gray-500 is 4.8:1.
// Dark surfaces (tooltips, the dark timeline) may keep the lighter grey because it reads well there.
const DARK_SURFACE = /bg-black|bg-gray-800|bg-slate-[89]00|bg-ink-9/;
const PLAIN_GRAY_400 = /(?<![:\w-])text-gray-400(?![\w-])/;

function svelteFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return svelteFiles(path);
    return path.endsWith('.svelte') ? [path] : [];
  });
}

describe('grey text', () => {
  it('is dark enough to read on a light background', () => {
    const offenders = svelteFiles('src')
      .filter((path) => !path.endsWith('SwimLaneTimeline.svelte'))
      .flatMap((path) =>
        readFileSync(path, 'utf8').split('\n').flatMap((line, i) => (PLAIN_GRAY_400.test(line) && !DARK_SURFACE.test(line) ? [`${path}:${i + 1}`] : []))
      );
    expect(offenders).toEqual([]);
  });
});
