import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// The Tailwind remap sends blue, sky, cyan, teal, indigo, violet, purple, fuchsia and pink to one ramp (primary), so a
// badge that picks one of those names per category can no longer tell categories apart. Category colours come from
// categoryColours.ts (the --se-cat-* tokens). This fails if a switch or map starts handing out those names again.
const PRIMARY_FAMILIES = 'blue|sky|cyan|teal|indigo|violet|purple|fuchsia|pink';
const CASE_RETURNS_HUE = new RegExp(`case '[^']+':\\s*return '[^']*(?:bg|text|border)-(?:${PRIMARY_FAMILIES})-\\d+`);
const MAP_ENTRY_HUE = new RegExp(`^\\s*'?[a-z_]+'?:\\s*(?:\\{[^}]*)?'(?:bg|text|border)-(?:${PRIMARY_FAMILIES})-\\d+`);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(svelte|ts)$/.test(path) && !/\.test\.ts$/.test(path) ? [path.split(sep).join('/')] : [];
  });
}

describe('category colours', () => {
  it('recognise the patterns they guard against', () => {
    expect("      case 'social': return 'bg-blue-100 text-blue-800';").toMatch(CASE_RETURNS_HUE);
    expect("    radio: { bg: 'bg-purple-50', text: 'text-purple-700' },").toMatch(MAP_ENTRY_HUE);
    expect("      case 'error': return 'bg-red-100 text-red-800';").not.toMatch(CASE_RETURNS_HUE);
  });

  it('are not built from a Tailwind hue name per category', () => {
    const offenders = sourceFiles('src').flatMap((path) =>
      readFileSync(path, 'utf8')
        .split('\n')
        .flatMap((line, i) => (CASE_RETURNS_HUE.test(line) || MAP_ENTRY_HUE.test(line) ? [`${path}:${i + 1}`] : []))
    );
    expect(offenders).toEqual([]);
  });
});
