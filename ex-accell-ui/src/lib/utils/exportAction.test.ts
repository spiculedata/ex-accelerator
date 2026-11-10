import { describe, expect, it, vi } from 'vitest';
import { runExport, type ExportState } from './exportAction';

const track = () => {
  const seen: ExportState[] = [];
  return { seen, set: (state: ExportState) => seen.push(state) };
};

describe('runExport', () => {
  it('says it is working, then how many rows were downloaded', async () => {
    const { seen, set } = track();
    await runExport(async () => ({ rows: 138 }), set);
    expect(seen.map((s) => s.kind)).toEqual(['working', 'done']);
    expect(seen[1].message).toBe('Downloaded 138 rows.');
  });

  it('uses the singular for one row and says plainly when there is nothing to export', async () => {
    const one = track();
    await runExport(async () => ({ rows: 1 }), one.set);
    expect(one.seen[1].message).toBe('Downloaded 1 row.');
    const none = track();
    await runExport(async () => ({ rows: 0 }), none.set);
    expect(none.seen[1]).toEqual({ kind: 'error', message: 'There is nothing to export for the current filters.' });
  });

  it('reports a failure in words, never the raw error, and logs the cause', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { seen, set } = track();
    await runExport(async () => { throw new Error('ECONNREFUSED 10.0.0.1'); }, set);
    expect(seen[1]).toEqual({ kind: 'error', message: 'The export could not be created. Try again in a moment.' });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('says when the export was cut at its limit', async () => {
    const { seen, set } = track();
    await runExport(async () => ({ rows: 10000, capped: true }), set);
    expect(seen[1].message).toContain('the most one export holds');
  });
});
