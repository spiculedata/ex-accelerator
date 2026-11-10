// The date range of the analysis filter bar, as SQL conditions over a timestamp column. Days are whole UTC days,
// matching how the bar builds its presets.
import { validateDayRange } from '$lib/utils/calendarDay';
import { dateBoundToEpochMs } from './dateBounds';

/** `start` is inclusive and `end` is exclusive: the first instant after the last chosen day. */
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
  const startMs = start ? dateBoundToEpochMs(start, 'start') : null;
  // The end of a day is its last millisecond; +1 makes the bound exclusive so rows within that millisecond are kept
  const endMs = end ? dateBoundToEpochMs(end, 'end') : null;
  return {
    ok: true,
    window: { start: startMs === null ? null : new Date(startMs).toISOString(), end: endMs === null ? null : new Date(endMs + 1).toISOString() }
  };
}

/** Conditions and their parameters; `firstParam` is the number of the first free `$n` slot. */
export function windowConditions(column: string, window: DateWindow, firstParam: number): { conditions: string[]; params: string[] } {
  const conditions: string[] = [];
  const params: string[] = [];
  if (window.start) { params.push(window.start); conditions.push(`${column} >= $${firstParam + params.length - 1}`); }
  if (window.end) { params.push(window.end); conditions.push(`${column} < $${firstParam + params.length - 1}`); }
  return { conditions, params };
}
