<script lang="ts">
  import { onMount } from 'svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { ErrorAlert } from '$lib/components/ui';
  import { formatNumber } from '$lib/utils/formatUtils';
  import DataUnavailable from '$lib/components/ui/DataUnavailable.svelte';

  let loading = true;
  let errorMessage = '';
  let unavailable = false;

  // Date range filter — default to last 12 months rolling window
  const _now = new Date();
  const _12moAgo = new Date(_now.getFullYear() - 1, _now.getMonth(), _now.getDate());
  let dateStart = _12moAgo.toISOString().split('T')[0];
  let dateEnd = _now.toISOString().split('T')[0];
  let debounceTimer: ReturnType<typeof setTimeout>;

  // Data
  let summary: any = null;
  let countries: any[] = [];
  let eventTypes: any[] = [];
  let actors: any[] = [];

  // Sort state for countries
  let countrySortField: 'country' | 'events' | 'avg_goldstein' | 'avg_tone' = 'events';
  let countrySortDir: 'asc' | 'desc' = 'desc';

  // Sort state for event types
  let eventSortField: 'code' | 'event_type' | 'events' | 'avg_goldstein' = 'events';
  let eventSortDir: 'asc' | 'desc' = 'desc';

  // Sort state for actors
  let actorSortField: 'actor' | 'mentions' | 'avg_tone' = 'mentions';
  let actorSortDir: 'asc' | 'desc' = 'desc';

  $: sortedCountries = [...countries].sort((a, b) => {
    const dir = countrySortDir === 'asc' ? 1 : -1;
    if (countrySortField === 'country') return dir * (a.country || '').localeCompare(b.country || '');
    return dir * ((a[countrySortField] ?? 0) - (b[countrySortField] ?? 0));
  });

  $: sortedEventTypes = [...eventTypes].sort((a, b) => {
    const dir = eventSortDir === 'asc' ? 1 : -1;
    if (eventSortField === 'code' || eventSortField === 'event_type') return dir * (a[eventSortField] || '').localeCompare(b[eventSortField] || '');
    return dir * ((a[eventSortField] ?? 0) - (b[eventSortField] ?? 0));
  });

  $: sortedActors = [...actors].sort((a, b) => {
    const dir = actorSortDir === 'asc' ? 1 : -1;
    if (actorSortField === 'actor') return dir * (a.actor || '').localeCompare(b.actor || '');
    return dir * ((a[actorSortField] ?? 0) - (b[actorSortField] ?? 0));
  });

  function buildParams(): string {
    const parts: string[] = [];
    if (dateStart) parts.push(`dateStart=${dateStart}`);
    if (dateEnd) parts.push(`dateEnd=${dateEnd}`);
    return parts.length > 0 ? '&' + parts.join('&') : '';
  }

  async function fetchData() {
    loading = true;
    errorMessage = '';
    const params = buildParams();

    try {
      const [summaryRes, countryRes, eventRes, actorRes] = await Promise.all([
        fetch(`/api/unified-analytics?type=gdelt-summary${params}`),
        fetch(`/api/unified-analytics?type=gdelt-by-country${params}&limit=20`),
        fetch(`/api/unified-analytics?type=gdelt-by-eventtype${params}`),
        fetch(`/api/unified-analytics?type=gdelt-top-actors${params}&limit=20`)
      ]);

      const [summaryData, countryData, eventData, actorData] = await Promise.all([
        summaryRes.json(),
        countryRes.json(),
        eventRes.json(),
        actorRes.json()
      ]);

      if (summaryData.success && summaryData.data?.length > 0) {
        summary = summaryData.data[0];
      } else {
        summary = null;
      }
      countries = countryData.success ? countryData.data || [] : [];
      eventTypes = eventData.success ? eventData.data || [] : [];
      actors = actorData.success ? actorData.data || [] : [];

      unavailable = !summary && countries.length === 0 && eventTypes.length === 0;
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Failed to load GDELT analytics data';
    } finally {
      loading = false;
    }
  }

  function onDateChange() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      fetchData();
    }, 500);
  }

  function clearDateRange() {
    dateStart = '';
    dateEnd = '';
    fetchData();
  }

  function toggleCountrySort(field: typeof countrySortField) {
    if (countrySortField === field) {
      countrySortDir = countrySortDir === 'asc' ? 'desc' : 'asc';
    } else {
      countrySortField = field;
      countrySortDir = field === 'country' ? 'asc' : 'desc';
    }
  }

  function toggleEventSort(field: typeof eventSortField) {
    if (eventSortField === field) {
      eventSortDir = eventSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      eventSortField = field;
      eventSortDir = field === 'code' || field === 'event_type' ? 'asc' : 'desc';
    }
  }

  function toggleActorSort(field: typeof actorSortField) {
    if (actorSortField === field) {
      actorSortDir = actorSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      actorSortField = field;
      actorSortDir = field === 'actor' ? 'asc' : 'desc';
    }
  }

  function sortIndicator(active: boolean, dir: 'asc' | 'desc'): string {
    if (!active) return '';
    return dir === 'asc' ? ' ↑' : ' ↓';
  }

  function formatGoldstein(val: number | null | undefined): string {
    if (val == null || isNaN(val)) return '—';
    return val.toFixed(2);
  }

  function formatTone(val: number | null | undefined): string {
    if (val == null || isNaN(val)) return '—';
    return val.toFixed(2);
  }

  function toneColor(val: number | null | undefined): string {
    if (val == null || isNaN(val)) return 'text-gray-500';
    if (val > 2) return 'text-emerald-600';
    if (val < -2) return 'text-red-600';
    return 'text-gray-600';
  }

  function goldsteinColor(val: number | null | undefined): string {
    if (val == null || isNaN(val)) return 'text-gray-500';
    if (val > 2) return 'text-emerald-600';
    if (val < -2) return 'text-red-600';
    return 'text-amber-600';
  }

  let refreshingViews = false;
  let refreshMessage = '';

  async function refreshMaterializedViews() {
    refreshingViews = true;
    refreshMessage = '';
    try {
      const res = await fetch('/api/unified-analytics?type=gdelt-refresh-views');
      const data = await res.json();
      if (data.success) {
        refreshMessage = 'Views refreshed. Reloading data...';
        await fetchData();
        refreshMessage = '';
      } else {
        refreshMessage = 'Failed to refresh views';
      }
    } catch (err) {
      refreshMessage = 'Error refreshing views';
    } finally {
      refreshingViews = false;
    }
  }

  function formatSqlDate(d: number | string | null | undefined): string {
    if (!d) return '—';
    const s = String(d);
    if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    return s;
  }

  onMount(fetchData);
