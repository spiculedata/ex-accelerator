import { inputDateToGdeltDate } from '$lib/utils/gdeltDates';
import { getEventType } from '$lib/utils/gdeltEventTypes';

export interface GdeltEvent {
  id: number;
  eventCode: string;
  country: string;
  goldstein?: number | null;
  tone?: number | null;
  date?: number;
  lat?: number | null;
  lng?: number | null;
  location?: string;
  actor1?: string;
  actor2?: string;
}

export interface GdeltEventFilters {
  eventTypes: Set<string>;
  goldstein: number[];
  tone: number[];
  /** Left out when counting events per country, which ignores the country filter by design */
  countries?: Set<string>;
  /** [start, end] as YYYY-MM-DD; an empty end is open */
  dateRange: string[];
}

const LATEST_GDELT_DATE = 99999999;

function matchesDateRange(event: GdeltEvent, dateRange: string[]): boolean {
  if (!dateRange[0] && !dateRange[1]) return true;
  const eventDate = event.date || 0;
  const startDate = dateRange[0] ? inputDateToGdeltDate(dateRange[0]) : 0;
  const endDate = dateRange[1] ? inputDateToGdeltDate(dateRange[1]) : LATEST_GDELT_DATE;
  return eventDate >= startDate && eventDate <= endDate;
}

export function matchesEventFilters(event: GdeltEvent, filters: GdeltEventFilters): boolean {
  const typeMatch = filters.eventTypes.has('all') || filters.eventTypes.has(getEventType(event.eventCode));

  const goldsteinValue = event.goldstein || 0;
  const goldsteinMatch = goldsteinValue >= filters.goldstein[0] && goldsteinValue <= filters.goldstein[1];

  const toneValue = event.tone || 0;
  const toneMatch = toneValue >= filters.tone[0] && toneValue <= filters.tone[1];

  const countryMatch = !filters.countries || filters.countries.has('all') || filters.countries.has(event.country);

  return typeMatch && goldsteinMatch && toneMatch && countryMatch && matchesDateRange(event, filters.dateRange);
}

export function filterEvents<T extends GdeltEvent>(events: T[], filters: GdeltEventFilters): T[] {
  return events.filter((event) => matchesEventFilters(event, filters));
}

/** Orders a pair of range values and keeps them inside the scale; the lower value always comes first. */
export function clampRange(first: number, second: number, scaleMin: number, scaleMax: number): [number, number] {
  const low = Math.max(scaleMin, Math.min(scaleMax, first));
  const high = Math.max(scaleMin, Math.min(scaleMax, second));
  return low <= high ? [low, high] : [high, low];
}
