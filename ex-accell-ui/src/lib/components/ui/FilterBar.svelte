<script lang="ts">
  import { dataSourceBadgeClass } from '$lib/utils/categoryColours';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { createEventDispatcher } from 'svelte';
  import { replaceState } from '$app/navigation';
  import { validateDayRange } from '$lib/utils/calendarDay';
  import { noSourcesMessage } from '$lib/utils/sourceLabels';
  import { applyRangeToParams, readRange, rememberRange } from '$lib/utils/filterRange';

  export let workspaceId: string | null = null;
  export let compact = false;
  export let datesOnly = false;  // Just the date range, for pages whose data does not depend on which sources are switched on
  export let datasetTypes: string[] = [];  // Filter to only show these dataset types (empty = all)
  export let onReady: ((params: Record<string, string>) => void) | null = null;  // Called once after initial load

  const dispatch = createEventDispatcher();

  // Filter state
  let datasets: any[] = [];
  let enabledIds = new Set<number>();
  let readyCalled = false;
  let dateStart = '';
  let dateEnd = '';
  let loading = true;
  let rangeProblem: string | null = null;

  // The date range is shared by every analysis page: restored from the URL, else from this session
  if (browser) {
    const saved = readRange($page.url.searchParams, sessionStorage);
    dateStart = saved.dateStart;
    dateEnd = saved.dateEnd;
  }

  function persistRange() {
    if (!browser) return;
    const range = { dateStart, dateEnd };
    rememberRange(range, sessionStorage);
    try {
      const params = applyRangeToParams($page.url.searchParams, range);
      const next = new URL($page.url);
      next.search = params.toString();
      if (next.href !== $page.url.href) replaceState(next, $page.state);
    } catch {
      // The router may not be ready yet; the range is still remembered for the session
    }
  }

  // Filter datasets by allowed types (prop), then by user toggle
  $: visibleDatasets = datasetTypes.length > 0
    ? datasets.filter(d => datasetTypes.includes(d.dataset_type))
    : datasets;
  $: activeDatasets = visibleDatasets.filter(d => enabledIds.has(d.id ?? d.dataset_id));
  $: platforms = [...new Set(activeDatasets.map((d: any) => d.source_platform).filter(Boolean))];
  $: derivedDatasetTypes = [...new Set(activeDatasets.map((d: any) => d.dataset_type).filter(Boolean))];


  let lastLoadKey = '';

  async function loadDatasets() {
    if (datesOnly) {
      loading = false;
      emitChange();
      return;
    }
    const loadKey = `${workspaceId || 'global'}_${datasetTypes.join(',')}`;
    // Skip only if exact same load params and we have data
    if (lastLoadKey === loadKey && visibleDatasets.length > 0) return;
    lastLoadKey = loadKey;
    if (browser) {
      console.log('[FilterBar] Client loading:', { workspaceId, datasetTypes: JSON.stringify(datasetTypes), loadKey });
    }

    loading = true;
    try {
      const params = workspaceId ? `?workspace_id=${workspaceId}` : '?status=available';
      const res = await fetch(`/api/datasets${params}`);
      const data = await res.json();
      const allDatasets = data.datasets || [];
      datasets = allDatasets;
      // Enable all visible datasets (filtering by type happens reactively in $: visibleDatasets)
      enabledIds = new Set(allDatasets.map((d: any) => d.id ?? d.dataset_id));
    } catch (e) {
      console.error('Failed to load datasets for filter bar:', e);
      datasets = [];
    } finally {
      loading = false;
      emitChange();
      // Call onReady callback after first successful client-side load
      if (onReady && browser && !readyCalled) {
        readyCalled = true;
        const params = getFilterParams();
        setTimeout(() => onReady?.(params), 0);
      }
    }
  }

  // No reactive reload needed — onMount handles initial load
  // If workspaceId changes (SPA navigation), the parent page re-renders the component

  function toggleDataset(id: number) {
    if (enabledIds.has(id)) {
      enabledIds.delete(id);
    } else {
      enabledIds.add(id);
    }
    enabledIds = new Set(enabledIds); // trigger reactivity
    emitChange();
  }

  function enableAll() {
    enabledIds = new Set(visibleDatasets.map((d: any) => d.id ?? d.dataset_id));
    emitChange();
  }

  function disableAll() {
    enabledIds = new Set();
    emitChange();
  }

  function setQuickRange(days: number) {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    dateStart = start.toISOString().split('T')[0];
    dateEnd = end.toISOString().split('T')[0];
    emitChange();
  }

  function clearDates() {
    dateStart = '';
    dateEnd = '';
    emitChange();
  }

  function emitChange() {
    rangeProblem = validateDayRange(dateStart, dateEnd);
    if (rangeProblem) return;
    persistRange();
    // Compute platforms directly (don't rely on reactive $: which may not have updated yet)
    const currentVisible = datasetTypes.length > 0
      ? datasets.filter(d => datasetTypes.includes(d.dataset_type))
      : datasets;
    const currentEnabled = currentVisible.filter(d => enabledIds.has(d.id ?? d.dataset_id));
    const currentPlatforms = [...new Set(currentEnabled.map((d: any) => d.source_platform).filter(Boolean))];

    dispatch('change', {
      workspaceId,
      enabledDatasets: [...enabledIds],
      platforms: currentPlatforms,
      datasetTypes: [...new Set(currentEnabled.map((d: any) => d.dataset_type).filter(Boolean))],
      dateStart: dateStart || null,
      dateEnd: dateEnd || null,
    });
  }

  // Export for parent to read
  export function getFilters() {
    return {
      workspaceId,
      enabledDatasets: [...enabledIds],
      platforms,
      datasetTypes,
      dateStart: dateStart || null,
      dateEnd: dateEnd || null,
    };
  }

  export function getFilterParams(): Record<string, string> {
    const currentVisible = datasetTypes.length > 0
      ? datasets.filter(d => datasetTypes.includes(d.dataset_type))
      : datasets;
    const currentEnabled = currentVisible.filter(d => enabledIds.has(d.id ?? d.dataset_id));
    const currentPlatforms = [...new Set(currentEnabled.map((d: any) => d.source_platform).filter(Boolean))];

    const params: Record<string, string> = {};
    if (workspaceId) params.workspace_id = workspaceId;
    params.platforms = currentPlatforms.join(',');
    if (dateStart) params.date_start = dateStart;
    if (dateEnd) params.date_end = dateEnd;
    return params;
  }

  onMount(loadDatasets);
