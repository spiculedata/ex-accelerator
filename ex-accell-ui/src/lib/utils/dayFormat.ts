/**
 * Formats a day for display. A date-only value such as "2026-08-01" is a calendar day, not an instant: it
 * parses as midnight UTC, so formatting it in the viewer's zone would show the previous day west of UTC.
 * It is shown as the day that was entered. A full timestamp is an instant and is shown in the viewer's zone.
 */
export function formatDay(value: string | undefined, options: { year?: boolean } = {}): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(options.year ? { year: 'numeric' } : {}),
    ...(dateOnly ? { timeZone: 'UTC' } : {})
  });
}
