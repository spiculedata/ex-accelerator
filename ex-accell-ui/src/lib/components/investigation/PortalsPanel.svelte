<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    clearCrossFilter,
    getPortalGrid,
    getPortalLayout,
    resetPortalGrid,
    setCrossFilter,
    setPortalGrid,
    setPortalLayout,
    type CrossFilter,
    type PortalGridItem
  } from '$lib/stores/investigationStore';
  import {
    ALL_PORTALS,
    defaultLayout,
    portalHeight,
    resizedSize,
    resolveGridItems,
    swapPortals,
    togglePortalVisibility,
    visiblePortalIds
  } from '$lib/utils/portalGrid';
  import type { GdeltEvent, RadioSegment, WorkbenchPost } from '$lib/utils/investigationTypes';
  import type { TimelineEntry } from '$lib/components/investigation/SwimLaneTimeline.svelte';
  import SentimentPortal from '$lib/components/investigation/portals/SentimentPortal.svelte';
  import VolumePortal from '$lib/components/investigation/portals/VolumePortal.svelte';
  import CorrelationPortal from '$lib/components/investigation/portals/CorrelationPortal.svelte';
  import TopicsPortal from '$lib/components/investigation/portals/TopicsPortal.svelte';
  import GeographyPortal from '$lib/components/investigation/portals/GeographyPortal.svelte';
  import ActorsPortal from '$lib/components/investigation/portals/ActorsPortal.svelte';

  /** Days inside the chosen time range */
  export let timelineData: TimelineEntry[];
  /** Records after the cross-filter */
  export let gdeltEvents: GdeltEvent[];
  export let radioSegments: RadioSegment[];
  export let socialPosts: WorkbenchPost[];
  /** All GDELT events loaded, before the cross-filter */
  export let gdeltTotal: number;
  export let gdeltLoading: boolean;
  export let keywordData: any[];
  export let keywords: string[];
  export let dateStart: string;
  export let dateEnd: string;
  export let activeCrossFilter: CrossFilter | null;

  let portalLayout = getPortalLayout();
  $: visiblePortals = visiblePortalIds(portalLayout);
  let portalGrid: PortalGridItem[] = getPortalGrid();
  let dragSource: string | null = null;
  let dragTarget: string | null = null;

  function togglePortal(portalId: string) {
    portalLayout = togglePortalVisibility(portalLayout, portalId);
    setPortalLayout(portalLayout);
  }

  // Grid items for visible portals, maintaining saved sizes
  $: gridItems = resolveGridItems(visiblePortals, portalGrid);

  // Corner-drag resize
  let resizingPortal: string | null = null;
  let resizeStartX = 0;
  let resizeStartY = 0;
  let resizeStartW = 0;
  let resizeStartH = 0;
  let resizeEl: HTMLElement | null = null;

  function startResize(portalId: string, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    resizingPortal = portalId;
    resizeStartX = e.clientX;
    resizeStartY = e.clientY;
    const item = portalGrid.find(g => g.id === portalId);
    resizeStartW = item?.w ?? 6;
    resizeStartH = item?.h ?? 2;
    resizeEl = (e.target as HTMLElement).closest('[data-portal-cell]');

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  }

  function handleResizeMove(e: MouseEvent) {
    if (!resizingPortal || !resizeEl) return;
    const { w: newW, h: newH } = resizedSize(
      { w: resizeStartW, h: resizeStartH },
      e.clientX - resizeStartX,
      e.clientY - resizeStartY,
      resizeEl.parentElement?.clientWidth
    );

    portalGrid = portalGrid.map(g =>
      g.id === resizingPortal ? { ...g, w: newW, h: newH } : g
    );
  }

  function handleResizeEnd() {
    if (resizingPortal) {
      setPortalGrid(portalGrid);
      resizingPortal = null;
      resizeEl = null;
    }
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  }

  // Leaving the tab mid-drag must not leave listeners on the document
  onDestroy(() => {
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  });

  function handleDragStart(portalId: string) {
    dragSource = portalId;
  }

  function handleDragOver(portalId: string, e: DragEvent) {
    e.preventDefault();
    dragTarget = portalId;
  }

  function handleDrop(portalId: string) {
    if (dragSource && dragSource !== portalId) {
      // Swap positions in the order
      const swapped = swapPortals(portalLayout, dragSource, portalId);
      if (swapped) {
        portalLayout = swapped;
        setPortalLayout(portalLayout);
      }
    }
    dragSource = null;
    dragTarget = null;
  }

  function handleResetGrid() {
    resetPortalGrid();
    portalGrid = getPortalGrid();
    portalLayout = defaultLayout();
    setPortalLayout(portalLayout);
  }

  function handleCrossFilter(event: CustomEvent<CrossFilter>) {
    setCrossFilter(event.detail);
  }
</script>

