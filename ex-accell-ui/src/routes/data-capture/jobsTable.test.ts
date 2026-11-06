import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A large edit once deleted most of each jobs-table row while the page still compiled, so the
 * Status, Schedule, Items and Actions cells silently vanished. Guard the row structure.
 */
describe('data-capture jobs table', () => {
  const source = readFileSync(join(__dirname, '+page.svelte'), 'utf8');

  const rowStart = source.indexOf('{#each sortedJobs as job}');
  if (rowStart < 0) throw new Error('The jobs table loop was renamed or moved; update this test to find it');
  const headerStart = source.lastIndexOf('<thead', rowStart);
  const header = source.slice(headerStart, source.indexOf('</thead>', headerStart));
  const firstRow = source.slice(rowStart, source.indexOf('</tr>', rowStart));
  const count = (text: string, pattern: RegExp) => (text.match(pattern) ?? []).length;

  it('finds the table', () => {
    expect(rowStart).toBeGreaterThan(0);
    expect(headerStart).toBeGreaterThan(0);
  });

  it('has one cell per header column in each job row', () => {
    const columns = count(header, /<th\b/g);

    expect(columns).toBeGreaterThanOrEqual(5);
    expect(count(firstRow, /<td\b/g)).toBe(columns);
    expect(count(firstRow, /<\/td>/g)).toBe(columns);
  });

  it('keeps the actions for crawler jobs: run, edit, delete', () => {
    expect(firstRow).toContain('runCrawl(job.id)');
    expect(firstRow).toContain('editJob(job)');
    expect(firstRow).toContain('confirmDeleteJob(job)');
  });

  it('does not keep branches for the removed Princeton SMART job type', () => {
    expect(source).not.toContain("job.type === 'princeton-smart'");
  });
});