</script>

<svelte:head>
  <title>GDELT Analytics - Social Explorer</title>
  <meta name="description" content="Trends, actors and tone across global news events from GDELT." />
</svelte:head>

<PageHeader
  title="GDELT Analytics"
  subtitle="Explore global news events from the GDELT Project"
  accentColor="amber"
  backHref="/gdelt"
>
  <div slot="icon">
    <div class="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl shadow-lg flex items-center justify-center mr-6 border border-white/20 backdrop-blur-sm">
      <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
    </div>
  </div>
  <div slot="actions">
    <a href="/gdelt" class="inline-flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors border border-white/20 text-sm font-medium">
      <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
      </svg>
      Map View
    </a>
  </div>
</PageHeader>

<div class="min-h-screen bg-gray-50">
  <div class="max-w-7xl xl:max-w-full 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-8">
    <!-- Date Range Filter + Actions Bar -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
      <div class="flex flex-wrap items-center gap-4">
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
          <span class="text-sm font-medium text-gray-700">Date Range:</span>
        </div>
        <input
          type="date"
          bind:value={dateStart}
          on:change={onDateChange}
          class="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <span class="text-gray-500">to</span>
        <input
          type="date"
          bind:value={dateEnd}
          on:change={onDateChange}
          class="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {#if dateStart || dateEnd}
          <button
            on:click={clearDateRange}
            class="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Clear
          </button>
        {/if}
        <div class="ml-auto flex items-center gap-3">
          {#if summary}
            <span class="text-xs text-gray-500">
              Data: {formatSqlDate(summary.date_min)} to {formatSqlDate(summary.date_max)}
            </span>
          {/if}
          <button
            on:click={refreshMaterializedViews}
            disabled={refreshingViews}
            class="inline-flex items-center text-xs px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors disabled:opacity-50"
          >
            {#if refreshingViews}
              <svg class="animate-spin w-3 h-3 mr-1.5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Refreshing...
            {:else}
              <svg class="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
              Refresh Views
            {/if}
          </button>
        </div>
      </div>
      {#if refreshMessage}
        <p class="text-xs text-blue-600 mt-2">{refreshMessage}</p>
      {/if}
    </div>

    {#if unavailable}
      <DataUnavailable
        title="No GDELT events are loaded"
        description="These tables summarise GDELT news events. They fill in once GDELT data has been loaded into the database." />
    {/if}
    {#if errorMessage}
      <ErrorAlert message={errorMessage} />
    {/if}

    {#if loading}
      <div class="flex items-center justify-center py-24">
        <div class="flex flex-col items-center space-y-4">
          <div class="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p class="text-gray-500 text-sm">Loading GDELT analytics...</p>
        </div>
      </div>
    {:else}
      <!-- Summary Stats -->
      {#if summary}
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Total Events</p>
            <p class="text-2xl font-bold text-gray-900">{formatNumber(summary.total_events)}</p>
          </div>
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Countries</p>
            <p class="text-2xl font-bold text-gray-900">{formatNumber(summary.countries)}</p>
          </div>
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Avg Goldstein</p>
            <p class="text-2xl font-bold {goldsteinColor(summary.avg_goldstein)}">{formatGoldstein(summary.avg_goldstein)}</p>
            <p class="text-xs text-gray-500 mt-1">-10 (conflict) to +10 (cooperation)</p>
          </div>
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Avg Tone</p>
            <p class="text-2xl font-bold {toneColor(summary.avg_tone)}">{formatTone(summary.avg_tone)}</p>
            <p class="text-xs text-gray-500 mt-1">Negative &larr; 0 &rarr; Positive</p>
          </div>
        </div>
      {/if}

      <!-- Two-column: Countries + Event Types -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <!-- Country Breakdown -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div class="px-5 py-4 border-b border-gray-100 bg-gray-50">
            <h2 class="text-lg font-semibold text-gray-900">Top Countries</h2>
            <p class="text-xs text-gray-500 mt-1">By event count (top 20)</p>
          </div>
          {#if countries.length === 0}
            <div class="px-5 py-8 text-center text-gray-500 text-sm">No country data available</div>
          {:else}
            <div class="overflow-x-auto max-h-[480px] overflow-y-auto">
              <table class="w-full text-sm">
                <thead class="sticky top-0 bg-gray-50">
                  <tr class="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th class="px-4 py-3 cursor-pointer hover:text-gray-800" on:click={() => toggleCountrySort('country')}>
                      Country{sortIndicator(countrySortField === 'country', countrySortDir)}
                    </th>
                    <th class="px-4 py-3 text-right cursor-pointer hover:text-gray-800" on:click={() => toggleCountrySort('events')}>
                      Events{sortIndicator(countrySortField === 'events', countrySortDir)}
                    </th>
                    <th class="px-4 py-3 text-right cursor-pointer hover:text-gray-800" on:click={() => toggleCountrySort('avg_goldstein')}>
                      Goldstein{sortIndicator(countrySortField === 'avg_goldstein', countrySortDir)}
                    </th>
                    <th class="px-4 py-3 text-right cursor-pointer hover:text-gray-800" on:click={() => toggleCountrySort('avg_tone')}>
                      Tone{sortIndicator(countrySortField === 'avg_tone', countrySortDir)}
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  {#each sortedCountries as row}
                    <tr class="hover:bg-blue-50/50 transition-colors">
                      <td class="px-4 py-2.5 text-gray-900 font-medium">{row.country || '—'}</td>
                      <td class="px-4 py-2.5 text-right text-gray-600">{formatNumber(row.events)}</td>
                      <td class="px-4 py-2.5 text-right {goldsteinColor(row.avg_goldstein)}">{formatGoldstein(row.avg_goldstein)}</td>
                      <td class="px-4 py-2.5 text-right {toneColor(row.avg_tone)}">{formatTone(row.avg_tone)}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>

        <!-- Event Type Breakdown -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div class="px-5 py-4 border-b border-gray-100 bg-gray-50">
            <h2 class="text-lg font-semibold text-gray-900">Event Types (CAMEO)</h2>
            <p class="text-xs text-gray-500 mt-1">Root event codes with labels</p>
          </div>
          {#if eventTypes.length === 0}
            <div class="px-5 py-8 text-center text-gray-500 text-sm">No event type data available</div>
          {:else}
            <div class="overflow-x-auto max-h-[480px] overflow-y-auto">
              <table class="w-full text-sm">
                <thead class="sticky top-0 bg-gray-50">
                  <tr class="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th class="px-4 py-3 cursor-pointer hover:text-gray-800" on:click={() => toggleEventSort('code')}>
                      Code{sortIndicator(eventSortField === 'code', eventSortDir)}
                    </th>
                    <th class="px-4 py-3 cursor-pointer hover:text-gray-800" on:click={() => toggleEventSort('event_type')}>
                      Type{sortIndicator(eventSortField === 'event_type', eventSortDir)}
                    </th>
                    <th class="px-4 py-3 text-right cursor-pointer hover:text-gray-800" on:click={() => toggleEventSort('events')}>
                      Events{sortIndicator(eventSortField === 'events', eventSortDir)}
                    </th>
                    <th class="px-4 py-3 text-right cursor-pointer hover:text-gray-800" on:click={() => toggleEventSort('avg_goldstein')}>
                      Goldstein{sortIndicator(eventSortField === 'avg_goldstein', eventSortDir)}
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  {#each sortedEventTypes as row}
                    <tr class="hover:bg-blue-50/50 transition-colors">
                      <td class="px-4 py-2.5 text-blue-600 font-mono text-xs">{row.code}</td>
                      <td class="px-4 py-2.5 text-gray-900">{row.event_type}</td>
                      <td class="px-4 py-2.5 text-right text-gray-600">{formatNumber(row.events)}</td>
                      <td class="px-4 py-2.5 text-right {goldsteinColor(row.avg_goldstein)}">{formatGoldstein(row.avg_goldstein)}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
      </div>

      <!-- Top Actors -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div class="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <h2 class="text-lg font-semibold text-gray-900">Top Actors</h2>
          <p class="text-xs text-gray-500 mt-1">Most mentioned actors across events (top 20)</p>
        </div>
        {#if actors.length === 0}
          <div class="px-5 py-8 text-center text-gray-500 text-sm">No actor data available</div>
        {:else}
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-gray-50">
                <tr class="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th class="px-5 py-3 cursor-pointer hover:text-gray-800" on:click={() => toggleActorSort('actor')}>
                    Actor{sortIndicator(actorSortField === 'actor', actorSortDir)}
                  </th>
                  <th class="px-5 py-3 text-right cursor-pointer hover:text-gray-800" on:click={() => toggleActorSort('mentions')}>
                    Mentions{sortIndicator(actorSortField === 'mentions', actorSortDir)}
                  </th>
                  <th class="px-5 py-3 text-right cursor-pointer hover:text-gray-800" on:click={() => toggleActorSort('avg_tone')}>
                    Avg Tone{sortIndicator(actorSortField === 'avg_tone', actorSortDir)}
                  </th>
                  <th class="px-5 py-3 w-1/3">Tone</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                {#each sortedActors as row}
                  <tr class="hover:bg-blue-50/50 transition-colors">
                    <td class="px-5 py-3 text-gray-900 font-medium">{row.actor}</td>
                    <td class="px-5 py-3 text-right text-gray-600">{formatNumber(row.mentions)}</td>
                    <td class="px-5 py-3 text-right {toneColor(row.avg_tone)}">{formatTone(row.avg_tone)}</td>
                    <td class="px-5 py-3">
                      <div class="flex items-center gap-2">
                        <div class="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          {#if row.avg_tone != null && !isNaN(row.avg_tone)}
                            <div
                              class="h-full rounded-full {row.avg_tone >= 0 ? 'bg-emerald-500' : 'bg-red-500'}"
                              style="width: {Math.min(Math.abs(row.avg_tone) * 5, 50)}%; margin-left: {row.avg_tone >= 0 ? '50%' : Math.max(50 - Math.abs(row.avg_tone) * 5, 0) + '%'}"
                            ></div>
                          {/if}
                        </div>
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>

      <!-- Navigation links -->
      <div class="flex items-center justify-center gap-6 pb-4">
        <a href="/gdelt" class="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors text-sm font-medium">
          <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
          </svg>
          Map View
        </a>
        <a href="/gdelt/intelligence" class="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors text-sm font-medium">
          <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
          </svg>
          Intelligence Dashboard
        </a>
      </div>
    {/if}
  </div>
</div>
