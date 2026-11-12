import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// Ratchets: exact baselines that can only fall (see hardCodedColours.test.ts). When you remove an `any`, a console call or
// shrink a big file, this test fails until you lower the number here, so the gain cannot be spent again later.

const ANY_BASELINE = 851;
const CONSOLE_BASELINE = 275;
const MAX_FILE_LINES = 800;
// Files over MAX_FILE_LINES, with their current line count. A file may only shrink (lower its number) and leaves this list
// once it is at or under the limit. A file that is not listed must never cross the limit. See issue #47.
const OVERSIZED_FILES: Record<string, number> = {
  'src/lib/components/Navigation.svelte': 818,
  'src/routes/api/unified-analytics/+server.ts': 2088,
  'src/routes/data-capture/+page.svelte': 3776,
  'src/routes/data-management/+page.svelte': 924,
  'src/routes/gdelt/+page.svelte': 2235,
  'src/routes/investigations/[id]/+page.svelte': 1403
};

const SOURCE = /\.(svelte|ts|js)$/;
const TEST_FILE = /\.(test|spec)\.(ts|js)$/;
const LOGGER = 'src/lib/utils/logger.ts';
const ANY = /:\s*any\b|\bas\s+any\b|<any\b|,\s*any\b|[|&]\s*any\b|\bany\s*[|&\[]/g;
const CONSOLE = /\bconsole\.\w+/g;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const files = walk('src')
  .map((path) => path.split(sep).join('/'))
  .filter((path) => SOURCE.test(path) && !TEST_FILE.test(path))
  .map((path) => ({ path, text: readFileSync(path, 'utf8') }));

const countMatches = (pattern: RegExp, skip: string[] = []) =>
  files.filter((file) => !skip.includes(file.path)).reduce((total, file) => total + (file.text.match(pattern)?.length ?? 0), 0);

// Same as `wc -l`, plus one when the last line has no newline
const lineCount = (text: string) => (text.match(/\n/g)?.length ?? 0) + (text.endsWith('\n') || text === '' ? 0 : 1);

describe('any ratchet', () => {
  it('does not change except downwards', () => {
    const count = countMatches(ANY);
    expect(count, `\`: any\`, \`as any\` and \`<any>\` in src (non-test): found ${count}, baseline ${ANY_BASELINE}. Lower ANY_BASELINE if you removed some; use a real type or unknown if you added some.`).toBe(ANY_BASELINE);
  });
});

describe('console ratchet', () => {
  it('does not change except downwards', () => {
    const count = countMatches(CONSOLE, [LOGGER]);
    expect(count, `console.* calls in src (non-test, excluding the logger): found ${count}, baseline ${CONSOLE_BASELINE}. Lower CONSOLE_BASELINE if you removed some; use createLogger from $lib/utils/logger if you added some.`).toBe(CONSOLE_BASELINE);
  });
});

describe('file size ratchet', () => {
  const sizes = Object.fromEntries(files.map((file) => [file.path, lineCount(file.text)]));

  it('lists no file that is not over the limit', () => {
    const stale = Object.keys(OVERSIZED_FILES).filter((path) => (sizes[path] ?? 0) <= MAX_FILE_LINES);
    expect(stale, `at or under ${MAX_FILE_LINES} lines (or gone): remove these from OVERSIZED_FILES`).toEqual([]);
  });

  it('has no unlisted file over the limit', () => {
    const unlisted = Object.entries(sizes).filter(([path, lines]) => lines > MAX_FILE_LINES && !(path in OVERSIZED_FILES));
    expect(unlisted, `files over ${MAX_FILE_LINES} lines that are not in OVERSIZED_FILES: split them, do not add them`).toEqual([]);
  });

  it('lets listed files only shrink, and keeps the recorded size exact', () => {
    const wrong = Object.entries(OVERSIZED_FILES)
      .filter(([path, recorded]) => sizes[path] !== undefined && sizes[path] !== recorded)
      .map(([path, recorded]) => `${path}: ${sizes[path]} lines, recorded ${recorded}${sizes[path] > recorded ? ' (grew: split it instead)' : ' (shrank: lower the number in OVERSIZED_FILES)'}`);
    expect(wrong).toEqual([]);
  });
});
