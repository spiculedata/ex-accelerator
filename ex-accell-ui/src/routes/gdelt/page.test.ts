import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';

type FakeMarker = {
  options: Record<string, unknown>;
  latlng: [number, number];
  popup: string;
  onLayer: boolean;
  clickHandler?: (e: unknown) => void;
  addTo: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  bindPopup: ReturnType<typeof vi.fn>;
};

const leafletState = vi.hoisted(() => ({
  maps: [] as Array<{ removed: boolean; remove: () => void }>,
  markers: [] as FakeMarker[]
}));

vi.mock('leaflet/dist/leaflet.css', () => ({}));
vi.mock('leaflet', () => {
  const circleMarker = (latlng: [number, number], options: Record<string, unknown>) => {
    const marker: FakeMarker = {
      options,
      latlng,
      popup: '',
      onLayer: false,
      addTo: vi.fn(() => {
        marker.onLayer = true;
        return marker;
      }),
      remove: vi.fn(() => {
        marker.onLayer = false;
      }),
      on: vi.fn((_name: string, handler: (e: unknown) => void) => {
        marker.clickHandler = handler;
      }),
      bindPopup: vi.fn((html: string) => {
        marker.popup = html;
      })
    };
    leafletState.markers.push(marker);
    return marker;
  };
  const map = () => {
    const instance = {
      removed: false,
      setView: vi.fn(() => instance),
      hasLayer: (marker: FakeMarker) => marker.onLayer,
      remove: vi.fn(() => {
        instance.removed = true;
      })
    };
    leafletState.maps.push(instance);
    return instance;
  };
  const tileLayer = () => ({ addTo: vi.fn() });
  return { map, tileLayer, circleMarker, default: { map, tileLayer, circleMarker } };
});

import Page from './+page.svelte';
import { getCountryNameWithFallback } from '$lib/countryMapping';

const event = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  eventCode: '40',
  country: 'US',
  goldstein: 3,
  tone: 2,
  date: 20260105,
  lat: 10 + id,
  lng: 20 + id,
  location: `Place ${id}`,
  actor1: 'Actor One',
  actor2: 'Actor Two',
  ...over
});

const events = [
  event(1, { eventCode: '40', country: 'US', goldstein: 3, tone: 2, date: 20260101 }),
  event(2, { eventCode: '190', country: 'FR', goldstein: -8, tone: -6, date: 20260103 }),
  event(3, { eventCode: '80', country: 'FR', goldstein: 0, tone: 0, date: 20260105 }),
  event(4, { eventCode: '40', country: 'BR', goldstein: 5, tone: 4, date: 20260105, lat: null, lng: null })
];

const mention = (n: number, over: Record<string, unknown> = {}) => ({
  globalEventId: 1,
  mentionSourceName: `source-${n}.com`,
  mentionType: (n % 3) + 1,
  mentionTimeDate: 202601010000 + n,
  confidence: 50 + n,
  mentionDocTone: n % 2 === 0 ? 1.5 : -1.5,
  mentionDocLen: 1000 * n,
  mentionIdentifier: `https://source-${n}.com/story`,
  eventTimeDate: 20260101,
  ...over
});

type Route = (url: string, init?: RequestInit) => unknown;
const fetchMock = vi.fn();
const respond = (body: unknown, ok = true) => ({
  ok,
  status: ok ? 200 : 500,
  statusText: ok ? 'OK' : 'Server Error',
  json: async () => body,
  text: async () => JSON.stringify(body)
});

function routes(over: { gdelt?: Route; mentions?: Route } = {}) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.startsWith('/api/gdelt/mentions')) {
      return respond(over.mentions ? over.mentions(url, init) : { mentions: [mention(1), mention(2), mention(3)] });
    }
    return respond(over.gdelt ? over.gdelt(url, init) : { events });
  });
}

const w = window as unknown as Record<string, (...args: unknown[]) => void>;
const stat = (label: string) =>
  Array.from(document.querySelectorAll('div.text-xs.text-gray-600')).find((el) => el.textContent === label)?.previousElementSibling?.textContent?.trim();
const loaded = () => screen.findByText('Global Events Map');
const mapReady = () => waitFor(() => expect(leafletState.markers.length).toBeGreaterThan(0), { timeout: 2000 });

