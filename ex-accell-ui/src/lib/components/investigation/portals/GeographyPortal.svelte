<script lang="ts">
  import { CHART } from '$lib/utils/chartColors';
  import { onMount, createEventDispatcher } from 'svelte';
  import * as d3 from 'd3';
  import { getPortalView, setPortalView, type CrossFilter } from '$lib/stores/investigationStore';
  import { computeHighlightSet } from '$lib/utils/crossFilterHelpers';
  import { getToneColor, getToneLabel } from '$lib/utils/colorUtils';
  import CrossFilterBadge from '../CrossFilterBadge.svelte';
  import ToneLegend from '../ToneLegend.svelte';

  const dispatch = createEventDispatcher<{ crossfilter: CrossFilter }>();

  export let keywords: string[] = [];
  export let dateStart: string = '';
  export let dateEnd: string = '';
  export let height: number = 260;
  export let crossFilter: CrossFilter | null = null;
  export let gdeltEvents: any[] = [];

  let activeView = 'hotspots';
  let container: HTMLDivElement;
  let svgEl: SVGSVGElement;
  let containerWidth = 400;
  let locationData: any[] = [];
  let loading = true;

  const views = [
    { id: 'hotspots', label: 'Hotspots' },
    { id: 'table', label: 'Table' },
  ];

  onMount(() => {
    activeView = getPortalView('geography', 'hotspots');
    if (container) {
      const ro = new ResizeObserver((entries) => {
        containerWidth = entries[0].contentRect.width;
        height = entries[0].contentRect.height || height;
        if (activeView === 'hotspots' && locationData.length > 0) renderChart();
      });
      ro.observe(container);
      return () => ro.disconnect();
    }
  });

  function selectView(id: string) {
    activeView = id;
    setPortalView('geography', id);
    if (id === 'hotspots') setTimeout(renderChart, 50);
  }

  let lastFetchKey = '';
  $: {
    const fetchKey = `${keywords.join(',')}|${dateStart}|${dateEnd}`;
    if (keywords.length > 0 && dateStart && dateEnd && fetchKey !== lastFetchKey) {
      lastFetchKey = fetchKey;
      loadData();
    }
  }

  async function loadData() {
    loading = true;
    try {
      const params = new URLSearchParams({
        type: 'investigation-locations',
        keywords: keywords.join(','),
        date_start: dateStart,
        date_end: dateEnd,
        limit: '30'
      });
      const res = await fetch(`/api/unified-analytics?${params}`);
      const result = await res.json();
      locationData = result.data || [];
    } catch (e) {
      console.error('Error loading locations:', e);
      locationData = [];
    } finally {
      loading = false;
      if (activeView === 'hotspots') setTimeout(renderChart, 50);
    }
  }

  $: if (locationData.length > 0 && svgEl && containerWidth > 0 && activeView === 'hotspots') renderChart();
  // Re-render when cross-filter changes
  $: if (crossFilter !== undefined && activeView === 'hotspots' && locationData.length > 0 && svgEl) renderChart();

  // Tone takes the brand sentiment scale (blue to orange) in three bands; the legend below names them
  const toneColor = (tone: number): string => getToneColor(tone, 3);

  // Cross-dimensional highlight set
  $: highlightedLocations = computeHighlightSet(crossFilter, gdeltEvents, 'location');
  $: hasHighlight = highlightedLocations.size > 0;

  function renderChart() {
    if (!svgEl) return;
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const margin = { top: 8, right: 8, bottom: 8, left: 8 };
    const w = containerWidth - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    svg.attr('width', containerWidth).attr('height', height);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    if (locationData.length === 0) {
      g.append('text').attr('x', w / 2).attr('y', h / 2).attr('text-anchor', 'middle')
        .attr('fill', CHART.ink400).attr('font-size', '12px').text('No location data');
      return;
    }

    // Bubble chart — x = position spread, y = position spread, size = event count, color = tone
    const maxCount = d3.max(locationData, (d: any) => Number(d.event_count)) ?? 1;
    const sizeScale = d3.scaleSqrt().domain([0, maxCount]).range([6, Math.min(40, h / 4)]);

    const nodes = locationData.slice(0, 20).map((d: any) => ({
      ...d,
      event_count: Number(d.event_count),
      avg_tone: Number(d.avg_tone),
      radius: sizeScale(Number(d.event_count)),
      x: w / 2,
      y: h / 2,
    }));

    const simulation = d3.forceSimulation(nodes)
      .force('center', d3.forceCenter(w / 2, h / 2))
      .force('collide', d3.forceCollide<any>().radius(d => d.radius + 3))
      .force('charge', d3.forceManyBody().strength(-3))
      .stop();

    for (let i = 0; i < 120; i++) simulation.tick();

    nodes.forEach(d => {
      d.x = Math.max(d.radius, Math.min(w - d.radius, d.x));
      d.y = Math.max(d.radius, Math.min(h - d.radius, d.y));
    });

    const bubbles = g.selectAll('.loc').data(nodes).join('g').attr('class', 'loc')
      .attr('transform', (d: any) => `translate(${d.x},${d.y})`);

    bubbles.append('circle')
      .attr('r', (d: any) => d.radius)
      .attr('fill', (d: any) => toneColor(d.avg_tone))
      .attr('fill-opacity', (d: any) => hasHighlight ? (highlightedLocations.has(d.location) ? 0.5 : 0.08) : 0.25)
      .attr('stroke', (d: any) => highlightedLocations.has(d.location) ? CHART.primary400 : toneColor(d.avg_tone))
      .attr('stroke-width', (d: any) => highlightedLocations.has(d.location) ? 2.5 : 1.5)
      .style('cursor', 'pointer')
      .on('click', (_event: any, d: any) => {
        dispatch('crossfilter', { dimension: 'location', value: d.location, label: d.location });
      });

    bubbles.append('text')
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .attr('fill', CHART.ink200)
      .attr('opacity', (d: any) => hasHighlight ? (highlightedLocations.has(d.location) ? 1 : 0.2) : 1)
      .attr('font-size', (d: any) => Math.max(7, Math.min(11, d.radius * 0.4)) + 'px')
      .text((d: any) => {
        const name = d.location || '';
        const parts = name.split(',');
        return parts[0].trim().substring(0, 12);
      });

    bubbles.append('text')
      .attr('text-anchor', 'middle').attr('y', (d: any) => d.radius * 0.35)
      .attr('fill', CHART.ink400)
      .attr('opacity', (d: any) => hasHighlight ? (highlightedLocations.has(d.location) ? 1 : 0.2) : 1)
      .attr('font-size', '7px').attr('font-family', 'monospace')
      .text((d: any) => d.event_count.toLocaleString());
  }
