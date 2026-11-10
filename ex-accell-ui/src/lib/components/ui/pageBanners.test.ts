import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// A page that opens a section uses PageHeader (docs-site/brand/components.md), not a banner of its own with a dark
// gradient and an accent of its choosing. The investigation workbench keeps its compact dark toolbar on purpose.
const ALLOWED_OWN_BANNER = ['src/routes/investigations/[id]/+page.svelte'];
// A gradient utility followed, within the same class attribute, by a mid-to-dark hue stop (not a hover: variant)
const DARK_GRADIENT_BANNER = /bg-(?:gradient|linear)-to-\w+[^"'`]*(?<![:\w-])from-[a-z]+-[6-9]\d\d\b/;

function pageFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return pageFiles(path);
    return name === '+page.svelte' ? [path.split(sep).join('/')] : [];
  });
}

describe('page banners', () => {
  it('recognises the banner it guards against', () => {
    expect('<div class="relative bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 overflow-hidden">').toMatch(DARK_GRADIENT_BANNER);
    expect('<div class="bg-gradient-to-br\n  from-blue-600 via-blue-600 to-indigo-700">').toMatch(DARK_GRADIENT_BANNER);
    expect('<div class="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl">').not.toMatch(DARK_GRADIENT_BANNER);
    expect('<button class="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700">').not.toMatch(DARK_GRADIENT_BANNER);
  });

  it('come from PageHeader, not a gradient of the page\'s own', () => {
    const offenders = pageFiles('src/routes')
      .filter((path) => !ALLOWED_OWN_BANNER.includes(path))
      .filter((path) => DARK_GRADIENT_BANNER.test(readFileSync(path, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
