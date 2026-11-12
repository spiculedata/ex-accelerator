import { getCountryNameWithFallback } from '$lib/countryMapping';
import { gdeltDateToInputDate } from '$lib/utils/gdeltDates';
import type { GdeltEvent } from '$lib/utils/gdeltFilters';

/** Distinct country codes in the events, sorted by country name. */
export function extractAvailableCountries(events: GdeltEvent[]): string[] {
  const codes = [...new Set(events.map((e) => e.country).filter((c) => c))];
  return codes.sort((a, b) => getCountryNameWithFallback(a, a).localeCompare(getCountryNameWithFallback(b, b)));
}

/** The earliest and latest event date as YYYY-MM-DD, or null when no event has a date. */
export function extractDateRange(events: GdeltEvent[]): string[] | null {
  const eventDates = events.map((e) => e.date).filter((d): d is number => !!d);
  if (eventDates.length === 0) return null;
  return [gdeltDateToInputDate(Math.min(...eventDates)), gdeltDateToInputDate(Math.max(...eventDates))];
}

/** Mean tone rounded to two decimals; 0 for no events. */
export function averageTone(events: GdeltEvent[]): number {
  if (events.length === 0) return 0;
  return Math.round((events.reduce((acc, e) => acc + (e.tone || 0), 0) / events.length) * 100) / 100;
}
