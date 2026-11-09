// The date range of the analysis filter bar. It lives in the URL so a view can be shared and reloaded, and is
// remembered for the session so moving between analysis pages keeps it.
import { isCalendarDay, validateDayRange } from './calendarDay';

export interface DateRange {
  dateStart: string;
  dateEnd: string;
}

export const STORAGE_KEY = 'se:filter-range';
const EMPTY: DateRange = { dateStart: '', dateEnd: '' };

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

function sanitise(start: unknown, end: unknown): DateRange {
  const dateStart = isCalendarDay(start) ? start : '';
  const dateEnd = isCalendarDay(end) ? end : '';
  return validateDayRange(dateStart, dateEnd) ? EMPTY : { dateStart, dateEnd };
}

export function readRange(params: URLSearchParams, store: Storage | null): DateRange {
  const fromUrl = sanitise(params.get('date_start'), params.get('date_end'));
  if (fromUrl.dateStart || fromUrl.dateEnd) return fromUrl;
  try {
    const saved = JSON.parse(store?.getItem(STORAGE_KEY) ?? 'null');
    return saved ? sanitise(saved.dateStart, saved.dateEnd) : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function applyRangeToParams(params: URLSearchParams, range: DateRange): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const [key, value] of [['date_start', range.dateStart], ['date_end', range.dateEnd]] as const) {
    if (value) next.set(key, value);
    else next.delete(key);
  }
  return next;
}

export function rememberRange(range: DateRange, store: Storage | null): void {
  try {
    if (range.dateStart || range.dateEnd) store?.setItem(STORAGE_KEY, JSON.stringify(range));
    else store?.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be blocked; the URL still carries the range
  }
}

/** The range as API query parameters (`date_start`, `date_end`), empty when no range is set. */
export function rangeQuery(range: DateRange): Record<string, string> {
  return {
    ...(range.dateStart ? { date_start: range.dateStart } : {}),
    ...(range.dateEnd ? { date_end: range.dateEnd } : {})
  };
}

/** The range the user has set right now, read from the page URL (or the session). Empty outside a browser. */
export function currentRangeQuery(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  let store: Storage | null = null;
  try { store = window.sessionStorage; } catch { /* blocked */ }
  return rangeQuery(readRange(new URLSearchParams(window.location.search), store));
}

/**
 * Reloads a page's data when the date range changes. Changes made while a load is running are not lost: the loop
 * runs again until the data matches the range last set, so the newest range always wins and loads never overlap.
 */
export function rangeReloader(load: () => Promise<void>, isBusy: () => boolean = () => false) {
  let loaded = JSON.stringify(currentRangeQuery());
  let running = false;
  return {
    /** Call just before the first load, so later changes are compared with the range that load used. */
    markLoaded(): void {
      loaded = JSON.stringify(currentRangeQuery());
    },
    async sync(): Promise<void> {
      if (running || isBusy()) return;
      running = true;
      try {
        for (;;) {
          const wanted = JSON.stringify(currentRangeQuery());
          if (wanted === loaded) return;
          loaded = wanted;
          await load();
        }
      } finally {
        running = false;
      }
    }
  };
}
