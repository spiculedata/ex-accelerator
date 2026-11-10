import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Every page names itself the same way ("Page - Social Explorer") and describes itself for search and sharing.
const ROUTES = 'src/routes';
const SUFFIX = ' - Social Explorer';

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return pages(path);
    return name === '+page.svelte' || name === '+error.svelte' ? [path] : [];
  });
}

const sources = pages(ROUTES).map((path) => ({ path, source: readFileSync(path, 'utf8') }));

describe('page metadata', () => {
  it.each(sources.map((s) => [s.path, s.source]))('%s has a "… - Social Explorer" title', (_path, source) => {
    const title = /<title>([^<{]*)(?:\{[^}]*\})?([^<]*)<\/title>/.exec(source);
    expect(title, 'a <title>').not.toBeNull();
    expect(`${title![1]}${title![2]}`.trim().endsWith(SUFFIX.trim()) || `${title![1]}${title![2]}`.trim() === 'Social Explorer').toBe(true);
  });

  it.each(sources.filter((s) => s.path.endsWith('+page.svelte')).map((s) => [s.path, s.source]))('%s has a meta description', (_path, source) => {
    expect(source).toMatch(/<meta\s+name="description"/);
  });
});