</script>

<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 {compact ? 'p-3' : 'p-4'}">
  {#if loading}
    <div class="flex items-center gap-2 text-sm text-gray-500">
      <div class="animate-spin rounded-full h-4 w-4 border-2 border-gray-200 border-t-blue-500"></div>
      Loading data sources...
    </div>
  {:else if !datesOnly && visibleDatasets.length === 0}
    <p class="text-sm text-gray-600">{noSourcesMessage(datasetTypes)}</p>
  {:else}
    <div class="flex flex-wrap items-center gap-3">
      {#if !datesOnly}
      <!-- Dataset toggles -->
      <div class="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
        <span class="text-xs font-medium text-gray-500 uppercase tracking-wider mr-1">Sources:</span>
        {#each visibleDatasets as dataset}
          {@const id = dataset.id ?? dataset.dataset_id}
          {@const enabled = enabledIds.has(id)}
          <button
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all
              {enabled
                ? `${dataSourceBadgeClass(dataset.dataset_type)} shadow-sm`
                : 'bg-gray-100 text-gray-600 ring-1 ring-gray-200'}"
            on:click={() => toggleDataset(id)}
            title="{enabled ? 'Click to disable' : 'Click to enable'}: {dataset.name || dataset.dataset_name}"
          >
            <span class="w-2 h-2 rounded-full {enabled ? 'bg-current' : 'bg-gray-300'}"></span>
            <span class="truncate max-w-32">{dataset.name || dataset.dataset_name}</span>
            {#if dataset.source_platform && !compact}
              <span class="text-[10px] opacity-60">({dataset.source_platform})</span>
            {/if}
          </button>
        {/each}
        {#if visibleDatasets.length > 1}
          <button on:click={enableAll} class="text-[10px] text-blue-600 hover:text-blue-800 px-1">All</button>
          <button on:click={disableAll} class="text-[10px] text-gray-500 hover:text-gray-700 px-1">None</button>
        {/if}
      </div>

      <!-- Separator -->
      <div class="w-px h-6 bg-gray-200 hidden sm:block"></div>
      {/if}

      <!-- Date range -->
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="text-xs font-medium text-gray-500 uppercase tracking-wider">Dates:</span>
        <input
          type="date"
          aria-label="Start date"
          aria-invalid={rangeProblem ? 'true' : undefined}
          aria-describedby={rangeProblem ? 'filter-range-problem' : undefined}
          bind:value={dateStart}
          on:change={emitChange}
          class="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:bg-white"
        />
        <span class="text-xs text-gray-300">—</span>
        <input
          type="date"
          aria-label="End date"
          aria-invalid={rangeProblem ? 'true' : undefined}
          aria-describedby={rangeProblem ? 'filter-range-problem' : undefined}
          bind:value={dateEnd}
          on:change={emitChange}
          class="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:bg-white"
        />
        {#if !compact}
          <div class="flex gap-0.5 ml-1">
            <button on:click={() => setQuickRange(7)} class="text-[10px] px-2 py-1 rounded-md border border-gray-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 text-gray-500 transition-colors">7d</button>
            <button on:click={() => setQuickRange(30)} class="text-[10px] px-2 py-1 rounded-md border border-gray-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 text-gray-500 transition-colors">30d</button>
            <button on:click={() => setQuickRange(90)} class="text-[10px] px-2 py-1 rounded-md border border-gray-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 text-gray-500 transition-colors">90d</button>
          </div>
        {/if}
        {#if rangeProblem}
          <span id="filter-range-problem" class="text-xs text-danger-700" role="alert">{rangeProblem.includes('on or before') ? 'The start date must be on or before the end date' : 'Enter a valid date'}</span>
        {/if}
        {#if dateStart || dateEnd}
          <button on:click={clearDates} class="text-xs text-danger-700 hover:text-danger-900 ml-1">Reset</button>
        {/if}
      </div>
    </div>

    {#if !datesOnly && enabledIds.size < visibleDatasets.length}
      <div class="mt-2 text-xs text-signal-700">
        Showing {enabledIds.size} of {visibleDatasets.length} data sources
      </div>
    {/if}
  {/if}
</div>
