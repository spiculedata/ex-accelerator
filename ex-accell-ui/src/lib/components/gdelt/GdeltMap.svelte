<script lang="ts">
  import { onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { matchesEventFilters, type GdeltEvent, type GdeltEventFilters } from '$lib/utils/gdeltFilters';
  import { buildEventPopupHtml, hasCoordinates, markerOptions } from '$lib/utils/gdeltMarkers';

  /** How many events pass the filters, and how many were loaded */
  export let visibleCount: number;
  export let eventsCount: number;
  export let isUpdatingFilter = false;
  export let loadingMentions = false;
  export let isBatchLoading = false;
  export let batchProgress = { current: 0, total: 0, loadedMentions: 0 };
  export let showMentions = false;
  export let onShowAllMentions: () => void;
  /** A marker or popup button picked a country */
  export let onSelectCountry: (country: string) => void;
  /** A popup button asked for the mentions of an event */
  export let onShowMentions: (eventId: number) => void;

  const WORLD_CENTER: [number, number] = [20, 0];
  const WORLD_ZOOM = 2;
  const TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';

  let mapContainer: HTMLDivElement;
  let map: any;
  let markers: Record<string, any> = {};

  // Global functions for the popup buttons, which are plain HTML inside the map
  if (browser) {
    (window as any).filterByCountry = (countryCode: string) => onSelectCountry(countryCode);
    (window as any).showEventMentions = (eventId: number) => onShowMentions(eventId);
  }

  /** Removes every marker and the map itself, ready for initializeMap to build a new one. */
  export function destroyMap() {
    Object.values(markers).forEach((marker: any) => marker.remove());
    markers = {};

    if (map) {
      map.remove();
      map = null;
    }
  }

  /**
   * Creates the map and one marker for each event that has coordinates. Does nothing before Leaflet and the container
   * exist. The Leaflet module is passed in, not held as a prop, so Svelte does not wrap it in reactive state.
   */
  export function initializeMap(leaflet: any, events: GdeltEvent[]) {
    console.log('Initializing map...', { leaflet: !!leaflet, mapContainer: !!mapContainer, eventsCount: events.length });
    if (!leaflet || !mapContainer) return;

    map = leaflet.map(mapContainer).setView(WORLD_CENTER, WORLD_ZOOM);

    // Add tile layer with English labels
    leaflet.tileLayer(TILE_URL, {
      attribution: '© Esri, © OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    events.forEach((event) => {
      if (!hasCoordinates(event)) return;

      const marker = leaflet.circleMarker([event.lat, event.lng], markerOptions(event)).addTo(map);

      // Store marker for toggling
      markers[event.id] = marker;

      // Clicking a marker selects its country
      marker.on('click', (e: any) => {
        e.originalEvent.stopPropagation(); // Prevent map click
        onSelectCountry(event.country);
      });

      marker.bindPopup(buildEventPopupHtml(event));
    });
  }

  /** Shows the markers whose events pass the filters and hides the rest. */
  export function updateVisibility(events: GdeltEvent[], filters: GdeltEventFilters) {
    let shownCount = 0;
    const startTime = performance.now();

    Object.entries(markers).forEach(([eventId, marker]) => {
      const event = events.find((e) => e.id.toString() === eventId);
      if (!event) return;

      if (matchesEventFilters(event, filters)) {
        if (!map.hasLayer(marker)) {
          marker.addTo(map);
        }
        shownCount++;
      } else if (map.hasLayer(marker)) {
        marker.remove();
      }
    });

    const endTime = performance.now();
    console.log(`Updated ${shownCount} markers (Filters: Goldstein ${filters.goldstein[0]} to ${filters.goldstein[1]}, Tone ${filters.tone[0]} to ${filters.tone[1]}, Countries: ${filters.countries?.size}) in ${Math.round(endTime - startTime)}ms`);
  }

  onDestroy(destroyMap);
</script>

<!-- Map -->
<div class="bg-white rounded-xl shadow-sm overflow-hidden">
  <div class="px-4 py-2 bg-gradient-to-r from-gray-50 to-gray-100 border-b">
    <div class="flex items-center justify-between">
      <div class="flex items-center">
        <div class="w-6 h-6 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center mr-2">
          <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <h2 class="text-base xl:text-lg font-semibold text-gray-900">Global Events Map</h2>
      </div>
      <div class="flex items-center space-x-3">
        {#if visibleCount > 0 && visibleCount < eventsCount}
          <button
            on:click={() => onShowAllMentions()}
            disabled={loadingMentions || isBatchLoading}
            class="text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white px-2 py-1 rounded-lg transition-all duration-200 flex items-center gap-1.5 min-w-max"
          >
            {#if loadingMentions || isBatchLoading}
              <div class="animate-spin rounded-full h-4 w-4 border-2 border-blue-200 border-t-white"></div>
              <span class="text-blue-100">
                {#if isBatchLoading}
                  Batch {batchProgress.current}/{batchProgress.total} ({batchProgress.loadedMentions} mentions)
                {:else}
                  Processing...
                {/if}
              </span>
            {:else}
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <span>
                Show All Mentions ({visibleCount})
              </span>
            {/if}
          </button>
        {/if}
        <div class="text-xs text-gray-600">
          {visibleCount} of {eventsCount} events
        </div>
        <div class="flex items-center text-xs text-gray-500">
          <div class="w-1.5 h-1.5 {isUpdatingFilter ? 'bg-blue-400' : 'bg-blue-400'} rounded-full animate-pulse mr-1"></div>
          {isUpdatingFilter ? 'Refreshing...' : 'Live'}
        </div>
      </div>
    </div>
  </div>
  <div class="relative">
    <div bind:this={mapContainer} class="h-[calc(100vh-220px)] min-h-[350px] max-h-[700px] w-full"></div>
    <!-- Loading Overlay -->
    {#if isUpdatingFilter}
      <div class="absolute inset-0 bg-white/75 flex items-center justify-center z-50">
        <div class="bg-white rounded-xl shadow-lg p-6 flex flex-col items-center">
          <div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mb-4"></div>
          <div class="text-lg font-semibold text-gray-900 mb-2">Refreshing Data</div>
          <div class="text-sm text-gray-600 text-center">
            Fetching updated events from database...
          </div>
        </div>
      </div>
    {/if}

    <!-- Bulk Mentions Processing Indicator -->
    {#if (loadingMentions || isBatchLoading) && showMentions}
      <div class="absolute top-4 right-4 bg-blue-600 text-white px-3 py-2 rounded-xl shadow-lg flex items-center gap-2 z-40">
        <div class="animate-spin rounded-full h-4 w-4 border-2 border-blue-200 border-t-white"></div>
        <span class="text-sm font-medium">
          {#if isBatchLoading}
            Loading batch {batchProgress.current}/{batchProgress.total}...
          {:else}
            Processing mentions...
          {/if}
        </span>
      </div>
    {/if}
  </div>
</div>
