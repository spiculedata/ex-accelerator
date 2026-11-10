<script lang="ts">
  import { CHART } from '$lib/utils/chartColors';
  import { onMount, createEventDispatcher } from 'svelte';
  import * as d3 from 'd3';
  import KeywordNetwork from '../KeywordNetwork.svelte';
  import WordCloudChart from '../WordCloudChart.svelte';
  import { getPortalView, setPortalView, type CrossFilter } from '$lib/stores/investigationStore';
  import { computeHighlightSet } from '$lib/utils/crossFilterHelpers';
  import CrossFilterBadge from '../CrossFilterBadge.svelte';

  const dispatch = createEventDispatcher<{ crossfilter: CrossFilter }>();

  export let keywordData: any[] = [];
  export let height: number = 260;
  export let crossFilter: CrossFilter | null = null;
  export let gdeltEvents: any[] = [];

  let activeView = 'shared';
  let container: HTMLDivElement;
  let svgEl: SVGSVGElement;
  let containerWidth = 400;

  const views = [
    { id: 'shared', label: 'Shared' },
    { id: 'table', label: 'Table' },
    { id: 'cloud', label: 'Cloud' },
  ];

  onMount(() => {
    activeView = getPortalView('topics', 'shared');
    if (container) {
      const ro = new ResizeObserver((entries) => {
        containerWidth = entries[0].contentRect.width;
        height = entries[0].contentRect.height || height;
        if (activeView === 'shared') renderShared();
      });
      ro.observe(container);
      return () => ro.disconnect();
    }
  });

  function selectView(id: string) {
    activeView = id;
    setPortalView('topics', id);
    if (id === 'shared') setTimeout(renderShared, 50);
  }

  // Classify keywords by source presence
  $: classified = keywordData.map((k: any) => {
    const inGdelt = (k.gdelt_count || 0) > 0;
    const inRadio = (k.radio_count || 0) > 0;
    const inSocial = (k.social_count || 0) > 0;
    const sourceCount = [inGdelt, inRadio, inSocial].filter(Boolean).length;
    const total = (k.gdelt_count || 0) + (k.radio_count || 0) + (k.social_count || 0);
    return { ...k, inGdelt, inRadio, inSocial, sourceCount, total };
  });

  $: sharedTerms = classified.filter(k => k.sourceCount >= 2).sort((a, b) => b.total - a.total);
  $: gdeltOnly = classified.filter(k => k.inGdelt && !k.inRadio && !k.inSocial);
  $: radioOnly = classified.filter(k => !k.inGdelt && k.inRadio && !k.inSocial);
  $: socialOnly = classified.filter(k => !k.inGdelt && !k.inRadio && k.inSocial);

  $: wordCloudData = keywordData.map((k: any) => ({
    text: k.keyword || k.word,
    size: (k.gdelt_count || 0) + (k.radio_count || 0) + (k.social_count || 0)
  })).filter((w: any) => w.size > 0);

  // Cross-dimensional highlight set
  $: highlightedKeywords = computeHighlightSet(crossFilter, gdeltEvents, 'keyword');
  $: hasHighlight = highlightedKeywords.size > 0;

  $: if (classified.length > 0 && svgEl && containerWidth > 0 && activeView === 'shared') renderShared();
  // Re-render when cross-filter changes
  $: if (crossFilter !== undefined && activeView === 'shared' && classified.length > 0 && svgEl) renderShared();

  function renderShared() {
    if (!svgEl) return;
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    svg.attr('width', containerWidth).attr('height', height);

    const margin = { top: 8, right: 8, bottom: 8, left: 8 };
    const w = containerWidth - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Layout: shared terms as large bubbles in center, source-unique terms smaller around edges
    const allTerms = [
      ...sharedTerms.map(k => ({ ...k, category: 'shared', color: CHART.catOrange })),
      ...gdeltOnly.slice(0, 5).map(k => ({ ...k, category: 'gdelt', color: CHART.catOrange })),
      ...radioOnly.slice(0, 5).map(k => ({ ...k, category: 'radio', color: CHART.catPink })),
      ...socialOnly.slice(0, 5).map(k => ({ ...k, category: 'social', color: CHART.catSky })),
    ];

    if (allTerms.length === 0) {
      g.append('text').attr('x', w / 2).attr('y', h / 2).attr('text-anchor', 'middle')
        .attr('fill', CHART.ink400).attr('font-size', '12px').text('No keyword data');
      return;
    }

    const maxTotal = d3.max(allTerms, d => d.total) ?? 1;
    const sizeScale = d3.scaleSqrt().domain([0, maxTotal]).range([8, Math.min(40, h / 4)]);

    const nodes = allTerms.map(d => ({
      ...d,
      radius: sizeScale(d.total),
      x: w / 2,
      y: h / 2,
    }));

    const simulation = d3.forceSimulation(nodes)
      .force('center', d3.forceCenter(w / 2, h / 2))
      .force('charge', d3.forceManyBody().strength(-5))
      .force('collide', d3.forceCollide<any>().radius(d => d.radius + 3))
      .force('x', d3.forceX(w / 2).strength(0.05))
      .force('y', d3.forceY(h / 2).strength(0.05))
      .stop();

    for (let i = 0; i < 150; i++) simulation.tick();

    // Clamp positions
    nodes.forEach(d => {
      d.x = Math.max(d.radius, Math.min(w - d.radius, d.x));
      d.y = Math.max(d.radius, Math.min(h - d.radius, d.y));
    });

    // Draw bubbles
    const bubbles = g.selectAll('.bubble').data(nodes).join('g').attr('class', 'bubble')
      .attr('transform', d => `translate(${d.x},${d.y})`);

    bubbles.append('circle')
      .attr('r', d => d.radius)
      .attr('fill', d => d.category === 'shared' ? CHART.catOrange : d.color)
      .attr('fill-opacity', d => {
        if (hasHighlight) return highlightedKeywords.has(d.keyword) ? 0.5 : 0.06;
        return d.category === 'shared' ? 0.3 : 0.15;
      })
      .attr('stroke', d => highlightedKeywords.has(d.keyword) ? CHART.primary400 : (d.category === 'shared' ? CHART.catOrange : d.color))
      .attr('stroke-width', d => highlightedKeywords.has(d.keyword) ? 2.5 : (d.category === 'shared' ? 1.5 : 0.5))
      .style('cursor', 'pointer')
      .on('click', (_event: any, d: any) => {
        dispatch('crossfilter', { dimension: 'keyword', value: d.keyword, label: d.keyword });
      });

    // Source indicator dots for shared terms
    bubbles.filter(d => d.category === 'shared').each(function (d) {
      const el = d3.select(this);
      const indicators = [
        { show: d.inGdelt, color: CHART.catOrange, offset: -6 },
        { show: d.inRadio, color: CHART.catPink, offset: 0 },
        { show: d.inSocial, color: CHART.catSky, offset: 6 },
      ].filter(i => i.show);
      indicators.forEach(ind => {
        el.append('circle').attr('cx', ind.offset).attr('cy', d.radius + 6).attr('r', 2).attr('fill', ind.color);
      });
    });

    bubbles.append('text')
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .attr('fill', CHART.ink200)
      .attr('opacity', d => hasHighlight ? (highlightedKeywords.has(d.keyword) ? 1 : 0.15) : 1)
      .attr('font-size', d => Math.max(8, Math.min(12, d.radius * 0.5)) + 'px')
      .attr('font-weight', d => d.category === 'shared' ? '600' : '400')
      .text(d => d.keyword);

    // Legend
    const legend = svg.append('g').attr('transform', `translate(${margin.left + 4},${margin.top + h - 12})`);
    const items = [
      { color: CHART.catOrange, label: 'Multi-source' },
      { color: CHART.catPink, label: 'Radio only' },
      { color: CHART.catSky, label: 'Social only' },
    ];
    items.forEach((item, i) => {
      legend.append('circle').attr('cx', i * 80).attr('cy', 0).attr('r', 3).attr('fill', item.color);
      legend.append('text').attr('x', i * 80 + 6).attr('y', 3).attr('fill', CHART.ink500).attr('font-size', '7px').text(item.label);
    });
  }
