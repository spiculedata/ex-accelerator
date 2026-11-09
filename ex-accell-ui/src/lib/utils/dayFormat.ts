/**
 * Formats a calendar day such as "2026-08-01" as "Aug 1". Date-only strings are midnight UTC when parsed,
 * so formatting them in the viewer's time zone shows the previous day west of UTC. Days are shown in UTC
 * so the date on screen is the date that was entered.
 */
export function formatDay(value: string | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
