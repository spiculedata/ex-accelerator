// Calendar days (YYYY-MM-DD): the unit investigation date ranges are written in.

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar day in YYYY-MM-DD form (rejects 2026-02-30 and timestamps). */
export function isCalendarDay(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = DAY.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
}

/** Returns a message when a range is invalid (a bad day, or a start after the end), or null when it is fine. Blank is fine. */
export function validateDayRange(start: string | undefined | null, end: string | undefined | null): string | null {
  if (start && !isCalendarDay(start)) return 'date_start must be a date (YYYY-MM-DD)';
  if (end && !isCalendarDay(end)) return 'date_end must be a date (YYYY-MM-DD)';
  if (start && end && start > end) return 'date_start must be on or before date_end';
  return null;
}