<div role="tabpanel" id="panel-visualizations" aria-labelledby="tab-visualizations" class="h-full">
<div class="h-full overflow-y-auto p-3">
  <!-- Portal toolbar -->
  <div class="flex items-center gap-1.5 mb-3">
    <span class="text-[9px] uppercase tracking-wider text-slate-600 font-semibold mr-1">Portals</span>
    {#each ALL_PORTALS as portal}
      <button
        on:click={() => togglePortal(portal.id)}
        class="px-2 py-0.5 text-[9px] rounded-full transition-colors {portalLayout.visible.includes(portal.id)
          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
          : 'text-slate-600 border border-slate-700/30 hover:text-slate-400 hover:border-slate-600'}"
      >
        {portal.label}
      </button>
    {/each}

    <!-- Active cross-filter pill -->
    {#if activeCrossFilter}
      <div class="ml-2 flex items-center gap-1.5 px-2 py-0.5 bg-indigo-500/15 border border-indigo-500/30 rounded-full">
        <span class="text-[9px] text-indigo-400/70 uppercase tracking-wider">{activeCrossFilter.dimension}</span>
        <span class="text-[10px] text-indigo-300 font-medium max-w-[120px] truncate">{activeCrossFilter.label || activeCrossFilter.value}</span>
        <button
          on:click={() => clearCrossFilter()}
          class="text-indigo-400/50 hover:text-indigo-300 transition-colors ml-0.5"
          title="Clear filter"
          aria-label="Clear filter"
        >
          <svg class="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 3l6 6M9 3l-6 6" />
          </svg>
        </button>
      </div>
    {/if}

    <div class="flex-1"></div>
    <button on:click={handleResetGrid}
      class="px-2 py-0.5 text-[9px] text-slate-600 hover:text-slate-400 transition-colors"
      title="Reset layout"
    >Reset</button>
  </div>

  <!-- Portal grid — drag headers to reorder, drag corners to resize -->
  <div class="grid grid-cols-12 gap-3 auto-rows-[140px]">
    {#each visiblePortals as portalId (portalId)}
      {@const item = gridItems.find(g => g.id === portalId) || { id: portalId, w: 6, h: 2, x: 0, y: 0 }}
      <div
        data-portal-cell
        class="relative transition-all duration-150 {dragTarget === portalId ? 'ring-2 ring-indigo-500/50' : ''} {resizingPortal === portalId ? 'ring-1 ring-indigo-400/30' : ''}"
        style="grid-column: span {Math.min(12, item.w)}; grid-row: span {item.h};"
        draggable="true"
        on:dragstart={() => handleDragStart(portalId)}
        on:dragover={(e) => handleDragOver(portalId, e)}
        on:dragleave={() => { if (dragTarget === portalId) dragTarget = null; }}
        on:drop={() => handleDrop(portalId)}
        on:dragend={() => { dragSource = null; dragTarget = null; }}
        role="listitem"
      >
        <!-- Corner resize handle (bottom-right) -->
        <div
          class="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-20 opacity-0 hover:opacity-100 transition-opacity"
          on:mousedown={(e) => startResize(portalId, e)}
          role="separator"
          aria-orientation="horizontal"
        >
          <svg class="w-4 h-4 text-slate-500" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="12" cy="12" r="1.5" /><circle cx="8" cy="12" r="1.5" /><circle cx="12" cy="8" r="1.5" />
          </svg>
        </div>

        {#if portalId === 'sentiment'}
          <SentimentPortal
            timelineData={timelineData}
            gdeltEvents={gdeltEvents}
            radioSegments={radioSegments}
            socialPosts={socialPosts}
            height={portalHeight(item)}
            crossFilter={activeCrossFilter}
            on:crossfilter={handleCrossFilter}
          />
        {:else if portalId === 'volume'}
          <VolumePortal
            timelineData={timelineData}
            gdeltEvents={gdeltEvents}
            height={portalHeight(item)}
            crossFilter={activeCrossFilter}
            on:crossfilter={handleCrossFilter}
          />
        {:else if portalId === 'correlation'}
          <CorrelationPortal
            timelineData={timelineData}
            gdeltEvents={gdeltEvents}
            {gdeltTotal}
            {gdeltLoading}
            height={portalHeight(item)}
            crossFilter={activeCrossFilter}
            on:crossfilter={handleCrossFilter}
          />
        {:else if portalId === 'topics'}
          <TopicsPortal
            {keywordData}
            gdeltEvents={gdeltEvents}
            height={portalHeight(item)}
            crossFilter={activeCrossFilter}
            on:crossfilter={handleCrossFilter}
          />
        {:else if portalId === 'geography'}
          <GeographyPortal
            {keywords}
            {dateStart}
            {dateEnd}
            gdeltEvents={gdeltEvents}
            height={portalHeight(item)}
            crossFilter={activeCrossFilter}
            on:crossfilter={handleCrossFilter}
          />
        {:else if portalId === 'actors'}
          <ActorsPortal
            {keywords}
            {dateStart}
            {dateEnd}
            gdeltEvents={gdeltEvents}
            height={portalHeight(item)}
            crossFilter={activeCrossFilter}
            on:crossfilter={handleCrossFilter}
          />
        {/if}
      </div>
    {/each}
  </div>
</div>
</div>