</script>

<div class="bg-slate-900 border border-slate-700/30 rounded-lg flex flex-col h-full overflow-hidden">
  <div class="flex items-center justify-between px-3 py-1.5 border-b border-slate-700/30 flex-shrink-0">
    <div class="flex items-center gap-2">
      <span class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Topics</span>
      {#if keywordData.length > 0}
        <span class="text-[9px] text-slate-600">{keywordData.length} terms</span>
      {/if}
      <CrossFilterBadge {crossFilter} nativeDimensions={['keyword']} />
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
    {#if activeView === 'shared'}
      <svg bind:this={svgEl} class="w-full"></svg>
    {:else if activeView === 'table'}
      {#if keywordData.length > 0}
        <div class="mb-2">
          <div class="grid grid-cols-4 gap-1 text-[9px] uppercase tracking-wider text-slate-500 font-medium mb-1 px-1 sticky top-0 bg-slate-900">
            <span>Keyword</span>
            <span class="text-right text-amber-400/70">GDELT</span>
            <span class="text-right text-violet-400/70">Radio</span>
            <span class="text-right text-sky-400/70">Social</span>
          </div>
          {#each keywordData as kw}
            {@const isSelected = hasHighlight && highlightedKeywords.has(kw.keyword)}
            {@const isDimmed = hasHighlight && !highlightedKeywords.has(kw.keyword)}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <div
              class="grid grid-cols-4 gap-1 px-1 py-0.5 rounded cursor-pointer transition-all {isSelected ? 'bg-indigo-500/20 ring-1 ring-indigo-400/40' : 'hover:bg-slate-800/30'} {isDimmed ? 'opacity-40' : ''}"
              on:click={() => dispatch('crossfilter', { dimension: 'keyword', value: kw.keyword, label: kw.keyword })}
              role="button"
              tabindex="0">
              <span class="text-xs text-slate-300 font-medium truncate">{kw.keyword}</span>
              <span class="text-right text-xs font-mono text-amber-400">{kw.gdelt_count || 0}</span>
              <span class="text-right text-xs font-mono text-violet-400">{kw.radio_count || 0}</span>
              <span class="text-right text-xs font-mono text-sky-400">{kw.social_count || 0}</span>
            </div>
          {/each}
        </div>
        <KeywordNetwork data={keywordData} height={140} {crossFilter} {highlightedKeywords} on:crossfilter />
      {:else}
        <div class="flex items-center justify-center h-full text-slate-600 text-xs">No keyword data</div>
      {/if}
    {:else if activeView === 'cloud'}
      {#if wordCloudData.length > 0}
        <WordCloudChart words={wordCloudData} height={height - 10} {crossFilter} {highlightedKeywords} on:crossfilter />
      {:else}
        <div class="flex items-center justify-center h-full text-slate-600 text-xs">No keyword data</div>
      {/if}
    {/if}
  </div>
</div>
