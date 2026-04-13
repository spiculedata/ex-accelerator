<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import * as d3 from 'd3';

	export let data: any[] = [];
	export let sourceA: string = 'gdelt';
	export let sourceB: string = 'social';

	const dispatch = createEventDispatcher<{
		dayClick: { date: string };
	}>();

	let container: HTMLDivElement;
	let svg: SVGSVGElement;
	let tooltipEl: HTMLDivElement;
	let containerWidth = 800;
	let lagHours = 0;
	let correlation = 0;

	export let chartHeight: number = 200;
	const sliderHeight = 40;
	const totalHeight = chartHeight + sliderHeight + 16;
	const margin = { top: 20, right: 20, bottom: 44, left: 48 };

	const sourceLabels: Record<string, string> = {
		gdelt: 'GDELT Tone',
		radio: 'Radio Sentiment',
		social: 'Social Sentiment'
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
	$: if (data.length > 0 && svg) render(), lagHours;

	function getMetric(d: any, source: string): number {
		switch (source) {
			case 'gdelt':
				return (d.gdelt_avg_goldstein ?? 0) / 10;
			case 'radio': {
				const total = d.radio_segments ?? 0;
				if (total <= 0) return 0;
				return ((d.radio_positive ?? 0) - (d.radio_negative ?? 0)) / total;
			}
			case 'social': {
				const total = d.social_posts ?? 0;
				if (total <= 0) return 0;
				return ((d.social_positive ?? 0) - (d.social_negative ?? 0)) / total;
			}
			default:
				return 0;
		}
	}

	function pearsonCorrelation(x: number[], y: number[]): number {
		const n = x.length;
		if (n < 2) return 0;
		const meanX = d3.mean(x) ?? 0;
		const meanY = d3.mean(y) ?? 0;
		let num = 0;
		let denomX = 0;
		let denomY = 0;
		for (let i = 0; i < n; i++) {
			const dx = x[i] - meanX;
			const dy = y[i] - meanY;
			num += dx * dy;
			denomX += dx * dx;
			denomY += dy * dy;
		}
		const denom = Math.sqrt(denomX * denomY);
		if (denom === 0) return 0;
		return num / denom;
	}

	function computeLaggedData() {
		const lagDays = lagHours / 24;
		const lagOffset = Math.round(lagDays);
		const sorted = [...data].sort(
			(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
		);

		const pairs: { date: string; a: number; b: number }[] = [];
		for (let i = 0; i < sorted.length; i++) {
			const j = i + lagOffset;
			if (j < 0 || j >= sorted.length) continue;
			pairs.push({
				date: sorted[i].date,
				a: getMetric(sorted[i], sourceA),
				b: getMetric(sorted[j], sourceB)
			});
		}
		return pairs;
	}

	function render() {
		const svgEl = d3.select(svg);
		svgEl.selectAll('*').remove();

		const innerWidth = effectiveWidth - margin.left - margin.right;
		const innerHeight = chartHeight - margin.top - margin.bottom;

		const pairs = computeLaggedData();
		if (pairs.length === 0) return;

		const xArr = pairs.map((p) => p.a);
		const yArr = pairs.map((p) => p.b);
		correlation = pairs.length >= 3 ? pearsonCorrelation(xArr, yArr) : NaN;

		const g = svgEl
			.attr('width', effectiveWidth)
			.attr('height', chartHeight)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		const xExtent = d3.extent(xArr) as [number, number];
		const yExtent = d3.extent(yArr) as [number, number];
		const xRange = xExtent[1] - xExtent[0];
		const yRange = yExtent[1] - yExtent[0];
		// Pad proportionally, with a small minimum relative to the data magnitude
		const xPad = xRange > 0.001 ? xRange * 0.2 : Math.max(Math.abs(xExtent[0]) * 0.5, 0.05);
		const yPad = yRange > 0.001 ? yRange * 0.2 : Math.max(Math.abs(yExtent[0]) * 0.5, 0.05);

		const xScale = d3
			.scaleLinear()
			.domain([xExtent[0] - xPad, xExtent[1] + xPad])
			.range([0, innerWidth]);

		const yScale = d3
			.scaleLinear()
			.domain([yExtent[0] - yPad, yExtent[1] + yPad])
			.range([innerHeight, 0]);

		const colorScale = d3
			.scaleLinear<string>()
			.domain([0, pairs.length - 1])
			.range(['#8b5cf6', '#06d6a0']);

		g.append('g')
			.attr('transform', `translate(0,${innerHeight})`)
			.call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.format('.2f')))
			.selectAll('text')
			.attr('fill', '#94a3b8')
			.attr('font-size', '10px');

		g.append('g')
			.call(d3.axisLeft(yScale).ticks(6).tickFormat(d3.format('.2f')))
			.selectAll('text')
			.attr('fill', '#94a3b8')
			.attr('font-size', '10px');

		g.selectAll('.domain').attr('stroke', '#475569');
		g.selectAll('.tick line').attr('stroke', '#334155');

		g.append('text')
			.attr('x', innerWidth / 2)
			.attr('y', innerHeight + 38)
			.attr('text-anchor', 'middle')
			.attr('fill', '#94a3b8')
			.attr('font-size', '11px')
			.text(sourceLabels[sourceA] ?? sourceA);

		g.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -innerHeight / 2)
			.attr('y', -42)
			.attr('text-anchor', 'middle')
			.attr('fill', '#94a3b8')
			.attr('font-size', '11px')
			.text(sourceLabels[sourceB] ?? sourceB);

		if (pairs.length >= 2) {
			const xMean = d3.mean(xArr) ?? 0;
			const yMean = d3.mean(yArr) ?? 0;
			let ssxx = 0;
			let ssxy = 0;
			for (let i = 0; i < pairs.length; i++) {
				ssxx += (xArr[i] - xMean) ** 2;
				ssxy += (xArr[i] - xMean) * (yArr[i] - yMean);
			}
			if (ssxx > 0) {
				const slope = ssxy / ssxx;
				const intercept = yMean - slope * xMean;
				const x1 = xScale.domain()[0];
				const x2 = xScale.domain()[1];
				g.append('line')
					.attr('x1', xScale(x1))
					.attr('y1', yScale(slope * x1 + intercept))
					.attr('x2', xScale(x2))
					.attr('y2', yScale(slope * x2 + intercept))
					.attr('stroke', '#fbbf24')
					.attr('stroke-width', 2)
					.attr('stroke-dasharray', '6,3')
					.attr('opacity', 0.7);
			}
		}

		g.selectAll('circle')
			.data(pairs)
			.enter()
			.append('circle')
			.attr('cx', (d: any) => xScale(d.a))
			.attr('cy', (d: any) => yScale(d.b))
			.attr('r', 6)
			.attr('fill', (_: any, i: number) => colorScale(i))
			.attr('stroke', '#0f172a')
			.attr('stroke-width', 1.5)
			.attr('opacity', 0.85)
			.style('cursor', 'pointer')
			.on('mouseenter', function (event: MouseEvent, d: any) {
				d3.select(this).attr('r', 8).attr('opacity', 1);
				showTooltip(event, d);
			})
			.on('mousemove', (event: MouseEvent) => moveTooltip(event))
			.on('mouseleave', function () {
				d3.select(this).attr('r', 5).attr('opacity', 0.8);
				hideTooltip();
			})
			.on('click', (_: MouseEvent, d: any) => {
				dispatch('dayClick', { date: d.date });
			});

		const hasValidCorr = !isNaN(correlation);
		const corrColor = !hasValidCorr
			? '#64748b'
			: Math.abs(correlation) > 0.5
				? '#22c55e'
				: Math.abs(correlation) > 0.3
					? '#eab308'
					: '#94a3b8';

		g.append('text')
			.attr('x', innerWidth - 8)
			.attr('y', 4)
			.attr('text-anchor', 'end')
			.attr('fill', corrColor)
			.attr('font-size', '18px')
			.attr('font-weight', '700')
			.text(hasValidCorr ? `r = ${correlation.toFixed(3)}` : 'insufficient data');

		const lagLabel =
			lagHours === 0
				? 'no lag'
				: lagHours > 0
					? `+${lagHours}h`
					: `${lagHours}h`;

		g.append('text')
			.attr('x', innerWidth - 8)
			.attr('y', 22)
			.attr('text-anchor', 'end')
			.attr('fill', '#cbd5e1')
			.attr('font-size', '11px')
			.text(
				`${sourceLabels[sourceA] ?? sourceA} → ${sourceLabels[sourceB] ?? sourceB} (lag: ${lagLabel})`
			);
	}

	function showTooltip(event: MouseEvent, d: any) {
		if (!tooltipEl) return;
		tooltipEl.style.display = 'block';
		tooltipEl.innerHTML = `
			<div class="font-semibold text-white mb-1">${d.date}</div>
			<div class="text-slate-300 text-xs space-y-0.5">
				<div>${sourceLabels[sourceA] ?? sourceA}: <span class="text-white">${d.a.toFixed(3)}</span></div>
				<div>${sourceLabels[sourceB] ?? sourceB}: <span class="text-white">${d.b.toFixed(3)}</span></div>
			</div>
		`;
		moveTooltip(event);
	}

	function moveTooltip(event: MouseEvent) {
		if (!tooltipEl || !container) return;
		const rect = container.getBoundingClientRect();
		let x = event.clientX - rect.left + 12;
		let y = event.clientY - rect.top - 10;
		if (x + 180 > rect.width) x = x - 200;
		if (y + 80 > rect.height) y = y - 80;
		tooltipEl.style.left = `${x}px`;
		tooltipEl.style.top = `${y}px`;
	}

	function hideTooltip() {
		if (tooltipEl) tooltipEl.style.display = 'none';
	}

	function handleLagInput(event: Event) {
		const target = event.target as HTMLInputElement;
		lagHours = parseInt(target.value, 10);
	}
</script>

<div bind:this={container} class="relative w-full">
	{#if data.length === 0}
		<div class="flex items-center justify-center h-64 text-slate-500 text-sm">
			No data available for lag analysis
		</div>
	{:else}
		<svg bind:this={svg} class="w-full" height={chartHeight}></svg>
		<div class="flex items-center gap-4 px-4 py-2">
			<label class="text-xs text-slate-400 whitespace-nowrap">
				Lag: <span class="text-white font-medium">{lagHours}h</span>
			</label>
			<input
				type="range"
				min="-72"
				max="72"
				step="6"
				value={lagHours}
				on:input={handleLagInput}
				class="flex-1 h-2 rounded-lg appearance-none cursor-pointer accent-violet-500 bg-slate-700"
			/>
			<span class="text-xs text-slate-500 whitespace-nowrap">-72h to +72h</span>
		</div>
		<div
			bind:this={tooltipEl}
			class="absolute pointer-events-none z-50 hidden bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs shadow-xl"
		></div>
	{/if}
</div>
