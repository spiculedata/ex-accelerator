<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { getSentimentColor } from '$lib/utils/colorUtils';
  import * as d3 from 'd3';
  import AnalyticalPortal from '../AnalyticalPortal.svelte';
  import SentimentDistribution from '../SentimentDistribution.svelte';
  import { getPortalView, setPortalView, type CrossFilter } from '$lib/stores/investigationStore';
  import { computeTimelineHighlightDays } from '$lib/utils/crossFilterHelpers';
  import CrossFilterBadge from '../CrossFilterBadge.svelte';

  const dispatch = createEventDispatcher<{ crossfilter: CrossFilter }>();

  export let timelineData: any[] = [];
  export let gdeltEvents: any[] = [];
  export let radioSegments: any[] = [];
  export let socialPosts: any[] = [];
  export let height: number = 260;
  export let crossFilter: CrossFilter | null = null;

  let activeView = 'unified';
  let container: HTMLDivElement;
  let svgEl: SVGSVGElement;
  let containerWidth = 400;

  const views = [
    { id: 'unified', label: 'Trend' },
    { id: 'breakdown', label: 'Breakdown' },
    { id: 'by-source', label: 'By Source' },
  ];

  onMount(() => {
    activeView = getPortalView('sentiment', 'unified');
    if (container) {
      const ro = new ResizeObserver((entries) => {
        containerWidth = entries[0].contentRect.width;
        if (activeView !== 'breakdown') renderChart();
      });
      ro.observe(container);
      return () => ro.disconnect();
    }
  });

  function selectView(id: string) {
    activeView = id;
    setPortalView('sentiment', id);
    if (id !== 'breakdown') setTimeout(renderChart, 50);
  }

  // Fused sentiment data
  $: fusedData = timelineData.map(d => {
    const gdeltSent = d.gdelt_events > 0 ? (d.gdelt_avg_tone ?? 0) / 10 : null;
    const radioTotal = d.radio_segments ?? 0;
    const radioSent = radioTotal > 0 ? ((d.radio_positive ?? 0) - (d.radio_negative ?? 0)) / radioTotal : null;
    const socialTotal = d.social_posts ?? 0;
    const socialSent = socialTotal > 0 ? ((d.social_positive ?? 0) - (d.social_negative ?? 0)) / socialTotal : null;

    const sources = [gdeltSent, radioSent, socialSent].filter((v): v is number => v !== null);
    const score = sources.length > 0 ? sources.reduce((a, b) => a + b, 0) / sources.length : 0;
    const spread = sources.length > 1 ? Math.max(...sources) - Math.min(...sources) : 0;

    return {
      date: d.date,
      parsedDate: d3.timeParse('%Y-%m-%d')(d.date) ?? new Date(d.date),
      score,
      agreement: Math.max(0, 1 - spread),
      gdelt: gdeltSent ?? 0,
      radio: radioSent ?? 0,
      social: socialSent ?? 0,
    };
  });

  // Breakdown donut data
  $: breakdownData = (() => {
    let positive = 0, negative = 0, neutral = 0;
    for (const e of gdeltEvents) {
      if ((e.avgtone ?? e.avg_tone ?? 0) > 1) positive++;
      else if ((e.avgtone ?? e.avg_tone ?? 0) < -1) negative++;
      else neutral++;
    }
    for (const s of radioSegments) {
      const sent = (s.sentiment || '').toLowerCase();
      if (sent === 'positive') positive++;
      else if (sent === 'negative') negative++;
      else neutral++;
    }
    for (const p of socialPosts) {
      const sent = (p.sentiment_category || '').toLowerCase();
      if (sent === 'positive' || sent === 'very positive') positive++;
      else if (sent === 'negative' || sent === 'very negative') negative++;
      else neutral++;
    }
    return [
      { label: 'Positive', value: positive, color: getSentimentColor('positive') },
      { label: 'Negative', value: negative, color: getSentimentColor('negative') },
      { label: 'Neutral', value: neutral, color: getSentimentColor('neutral') },
    ];
  })();

  // Compute which days to highlight based on ANY cross-filter dimension
  $: highlightDays = computeTimelineHighlightDays(crossFilter, timelineData, gdeltEvents);

  $: if (fusedData.length > 0 && svgEl && containerWidth > 0 && activeView !== 'breakdown') renderChart();
  $: if (crossFilter !== undefined && activeView !== 'breakdown' && fusedData.length > 0 && svgEl) renderChart();

  function renderChart() {
    if (!svgEl) return;
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const margin = { top: 8, right: 12, bottom: 20, left: 32 };
    const w = containerWidth - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    svg.attr('width', containerWidth).attr('height', height);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleTime()
      .domain(d3.extent(fusedData, d => d.parsedDate) as [Date, Date])
      .range([0, w]);

    if (activeView === 'unified') {
      const yScale = d3.scaleLinear().domain([-1, 1]).range([h, 0]);

      // Zero line
      g.append('line').attr('x1', 0).attr('x2', w)
        .attr('y1', yScale(0)).attr('y2', yScale(0))
        .attr('stroke', '#334155').attr('stroke-dasharray', '3,3');

      // Agreement band
      const area = d3.area<any>()
        .x(d => xScale(d.parsedDate))
        .y0(d => yScale(Math.max(-1, d.score - (1 - d.agreement) * 0.5)))
        .y1(d => yScale(Math.min(1, d.score + (1 - d.agreement) * 0.5)))
        .curve(d3.curveMonotoneX);
      g.append('path').datum(fusedData).attr('fill', '#6366f1').attr('fill-opacity', highlightDays ? 0.05 : 0.12).attr('d', area);

      // Unified line
      const line = d3.line<any>().x(d => xScale(d.parsedDate)).y(d => yScale(d.score)).curve(d3.curveMonotoneX);
      g.append('path').datum(fusedData).attr('fill', 'none').attr('stroke', '#818cf8').attr('stroke-width', 2).attr('opacity', highlightDays ? 0.3 : 1).attr('d', line);

      // Dots coloured by sentiment — clickable, highlight/dim based on cross-filter
      g.selectAll('.dot').data(fusedData).join('circle')
        .attr('cx', d => xScale(d.parsedDate))
        .attr('cy', d => yScale(d.score))
        .attr('r', (d: any) => highlightDays?.has(d.date) ? 5 : 3)
        .attr('fill', d => d.score > 0.05 ? getSentimentColor('positive') : d.score < -0.05 ? getSentimentColor('negative') : getSentimentColor('neutral'))
        .attr('fill-opacity', (d: any) => highlightDays ? (highlightDays.has(d.date) ? 1 : 0.15) : 1)
        .attr('stroke', (d: any) => highlightDays?.has(d.date) ? '#818cf8' : '#0f172a')
        .attr('stroke-width', (d: any) => highlightDays?.has(d.date) ? 2 : 1)
        .style('cursor', 'pointer')
        .on('click', (_event: any, d: any) => {
          dispatch('crossfilter', { dimension: 'date', value: d.date, label: d.date });
        });

      // Y axis
      g.append('g').call(d3.axisLeft(yScale).ticks(5).tickSize(-w).tickFormat(d3.format('.1f')))
        .call(g2 => g2.select('.domain').remove())
        .call(g2 => g2.selectAll('.tick line').attr('stroke', '#1e293b'))
        .call(g2 => g2.selectAll('.tick text').attr('fill', '#64748b').attr('font-size', '8px'));

      // Labels
      g.append('text').attr('x', w).attr('y', yScale(0.8)).attr('text-anchor', 'end')
        .attr('fill', getSentimentColor('positive')).attr('font-size', '8px').attr('opacity', 0.6).text('positive');
      g.append('text').attr('x', w).attr('y', yScale(-0.8)).attr('text-anchor', 'end')
        .attr('fill', getSentimentColor('negative')).attr('font-size', '8px').attr('opacity', 0.6).text('negative');

    } else if (activeView === 'by-source') {
      const yScale = d3.scaleLinear().domain([-1, 1]).range([h, 0]);

      // Zero line
      g.append('line').attr('x1', 0).attr('x2', w)
        .attr('y1', yScale(0)).attr('y2', yScale(0))
        .attr('stroke', '#334155').attr('stroke-dasharray', '3,3');

      const sources = [
        { key: 'gdelt', color: '#f59e0b', label: 'GDELT' },
        { key: 'radio', color: '#a78bfa', label: 'Radio' },
        { key: 'social', color: '#38bdf8', label: 'Social' },
      ];

      for (const src of sources) {
        const line = d3.line<any>().x(d => xScale(d.parsedDate)).y(d => yScale(d[src.key])).curve(d3.curveMonotoneX);
        g.append('path').datum(fusedData).attr('fill', 'none').attr('stroke', src.color).attr('stroke-width', 1.5).attr('opacity', highlightDays ? 0.3 : 1).attr('d', line);
        g.selectAll(`.dot-${src.key}`).data(fusedData).join('circle')
          .attr('cx', d => xScale(d.parsedDate)).attr('cy', d => yScale(d[src.key]))
          .attr('r', (d: any) => highlightDays?.has(d.date) ? 5 : 2.5)
          .attr('fill', src.color)
          .attr('fill-opacity', (d: any) => highlightDays ? (highlightDays.has(d.date) ? 1 : 0.15) : 1)
          .attr('stroke', (d: any) => highlightDays?.has(d.date) ? '#818cf8' : '#0f172a')
          .attr('stroke-width', (d: any) => highlightDays?.has(d.date) ? 2 : 1)
          .style('cursor', 'pointer')
          .on('click', (_event: any, d: any) => {
            dispatch('crossfilter', { dimension: 'date', value: d.date, label: d.date });
          });
      }

      // Legend
      sources.forEach((src, i) => {
        g.append('circle').attr('cx', w - 80 + i * 50).attr('cy', 6).attr('r', 3).attr('fill', src.color);
        g.append('text').attr('x', w - 75 + i * 50).attr('y', 9).attr('fill', '#94a3b8').attr('font-size', '8px').text(src.label);
      });

      g.append('g').call(d3.axisLeft(yScale).ticks(5).tickSize(-w).tickFormat(d3.format('.1f')))
        .call(g2 => g2.select('.domain').remove())
        .call(g2 => g2.selectAll('.tick line').attr('stroke', '#1e293b'))
        .call(g2 => g2.selectAll('.tick text').attr('fill', '#64748b').attr('font-size', '8px'));
    }

    // Shared X axis
    g.append('g').attr('transform', `translate(0,${h})`)
      .call(d3.axisBottom(xScale).ticks(d3.timeDay.every(1)).tickFormat(d => d3.timeFormat('%b %d')(d as Date)))
      .call(g2 => g2.select('.domain').attr('stroke', '#334155'))
      .call(g2 => g2.selectAll('.tick text').attr('fill', '#64748b').attr('font-size', '8px'))
      .call(g2 => g2.selectAll('.tick line').attr('stroke', '#334155'));

    // Cross-filter indicator line for single-day highlights
    if (highlightDays && highlightDays.size === 1) {
      const cfDate = d3.timeParse('%Y-%m-%d')([...highlightDays][0]);
      if (cfDate) {
        const cx = xScale(cfDate);
        g.append('line').attr('x1', cx).attr('x2', cx).attr('y1', 0).attr('y2', h)
          .attr('stroke', '#818cf8').attr('stroke-width', 1.5).attr('stroke-dasharray', '4,3').attr('opacity', 0.7);
      }
    }
  }
</script>

<div class="bg-slate-900 border border-slate-700/30 rounded-lg flex flex-col h-full overflow-hidden">
  <div class="flex items-center justify-between px-3 py-1.5 border-b border-slate-700/30 flex-shrink-0">
    <span class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Sentiment</span>
    <CrossFilterBadge {crossFilter} nativeDimensions={['date', 'sentiment']} />
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

  <div bind:this={container} class="flex-1 min-h-0 p-2">
    {#if activeView === 'breakdown'}
      <SentimentDistribution data={breakdownData} {crossFilter} on:crossfilter />
    {:else}
      <svg bind:this={svgEl} class="w-full"></svg>
    {/if}
  </div>
</div>
