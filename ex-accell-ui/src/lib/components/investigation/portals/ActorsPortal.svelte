<script lang="ts">
  import { CHART } from '$lib/utils/chartColors';
  import { onMount, createEventDispatcher } from 'svelte';
  import * as d3 from 'd3';
  import { getPortalView, setPortalView, type CrossFilter } from '$lib/stores/investigationStore';
  import { computeHighlightSet } from '$lib/utils/crossFilterHelpers';
  import CrossFilterBadge from '../CrossFilterBadge.svelte';

  const dispatch = createEventDispatcher<{ crossfilter: CrossFilter }>();

  export let keywords: string[] = [];
  export let dateStart: string = '';
  export let dateEnd: string = '';
  export let height: number = 260;
  export let crossFilter: CrossFilter | null = null;
  export let gdeltEvents: any[] = [];

  let activeView = 'players';
  let container: HTMLDivElement;
  let svgEl: SVGSVGElement;
  let containerWidth = 400;
  let actorData: any[] = [];
  let pairData: any[] = [];
  let loading = true;

  const views = [
    { id: 'players', label: 'Key Players' },
    { id: 'network', label: 'Network' },
  ];

  onMount(() => {
    activeView = getPortalView('actors', 'players');
    if (container) {
      const ro = new ResizeObserver((entries) => {
        containerWidth = entries[0].contentRect.width;
        height = entries[0].contentRect.height || height;
        if (activeView === 'network' && actorData.length > 0) renderNetwork();
      });
      ro.observe(container);
      return () => ro.disconnect();
    }
  });

  function selectView(id: string) {
    activeView = id;
    setPortalView('actors', id);
    if (id === 'network') setTimeout(renderNetwork, 50);
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
        type: 'investigation-actors',
        keywords: keywords.join(','),
        date_start: dateStart,
        date_end: dateEnd,
        limit: '20'
      });
      const res = await fetch(`/api/unified-analytics?${params}`);
      const result = await res.json();
      actorData = result.data?.actors || [];
      pairData = result.data?.pairs || [];
    } catch (e) {
      console.error('Error loading actors:', e);
      actorData = [];
      pairData = [];
    } finally {
      loading = false;
      if (activeView === 'network') setTimeout(renderNetwork, 50);
    }
  }

  function toneColor(tone: number): string {
    if (tone > 1) return CHART.catGreen;
    if (tone > -1) return CHART.catOrange;
    return CHART.danger500;
  }

  $: maxMentions = d3.max(actorData, (d: any) => Number(d.mention_count)) ?? 1;

  // Cross-dimensional highlight set: highlights actors related to any active cross-filter
  $: highlightedActors = computeHighlightSet(crossFilter, gdeltEvents, 'actor');
  $: hasHighlight = highlightedActors.size > 0;

  // Re-render network when cross-filter changes
  $: if (crossFilter !== undefined && activeView === 'network' && actorData.length > 0 && svgEl) renderNetwork();

  function renderNetwork() {
    if (!svgEl || actorData.length === 0) return;
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const margin = { top: 8, right: 8, bottom: 8, left: 8 };
    const w = containerWidth - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    svg.attr('width', containerWidth).attr('height', height);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Build nodes from top actors
    const topActors = actorData.slice(0, 15);
    const actorSet = new Set(topActors.map((a: any) => a.actor));
    const nodes = topActors.map((a: any, i: number) => ({
      id: a.actor,
      index: i,
      mentions: Number(a.mention_count),
      tone: Number(a.avg_tone),
      radius: d3.scaleSqrt().domain([0, maxMentions]).range([6, Math.min(30, h / 5)])(Number(a.mention_count)),
      x: w / 2,
      y: h / 2,
    }));

    // Build links from pairs where both actors are in our top set
    const links = pairData
      .filter((p: any) => actorSet.has(p.source_actor) && actorSet.has(p.target_actor))
      .map((p: any) => ({
        source: nodes.findIndex(n => n.id === p.source_actor),
        target: nodes.findIndex(n => n.id === p.target_actor),
        weight: Number(p.weight),
      }))
      .filter(l => l.source >= 0 && l.target >= 0);

    const simulation = d3.forceSimulation(nodes)
      .force('center', d3.forceCenter(w / 2, h / 2))
      .force('collide', d3.forceCollide<any>().radius(d => d.radius + 4))
      .force('charge', d3.forceManyBody().strength(-20))
      .force('link', d3.forceLink(links).distance(60).strength(0.3))
      .stop();

    for (let i = 0; i < 150; i++) simulation.tick();

    nodes.forEach(d => {
      d.x = Math.max(d.radius, Math.min(w - d.radius, d.x));
      d.y = Math.max(d.radius, Math.min(h - d.radius, d.y));
    });

    // Draw links
    g.selectAll('.link').data(links).join('line')
      .attr('class', 'link')
      .attr('x1', (d: any) => nodes[d.source]?.x ?? 0)
      .attr('y1', (d: any) => nodes[d.source]?.y ?? 0)
      .attr('x2', (d: any) => nodes[d.target]?.x ?? 0)
      .attr('y2', (d: any) => nodes[d.target]?.y ?? 0)
      .attr('stroke', CHART.ink700)
      .attr('opacity', (d: any) => {
        if (!hasHighlight) return 1;
        const srcNode = nodes[d.source];
        const tgtNode = nodes[d.target];
        return (highlightedActors.has(srcNode?.id) || highlightedActors.has(tgtNode?.id)) ? 1 : 0.15;
      })
      .attr('stroke-width', (d: any) => Math.max(0.5, Math.min(3, d.weight / 5)));

    // Draw nodes
    const nodeG = g.selectAll('.actor').data(nodes).join('g').attr('class', 'actor')
      .attr('transform', (d: any) => `translate(${d.x},${d.y})`);

    nodeG.append('circle')
      .attr('r', (d: any) => d.radius)
      .attr('fill', (d: any) => toneColor(d.tone))
      .attr('fill-opacity', (d: any) => hasHighlight ? (highlightedActors.has(d.id) ? 0.5 : 0.08) : 0.2)
      .attr('stroke', (d: any) => highlightedActors.has(d.id) ? CHART.primary400 : toneColor(d.tone))
      .attr('stroke-width', (d: any) => highlightedActors.has(d.id) ? 2.5 : 1.5)
      .style('cursor', 'pointer')
      .on('click', (_event: any, d: any) => {
        dispatch('crossfilter', { dimension: 'actor', value: d.id, label: d.id });
      });

    nodeG.append('text')
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .attr('fill', CHART.ink200)
      .attr('opacity', (d: any) => hasHighlight ? (highlightedActors.has(d.id) ? 1 : 0.2) : 1)
      .attr('font-size', (d: any) => Math.max(7, Math.min(10, d.radius * 0.45)) + 'px')
      .attr('font-weight', '500')
      .text((d: any) => d.id.substring(0, 10));
  }