beforeEach(() => {
  leafletState.maps.length = 0;
  leafletState.markers.length = 0;
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GDELT page loading states', () => {
  it('shows the loading card, then the filters and the map', async () => {
    routes();
    render(Page);
    expect(screen.getByText('Loading GDELT events...')).toBeTruthy();
    expect(await loaded()).toBeTruthy();
    expect(screen.getByText('Filters')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Event Types' })).toBeTruthy();
  });

  it('explains when GDELT has not been loaded', async () => {
    routes({ gdelt: () => ({ events: [], unavailable: true }) });
    render(Page);
    expect(await screen.findByText('No GDELT events are loaded')).toBeTruthy();
    expect(screen.queryByText('Global Events Map')).toBeNull();
  });

  it('shows an error that can be dismissed', async () => {
    fetchMock.mockResolvedValue(respond({ error: 'boom' }, false));
    render(Page);
    expect(await screen.findByText('Error Loading Data')).toBeTruthy();
    expect(screen.getByText('Failed to load GDELT data. Please check the database connection.')).toBeTruthy();
    await fireEvent.click(screen.getByText('Dismiss'));
    expect(screen.queryByText('Error Loading Data')).toBeNull();
    expect(screen.getByText('Filters')).toBeTruthy();
  });
});

describe('GDELT page stats and filters', () => {
  it('counts events, countries, types and average tone', async () => {
    routes();
    render(Page);
    await loaded();
    expect(stat('Visible Events')).toBe('4');
    expect(stat('Countries')).toBe('3');
    expect(stat('Event Types')).toBe('3');
    expect(stat('Avg Tone')).toBeTruthy();
    expect(screen.getByText('Neutral')).toBeTruthy();
    expect(screen.getByText('4 of 4 events')).toBeTruthy();
  });

  it('lists each event type present with its count and hides empty types', async () => {
    routes();
    render(Page);
    await loaded();
    expect(screen.getByText('Support & Agreements')).toBeTruthy();
    expect(screen.getByText('Military Actions')).toBeTruthy();
    expect(screen.getByText('Material Conflict')).toBeTruthy();
    expect(screen.queryByText('Economic Actions')).toBeNull();
    const support = screen.getByText('Support & Agreements').closest('button') as HTMLElement;
    expect(within(support).getByText('2')).toBeTruthy();
  });

  it('narrows the visible events when an event type is toggled', async () => {
    routes();
    render(Page);
    await loaded();
    await fireEvent.click(screen.getByText('Military Actions').closest('button') as HTMLElement);
    await waitFor(() => expect(stat('Visible Events')).toBe('1'));
    expect(screen.getByText('1 of 4 events')).toBeTruthy();
    await fireEvent.click(screen.getByText('All Events').closest('button') as HTMLElement);
    await waitFor(() => expect(stat('Visible Events')).toBe('4'));
    await waitFor(() => expect((screen.getByText('All Events').closest('button') as HTMLButtonElement).disabled).toBe(false));
    // Toggling All Events while it is the active choice clears the selection
    await fireEvent.click(screen.getByText('All Events').closest('button') as HTMLElement);
    await waitFor(() => expect(stat('Visible Events')).toBe('0'));
  });

  it('filters by country and lists countries by name', async () => {
    routes();
    render(Page);
    await loaded();
    const franceName = getCountryNameWithFallback('FR', 'Unknown (FR)');
    await fireEvent.click(screen.getByText(franceName).closest('button') as HTMLElement);
    expect(stat('Visible Events')).toBe('2');
    expect(stat('Countries')).toBe('1');
  });

  it('searches the country list', async () => {
    routes();
    render(Page);
    await loaded();
    const franceName = getCountryNameWithFallback('FR', 'Unknown (FR)');
    const usName = getCountryNameWithFallback('US', 'Unknown (US)');
    await fireEvent.input(screen.getByPlaceholderText('Search countries...'), { target: { value: franceName.slice(0, 4) } });
    expect(screen.getByText(franceName)).toBeTruthy();
    expect(screen.queryByText(usName)).toBeNull();
  });

  it('applies the Goldstein manual entry, swapping a reversed range', async () => {
    routes();
    render(Page);
    await loaded();
    const goldstein = screen.getByText('Goldstein Scale').closest('div.mb-6') as HTMLElement;
    const [min, max] = within(goldstein).getAllByRole('spinbutton') as HTMLInputElement[];
    await fireEvent.input(min, { target: { value: '4' } });
    await fireEvent.change(min);
    await fireEvent.input(max, { target: { value: '-1' } });
    await fireEvent.change(max);
    expect(screen.getByText('Conflict: -1')).toBeTruthy();
    expect(screen.getByText('Cooperation: 4')).toBeTruthy();
    expect(stat('Visible Events')).toBe('2');
  });

  it('clamps tone manual entry to the scale', async () => {
    routes();
    render(Page);
    await loaded();
    const tone = screen.getByText('Average Tone').closest('div.mb-6') as HTMLElement;
    const [min, max] = within(tone).getAllByRole('spinbutton') as HTMLInputElement[];
    await fireEvent.input(min, { target: { value: '-99' } });
    await fireEvent.change(min);
    await fireEvent.input(max, { target: { value: '1' } });
    await fireEvent.change(max);
    expect(screen.getByText('Negative: -50')).toBeTruthy();
    expect(screen.getByText('Positive: 1')).toBeTruthy();
    expect(stat('Visible Events')).toBe('2');
  });

  it('selects and clears the Global South countries', async () => {
    routes();
    render(Page);
    await loaded();
    const toggle = screen.getByText('All Global South Countries').closest('button') as HTMLElement;
    expect(within(toggle).getByText('1 countries available')).toBeTruthy();
    await fireEvent.click(toggle);
    expect(stat('Visible Events')).toBe('1');
    expect(within(toggle).getByText('1/1')).toBeTruthy();
    await fireEvent.click(toggle);
    expect(stat('Visible Events')).toBe('0');
  });

  it('restores every filter with Reset All', async () => {
    routes();
    render(Page);
    await loaded();
    await fireEvent.click(screen.getByText('Military Actions').closest('button') as HTMLElement);
    await waitFor(() => expect(stat('Visible Events')).toBe('1'));
    await fireEvent.click(screen.getByText('Reset All'));
    await waitFor(() => expect(stat('Visible Events')).toBe('4'));
  });

  it('shows the available date range', async () => {
    routes();
    render(Page);
    await loaded();
    expect(screen.getByText('Available range: 2026-01-01 to 2026-01-05')).toBeTruthy();
    const [from, to] = Array.from(document.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
    expect(from.value).toBe('2026-01-01');
    expect(to.value).toBe('2026-01-05');
  });
});

describe('GDELT page date range', () => {
  it('refreshes from the server a second after a date is changed', async () => {
    routes();
    render(Page);
    await loaded();
    // Let the refresh that follows loading finish, so the next request is the one this test causes
    await waitFor(() => expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('dateStart='))).toHaveLength(1), { timeout: 3000 });
    await waitFor(() => expect(leafletState.maps.length).toBeGreaterThanOrEqual(2));
    const [from] = Array.from(document.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
    await fireEvent.input(from, { target: { value: '2026-01-03' } });
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('dateStart=2026-01-03'))).toBe(true), { timeout: 3000 });
  }, 10000);

  it('sets the last seven days and all dates from the quick buttons', async () => {
    routes();
    render(Page);
    await loaded();
    const [from, to] = Array.from(document.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
    await fireEvent.click(screen.getByText('Last 7 days'));
    await waitFor(() => expect(to.value).toBe(new Date().toISOString().split('T')[0]));
    expect(from.value).toBe(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    await fireEvent.click(screen.getByText('All dates'));
    await waitFor(() => expect(from.value).toBe('2026-01-01'));
    expect(to.value).toBe('2026-01-05');
  });

  it('narrows the visible events to the chosen dates', async () => {
    routes();
    render(Page);
    await loaded();
    const [from] = Array.from(document.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
    await fireEvent.input(from, { target: { value: '2026-01-05' } });
    await waitFor(() => expect(stat('Visible Events')).toBe('2'));
  });
});

describe('GDELT page map', () => {
  it('draws one marker per located event, coloured and sized from the event', async () => {
    routes();
    render(Page);
    await loaded();
    await mapReady();
    expect(leafletState.maps).toHaveLength(1);
    expect(leafletState.markers).toHaveLength(3);
    const first = leafletState.markers[0];
    expect(first.latlng).toEqual([11, 21]);
    expect(first.options.radius).toBe(8.5);
    expect(first.options.fillOpacity).toBe(0.8);
    expect(first.options.fillColor).toBeTruthy();
    expect(first.popup).toContain('Event 1');
    expect(first.popup).toContain('Support &amp; Agreements'.replace('&amp;', '&'));
    expect(first.popup).toContain('Show Related Mentions');
  });

  it('adds and removes markers as the filters change', async () => {
    routes();
    render(Page);
    await loaded();
    await mapReady();
    await fireEvent.click(screen.getByText('Military Actions').closest('button') as HTMLElement);
    await waitFor(() => expect(leafletState.markers.filter((m) => m.onLayer)).toHaveLength(1));
    await fireEvent.click(screen.getByText('All Events').closest('button') as HTMLElement);
    await waitFor(() => expect(leafletState.markers.filter((m) => m.onLayer)).toHaveLength(0));
  });

  it('selects a country when its marker is clicked', async () => {
    routes();
    render(Page);
    await loaded();
    await mapReady();
    const stopPropagation = vi.fn();
    leafletState.markers[1].clickHandler?.({ originalEvent: { stopPropagation } });
    await waitFor(() => expect(stat('Visible Events')).toBe('2'));
    expect(stopPropagation).toHaveBeenCalled();
    expect(leafletState.markers.filter((m) => m.onLayer)).toHaveLength(2);
  });

  it('filters by country from the popup button', async () => {
    routes();
    render(Page);
    await loaded();
    await mapReady();
    w.filterByCountry('US');
    await waitFor(() => expect(stat('Visible Events')).toBe('1'));
  });

  it('rebuilds the map after the date range is refreshed from the server', async () => {
    routes();
    render(Page);
    await loaded();
    await mapReady();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/gdelt?'))).toHaveLength(1);
    // The date range is set on load, which schedules a server refresh a second later
    await waitFor(() => expect(leafletState.maps.length).toBeGreaterThanOrEqual(2), { timeout: 4000 });
    expect(leafletState.maps.some((map) => map.removed)).toBe(true);
    const urls = fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => url.startsWith('/api/gdelt?'));
    const refresh = urls.find((url) => url.includes('dateStart='));
    expect(refresh).toContain('dateStart=2026-01-01');
    expect(refresh).toContain('dateEnd=2026-01-05');
    expect(refresh).toContain('goldsteinMin=-10');
  }, 8000);

  it('reports a failed refresh and leaves the page recoverable', async () => {
    let calls = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).startsWith('/api/gdelt?')) {
        calls++;
        return calls === 1 ? respond({ events }) : respond({ error: 'db down' }, false);
      }
      return respond({ mentions: [] });
    });
    render(Page);
    await loaded();
    expect(await screen.findByText('Error Loading Data', {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByText(/Failed to refresh GDELT data/)).toBeTruthy();
  }, 8000);
});

