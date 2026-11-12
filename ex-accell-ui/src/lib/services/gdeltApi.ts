import type { GdeltEvent } from '$lib/utils/gdeltFilters';
import type { GdeltMention } from '$lib/utils/gdeltMentions';

export interface GdeltEventsResponse {
  events?: GdeltEvent[];
  unavailable?: boolean;
  error?: string;
}

/** The query string for /api/gdelt: the Goldstein range always, the dates only when set. */
export function buildEventsQuery(goldsteinRange: number[], dateRange: string[]): URLSearchParams {
  const params = new URLSearchParams({
    goldsteinMin: goldsteinRange[0].toString(),
    goldsteinMax: goldsteinRange[1].toString()
  });
  if (dateRange[0]) {
    params.append('dateStart', dateRange[0]);
  }
  if (dateRange[1]) {
    params.append('dateEnd', dateRange[1]);
  }
  return params;
}

async function failureFor(response: Response): Promise<Error> {
  const errorText = await response.text();
  return new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
}

/**
 * Loads the events. `onUnavailable` hears whether GDELT is loaded before an error in the same response is thrown, so
 * the caller can tell an empty database from a failure.
 */
export async function fetchGdeltEvents(
  goldsteinRange: number[],
  dateRange: string[],
  onUnavailable: (isUnavailable: boolean) => void = () => {}
): Promise<GdeltEventsResponse> {
  const url = `/api/gdelt?${buildEventsQuery(goldsteinRange, dateRange)}`;
  console.log('Fetching from URL:', url);

  const response = await fetch(url);
  console.log('Response status:', response.status, response.statusText);

  if (!response.ok) {
    const failure = await failureFor(response);
    console.error('Response error:', failure.message);
    throw failure;
  }

  const data = await response.json();
  onUnavailable(!!data.unavailable);

  if (data.error) {
    throw new Error(data.error);
  }
  return data;
}

export async function fetchEventMentions(eventId: number): Promise<GdeltMention[]> {
  const response = await fetch(`/api/gdelt/mentions?eventId=${eventId}`);
  if (!response.ok) throw await failureFor(response);

  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.mentions || [];
}

export async function fetchMentionsBatch(eventIds: number[]): Promise<GdeltMention[]> {
  const response = await fetch('/api/gdelt/mentions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      eventIds: eventIds
    })
  });
  if (!response.ok) throw await failureFor(response);

  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.mentions || [];
}
