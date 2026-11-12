<script lang="ts">
  import 'leaflet/dist/leaflet.css';
  import { onDestroy, onMount } from 'svelte';
  import { browser } from '$app/environment';
  import CountryFilter from '$lib/components/gdelt/CountryFilter.svelte';
  import DateRangeFilter from '$lib/components/gdelt/DateRangeFilter.svelte';
  import EventTypeFilter from '$lib/components/gdelt/EventTypeFilter.svelte';
  import GdeltMap from '$lib/components/gdelt/GdeltMap.svelte';
  import GdeltStats from '$lib/components/gdelt/GdeltStats.svelte';
  import GoldsteinFilter from '$lib/components/gdelt/GoldsteinFilter.svelte';
  import MentionsPanel from '$lib/components/gdelt/MentionsPanel.svelte';
  import ToneFilter from '$lib/components/gdelt/ToneFilter.svelte';
  import DataUnavailable from '$lib/components/ui/DataUnavailable.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { fetchEventMentions, fetchGdeltEvents, fetchMentionsBatch } from '$lib/services/gdeltApi';
  import { getGlobalSouthCountryCodes } from '$lib/utils/gdeltCountries';
  import { extractAvailableCountries, extractDateRange } from '$lib/utils/gdeltEvents';
  import { filterEvents, type GdeltEvent, type GdeltEventFilters } from '$lib/utils/gdeltFilters';
  import type { GdeltMention } from '$lib/utils/gdeltMentions';

  const DATE_REFRESH_DELAY_MS = 1000;
  const MAP_INIT_DELAY_MS = 100;
  const TOGGLE_DELAY_MS = 50;
  const MENTIONS_BATCH_SIZE = 1000;
  const MENTIONS_BATCH_PAUSE_MS = 100;

  let mapView: ReturnType<typeof GdeltMap> | null = null;
  let mentionsPanel: ReturnType<typeof MentionsPanel> | null = null;
  let leaflet: any;
  let events: GdeltEvent[] = [];
  let loading = true;
  let error = '';
  // GDELT has not been loaded into this database: say so, rather than show an error or an empty map
  let gdeltUnavailable = false;
  let activeEventTypes = new Set(['all']);
  let isToggling = false;
  let goldsteinRange = [-10, 10];
  let isUpdatingFilter = false;
  let goldsteinMin = -10;
  let goldsteinMax = 10;
  let toneRange = [-50, 50];
  let toneMin = -50;
  let toneMax = 50;
  let selectedCountries = new Set(['all']);
  let availableCountries: string[] = [];
  let countrySearchTerm = '';
  let dateRange = ['', '']; // [startDate, endDate] in YYYY-MM-DD format
  let availableDateRange = ['', '']; // Auto-detected from data
  let dateRefreshTimeout: ReturnType<typeof setTimeout>;
  let mapInitTimeout: ReturnType<typeof setTimeout>;

  // Mentions functionality
  let selectedEventId: number | null = null;
  let mentions: GdeltMention[] = [];
  let loadingMentions = false;
  let mentionsError = '';
  let mentionsLimitationNotice = '';
  let showMentions = false;

  // Batch loading state
  let isBatchLoading = false;
  let batchProgress = { current: 0, total: 0, loadedMentions: 0 };

  // Get Global South country codes that are available in our data
  $: globalSouthCountryCodes = getGlobalSouthCountryCodes(availableCountries);

  // Check if all Global South countries are selected
  $: allGlobalSouthSelected = globalSouthCountryCodes.length > 0 &&
    globalSouthCountryCodes.every((code) => selectedCountries.has(code));

  // The events that pass every filter, and those that pass all but the country one (for the country counts)
  $: visibleEvents = filterEvents(events, { eventTypes: activeEventTypes, goldstein: goldsteinRange, tone: toneRange, countries: selectedCountries, dateRange });
  $: eventsForCountryCounts = filterEvents(events, { eventTypes: activeEventTypes, goldstein: goldsteinRange, tone: toneRange, dateRange });

  // Handle date range changes with debounced database refresh
  $: if (browser && dateRange) {
    clearTimeout(dateRefreshTimeout);
    dateRefreshTimeout = setTimeout(() => {
      // Only refresh from server if we have significant date changes
      // For now, always refresh since date filtering should be server-side
      if (dateRange[0] || dateRange[1]) {
        refreshDataFromServer('date range change');
      }
    }, DATE_REFRESH_DELAY_MS); // 1 second delay to avoid too many requests
  }

  function currentFilters(): GdeltEventFilters {
    return { eventTypes: activeEventTypes, goldstein: goldsteinRange, tone: toneRange, countries: selectedCountries, dateRange };
  }

  function updateMarkerVisibility() {
    mapView?.updateVisibility(events, currentFilters());
  }

  async function toggleEventType(eventType: string) {
    if (isToggling) return; // Prevent multiple rapid toggles

    isToggling = true;

    try {
      if (eventType === 'all') {
        if (activeEventTypes.has('all')) {
          activeEventTypes = new Set();
        } else {
          activeEventTypes = new Set(['all']);
        }
      } else {
        activeEventTypes.delete('all');
        if (activeEventTypes.has(eventType)) {
          activeEventTypes.delete(eventType);
        } else {
          activeEventTypes.add(eventType);
        }
      }

      // Add small delay for smooth UI feedback
      await new Promise((resolve) => setTimeout(resolve, TOGGLE_DELAY_MS));
      updateMarkerVisibility();
    } finally {
      isToggling = false;
    }
  }

  function toggleCountry(country: string) {
    if (country === 'all') {
      if (selectedCountries.has('all')) {
        selectedCountries = new Set();
      } else {
        selectedCountries = new Set(['all']);
      }
    } else {
      // Create a new Set to trigger reactivity
      const newSelectedCountries = new Set(selectedCountries);
      newSelectedCountries.delete('all'); // Remove 'all' when selecting individual countries

      if (newSelectedCountries.has(country)) {
        newSelectedCountries.delete(country);
      } else {
        newSelectedCountries.add(country);
      }

      selectedCountries = newSelectedCountries;
    }
    updateMarkerVisibility();
  }

  function toggleGlobalSouthCountries() {
    // Check if all Global South countries are currently selected
    const allSelected = globalSouthCountryCodes.every((code) => selectedCountries.has(code));

    const newSelectedCountries = new Set(selectedCountries);
    newSelectedCountries.delete('all'); // Remove 'all' when selecting specific countries

    if (allSelected) {
      // Deselect all Global South countries
      globalSouthCountryCodes.forEach((code) => newSelectedCountries.delete(code));
    } else {
      // Select all Global South countries
      globalSouthCountryCodes.forEach((code) => newSelectedCountries.add(code));
    }

    selectedCountries = newSelectedCountries;
    updateMarkerVisibility();
  }

  // A marker or popup button picks one country and drops the rest
  function selectOnlyCountry(country: string) {
    selectedCountries = new Set([country]);
    updateMarkerVisibility();
  }

  function resetFilters() {
    activeEventTypes = new Set(['all']);

    goldsteinRange = [-10, 10];
    goldsteinMin = -10;
    goldsteinMax = 10;

    toneRange = [-50, 50];
    toneMin = -50;
    toneMax = 50;

    selectedCountries = new Set(['all']);

    // Reset date range to show all available dates
    dateRange = [...availableDateRange];

    updateMarkerVisibility();
  }

  async function fetchEvents() {
    return fetchGdeltEvents(goldsteinRange, dateRange, (isUnavailable) => {
      gdeltUnavailable = isUnavailable;
    });
  }

  async function fetchMentions(eventId: number) {
    try {
      loadingMentions = true;
      mentionsError = '';

      mentionsPanel?.resetPagination();

      mentions = await fetchEventMentions(eventId);
      selectedEventId = eventId;
      showMentions = true;
    } catch (err) {
      console.error('Error fetching mentions:', err);
      mentionsError = err instanceof Error ? err.message : 'Failed to load mentions';
      mentions = [];
    } finally {
      loadingMentions = false;
    }
  }

  async function fetchAllMentionsForVisible() {
    try {
      loadingMentions = true;
      isBatchLoading = false;
      mentionsError = '';
      mentionsLimitationNotice = '';
      mentions = []; // Clear previous mentions
      selectedEventId = null; // Set to null to indicate multiple events
      showMentions = true; // Show the mentions section immediately

      mentionsPanel?.resetPagination();

      const allEventIds = visibleEvents.map((e) => e.id);
      console.log(`Starting batch mentions fetch for ${allEventIds.length} events...`);

      if (allEventIds.length <= MENTIONS_BATCH_SIZE) {
        // Single batch
        mentions = await fetchMentionsBatch(allEventIds);
        console.log(`Successfully loaded ${mentions.length} mentions for ${allEventIds.length} events`);
      } else {
        // Multiple batches required
        isBatchLoading = true;
        const totalBatches = Math.ceil(allEventIds.length / MENTIONS_BATCH_SIZE);

        batchProgress = {
          current: 0,
          total: totalBatches,
          loadedMentions: 0
        };

        console.log(`Large dataset: processing ${allEventIds.length} events in ${totalBatches} batches of ${MENTIONS_BATCH_SIZE}`);

        let allMentions: GdeltMention[] = [];

        for (let i = 0; i < totalBatches; i++) {
          const start = i * MENTIONS_BATCH_SIZE;
          const end = Math.min(start + MENTIONS_BATCH_SIZE, allEventIds.length);
          const batchEventIds = allEventIds.slice(start, end);

          console.log(`Processing batch ${i + 1}/${totalBatches}: events ${start + 1}-${end}`);

          batchProgress.current = i + 1;

          const batchMentions = await fetchMentionsBatch(batchEventIds);
          allMentions = [...allMentions, ...batchMentions];

          // Update mentions progressively so user sees results building up
          mentions = [...allMentions];
          batchProgress.loadedMentions = allMentions.length;

          console.log(`Batch ${i + 1} complete: ${batchMentions.length} mentions (total: ${allMentions.length})`);

          // Small delay to prevent overwhelming the server and allow UI updates
          if (i < totalBatches - 1) {
            await new Promise((resolve) => setTimeout(resolve, MENTIONS_BATCH_PAUSE_MS));
          }
        }

        console.log(`Batch loading complete: ${allMentions.length} mentions from ${allEventIds.length} events`);
        isBatchLoading = false;
      }
    } catch (err) {
      console.error('Error fetching all mentions:', err);
      mentionsError = err instanceof Error ? err.message : 'Failed to load mentions';
      mentions = [];
      isBatchLoading = false;
    } finally {
      loadingMentions = false;
    }
  }

  async function refreshDataFromServer(reason = 'filter change') {
    if (isUpdatingFilter) return;

    isUpdatingFilter = true;
    error = ''; // Clear any existing errors

    try {
      console.log(`Refreshing data due to ${reason}:`, { goldsteinRange, dateRange });

      // Clear existing markers and remove the map
      mapView?.destroyMap();

      // Fetch new data
      const data = await fetchEvents();
      console.log('Refresh - Fetched events:', data.events?.length || 0);

      events = data.events || [];
      availableCountries = extractAvailableCountries(events);

      // Only update available range if it changed
      const newAvailableDateRange = extractDateRange(events);
      if (newAvailableDateRange && (newAvailableDateRange[0] !== availableDateRange[0] || newAvailableDateRange[1] !== availableDateRange[1])) {
        availableDateRange = newAvailableDateRange;
      }

      // Reinitialize map with new data
      if (leaflet) {
        mapView?.initializeMap(leaflet, events);
      }

      console.log('Data refresh completed successfully');
    } catch (err: any) {
      console.error('Error refreshing data:', err);
      console.error('Error details:', err.message, err.stack);
      error = `Failed to refresh GDELT data: ${err.message}`;
    } finally {
      isUpdatingFilter = false;
    }
  }

  onMount(async () => {
    if (browser) {
      try {
        // Import Leaflet dynamically
        // @ts-ignore - leaflet types not installed
        leaflet = await import('leaflet');

        // Fetch data from API endpoint with Goldstein filter
        const data = await fetchEvents();

        events = data.events || [];
        console.log('Loaded events:', events.length, events.slice(0, 3));

        availableCountries = extractAvailableCountries(events);

        const eventDateRange = extractDateRange(events);
        if (eventDateRange) {
          availableDateRange = eventDateRange;

          // Initialize date range to show all dates if not set
          if (!dateRange[0] && !dateRange[1]) {
            dateRange = [...availableDateRange];
          }
        }

        loading = false;

        // Initialize the map after DOM update
        mapInitTimeout = setTimeout(() => {
          mapView?.initializeMap(leaflet, events);
        }, MAP_INIT_DELAY_MS);
      } catch (err) {
        console.error('Error loading data:', err);
        error = 'Failed to load GDELT data. Please check the database connection.';
        loading = false;
      }
    }
  });

  onDestroy(() => {
    clearTimeout(dateRefreshTimeout);
    clearTimeout(mapInitTimeout);
  });