describe('GDELT page mentions', () => {
  it('loads the mentions for one event from its popup', async () => {
    routes();
    render(Page);
    await loaded();
    await mapReady();
    w.showEventMentions(1);
    expect(await screen.findByText('Related Mentions')).toBeTruthy();
    expect(await screen.findByText('source-1.com')).toBeTruthy();
    expect(screen.getByText('Event ID: 1')).toBeTruthy();
    expect(screen.getAllByText('Web News').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Link')).toHaveLength(3);
    expect(screen.getByText(/Showing 1-3 of 3 filtered mentions/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('/api/gdelt/mentions?eventId=1');
  });

  it('shows the empty state and the error states', async () => {
    routes({ mentions: () => ({ mentions: [] }) });
    render(Page);
    await loaded();
    await mapReady();
    w.showEventMentions(1);
    expect(await screen.findByText('No mentions found')).toBeTruthy();

    routes({ mentions: () => ({ error: 'Note: mentions are limited' }) });
    w.showEventMentions(2);
    expect(await screen.findByText('Data Limitation')).toBeTruthy();
    expect(screen.getByText('Note: mentions are limited')).toBeTruthy();

    routes({ mentions: () => ({ error: 'bad query' }) });
    w.showEventMentions(3);
    expect(await screen.findByText('Error Loading Mentions')).toBeTruthy();
    expect(screen.getByText('bad query')).toBeTruthy();

    await fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByText('Related Mentions')).toBeNull();
    // A failed single-event load does not reopen a closed section
    w.showEventMentions(3);
    await waitFor(() => expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('eventId=3'))).toHaveLength(2));
    expect(screen.queryByText('Related Mentions')).toBeNull();
  });

  it('searches, filters by type and sorts the mentions', async () => {
    routes({ mentions: () => ({ mentions: [mention(1), mention(2), mention(3)] }) });
    render(Page);
    await loaded();
    await mapReady();
    w.showEventMentions(1);
    await screen.findByText('source-1.com');

    const order = () => Array.from(document.querySelectorAll('tbody tr td:first-child')).map((td) => td.textContent?.trim());
    // Default sort is newest mention first
    expect(order()).toEqual(['source-3.com', 'source-2.com', 'source-1.com']);
    await fireEvent.click(screen.getByText('Source'));
    expect(order()).toEqual(['source-3.com', 'source-2.com', 'source-1.com']);
    await fireEvent.click(screen.getByText('Source'));
    expect(order()).toEqual(['source-1.com', 'source-2.com', 'source-3.com']);

    await fireEvent.input(screen.getByPlaceholderText('Search by source name or identifier...'), { target: { value: 'source-2' } });
    expect(order()).toEqual(['source-2.com']);
    await fireEvent.input(screen.getByPlaceholderText('Search by source name or identifier...'), { target: { value: '' } });

    await fireEvent.change(screen.getByDisplayValue('All Types'), { target: { value: '3' } });
    expect(order()).toEqual(['source-2.com']);
  });

  it('paginates long mention lists', async () => {
    const many = Array.from({ length: 30 }, (_, i) => mention(i + 1));
    routes({ mentions: () => ({ mentions: many }) });
    render(Page);
    await loaded();
    await mapReady();
    w.showEventMentions(1);
    await screen.findByText('source-30.com');
    expect(screen.getAllByText('Show:')).toHaveLength(2);
    expect(screen.getByText(/Showing 1-30 of 30 filtered mentions/)).toBeTruthy();
    const [perPage] = screen.getAllByDisplayValue('100 per page');
    await fireEvent.change(perPage, { target: { value: '25' } });
    expect(document.querySelectorAll('tbody tr')).toHaveLength(25);
    await fireEvent.click(screen.getAllByText('Next')[0]);
    expect(document.querySelectorAll('tbody tr')).toHaveLength(5);
    expect(screen.getByText(/Showing 26-30 of 30 filtered mentions/)).toBeTruthy();
  });

  it('exports the filtered mentions as CSV', async () => {
    routes();
    const createObjectURL = vi.fn(() => 'blob:csv');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(Page);
    await loaded();
    await mapReady();
    w.showEventMentions(1);
    await screen.findByText('source-1.com');
    await fireEvent.click(screen.getByText('Export CSV'));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = (createObjectURL.mock.calls as unknown as Blob[][])[0][0];
    expect(await blob.text()).toContain('Event ID,Source Name,Type');
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:csv');
  });

  it('loads the mentions of every filtered event and offers it only when filtered', async () => {
    routes();
    render(Page);
    await loaded();
    await mapReady();
    expect(screen.queryByText(/Show All Mentions/)).toBeNull();
    await fireEvent.click(screen.getByText('Military Actions').closest('button') as HTMLElement);
    const button = await screen.findByText('Show All Mentions (1)');
    await fireEvent.click(button);
    expect(await screen.findByText('source-1.com')).toBeTruthy();
    expect(screen.getByText('All Filtered Events (3 mentions)')).toBeTruthy();
    const post = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST');
    expect(JSON.parse((post?.[1] as RequestInit).body as string)).toEqual({ eventIds: [3] });
  });
  it('loads mentions in batches of 1000 and shows the progress', async () => {
    const many = [
      ...Array.from({ length: 1001 }, (_, i) => event(1000 + i, { eventCode: '40', country: 'US' })),
      event(5, { eventCode: '80', country: 'FR' })
    ];
    const posts: number[][] = [];
    routes({
      gdelt: () => ({ events: many }),
      mentions: (_url, init) => {
        const ids = JSON.parse(init?.body as string).eventIds as number[];
        posts.push(ids);
        return { mentions: ids.slice(0, 2).map((id) => mention(id, { mentionSourceName: `batch-${id}.com` })) };
      }
    });
    render(Page);
    await loaded();
    await fireEvent.click(screen.getByText('Support & Agreements').closest('button') as HTMLElement);
    await fireEvent.click(await screen.findByText('Show All Mentions (1001)'));
    await screen.findByText(/Batch 1\/2/, {}, { timeout: 3000 }).catch(() => undefined);
    await waitFor(() => expect(posts).toHaveLength(2), { timeout: 4000 });
    expect(posts.map((p) => p.length)).toEqual([1000, 1]);
    await waitFor(() => expect(screen.getByText('All Filtered Events (3 mentions)')).toBeTruthy(), { timeout: 4000 });
    expect(screen.queryByText(/loading\.\.\./)).toBeNull();
  }, 15000);
});
