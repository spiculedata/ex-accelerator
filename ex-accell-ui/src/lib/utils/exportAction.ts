// Running an export so the visitor always sees what happened: working, how much was downloaded, or why not.
import { CSV_BOM } from './evidenceExport';

export interface ExportState {
  kind: 'idle' | 'working' | 'done' | 'error';
  message: string;
}

export const IDLE_EXPORT: ExportState = { kind: 'idle', message: '' };

export async function runExport(work: () => Promise<{ rows: number; capped?: boolean }>, set: (state: ExportState) => void): Promise<void> {
  set({ kind: 'working', message: 'Preparing the export…' });
  try {
    const { rows, capped } = await work();
    if (rows === 0) set({ kind: 'error', message: 'There is nothing to export for the current filters.' });
    else set({ kind: 'done', message: `Downloaded ${rows} row${rows === 1 ? '' : 's'}.${capped ? ' That is the most one export holds; narrow the filters to export the rest.' : ''}` });
  } catch (error) {
    console.error('Export failed:', error);
    set({ kind: 'error', message: 'The export could not be created. Try again in a moment.' });
  }
}

/** Saves CSV text as a file (with the byte order mark Excel needs for non-English text). */
export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([CSV_BOM + csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
