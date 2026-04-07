<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { ErrorAlert } from '$lib/components/ui';
  import { formatNumber } from '$lib/utils/formatUtils';
  import { waitForEcharts, initChart } from '$lib/utils/echarts';
  import { getCountryNameWithFallback } from '$lib/countryMapping';

  // Helper: resolve country code to full name
  function countryName(code: string): string {
    return getCountryNameWithFallback(code, code);
  }

  let loading = true;
  let errorMessage = '';

  // Date range — default last 12 months
  const _now = new Date();
  const _12mo = new Date(_now.getFullYear() - 1, _now.getMonth(), _now.getDate());
  let dateStart = _12mo.toISOString().split('T')[0];
  let dateEnd = _now.toISOString().split('T')[0];

  // Search
  let searchQuery = '';
  let searchResults: any = null;

  // Selected country for drill-down
  let selectedCountry = '';
  let countryDetail: any = null;

  // Overview data
  let conflicts: any[] = [];
  let topCountries: any[] = [];
  let summary: any = null;
  let countryLoading = false;

  // Simple markdown to HTML for LLM output (bold, italic, lists)
  function renderMarkdown(text: string): string {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')  // escape HTML
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')                    // **bold**
      .replace(/\*(.+?)\*/g, '<em>$1</em>')                                // *italic*
      .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')         // - list items
      .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal">$2</li>') // 1. numbered
      .replace(/\n/g, '<br>');                                               // line breaks
  }

  // AI Narrative Summary
  let narrativeLoading = false;
  let narrative = '';
  let narrativeContext: any = null;

  async function generateNarrative(country: string) {
    narrativeLoading = true;
    narrative = '';
    narrativeContext = null;
    try {
      const params = new URLSearchParams({ type: 'gdelt-narrative-summary', country });
      if (dateStart) params.set('dateStart', dateStart);
      if (dateEnd) params.set('dateEnd', dateEnd);
      const res = await fetch(`/api/unified-analytics?${params}`);
      const data = await res.json();
      if (data.success && data.data) {
        narrative = data.data.narrative;
        narrativeContext = data.data.context;
      } else {
        narrative = `Unable to generate summary: ${data.error || 'unknown error'}`;
      }
    } catch (err: any) {
      narrative = `Error: ${err.message}`;
    } finally {
      narrativeLoading = false;
    }
  }
  let searchLoading = false;

  // Charts
  let toneChart: any = null;

  let debounceTimer: ReturnType<typeof setTimeout>;

  onMount(async () => {
    await loadData();
  });

  function buildDateParams(): string {
    let params = '';
    if (dateStart) params += `&dateStart=${dateStart}`;
    if (dateEnd) params += `&dateEnd=${dateEnd}`;
    return params;
  }

  async function loadData() {
    try {
      loading = true;
      errorMessage = '';
      const dp = buildDateParams();

      const [summaryRes, conflictsRes, countriesRes] = await Promise.all([
        fetch(`/api/unified-analytics?type=gdelt-summary${dp}`),
        fetch(`/api/unified-analytics?type=gdelt-conflicts${dp}`),
        fetch(`/api/unified-analytics?type=gdelt-by-country${dp}&limit=10`)
      ]);

      const summaryData = await summaryRes.json();
      const conflictsData = await conflictsRes.json();
      const countriesData = await countriesRes.json();

      summary = summaryData.data?.[0] || null;
      conflicts = conflictsData.data || [];
      topCountries = countriesData.data || [];

      loading = false;
    } catch (error) {
      console.error('Failed to load GDELT intelligence:', error);
      errorMessage = 'Failed to load data';
      loading = false;
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) {
      searchResults = null;
      return;
    }
    try {
      searchLoading = true;
      const dp = buildDateParams();
      const res = await fetch(`/api/unified-analytics?type=gdelt-search&q=${encodeURIComponent(searchQuery)}${dp}`);
      const data = await res.json();
      searchResults = data.data || null;
      searchLoading = false;
    } catch (error) {
      errorMessage = 'Search failed';
      searchLoading = false;
    }
  }

  async function selectCountry(countryCode: string) {
    selectedCountry = countryCode;
    countryLoading = true;
    countryDetail = null;
    try {
      const dp = buildDateParams();
      const res = await fetch(`/api/unified-analytics?type=gdelt-country-detail&country=${countryCode}${dp}`);
      const data = await res.json();
      countryDetail = data.data || null;

      // Render tone chart
      if (countryDetail?.toneTrend?.length > 0) {
        await waitForEcharts();
        setTimeout(() => renderToneChart(), 100);
      }
      countryLoading = false;
    } catch (error) {
      errorMessage = 'Failed to load country detail';
      countryLoading = false;
    }
  }

  function renderToneChart() {
    const container = document.getElementById('tone-chart');
    if (!container || !countryDetail?.toneTrend) return;

    toneChart = initChart(container);
    if (!toneChart) return;

    const dates = countryDetail.toneTrend.map((d: any) => String(d.date));
    const toneValues = countryDetail.toneTrend.map((d: any) => d.avg_tone);
    const goldsteinValues = countryDetail.toneTrend.map((d: any) => d.avg_goldstein);
    const eventCounts = countryDetail.toneTrend.map((d: any) => d.events);

    toneChart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['Tone', 'Goldstein', 'Events'], bottom: 0 },
      grid: { left: 50, right: 50, top: 30, bottom: 50 },
      xAxis: { type: 'category', data: dates, axisLabel: { rotate: 45, fontSize: 9 } },
      yAxis: [
        { type: 'value', name: 'Score', position: 'left' },
        { type: 'value', name: 'Events', position: 'right' }
      ],
      series: [
        { name: 'Tone', type: 'line', data: toneValues, smooth: true, lineStyle: { color: '#3b82f6' }, itemStyle: { color: '#3b82f6' } },
        { name: 'Goldstein', type: 'line', data: goldsteinValues, smooth: true, lineStyle: { color: '#ef4444' }, itemStyle: { color: '#ef4444' } },
        { name: 'Events', type: 'bar', data: eventCounts, yAxisIndex: 1, itemStyle: { color: '#e5e7eb' }, barWidth: '60%' }
      ]
    });
  }

  function onDateChange() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      loadData();
      if (selectedCountry) selectCountry(selectedCountry);
      if (searchQuery) handleSearch();
      narrative = '';
      narrativeContext = null;
    }, 500);
  }

  function getGoldsteinColor(value: number): string {
    if (value >= 5) return 'text-green-600';
    if (value >= 0) return 'text-blue-600';
    if (value >= -5) return 'text-amber-600';
    return 'text-red-600';
  }

  function getToneColor(value: number): string {
    if (value >= 2) return 'text-green-600';
    if (value >= 0) return 'text-blue-600';
    if (value >= -2) return 'text-amber-600';
    return 'text-red-600';
  }

  $: if (dateStart || dateEnd) onDateChange();
