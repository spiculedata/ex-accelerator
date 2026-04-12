<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import * as d3 from 'd3';

  export let data: { label: string; value: number; color: string }[] = [];

  const dispatch = createEventDispatcher<{ segmentClick: { label: string } }>();

  let containerEl: HTMLDivElement;
  let svgEl: SVGSVGElement;
  let tooltipEl: HTMLDivElement;
  let resizeObserver: ResizeObserver;
  let width = 300;
  let height = 300;

  const margin = 20;

  $: total = data.reduce((sum, d) => sum + d.value, 0);
  $: radius = Math.min(width, height) / 2 - margin;
  $: innerRadius = radius * 0.55;

  $: if (svgEl && data.length > 0 && radius > 0) {
    drawChart();
  }

  function drawChart() {
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    const pie = d3
      .pie<{ label: string; value: number; color: string }>()
      .value((d) => d.value)
      .sort(null);

    const arc = d3
      .arc<d3.PieArcDatum<{ label: string; value: number; color: string }>>()
      .innerRadius(innerRadius)
      .outerRadius(radius);

    const arcHover = d3
      .arc<d3.PieArcDatum<{ label: string; value: number; color: string }>>()
      .innerRadius(innerRadius)
      .outerRadius(radius + 6);

    const arcs = g
      .selectAll('path')
      .data(pie(data))
      .enter()
      .append('path')
      .attr('fill', (d) => d.data.color)
      .attr('stroke', 'white')
      .attr('stroke-width', 2)
      .attr('cursor', 'pointer')
      .each(function (d) {
        (this as any)._current = { startAngle: d.startAngle, endAngle: d.startAngle };
      })
      .on('click', (_event, d) => {
        dispatch('segmentClick', { label: d.data.label });
      })
      .on('mouseenter', function (_event, d) {
        d3.select(this).transition().duration(150).attr('d', arcHover as any);
        const pct = total > 0 ? ((d.data.value / total) * 100).toFixed(1) : '0';
        showTooltip(d.data.label, d.data.value, pct);
      })
      .on('mousemove', function (event) {
        moveTooltip(event);
      })
      .on('mouseleave', function () {
        d3.select(this).transition().duration(150).attr('d', arc as any);
        hideTooltip();
      });

    arcs
      .transition()
      .duration(600)
      .attrTween('d', function (d) {
        const prev = (this as any)._current;
        const interp = d3.interpolate(prev, d);
        (this as any)._current = d;
        return (t: number) => arc(interp(t)) || '';
      });

    // Center label
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.2em')
      .attr('class', 'fill-gray-800 text-2xl font-bold')
      .text(total.toLocaleString());

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.2em')
      .attr('class', 'fill-gray-500 text-xs')
      .text('total');
  }

  function showTooltip(label: string, value: number, pct: string) {
    if (!tooltipEl) return;
    tooltipEl.innerHTML = `<span class="font-semibold">${label}</span><br/>${value.toLocaleString()} (${pct}%)`;
    tooltipEl.style.opacity = '1';
  }

  function moveTooltip(event: MouseEvent) {
    if (!tooltipEl || !containerEl) return;
    const rect = containerEl.getBoundingClientRect();
    tooltipEl.style.left = `${event.clientX - rect.left + 12}px`;
    tooltipEl.style.top = `${event.clientY - rect.top - 10}px`;
  }

  function hideTooltip() {
    if (!tooltipEl) return;
    tooltipEl.style.opacity = '0';
  }

  onMount(() => {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        width = cr.width;
        height = Math.min(cr.width, cr.height - 40, 280);
      }
    });
    if (containerEl) {
      resizeObserver.observe(containerEl);
    }
  });

  onDestroy(() => {
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
  });
</script>

<div bind:this={containerEl} class="relative w-full min-h-[200px]">
  {#if data.length === 0 || total === 0}
    <div class="flex flex-col items-center justify-center h-64 text-gray-400">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
      </svg>
      <p class="text-sm font-medium">No sentiment data</p>
    </div>
  {:else}
    <svg bind:this={svgEl} class="mx-auto"></svg>

    <!-- Legend -->
    <div class="flex flex-wrap justify-center gap-4 mt-3">
      {#each data as segment}
        <button
          class="flex items-center gap-1.5 text-xs text-slate-300 hover:text-slate-100 transition-colors"
          on:click={() => dispatch('segmentClick', { label: segment.label })}
        >
          <span class="w-3 h-3 rounded-full inline-block flex-shrink-0" style="background-color: {segment.color}"></span>
          {segment.label}
          <span class="text-slate-500">({segment.value.toLocaleString()})</span>
        </button>
      {/each}
    </div>

    <!-- Tooltip -->
    <div
      bind:this={tooltipEl}
      class="absolute pointer-events-none bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg opacity-0 transition-opacity duration-150 z-50"
      style="opacity: 0"
    ></div>
  {/if}
</div>
