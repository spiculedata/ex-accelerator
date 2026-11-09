// Posts store `timestamp` as epoch milliseconds (see db/migrations/0004_app_views.sql), but the
// date filters arrive as `YYYY-MM-DD` or full ISO strings. Comparing the two directly is a type
// error in Postgres, so bounds are converted here.

// Days are UTC days, matching how the date presets are built (toISOString). A custom date picked in a
// browser away from UTC is shifted by its offset; change both sides together if that ever matters.
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
// A full timestamp must carry its zone, so the result does not depend on the server's time zone
const ISO_WITH_ZONE = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isRealDay(year: number, month: number, day: number): boolean {
  // Date.UTC rolls 2026-02-30 over into March, so confirm the day survives a round trip
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
}

/**
 * Converts a date filter to epoch milliseconds. A date-only value means the whole day: the start
 * bound is midnight UTC and the end bound is the last millisecond of that day, so ranges are
 * inclusive. Returns null when the value is not a real date.
 */
export function dateBoundToEpochMs(value: string, bound: 'start' | 'end'): number | null {
  const dateOnly = DATE_ONLY.exec(value);
  if (dateOnly) {
    const [year, month, day] = dateOnly.slice(1).map(Number);
    if (!isRealDay(year, month, day)) return null;
    const start = Date.UTC(year, month - 1, day);
    return bound === 'start' ? start : start + MS_PER_DAY - 1;
  }

  const timestamp = ISO_WITH_ZONE.exec(value);
  if (!timestamp || !isRealDay(Number(timestamp[1]), Number(timestamp[2]), Number(timestamp[3]))) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}
