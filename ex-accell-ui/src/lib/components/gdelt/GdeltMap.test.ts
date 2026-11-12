import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import GdeltMap from './GdeltMap.svelte';
import type { GdeltEventFilters } from '$lib/utils/gdeltFilters';

type FakeMarker = ReturnType<typeof marker>;
const marker = () => {
  const m = {
    onLayer: false,
    addTo: vi.fn(() => {
      m.onLayer = true;
      return m;
    }),
    remove: vi.fn(() => {
      m.onLayer = false;
    }),
    on: vi.fn(),
    bindPopup: vi.fn()
  };
  return m;
};

function fakeLeaflet() {
  const markers: FakeMarker[] = [];
  const mapInstance = {
    setView: vi.fn(() => mapInstance),
    hasLayer: (m: FakeMarker) => m.onLayer,
    remove: vi.fn()
  };
  return {
    markers,
    mapInstance,
    api: {
      map: vi.fn(() => mapInstance),
      tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
      circleMarker: vi.fn(() => {
        const m = marker();
        markers.push(m);
        return m;
      })
    }
  };
}

const events = [
  { id: 1, eventCode: '40', country: 'US', goldstein: 3, tone: 1, date: 20260101, lat: 1, lng: 2 },
  { id: 2, eventCode: '80', country: 'FR', goldstein: 1, tone: 1, date: 20260101, lat: 3, lng: 4 },
  { id: 3, eventCode: '40', country: 'BR', goldstein: 1, tone: 1, date: 20260101, lat: null, lng: null }
];
const open: GdeltEventFilters = { eventTypes: new Set(['all']), goldstein: [-10, 10], tone: [-50, 50], countries: new Set(['all']), dateRange: ['', ''] };

const props = (over: Record<string, unknown> = {}) => ({
  visibleCount: 3,
  eventsCount: 3,
  onShowAllMentions: vi.fn(),
  onSelectCountry: vi.fn(),
  onShowMentions: vi.fn(),
  ...over
});

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('GdeltMap lifecycle', () => {
  it('builds one map with a marker for each located event', () => {
    const leaflet = fakeLeaflet();
    const { component } = render(GdeltMap, props());
    component.initializeMap(leaflet.api, events);

    expect(leaflet.api.map).toHaveBeenCalledTimes(1);
    expect(leaflet.mapInstance.setView).toHaveBeenCalledWith([20, 0], 2);
    expect(leaflet.markers).toHaveLength(2);
    expect(leaflet.markers.every((m) => m.bindPopup.mock.calls.length === 1)).toBe(true);
  });

  it('shows and hides markers as the filters change', () => {
    const leaflet = fakeLeaflet();
    const { component } = render(GdeltMap, props());
    component.initializeMap(leaflet.api, events);

    component.updateVisibility(events, { ...open, eventTypes: new Set(['military']) });
    expect(leaflet.markers.map((m) => m.onLayer)).toEqual([false, true]);
    component.updateVisibility(events, open);
    expect(leaflet.markers.map((m) => m.onLayer)).toEqual([true, true]);
  });

  it('removes the markers and the map when asked, and again builds a fresh one', () => {
    const leaflet = fakeLeaflet();
    const { component } = render(GdeltMap, props());
    component.initializeMap(leaflet.api, events);

    component.destroyMap();
    expect(leaflet.markers.every((m) => m.remove.mock.calls.length === 1)).toBe(true);
    expect(leaflet.mapInstance.remove).toHaveBeenCalledTimes(1);

    component.destroyMap();
    expect(leaflet.mapInstance.remove).toHaveBeenCalledTimes(1);

    component.initializeMap(leaflet.api, events);
    expect(leaflet.api.map).toHaveBeenCalledTimes(2);
  });

  it('removes the map when the component is destroyed', () => {
    const leaflet = fakeLeaflet();
    const { component, unmount } = render(GdeltMap, props());
    component.initializeMap(leaflet.api, events);

    unmount();
    expect(leaflet.mapInstance.remove).toHaveBeenCalledTimes(1);
  });

  it('does nothing without Leaflet', () => {
    const { component } = render(GdeltMap, props());
    expect(() => component.initializeMap(undefined, events)).not.toThrow();
    expect(() => component.updateVisibility(events, open)).not.toThrow();
  });

  it('passes popup button clicks on to the page', () => {
    const p = props();
    render(GdeltMap, p);
    (window as unknown as Record<string, (arg: unknown) => void>).filterByCountry('FR');
    (window as unknown as Record<string, (arg: unknown) => void>).showEventMentions(7);
    expect(p.onSelectCountry).toHaveBeenCalledWith('FR');
    expect(p.onShowMentions).toHaveBeenCalledWith(7);
  });
});

describe('GdeltMap header', () => {
  it('counts the events and offers the mentions of a filtered subset', async () => {
    const p = props({ visibleCount: 2, eventsCount: 5 });
    render(GdeltMap, p);
    expect(screen.getByText('2 of 5 events')).toBeTruthy();
    expect(screen.getByText('Live')).toBeTruthy();
    await fireEvent.click(screen.getByText('Show All Mentions (2)'));
    expect(p.onShowAllMentions).toHaveBeenCalledTimes(1);
  });

  it('hides the mentions button when nothing is filtered out', () => {
    render(GdeltMap, props({ visibleCount: 5, eventsCount: 5 }));
    expect(screen.queryByText(/Show All Mentions/)).toBeNull();
  });

  it('shows the batch progress while mentions load', () => {
    render(GdeltMap, props({ visibleCount: 2, eventsCount: 5, isBatchLoading: true, showMentions: true, batchProgress: { current: 1, total: 3, loadedMentions: 40 } }));
    expect(screen.getByText('Batch 1/3 (40 mentions)')).toBeTruthy();
    expect(screen.getByText('Loading batch 1/3...')).toBeTruthy();
  });

  it('covers the map while the data refreshes', () => {
    render(GdeltMap, props({ isUpdatingFilter: true }));
    expect(screen.getByText('Refreshing Data')).toBeTruthy();
    expect(screen.getByText('Refreshing...')).toBeTruthy();
  });
});