</script>

<svelte:head>
  <title>GDELT Intelligence - Social Explorer</title>
</svelte:head>

<PageHeader
  title="GDELT Intelligence"
  subtitle="Explore global events, conflicts, and media narratives"
  accentColor="red"
  showProject={false}
>
  <svelte:fragment slot="actions">
    <button on:click={() => goto('/gdelt')} class="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg">
      Map View
    </button>
    <button on:click={() => goto('/gdelt/analytics')} class="px-4 py-2 text-sm font-medium text-red-100 bg-red-800/30 hover:bg-red-800/50 rounded-lg border border-red-400/30">
      Data Tables
    </button>
  </svelte:fragment>
</PageHeader>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
  {#if errorMessage}<ErrorAlert message={errorMessage} />{/if}

  <!-- Search & Date Filter Bar -->
  <div class="bg-white rounded-xl shadow-sm p-4 mb-4">
    <div class="flex flex-col md:flex-row gap-3">
      <div class="flex-1">
        <div class="relative">
          <input
            type="text"
            bind:value={searchQuery}
            on:keydown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search countries, actors, locations... (e.g. Iran, UNITED STATES, Ukraine)"
            class="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
          <svg class="absolute left-3 top-3 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
        </div>
      </div>
      <div class="flex gap-2 items-center">
        <input type="date" bind:value={dateStart} class="text-sm border border-gray-200 rounded-lg px-3 py-2" />
        <span class="text-gray-400 text-sm">to</span>
        <input type="date" bind:value={dateEnd} class="text-sm border border-gray-200 rounded-lg px-3 py-2" />
        <button on:click={handleSearch} class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg">
          Search
        </button>
      </div>
    </div>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-16">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
    </div>
  {:else}

  <!-- Search Loading -->
  {#if searchLoading}
    <div class="bg-white rounded-xl shadow-sm p-6 mb-4 flex items-center">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600 mr-3"></div>
      <span class="text-gray-600">Searching for "{searchQuery}"...</span>
    </div>
  {/if}

  <!-- Search Results -->
  {#if searchResults && !searchLoading}
    <div class="bg-white rounded-xl shadow-sm p-6 mb-4">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-gray-900">
          Search: "{searchQuery}"
          <span class="text-sm font-normal text-gray-500 ml-2">{formatNumber(searchResults.summary?.total || 0)} events</span>
        </h2>
        <button on:click={() => { searchResults = null; searchQuery = ''; }} class="text-sm text-gray-500 hover:text-gray-700">Clear</button>
      </div>

      {#if searchResults.summary}
        <div class="grid grid-cols-4 gap-4 mb-4">
          <div class="text-center p-3 bg-gray-50 rounded-lg">
            <div class="text-xl font-bold text-gray-900">{formatNumber(searchResults.summary.total || 0)}</div>
            <div class="text-xs text-gray-500">Events</div>
          </div>
          <div class="text-center p-3 bg-gray-50 rounded-lg">
            <div class="text-xl font-bold {getGoldsteinColor(searchResults.summary.avg_goldstein || 0)}">{(searchResults.summary.avg_goldstein || 0).toFixed(1)}</div>
            <div class="text-xs text-gray-500">Avg Goldstein</div>
          </div>
          <div class="text-center p-3 bg-gray-50 rounded-lg">
            <div class="text-xl font-bold {getToneColor(searchResults.summary.avg_tone || 0)}">{(searchResults.summary.avg_tone || 0).toFixed(1)}</div>
            <div class="text-xs text-gray-500">Avg Tone</div>
          </div>
          <div class="text-center p-3 bg-gray-50 rounded-lg">
            <div class="text-xl font-bold text-blue-600">{searchResults.summary.countries || 0}</div>
            <div class="text-xs text-gray-500">Countries</div>
          </div>
        </div>
      {/if}

      <!-- Key Events -->
      <div class="space-y-2 max-h-96 overflow-y-auto">
        {#each (searchResults.events || []).slice(0, 20) as event}
          <div class="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 border border-gray-100">
            <div class="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold {
              (event.goldsteinscale || 0) < -5 ? 'bg-red-100 text-red-700' :
              (event.goldsteinscale || 0) < 0 ? 'bg-amber-100 text-amber-700' :
              'bg-green-100 text-green-700'
            }">
              {(event.goldsteinscale || 0).toFixed(0)}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-gray-900">
                {event.actor1name || '?'} → {event.actor2name || '?'}
              </div>
              <div class="text-xs text-gray-500">
                {event.actiongeo_fullname || ''} · {event.sqldate} · {event.numarticles || 0} articles
              </div>
              {#if event.sourceurl}
                <a href={event.sourceurl} target="_blank" class="text-xs text-blue-600 hover:underline truncate block mt-1">{event.sourceurl.substring(0, 80)}...</a>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Overview: Summary + Conflicts Side by Side -->
  <div class="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
    <!-- Summary Stats -->
    <div class="bg-white rounded-xl shadow-sm p-5">
      <h3 class="text-sm font-semibold text-gray-700 mb-3">Global Overview</h3>
      {#if summary}
        <div class="space-y-3">
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-500">Total Events</span>
            <span class="text-lg font-bold text-gray-900">{formatNumber(summary.total_events || 0)}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-500">Countries</span>
            <span class="text-lg font-bold text-blue-600">{summary.countries || 0}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-500">Avg Goldstein</span>
            <span class="text-lg font-bold {getGoldsteinColor(summary.avg_goldstein || 0)}">{(summary.avg_goldstein || 0).toFixed(2)}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-500">Avg Tone</span>
            <span class="text-lg font-bold {getToneColor(summary.avg_tone || 0)}">{(summary.avg_tone || 0).toFixed(2)}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-500">Date Range</span>
            <span class="text-xs text-gray-600">{summary.date_min} – {summary.date_max}</span>
          </div>
        </div>
      {/if}
    </div>

    <!-- Top Countries (clickable) -->
    <div class="bg-white rounded-xl shadow-sm p-5">
      <h3 class="text-sm font-semibold text-gray-700 mb-3">Top Countries</h3>
      <div class="space-y-1.5 max-h-52 overflow-y-auto">
        {#each topCountries as country}
          <button
            on:click={() => selectCountry(country.country)}
            class="w-full flex items-center justify-between px-2 py-1.5 rounded text-left hover:bg-blue-50 transition-colors {selectedCountry === country.country ? 'bg-blue-100 border border-blue-300' : ''}"
          >
            <span class="text-sm font-medium text-gray-900">{countryName(country.country)}</span>
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-500">{formatNumber(country.events)}</span>
              <span class="text-xs font-mono {getGoldsteinColor(country.avg_goldstein || 0)}">{(country.avg_goldstein || 0).toFixed(1)}</span>
            </div>
          </button>
        {/each}
      </div>
    </div>

    <!-- Active Conflicts -->
    <div class="bg-white rounded-xl shadow-sm p-5">
      <h3 class="text-sm font-semibold text-gray-700 mb-3">
        Conflict Hotspots
        <span class="text-xs font-normal text-red-500 ml-1">Goldstein &lt; -5</span>
      </h3>
      <div class="space-y-1.5 max-h-52 overflow-y-auto">
        {#each conflicts.slice(0, 10) as conflict}
          <button
            on:click={() => selectCountry(conflict.country)}
            class="w-full flex items-center justify-between px-2 py-1.5 rounded text-left hover:bg-red-50 transition-colors"
          >
            <div>
              <span class="text-sm font-medium text-gray-900">{countryName(conflict.country)}</span>
              {#if conflict.violent_events > 0}
                <span class="ml-1 text-xs text-red-600">({conflict.violent_events} violent)</span>
              {/if}
            </div>
            <span class="text-xs font-mono text-red-600">{formatNumber(conflict.conflict_events)}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- Country Loading -->
  {#if countryLoading}
    <div class="bg-white rounded-xl shadow-sm p-8 mb-4 border-l-4 border-blue-500 flex items-center justify-center">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
      <span class="text-gray-600">Loading {countryName(selectedCountry)} data...</span>
    </div>
  {/if}

  <!-- Country Detail Panel -->
  {#if selectedCountry && countryDetail && !countryLoading}
    <div class="bg-white rounded-xl shadow-sm p-6 mb-4 border-l-4 border-blue-500">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold text-gray-900">
          Country Spotlight: {countryName(selectedCountry)}
        </h2>
        <button on:click={() => { selectedCountry = ''; countryDetail = null; }} class="text-sm text-gray-500 hover:text-gray-700">Close</button>
      </div>

      <!-- Country Summary -->
      {#if countryDetail.summary}
        <div class="grid grid-cols-4 gap-4 mb-6">
          <div class="text-center p-3 bg-blue-50 rounded-lg">
            <div class="text-2xl font-bold text-blue-700">{formatNumber(countryDetail.summary.total_events || 0)}</div>
            <div class="text-xs text-blue-600">Events</div>
          </div>
          <div class="text-center p-3 bg-gray-50 rounded-lg">
            <div class="text-2xl font-bold">{countryDetail.summary.unique_actors || 0}</div>
            <div class="text-xs text-gray-500">Unique Actors</div>
          </div>
          <div class="text-center p-3 bg-gray-50 rounded-lg">
            <div class="text-2xl font-bold {getGoldsteinColor(countryDetail.summary.avg_goldstein || 0)}">{(countryDetail.summary.avg_goldstein || 0).toFixed(2)}</div>
            <div class="text-xs text-gray-500">Avg Goldstein</div>
          </div>
          <div class="text-center p-3 bg-gray-50 rounded-lg">
            <div class="text-2xl font-bold {getToneColor(countryDetail.summary.avg_tone || 0)}">{(countryDetail.summary.avg_tone || 0).toFixed(2)}</div>
            <div class="text-xs text-gray-500">Avg Tone</div>
          </div>
        </div>
      {/if}

      <!-- Tone Timeline Chart -->
      {#if countryDetail.toneTrend?.length > 0}
        <div class="mb-6">
          <h3 class="text-sm font-semibold text-gray-700 mb-2">Tone & Events Over Time</h3>
          <div id="tone-chart" class="w-full h-64"></div>
        </div>
      {/if}

      <!-- AI Intelligence Briefing -->
      <div class="mb-6 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-5 border border-indigo-200">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-lg flex items-center justify-center">
              <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
              </svg>
            </div>
            <h3 class="text-sm font-semibold text-indigo-900">AI Intelligence Briefing</h3>
            {#if narrativeContext}
              <span class="text-xs text-indigo-500 bg-indigo-100 px-2 py-0.5 rounded-full">Gemma 3</span>
            {/if}
          </div>
          <button
            on:click={() => generateNarrative(selectedCountry)}
            disabled={narrativeLoading}
            class="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg transition-colors flex items-center gap-1.5"
          >
            {#if narrativeLoading}
              <svg class="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating...
            {:else}
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
              </svg>
              {narrative ? 'Regenerate' : 'Generate Briefing'}
            {/if}
          </button>
        </div>

        {#if narrativeLoading}
          <div class="flex items-center gap-3 py-6">
            <div class="animate-spin rounded-full h-5 w-5 border-2 border-indigo-200 border-t-indigo-600"></div>
            <span class="text-sm text-indigo-700">Analyzing {countryName(selectedCountry)} events with Gemma 3...</span>
          </div>
        {:else if narrative}
          <div class="prose prose-sm max-w-none text-gray-800 leading-relaxed">
            {#each narrative.split('\n\n') as paragraph}
              {#if paragraph.trim()}
                <p class="mb-3 last:mb-0">{@html renderMarkdown(paragraph.trim())}</p>
              {/if}
            {/each}
          </div>
        {:else}
          <p class="text-sm text-indigo-600 py-2">Click "Generate Briefing" for an AI-powered analysis of {countryName(selectedCountry)}'s event patterns.</p>
        {/if}
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Top Actors -->
        <div>
          <h3 class="text-sm font-semibold text-gray-700 mb-2">Key Actors</h3>
          <div class="space-y-1 max-h-48 overflow-y-auto">
            {#each (countryDetail.actors || []).slice(0, 10) as actor}
              <div class="flex items-center justify-between px-2 py-1 text-sm">
                <span class="text-gray-900 truncate flex-1">{actor.actor}</span>
                <div class="flex items-center gap-2 ml-2">
                  <span class="text-xs text-gray-500">{formatNumber(actor.mentions)}</span>
                  <span class="text-xs {getToneColor(actor.avg_tone || 0)}">{(actor.avg_tone || 0).toFixed(1)}</span>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Event Types -->
        <div>
          <h3 class="text-sm font-semibold text-gray-700 mb-2">Event Types</h3>
          <div class="space-y-1 max-h-48 overflow-y-auto">
            {#each (countryDetail.eventTypes || []).slice(0, 10) as et}
              <div class="flex items-center justify-between px-2 py-1 text-sm">
                <span class="text-gray-900 truncate flex-1">{et.event_type}</span>
                <span class="text-xs text-gray-500">{formatNumber(et.events)}</span>
              </div>
            {/each}
          </div>
        </div>

        <!-- Key Headlines -->
        <div>
          <h3 class="text-sm font-semibold text-gray-700 mb-2" title="Top events ranked by number of source articles — more articles indicates higher media significance">
            Key Events
            <span class="text-xs font-normal text-gray-400 ml-1 cursor-help" title="Sorted by number of source news articles covering the event. Higher article count = more media attention.">ⓘ</span>
          </h3>
          <div class="space-y-2 max-h-48 overflow-y-auto">
            {#each (countryDetail.keyEvents || []).slice(0, 5) as event}
              <div class="p-2 rounded bg-gray-50 text-xs">
                <div class="font-medium text-gray-900">{event.actor1name || '?'} → {event.actor2name || '?'}</div>
                <div class="text-gray-500">{event.actiongeo_fullname} · {event.numarticles} articles</div>
                {#if event.sourceurl}
                  <a href={event.sourceurl} target="_blank" class="text-blue-600 hover:underline truncate block">{event.sourceurl.substring(0, 60)}...</a>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  {/if}

  {/if}
</div>
