<script lang="ts">
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import LagAnalysisChart from '../LagAnalysisChart.svelte';
  import { getPortalView, setPortalView } from '$lib/stores/investigationStore';

  export let timelineData: any[] = [];
  export let height: number = 260;

  let activeView = 'agreement';
  let container: HTMLDivElement;
  let svgEl: SVGSVGElement;
  let containerWidth = 400;

  const views = [
    { id: 'agreement', label: 'Agreement' },
    { id: 'lag', label: 'Lag' },
    { id: 'overlay', label: 'Overlay' },
  ];

  onMount(() => {
    activeView = getPortalView('correlation', 'agreement');
    if (container) {
      const ro = new ResizeObserver((entries) => {
        containerWidth = entries[0].contentRect.width;
        if (activeView !== 'lag') renderChart();
      });
      ro.observe(container);
      return () => ro.disconnect();
    }
  });

  function selectView(id: string) {
    activeView = id;
    setPortalView('correlation', id);
    if (id !== 'lag') setTimeout(renderChart, 50);
  }

  // Compute per-source normalised sentiment for correlation analysis
  $: correlationData = timelineData.map((d: any) => {
    const gdeltSent = d.gdelt_events > 0 ? (d.gdelt_avg_tone ?? 0) / 10 : null;
    const radioTotal = d.radio_segments ?? 0;
    const radioSent = radioTotal > 0 ? ((d.radio_positive ?? 0) - (d.radio_negative ?? 0)) / radioTotal : null;
    const socialTotal = d.social_posts ?? 0;
    const socialSent = socialTotal > 0 ? ((d.social_positive ?? 0) - (d.social_negative ?? 0)) / socialTotal : null;

    const vals = [gdeltSent, radioSent, socialSent].filter((v): v is number => v !== null);
    const mean = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const spread = vals.length > 1 ? Math.max(...vals) - Math.min(...vals) : 0;
    const agreement = vals.length > 1 ? Math.max(0, 1 - spread) : 0;

    return {
      date: d.date,
      parsedDate: d3.timeParse('%Y-%m-%d')(d.date) ?? new Date(d.date),
      gdelt: gdeltSent ?? 0, radio: radioSent ?? 0, social: socialSent ?? 0,
      agreement, mean, spread,
      sourceCount: vals.length,
    };
  });

  $: if (correlationData.length > 0 && svgEl && containerWidth > 0 && activeView !== 'lag') renderChart();

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
      .domain(d3.extent(correlationData, d => d.parsedDate) as [Date, Date])
      .range([0, w]);

    if (activeView === 'agreement') {
      const yScale = d3.scaleLinear().domain([0, 1]).range([h, 0]);

      // Agreement area fill — green when high, red when low
      const agreementGrad = svg.append('defs').append('linearGradient')
        .attr('id', 'agree-grad').attr('gradientUnits', 'userSpaceOnUse')
        .attr('y1', yScale(1) + margin.top).attr('y2', yScale(0) + margin.top);
      agreementGrad.append('stop').attr('offset', '0%').attr('stop-color', '#22c55e');
      agreementGrad.append('stop').attr('offset', '50%').attr('stop-color', '#eab308');
      agreementGrad.append('stop').attr('offset', '100%').attr('stop-color', '#ef4444');

      const area = d3.area<any>()
        .x(d => xScale(d.parsedDate)).y0(h).y1(d => yScale(d.agreement)).curve(d3.curveMonotoneX);
      g.append('path').datum(correlationData).attr('fill', 'url(#agree-grad)').attr('fill-opacity', 0.25).attr('d', area);

      const line = d3.line<any>().x(d => xScale(d.parsedDate)).y(d => yScale(d.agreement)).curve(d3.curveMonotoneX);
      g.append('path').datum(correlationData).attr('fill', 'none').attr('stroke', '#22c55e').attr('stroke-width', 2).attr('d', line);

      g.selectAll('.dot').data(correlationData).join('circle')
        .attr('cx', d => xScale(d.parsedDate)).attr('cy', d => yScale(d.agreement))
        .attr('r', 3)
        .attr('fill', d => d.agreement > 0.7 ? '#22c55e' : d.agreement > 0.4 ? '#eab308' : '#ef4444')
        .attr('stroke', '#0f172a').attr('stroke-width', 1);

      // Threshold lines
      g.append('line').attr('x1', 0).attr('x2', w).attr('y1', yScale(0.7)).attr('y2', yScale(0.7))
        .attr('stroke', '#22c55e').attr('stroke-dasharray', '2,4').attr('opacity', 0.3);
      g.append('text').attr('x', w).attr('y', yScale(0.7) - 3).attr('text-anchor', 'end')
        .attr('fill', '#22c55e').attr('font-size', '7px').attr('opacity', 0.5).text('consensus');

      g.append('g').call(d3.axisLeft(yScale).ticks(5).tickSize(-w).tickFormat(d3.format('.1f')))
        .call(g2 => g2.select('.domain').remove())
        .call(g2 => g2.selectAll('.tick line').attr('stroke', '#1e293b'))
        .call(g2 => g2.selectAll('.tick text').attr('fill', '#64748b').attr('font-size', '8px'));

    } else if (activeView === 'overlay') {
      const yScale = d3.scaleLinear().domain([-1, 1]).range([h, 0]);

      g.append('line').attr('x1', 0).attr('x2', w).attr('y1', yScale(0)).attr('y2', yScale(0))
        .attr('stroke', '#334155').attr('stroke-dasharray', '3,3');

      const sources = [
        { key: 'gdelt', color: '#f59e0b', label: 'GDELT' },
        { key: 'radio', color: '#a78bfa', label: 'Radio' },
        { key: 'social', color: '#38bdf8', label: 'Social' },
      ];

      for (const src of sources) {
        const area = d3.area<any>()
          .x(d => xScale(d.parsedDate)).y0(d => yScale(0)).y1(d => yScale(d[src.key])).curve(d3.curveMonotoneX);
        g.append('path').datum(correlationData).attr('fill', src.color).attr('fill-opacity', 0.08).attr('d', area);

        const line = d3.line<any>().x(d => xScale(d.parsedDate)).y(d => yScale(d[src.key])).curve(d3.curveMonotoneX);
        g.append('path').datum(correlationData).attr('fill', 'none').attr('stroke', src.color).attr('stroke-width', 1.5).attr('d', line);
      }

      // Legend
      let lx = w - 10;
      for (const src of [...sources].reverse()) {
        lx -= src.label.length * 6 + 18;
        g.append('circle').attr('cx', lx).attr('cy', 6).attr('r', 3).attr('fill', src.color);
        g.append('text').attr('x', lx + 6).attr('y', 9).attr('fill', '#94a3b8').attr('font-size', '8px').text(src.label);
      }

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
  }
</script>

<div class="bg-slate-900 border border-slate-700/30 rounded-lg flex flex-col h-full overflow-hidden">
  <div class="flex items-center justify-between px-3 py-1.5 border-b border-slate-700/30 flex-shrink-0">
    <span class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Correlation</span>
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
    {#if activeView === 'lag'}
      <LagAnalysisChart data={timelineData} sourceA="gdelt" sourceB="social" chartHeight={height - 40} />
    {:else}
      <svg bind:this={svgEl} class="w-full"></svg>
    {/if}
  </div>
</div>
