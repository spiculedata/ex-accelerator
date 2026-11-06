const DAY_MS = 86_400_000;
const DEFAULT_DAYS = 90;

const toDay = (date: Date): string => date.toISOString().slice(0, 10);
const isValidDay = (value: string): boolean => /^\d{4}-\d{2}-\d{2}/.test(value) && !Number.isNaN(new Date(value).getTime());

/** An investigation's date range with sensible defaults, since its queries need both dates. */
export function resolveInvestigationRange(start: string, end: string, now: Date = new Date()): { start: string; end: string } {
  const resolvedEnd = isValidDay(end) ? end : toDay(now);
  const defaultStart = toDay(new Date(new Date(resolvedEnd).getTime() - DEFAULT_DAYS * DAY_MS));
  const startIsUsable = isValidDay(start) && start <= resolvedEnd;
  return { start: startIsUsable ? start : defaultStart, end: resolvedEnd };
}
