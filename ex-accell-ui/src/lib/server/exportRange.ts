// The date range and minimum confidence an export honours. posts_with_sentiment keeps `timestamp` as epoch milliseconds.
import { validateDayRange } from '$lib/utils/calendarDay';
import { dateBoundToEpochMs } from './dateBounds';

export type ExportRange = { ok: true; conditions: string[]; params: number[] } | { ok: false; error: string };

export function exportRangeConditions(search: URLSearchParams, firstParam: number): ExportRange {
  const start = search.get('date_start') || '';
  const end = search.get('date_end') || '';
  const problem = validateDayRange(start, end);
  if (problem) return { ok: false, error: problem };

  const conditions: string[] = [];
  const params: number[] = [];
  const add = (condition: string, value: number) => {
    params.push(value);
    conditions.push(`${condition} $${firstParam + params.length - 1}`);
  };
  const startMs = start ? dateBoundToEpochMs(start, 'start') : null;
  const endMs = end ? dateBoundToEpochMs(end, 'end') : null;
  if (startMs !== null) add('timestamp >=', startMs);
  if (endMs !== null) add('timestamp <=', endMs);
  const confidence = parseFloat(search.get('minConfidence') || '');
  if (Number.isFinite(confidence)) add('confidence_score >=', confidence);
  return { ok: true, conditions, params };
}
