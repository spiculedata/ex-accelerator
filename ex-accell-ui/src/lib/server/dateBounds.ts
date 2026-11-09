// Posts store `timestamp` as epoch milliseconds (see db/migrations/0004_app_views.sql), but the
// date filters arrive as `YYYY-MM-DD` or full ISO strings. Comparing the two directly is a type
// error in Postgres, so bounds are converted here.

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Converts a date filter to epoch milliseconds. A date-only value means the whole day: the start
 * bound is midnight UTC and the end bound is the last millisecond of that day, so ranges are
 * inclusive. Returns null when the value is not a real date.
 */
export function dateBoundToEpochMs(value: string, bound: 'start' | 'end'): number | null {
  const dateOnly = DATE_ONLY.exec(value);
  if (dateOnly) {
    const [year, month, day] = dateOnly.slice(1).map(Number);
    const start = Date.UTC(year, month - 1, day);
    // Date.UTC rolls 2026-13-45 over into a valid date, so confirm it round-trips
    const check = new Date(start);
    if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
    return bound === 'start' ? start : start + 24 * 60 * 60 * 1000 - 1;
  }

  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}