</script>

<div class="bg-slate-900 border border-slate-700/30 rounded-lg flex flex-col h-full overflow-hidden">
  <div class="flex items-center justify-between px-3 py-1.5 border-b border-slate-700/30 flex-shrink-0">
    <div class="flex items-center gap-2">
      <span class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Geography</span>
      {#if locationData.length > 0}
        <span class="text-[9px] text-slate-600">{locationData.length} locations</span>
      {/if}
      <CrossFilterBadge {crossFilter} nativeDimensions={['location']} />
    </div>
    <div class="flex items-center gap-0.5">
      {#each views as view}
        <button on:click={() => selectView(view.id)}
          class="px-1.5 py-0.5 text-[9px] rounded transition-colors {activeView === view.id
            ? 'bg-indigo-500/20 text-indigo-300 font-semibold'
            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}"
        >{view.label}</button>
      {/each}
    </div>
  </div>

  <div bind:this={container} class="flex-1 min-h-0 p-2 overflow-y-auto">
    {#if loading}
      <div class="flex items-center justify-center h-full">
        <svg class="animate-spin h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
      </div>
    {:else if activeView === 'hotspots'}
      <svg bind:this={svgEl} class="w-full"></svg>
    {:else if activeView === 'table'}
      {#if locationData.length > 0}
        <div class="grid grid-cols-4 gap-1 text-[9px] uppercase tracking-wider text-slate-500 font-medium mb-1 px-1 sticky top-0 bg-slate-900">
          <span>Location</span>
          <span class="text-right">Events</span>
          <span class="text-right">Avg Tone</span>
          <span class="text-right">Goldstein</span>
        </div>
        {#each locationData as loc}
          {@const isSelected = hasHighlight && highlightedLocations.has(loc.location)}
          {@const isDimmed = hasHighlight && !highlightedLocations.has(loc.location)}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <div
            class="grid grid-cols-4 gap-1 px-1 py-0.5 rounded cursor-pointer transition-all {isSelected ? 'bg-indigo-500/20 ring-1 ring-indigo-400/40' : 'hover:bg-slate-800/30'} {isDimmed ? 'opacity-40' : ''}"
            on:click={() => dispatch('crossfilter', { dimension: 'location', value: loc.location, label: loc.location })}
            role="button"
            tabindex="0">
            <span class="text-xs text-slate-300 truncate" title={loc.location}>{loc.location}</span>
            <span class="text-right text-xs font-mono text-slate-400">{Number(loc.event_count).toLocaleString()}</span>
            <span class="text-right text-xs font-mono" style="color: {toneColor(Number(loc.avg_tone))}" title="{getToneLabel(Number(loc.avg_tone), 3)} tone">{Number(loc.avg_tone).toFixed(1)}</span>
            <span class="text-right text-xs font-mono text-slate-400">{Number(loc.avg_goldstein).toFixed(1)}</span>
          </div>
        {/each}
      {:else}
        <div class="flex items-center justify-center h-full text-slate-600 text-xs">No location data</div>
      {/if}
    {/if}
  </div>
  {#if !loading && locationData.length > 0}
    <ToneLegend />
  {/if}
</div>
