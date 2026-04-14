<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import * as d3 from 'd3';
  import ParallelCoordinates from '../ParallelCoordinates.svelte';
  import { getPortalView, setPortalView, type CrossFilter } from '$lib/stores/investigationStore';
  import { computeTimelineHighlightDays } from '$lib/utils/crossFilterHelpers';
  import CrossFilterBadge from '../CrossFilterBadge.svelte';

  const dispatch = createEventDispatcher<{ crossfilter: CrossFilter }>();

  export let timelineData: any[] = [];
  export let gdeltEvents: any[] = [];
  export let height: number = 260;
  export let crossFilter: CrossFilter | null = null;

  let activeView = 'attention';
  let container: HTMLDivElement;
  let svgEl: SVGSVGElement;
  let containerWidth = 400;

  const views = [
    { id: 'attention', label: 'Attention' },
    { id: 'sparklines', label: 'Metrics' },
    { id: 'stacked', label: 'Stacked' },
  ];

  onMount(() => {
    activeView = getPortalView('volume', 'attention');
    if (container) {
      const ro = new ResizeObserver((entries) => {
        containerWidth = entries[0].contentRect.width;
        if (activeView !== 'sparklines') renderChart();
      });
      ro.observe(container);
      return () => ro.disconnect();
    }
  });

  function selectView(id: string) {
    activeView = id;
    setPortalView('volume', id);
    if (id !== 'sparklines') setTimeout(renderChart, 50);
  }

  // Normalised attention index: each source scaled 0-100, then averaged
  $: attentionData = (() => {
    if (timelineData.length === 0) return [];
    const maxGdelt = d3.max(timelineData, (d: any) => d.gdelt_events) || 1;
    const maxRadio = d3.max(timelineData, (d: any) => d.radio_segments) || 1;
    const maxSocial = d3.max(timelineData, (d: any) => d.social_posts) || 1;
    return timelineData.map((d: any) => {
      const gNorm = (d.gdelt_events / maxGdelt) * 100;
      const rNorm = (d.radio_segments / maxRadio) * 100;
      const sNorm = (d.social_posts / maxSocial) * 100;
      const active = [d.gdelt_events > 0 ? gNorm : null, d.radio_segments > 0 ? rNorm : null, d.social_posts > 0 ? sNorm : null].filter((v): v is number => v !== null);
      const index = active.length > 0 ? active.reduce((a, b) => a + b, 0) / active.length : 0;
      return {
        date: d.date,
        parsedDate: d3.timeParse('%Y-%m-%d')(d.date) ?? new Date(d.date),
        index, gdelt: gNorm, radio: rNorm, social: sNorm,
        rawGdelt: d.gdelt_events, rawRadio: d.radio_segments, rawSocial: d.social_posts,
      };
    });
  })();

  $: highlightDays = computeTimelineHighlightDays(crossFilter, timelineData, gdeltEvents);

  $: if (attentionData.length > 0 && svgEl && containerWidth > 0 && activeView !== 'sparklines') renderChart();
  $: if (crossFilter !== undefined && activeView !== 'sparklines' && attentionData.length > 0 && svgEl) renderChart();

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
      .domain(d3.extent(attentionData, d => d.parsedDate) as [Date, Date])
      .range([0, w]);

    if (activeView === 'attention') {
      const yScale = d3.scaleLinear().domain([0, 100]).range([h, 0]);

      // Attention index area
      const area = d3.area<any>()
        .x(d => xScale(d.parsedDate)).y0(h).y1(d => yScale(d.index)).curve(d3.curveMonotoneX);
      g.append('path').datum(attentionData).attr('fill', '#6366f1').attr('fill-opacity', highlightDays ? 0.05 : 0.15).attr('d', area);

      // Attention line
      const line = d3.line<any>().x(d => xScale(d.parsedDate)).y(d => yScale(d.index)).curve(d3.curveMonotoneX);
      g.append('path').datum(attentionData).attr('fill', 'none').attr('stroke', '#818cf8').attr('stroke-width', 2).attr('opacity', highlightDays ? 0.3 : 1).attr('d', line);

      // Source contribution bars (thin stacked bars at each data point)
      const barW = Math.max(2, w / attentionData.length * 0.4);
      attentionData.forEach(d => {
        const x = xScale(d.parsedDate) - barW / 2;
        const total = d.gdelt + d.radio + d.social || 1;
        let cy = h;
        const segments = [
          { val: d.gdelt, color: '#f59e0b' },
          { val: d.radio, color: '#a78bfa' },
          { val: d.social, color: '#38bdf8' },
        ];
        for (const seg of segments) {
          const segH = (seg.val / total) * (h - yScale(d.index));
          const barOpacity = highlightDays ? (highlightDays.has(d.date) ? 0.6 : 0.08) : 0.4;
          g.append('rect').attr('x', x).attr('y', cy - segH).attr('width', barW).attr('height', segH)
            .attr('fill', seg.color).attr('opacity', barOpacity);
          cy -= segH;
        }
      });

      // Dots — clickable, highlight/dim based on cross-filter
      g.selectAll('.dot').data(attentionData).join('circle')
        .attr('cx', d => xScale(d.parsedDate)).attr('cy', d => yScale(d.index))
        .attr('r', (d: any) => highlightDays?.has(d.date) ? 5 : 3)
        .attr('fill', '#818cf8')
        .attr('fill-opacity', (d: any) => highlightDays ? (highlightDays.has(d.date) ? 1 : 0.15) : 1)
        .attr('stroke', (d: any) => highlightDays?.has(d.date) ? '#e0e7ff' : '#0f172a')
        .attr('stroke-width', (d: any) => highlightDays?.has(d.date) ? 2 : 1)
        .style('cursor', 'pointer')
        .on('click', (_event: any, d: any) => {
          dispatch('crossfilter', { dimension: 'date', value: d.date, label: d.date });
        });

      g.append('g').call(d3.axisLeft(yScale).ticks(5).tickSize(-w))
        .call(g2 => g2.select('.domain').remove())
        .call(g2 => g2.selectAll('.tick line').attr('stroke', '#1e293b'))
        .call(g2 => g2.selectAll('.tick text').attr('fill', '#64748b').attr('font-size', '8px'));

      // "Attention Index" label
      g.append('text').attr('x', 4).attr('y', 8).attr('fill', '#64748b').attr('font-size', '8px').text('Attention Index (0–100)');

    } else if (activeView === 'stacked') {
      const yMax = d3.max(attentionData, d => d.rawGdelt + d.rawRadio + d.rawSocial) ?? 1;
      const yScale = d3.scaleLinear().domain([0, yMax]).nice().range([h, 0]);

      const stack = d3.stack<any>().keys(['rawRadio', 'rawSocial', 'rawGdelt']).order(d3.stackOrderNone).offset(d3.stackOffsetNone);
      const stacked = stack(attentionData);
      const colors: Record<string, string> = { rawGdelt: '#f59e0b', rawRadio: '#a78bfa', rawSocial: '#38bdf8' };
      const labels: Record<string, string> = { rawGdelt: 'GDELT', rawRadio: 'Radio', rawSocial: 'Social' };

      const area = d3.area<any>()
        .x(d => xScale(d.data.parsedDate)).y0(d => yScale(d[0])).y1(d => yScale(d[1])).curve(d3.curveMonotoneX);

      stacked.forEach(series => {
        g.append('path').datum(series).attr('fill', colors[series.key]).attr('opacity', highlightDays ? 0.2 : 0.6).attr('d', area);
      });

      // Clickable dots at each data point on top of stack
      const topSeries = stacked[stacked.length - 1];
      if (topSeries) {
        g.selectAll('.stack-dot').data(topSeries).join('circle')
          .attr('cx', (d: any) => xScale(d.data.parsedDate))
          .attr('cy', (d: any) => yScale(d[1]))
          .attr('r', (d: any) => highlightDays?.has(d.data.date) ? 5 : 3)
          .attr('fill', '#818cf8')
          .attr('fill-opacity', (d: any) => highlightDays ? (highlightDays.has(d.data.date) ? 1 : 0.15) : 1)
          .attr('stroke', (d: any) => highlightDays?.has(d.data.date) ? '#e0e7ff' : '#0f172a')
          .attr('stroke-width', (d: any) => highlightDays?.has(d.data.date) ? 2 : 1)
          .style('cursor', 'pointer')
          .on('click', (_event: any, d: any) => {
            dispatch('crossfilter', { dimension: 'date', value: d.data.date, label: d.data.date });
          });
      }

      // Legend
      let lx = w - 10;
      for (const key of ['rawGdelt', 'rawSocial', 'rawRadio']) {
        const lbl = labels[key];
        lx -= lbl.length * 6 + 18;
        g.append('circle').attr('cx', lx).attr('cy', 6).attr('r', 3).attr('fill', colors[key]);
        g.append('text').attr('x', lx + 6).attr('y', 9).attr('fill', '#94a3b8').attr('font-size', '8px').text(lbl);
      }

      g.append('g').call(d3.axisLeft(yScale).ticks(5).tickSize(-w).tickFormat(d => d3.format('.2s')(d as number)))
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
    <span class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Volume</span>
    <CrossFilterBadge {crossFilter} nativeDimensions={['date']} />
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
    {#if activeView === 'sparklines'}
      <ParallelCoordinates data={timelineData} {height} {crossFilter} {highlightDays} on:crossfilter />
    {:else}
      <svg bind:this={svgEl} class="w-full"></svg>
    {/if}
  </div>
</div>