</script>

<div class="bg-slate-900 border border-slate-700/30 rounded-lg flex flex-col h-full overflow-hidden">
  <div class="flex items-center justify-between px-3 py-1.5 border-b border-slate-700/30 flex-shrink-0">
    <div class="flex items-center gap-2">
      <span class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Actors</span>
      {#if actorData.length > 0}
        <span class="text-[9px] text-slate-600">{actorData.length} entities</span>
      {/if}
      <CrossFilterBadge {crossFilter} nativeDimensions={['actor']} />
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
    {:else if activeView === 'players'}
      {#if actorData.length > 0}
        <div class="space-y-1">
          {#each actorData.slice(0, 15) as actor}
            {@const mentions = Number(actor.mention_count)}
            {@const pct = (mentions / maxMentions) * 100}
            {@const tone = Number(actor.avg_tone)}
            {@const isSelected = hasHighlight && highlightedActors.has(actor.actor)}
            {@const isDimmed = hasHighlight && !highlightedActors.has(actor.actor)}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <div
              class="flex items-center gap-2 px-1 py-0.5 rounded cursor-pointer transition-all {isSelected ? 'bg-indigo-500/20 ring-1 ring-indigo-400/40' : 'hover:bg-slate-800/30'} {isDimmed ? 'opacity-40' : ''}"
              on:click={() => dispatch('crossfilter', { dimension: 'actor', value: actor.actor, label: actor.actor })}
              role="button"
              tabindex="0">
              <span class="w-2 h-2 rounded-full flex-shrink-0" style="background-color: {toneColor(tone)}"></span>
              <span class="text-xs text-slate-300 font-medium truncate flex-1" title={actor.actor}>{actor.actor}</span>
              <span class="text-[9px] font-mono text-slate-500 flex-shrink-0">{actor.country_code || ''}</span>
              <div class="w-20 flex-shrink-0">
                <div class="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div class="h-full rounded-full" style="width: {pct}%; background-color: {toneColor(tone)}; opacity: 0.6;"></div>
                </div>
              </div>
              <span class="text-[9px] font-mono text-slate-400 w-8 text-right flex-shrink-0">{mentions.toLocaleString()}</span>
            </div>
          {/each}
        </div>
      {:else}
        <div class="flex items-center justify-center h-full text-slate-600 text-xs">No actor data</div>
      {/if}
    {:else if activeView === 'network'}
      <svg bind:this={svgEl} class="w-full"></svg>
    {/if}
  </div>
</div>