</script>

<svelte:head>
  <title>GDELT World Events - Social Explorer</title>
  <meta name="description" content="A map of global news events from GDELT, with the people, places and themes behind them." />
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <PageHeader
    title="GDELT World Events"
    subtitle="Real-time global events visualization powered by GDELT database"
    showProject={false}
    wide
    iconPath="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />

  <!-- Main Content -->
  <div class="max-w-7xl xl:max-w-full 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8 xl:py-12">

    {#if loading}
      <div class="flex items-center justify-center h-96 bg-white rounded-xl shadow-sm">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p class="text-gray-600 font-medium">Loading GDELT events...</p>
          <p class="text-sm text-gray-500 mt-2">Fetching global event data from database</p>
        </div>
      </div>
    {:else if gdeltUnavailable}
      <DataUnavailable
        title="No GDELT events are loaded"
        description="The world map shows news events from the GDELT Project. It fills in once GDELT data has been loaded into the database." />
    {:else if error}
      <div class="bg-white rounded-xl shadow-sm p-6 border-l-4 border-red-400">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-800">Error Loading Data</h3>
            <p class="text-sm text-red-700 mt-1">{error}</p>
            <p class="text-xs text-red-600 mt-2">Check that the database is running, then reload the page.</p>
            <button
              on:click={() => error = ''}
              class="text-xs text-red-600 hover:text-red-800 mt-2 underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    {:else}
      <div class="grid grid-cols-1 xl:grid-cols-5 lg:grid-cols-4 gap-6 xl:gap-8">
        <!-- Filters Panel -->
        <div class="xl:col-span-1 lg:col-span-1">
          <div class="bg-white rounded-xl shadow-sm p-6 sticky top-4 min-h-screen lg:min-h-[calc(100vh-8rem)] xl:min-h-[calc(100vh-6rem)] relative">

            <!-- Loading Overlay for Filter Panel -->
            {#if isUpdatingFilter}
              <div class="absolute inset-0 bg-white/90 rounded-xl flex items-center justify-center z-40">
                <div class="text-center">
                  <div class="animate-spin rounded-full h-8 w-8 border-3 border-blue-200 border-t-blue-600 mx-auto mb-3"></div>
                  <div class="text-sm font-medium text-gray-700">Updating filters...</div>
                  <div class="text-xs text-gray-500 mt-1">Please wait</div>
                </div>
              </div>
            {/if}
            <!-- Reset Button -->
            <div class="flex items-center justify-between mb-6 xl:mb-8">
              <div class="flex items-center">
                <div class="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center mr-3">
                  <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
                  </svg>
                </div>
                <h3 class="text-lg xl:text-xl font-semibold text-gray-900">Filters</h3>
              </div>
              <button
                on:click={resetFilters}
                disabled={isUpdatingFilter}
                class="text-xs xl:text-sm px-3 xl:px-4 py-1.5 xl:py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-colors border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reset All
              </button>
            </div>

            <DateRangeFilter bind:dateRange {availableDateRange} {isUpdatingFilter} />

            <EventTypeFilter {events} {visibleEvents} {activeEventTypes} {isToggling} onToggle={toggleEventType} />

            <GoldsteinFilter
              bind:range={goldsteinRange}
              bind:min={goldsteinMin}
              bind:max={goldsteinMax}
              {isUpdatingFilter}
              onApply={updateMarkerVisibility}
              onRefresh={() => refreshDataFromServer('Goldstein scale change')}
            />

            <ToneFilter
              bind:range={toneRange}
              bind:min={toneMin}
              bind:max={toneMax}
              onApply={updateMarkerVisibility}
            />

            <CountryFilter
              {events}
              {eventsForCountryCounts}
              {availableCountries}
              {selectedCountries}
              {globalSouthCountryCodes}
              {allGlobalSouthSelected}
              bind:countrySearchTerm
              onToggleCountry={toggleCountry}
              onToggleGlobalSouth={toggleGlobalSouthCountries}
            />

            <!-- Legend Footer -->
            <div class="mt-auto pt-4 border-t border-gray-200">
              <div class="flex items-center text-xs text-gray-500">
                <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                Click types to filter map events
              </div>
              <p class="text-xs text-gray-500 mt-1">Based on GDELT CAMEO codes</p>
            </div>
          </div>
        </div>

        <!-- Map Container -->
        <div class="xl:col-span-4 lg:col-span-3">
          <!-- Sticky wrapper: stats + map pin at top while scrolling mentions -->
          <div class="sticky top-0 z-10 space-y-4 pb-4 bg-gray-50">
            <GdeltStats {visibleEvents} {isUpdatingFilter} />

            <GdeltMap
              bind:this={mapView}
              visibleCount={visibleEvents.length}
              eventsCount={events.length}
              {isUpdatingFilter}
              {loadingMentions}
              {isBatchLoading}
              {batchProgress}
              {showMentions}
              onShowAllMentions={fetchAllMentionsForVisible}
              onSelectCountry={selectOnlyCountry}
              onShowMentions={fetchMentions}
            />
          </div>
          <!-- END sticky wrapper -->

          <MentionsPanel
            bind:this={mentionsPanel}
            bind:showMentions
            {mentions}
            {selectedEventId}
            {loadingMentions}
            {isBatchLoading}
            {batchProgress}
            {mentionsError}
            {mentionsLimitationNotice}
            visibleEventCount={visibleEvents.length}
          />
        </div>
      </div>

    {/if}
  </div>
</div>

<!-- Footer -->
<footer class="bg-gray-50 border-t border-gray-200">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <div class="flex flex-col sm:flex-row justify-between items-center">
      <!-- Brand -->
      <div class="flex items-center mb-4 sm:mb-0">
        <div class="h-6 w-6 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center mr-2">
          <span class="text-white font-bold text-xs">SE</span>
        </div>
        <span class="text-sm text-gray-600">Social Explorer - GDELT World Events</span>
      </div>

      <!-- Links -->
      <div class="flex items-center space-x-6 text-sm text-gray-500">
        <span>Data Source: GDELT Project</span>
        <span class="text-gray-300">|</span>
        <span>Last Updated: {new Date().toLocaleDateString()}</span>
        <span class="text-gray-300">|</span>
        <a href="https://concepttocloud.com/" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 font-medium transition-colors">
          Concept to Cloud
        </a>
      </div>
    </div>
  </div>
</footer>
