<script lang="ts">
  import { CHART } from '$lib/utils/chartColors';
	import { onMount, createEventDispatcher } from 'svelte';
	import * as d3 from 'd3';

	import type { CrossFilter } from '$lib/stores/investigationStore';

	export let data: any[] = [];
	export let height: number = 280;
	export let crossFilter: CrossFilter | null = null;
	export let highlightDays: Set<string> | null = null;

	const dispatch = createEventDispatcher<{
		brushChange: { axis: string; range: [number, number] | null };
		crossfilter: CrossFilter;
	}>();

	let container: HTMLDivElement;
	let svg: SVGSVGElement;
	let tooltipEl: HTMLDivElement;
	let containerWidth = 800;

	const metrics: { key: string; label: string; color: string; source: 'gdelt' | 'radio' | 'social'; unit: string }[] = [
		{ key: 'gdelt_events', label: 'GDELT Events', color: CHART.catOrange, source: 'gdelt', unit: '' },
		{ key: 'gdelt_avg_goldstein', label: 'Goldstein Scale', color: CHART.catGreen, source: 'gdelt', unit: '' },
		{ key: 'radio_volume', label: 'Radio Segments', color: CHART.catPink, source: 'radio', unit: '' },
		{ key: 'radio_sentiment', label: 'Radio Sentiment', color: CHART.catPink, source: 'radio', unit: '' },
		{ key: 'social_volume', label: 'Social Posts', color: CHART.catSky, source: 'social', unit: '' },
		{ key: 'social_sentiment', label: 'Social Sentiment', color: CHART.catSky, source: 'social', unit: '' },
	];

	const sourceColors: Record<string, string> = {
		gdelt: CHART.catOrange,
		radio: CHART.catPink,
		social: CHART.catSky,
	};

	onMount(() => {
		const ro = new ResizeObserver((entries) => {
			const rect = entries[0].contentRect;
			containerWidth = rect.width;
			if (data.length > 0) render();
		});
		ro.observe(container);
		return () => ro.disconnect();
	});

	$: effectiveWidth = containerWidth;
	$: if (data.length > 0 && effectiveWidth > 0 && svg) render();
	$: if (crossFilter !== undefined && data.length > 0 && svg) render();
	$: if (highlightDays !== undefined && data.length > 0 && svg) render();

	function computeSentiment(positive: number, negative: number, total: number): number {
		if (total <= 0) return 0;
		return (positive - negative) / total;
	}

	function prepareData() {
		return data.map((d) => ({
			date: d.date,
			parsedDate: d3.timeParse('%Y-%m-%d')(d.date) ?? new Date(d.date),
			gdelt_events: d.gdelt_events ?? 0,
			gdelt_avg_goldstein: d.gdelt_avg_goldstein ?? 0,
			radio_volume: d.radio_segments ?? 0,
			radio_sentiment: computeSentiment(d.radio_positive ?? 0, d.radio_negative ?? 0, d.radio_segments ?? 0),
			social_volume: d.social_posts ?? 0,
			social_sentiment: computeSentiment(d.social_positive ?? 0, d.social_negative ?? 0, d.social_posts ?? 0),
		}));
	}

	function formatValue(key: string, val: number): string {
		if (key.includes('sentiment') || key.includes('goldstein')) return val.toFixed(2);
		return Math.round(val).toLocaleString();
	}

	function render() {
		const svgEl = d3.select(svg);
		svgEl.selectAll('*').remove();

		const prepared = prepareData();
		if (prepared.length === 0) return;

		const cols = 3;
		const rows = 2;
		const cellPadding = { top: 18, right: 8, bottom: 14, left: 36 };
		const cellGapX = 12;
		const cellGapY = 8;
		const totalWidth = effectiveWidth;
		const totalHeight = height;
		const cellWidth = (totalWidth - (cols - 1) * cellGapX) / cols;
		const cellHeight = (totalHeight - (rows - 1) * cellGapY) / rows;
		const sparkW = cellWidth - cellPadding.left - cellPadding.right;
		const sparkH = cellHeight - cellPadding.top - cellPadding.bottom;

		svgEl.attr('width', totalWidth).attr('height', totalHeight);

		const xScale = d3.scaleTime()
			.domain(d3.extent(prepared, (d) => d.parsedDate) as [Date, Date])
			.range([0, sparkW]);

		const hoverLine = svgEl.append('line')
			.attr('y1', 0).attr('y2', totalHeight)
			.attr('stroke', CHART.ink600).attr('stroke-width', 1).attr('stroke-dasharray', '3,3')
			.attr('pointer-events', 'none').style('opacity', 0);

		metrics.forEach((metric, i) => {
			const col = i % cols;
			const row = Math.floor(i / cols);
			const offsetX = col * (cellWidth + cellGapX);
			const offsetY = row * (cellHeight + cellGapY);

			const cellG = svgEl.append('g')
				.attr('transform', `translate(${offsetX},${offsetY})`);

			// Cell background
			cellG.append('rect')
				.attr('width', cellWidth).attr('height', cellHeight)
				.attr('fill', CHART.ink900).attr('rx', 4).attr('stroke', CHART.ink800).attr('stroke-width', 1);

			// Metric label
			cellG.append('text')
				.attr('x', 8).attr('y', 13)
				.attr('fill', CHART.ink400).attr('font-size', '9px').attr('font-weight', '600')
				.text(metric.label);

			// Current value (last data point)
			const lastVal = (prepared[prepared.length - 1] as any)[metric.key];
			cellG.append('text')
				.attr('x', cellWidth - 8).attr('y', 13)
				.attr('text-anchor', 'end')
				.attr('fill', metric.color).attr('font-size', '10px').attr('font-weight', '700').attr('font-family', 'monospace')
				.text(formatValue(metric.key, lastVal));

			const sparkG = cellG.append('g')
				.attr('transform', `translate(${cellPadding.left},${cellPadding.top})`);

			// Y scale per metric
			const vals = prepared.map((d: any) => d[metric.key] as number);
			const ext = d3.extent(vals) as [number, number];
			const yPad = (ext[1] - ext[0]) * 0.15 || 0.5;
			const yScale = d3.scaleLinear()
				.domain([ext[0] - yPad, ext[1] + yPad])
				.range([sparkH, 0]);

			// Zero line for sentiment/goldstein
			if (metric.key.includes('sentiment') || metric.key.includes('goldstein')) {
				const zeroY = yScale(0);
				if (zeroY > 0 && zeroY < sparkH) {
					sparkG.append('line')
						.attr('x1', 0).attr('x2', sparkW)
						.attr('y1', zeroY).attr('y2', zeroY)
						.attr('stroke', CHART.ink700).attr('stroke-width', 1).attr('stroke-dasharray', '2,2');
				}
			}

			// Y axis (2 ticks: min, max)
			const yAxis = d3.axisLeft(yScale).ticks(3).tickSize(-sparkW).tickFormat((d) => {
				const v = d as number;
				if (Math.abs(v) >= 1000) return d3.format('.1s')(v);
				if (Math.abs(v) < 0.01) return '0';
				if (Number.isInteger(v)) return String(v);
				return d3.format('.1f')(v);
			});
			sparkG.append('g')
				.call(yAxis)
				.call((g) => g.select('.domain').remove())
				.call((g) => g.selectAll('.tick line').attr('stroke', CHART.ink800))
				.call((g) => g.selectAll('.tick text').attr('fill', CHART.ink500).attr('font-size', '8px'));

			// Area fill
			const area = d3.area<any>()
				.x((d) => xScale(d.parsedDate))
				.y0(sparkH)
				.y1((d) => yScale(d[metric.key]))
				.curve(d3.curveMonotoneX);

			sparkG.append('path')
				.datum(prepared)
				.attr('fill', metric.color)
				.attr('fill-opacity', 0.1)
				.attr('d', area);

			// Line
			const line = d3.line<any>()
				.x((d) => xScale(d.parsedDate))
				.y((d) => yScale(d[metric.key]))
				.curve(d3.curveMonotoneX);

			sparkG.append('path')
				.datum(prepared)
				.attr('fill', 'none')
				.attr('stroke', metric.color)
				.attr('stroke-width', 1.5)
				.attr('opacity', highlightDays ? 0.3 : 1)
				.attr('d', line);

			// Dots — clickable, highlight/dim based on any cross-filter
			sparkG.selectAll('.dot')
				.data(prepared)
				.join('circle')
				.attr('class', 'dot')
				.attr('cx', (d: any) => xScale(d.parsedDate))
				.attr('cy', (d: any) => yScale(d[metric.key]))
				.attr('r', (d: any) => highlightDays?.has(d.date) ? 4.5 : 2.5)
				.attr('fill', (d: any) => highlightDays?.has(d.date) ? CHART.primary400 : metric.color)
				.attr('fill-opacity', (d: any) => highlightDays ? (highlightDays.has(d.date) ? 1 : 0.15) : 1)
				.attr('stroke', (d: any) => highlightDays?.has(d.date) ? CHART.primary100 : CHART.ink900)
				.attr('stroke-width', (d: any) => highlightDays?.has(d.date) ? 2 : 1)
				.style('cursor', 'pointer')
				.on('click', (_event: any, d: any) => {
					dispatch('crossfilter', { dimension: 'date', value: d.date, label: d.date });
				});

			// Cross-filter indicator line for single-day highlight
			if (highlightDays && highlightDays.size === 1) {
				const cfDate = d3.timeParse('%Y-%m-%d')([...highlightDays][0]);
				if (cfDate) {
					const cx = xScale(cfDate);
					sparkG.append('line').attr('x1', cx).attr('x2', cx).attr('y1', 0).attr('y2', sparkH)
						.attr('stroke', CHART.primary400).attr('stroke-width', 1).attr('stroke-dasharray', '3,2').attr('opacity', 0.6);
				}
			}

			// Hover overlay for this cell
			sparkG.append('rect')
				.attr('width', sparkW).attr('height', sparkH)
				.attr('fill', 'transparent')
				.on('mousemove', (event: MouseEvent) => {
					const [mx] = d3.pointer(event);
					const hoveredDate = xScale.invert(mx);
					const bisect = d3.bisector<any, Date>((d) => d.parsedDate).left;
					const idx = bisect(prepared, hoveredDate, 1);
					const d0 = prepared[idx - 1];
					const d1 = prepared[idx];
					if (!d0) return;
					const closest = d1 && hoveredDate.getTime() - d0.parsedDate.getTime() > d1.parsedDate.getTime() - hoveredDate.getTime() ? d1 : d0;

					const globalX = offsetX + cellPadding.left + xScale(closest.parsedDate);
					hoverLine.attr('x1', globalX).attr('x2', globalX).style('opacity', 1);

					if (tooltipEl) {
						const dateStr = d3.timeFormat('%b %d')(closest.parsedDate);
						tooltipEl.innerHTML = `
							<div class="font-semibold text-white mb-1">${dateStr}</div>
							<div class="text-slate-300 text-xs">
								${metric.label}: <span class="font-mono" style="color:${metric.color}">${formatValue(metric.key, (closest as any)[metric.key])}</span>
							</div>
						`;
						tooltipEl.style.display = 'block';
						const rect = container.getBoundingClientRect();
						let tx = event.clientX - rect.left + 12;
						let ty = event.clientY - rect.top - 10;
						if (tx + 160 > rect.width) tx = tx - 180;
						tooltipEl.style.left = `${tx}px`;
						tooltipEl.style.top = `${ty}px`;
					}
				})
				.on('mouseleave', () => {
					hoverLine.style('opacity', 0);
					if (tooltipEl) tooltipEl.style.display = 'none';
				});
		});
	}
</script>

<div bind:this={container} class="relative w-full">
	{#if data.length === 0}
		<div class="flex items-center justify-center h-64 text-slate-500 text-sm">
			No data available
		</div>
	{:else}
		<svg bind:this={svg} class="w-full" {height}></svg>
		<div
			bind:this={tooltipEl}
			class="absolute pointer-events-none z-50 hidden bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs shadow-xl"
		></div>
	{/if}
</div>
