import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// A menu item is named after the page it opens, so people recognise where they landed.
const nav = readFileSync('src/lib/components/Navigation.svelte', 'utf8');
const items = [...nav.matchAll(/\{ name: '([^']+)', href: '(\/[^']*)'/g)].map((m) => ({ name: m[1], href: m[2] }));

function titleOf(href: string): string | null {
  const file = `src/routes${href === '/' ? '' : href}/+page.svelte`;
  if (!existsSync(file)) return null;
  const match = /<title>([^<]*?)(?: - Social Explorer)?<\/title>/.exec(readFileSync(file, 'utf8'));
  return match ? match[1].trim() : null;
}

describe('navigation labels', () => {
  it('finds the menu items', () => expect(items.length).toBeGreaterThan(15));

  it.each(items.filter((i) => i.href !== '/' && i.name !== 'Research' && i.name !== 'Investigations'))('$name opens a page titled the same', ({ name, href }) => {
    const title = titleOf(href);
    expect(title).not.toBeNull();
    // Section pages add their section ("Engagement Analysis - Text Analytics"); the page name leads the title
    expect(title === name || title!.startsWith(`${name} - `)).toBe(true);
  });
});
