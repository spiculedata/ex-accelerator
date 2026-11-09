// The date range of the analysis filter bar, as SQL conditions over a timestamp column. Days are whole UTC days,
// matching how the bar builds its presets.
import { validateDayRange } from '$lib/utils/calendarDay';
import { dateBoundToEpochMs } from './dateBounds';

export interface DateWindow {
  start: string | null;
  end: string | null;
}

export type ParsedWindow = { ok: true; window: DateWindow } | { ok: false; error: string };

export function parseDateWindow(params: URLSearchParams): ParsedWindow {
  const start = params.get('date_start') || '';
  const end = params.get('date_end') || '';
  const problem = validateDayRange(start, end);
  if (problem) return { ok: false, error: problem };
  const bound = (value: string, which: 'start' | 'end') => {
    const ms = value ? dateBoundToEpochMs(value, which) : null;
    return ms === null ? null : new Date(ms).toISOString();
  };
  return { ok: true, window: { start: bound(start, 'start'), end: bound(end, 'end') } };
}

/** Conditions and their parameters; `firstParam` is the number of the first free `$n` slot. */
export function windowConditions(column: string, window: DateWindow, firstParam: number): { conditions: string[]; params: string[] } {
  const conditions: string[] = [];
  const params: string[] = [];
  if (window.start) { params.push(window.start); conditions.push(`${column} >= $${firstParam + params.length - 1}`); }
  if (window.end) { params.push(window.end); conditions.push(`${column} <= $${firstParam + params.length - 1}`); }
  return { conditions, params };
}
