import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// Signal (amber, yellow, orange) is a fill colour: as text it is 1.9:1 at 400, 2.4:1 at 500 and 3.6:1 at 600 on white,
// below the 4.5:1 AA asks. Text uses signal-700 (5.4:1) or darker. The dark investigation workbench and the dark log
// viewer are the exceptions, because these tones read well on a dark surface.
// Variant-prefixed forms (md:, hover:, group-hover:) are caught too; only dark: is allowed, since it applies on dark surfaces
const PALE_SIGNAL_TEXT = /(?<![\w-])(?!dark:)(?:[a-z-]+:)*text-(amber|yellow|orange)-(400|500|600)\b/;
const DARK_SURFACES = ['investigations/[id]/+page.svelte', 'TopicsPortal.svelte'];

function svelteFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return svelteFiles(path);
    return path.endsWith('.svelte') ? [path] : [];
  });
}

describe('signal-coloured text', () => {
  it('is dark enough to read on a light background', () => {
    const offenders = svelteFiles('src')
      .map((path) => path.split(sep).join('/'))
      .filter((path) => !DARK_SURFACES.some((dark) => path.endsWith(dark)))
      .flatMap((path) =>
        readFileSync(path, 'utf8').split('\n').flatMap((line, i) => (PALE_SIGNAL_TEXT.test(line) && !/text-red-400/.test(line) ? [`${path}:${i + 1}`] : []))
      );
    expect(offenders).toEqual([]);
  });
});
