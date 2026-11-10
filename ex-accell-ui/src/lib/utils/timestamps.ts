// Post times come from the database as epoch milliseconds (a bigint, which arrives as a numeric string) or as ISO text.

const EPOCH_MS = /^\d{12,}$/;

/** An ISO 8601 UTC string, or '' when the value is missing or unreadable (so the page shows a dash, not today's date). */
export function toIsoTimestamp(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const input = typeof value === 'string' && EPOCH_MS.test(value.trim()) ? Number(value) : value;
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}
