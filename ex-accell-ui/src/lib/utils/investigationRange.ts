const DAY_MS = 86_400_000;
const DEFAULT_DAYS = 90;

const toDay = (date: Date): string => date.toISOString().slice(0, 10);

/** An investigation's date range with sensible defaults, since its queries need both dates. */
export function resolveInvestigationRange(start: string, end: string, now: Date = new Date()): { start: string; end: string } {
  const resolvedEnd = end || toDay(now);
  const resolvedStart = start || toDay(new Date(new Date(resolvedEnd).getTime() - DEFAULT_DAYS * DAY_MS));
  return { start: resolvedStart, end: resolvedEnd };
}
