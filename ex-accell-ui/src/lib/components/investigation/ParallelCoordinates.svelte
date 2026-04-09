<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import * as d3 from 'd3';

	export let data: any[] = [];

	const dispatch = createEventDispatcher<{
		brushChange: { axis: string; range: [number, number] | null };
	}>();

	let container: HTMLDivElement;
	let svg: SVGSVGElement;
	let tooltipEl: HTMLDivElement;
	let containerWidth = 800;

	const margin = { top: 50, right: 40, bottom: 20, left: 40 };
	const height = 420;

	const axisConfig: { key: string; label: string; domain: [number, number] | null }[] = [
		{ key: 'gdelt_events', label: 'GDELT Evt', domain: null },
		{ key: 'gdelt_avg_goldstein', label: 'Goldstein', domain: [-10, 10] },
		{ key: 'radio_volume', label: 'Radio Vol', domain: null },
		{ key: 'radio_sentiment', label: 'Radio Sent', domain: [-1, 1] },
		{ key: 'social_volume', label: 'Social Vol', domain: null },
		{ key: 'social_sentiment', label: 'Social Sent', domain: [-1, 1] }
	];

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

	function computeSentiment(positive: number, negative: number, total: number): number {
		if (total <= 0) return 0;
		return (positive - negative) / total;
	}

	function prepareData() {
		return data.map((d, i) => ({
			index: i,
			date: d.date,
			gdelt_events: d.gdelt_events ?? 0,
			gdelt_avg_goldstein: d.gdelt_avg_goldstein ?? 0,
			radio_volume: d.radio_segments ?? 0,
			radio_sentiment: computeSentiment(
				d.radio_positive ?? 0,
				d.radio_negative ?? 0,
				d.radio_segments ?? 0
			),
			social_volume: d.social_posts ?? 0,
			social_sentiment: computeSentiment(
				d.social_positive ?? 0,
				d.social_negative ?? 0,
				d.social_posts ?? 0
			)
		}));
	}

	function render() {
		const svgEl = d3.select(svg);
		svgEl.selectAll('*').remove();

		const innerWidth = effectiveWidth - margin.left - margin.right;
		const innerHeight = height - margin.top - margin.bottom;

		const prepared = prepareData();
		if (prepared.length === 0) return;

		const g = svgEl
			.attr('width', effectiveWidth)
			.attr('height', height)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		const colorScale = d3
			.scaleLinear<string>()
			.domain([0, prepared.length - 1])
			.range(['#8b5cf6', '#06d6a0']);

		const xScale = d3
			.scalePoint<string>()
			.domain(axisConfig.map((a) => a.key))
			.range([0, innerWidth])
			.padding(0.1);

		const yScales: Record<string, d3.ScaleLinear<number, number>> = {};

		for (const axis of axisConfig) {
			let domain: [number, number];
			if (axis.domain) {
				domain = axis.domain;
			} else {
				const ext = d3.extent(prepared, (d: any) => d[axis.key]) as [number, number];
				domain = [Math.min(0, ext[0]), Math.max(1, ext[1])];
			}
			yScales[axis.key] = d3.scaleLinear().domain(domain).range([innerHeight, 0]).nice();
		}

		const lineGenerator = (d: any) => {
			const points: [number, number][] = axisConfig.map((axis) => [
				xScale(axis.key)!,
				yScales[axis.key](d[axis.key])
			]);
			return d3.line()(points);
		};

		const linesGroup = g.append('g').attr('class', 'lines');

		const paths = linesGroup
			.selectAll('path')
			.data(prepared)
			.enter()
			.append('path')
			.attr('d', lineGenerator)
			.attr('fill', 'none')
			.attr('stroke', (d: any) => colorScale(d.index))
			.attr('stroke-width', 1.5)
			.attr('opacity', 0.6)
			.style('cursor', 'pointer')
			.on('mouseenter', function (event: MouseEvent, d: any) {
				d3.select(this).attr('stroke-width', 3).attr('opacity', 1);
				showTooltip(event, d);
			})
			.on('mousemove', (event: MouseEvent) => {
				moveTooltip(event);
			})
			.on('mouseleave', function () {
				d3.select(this).attr('stroke-width', 1.5).attr('opacity', getOpacity);
				hideTooltip();
			});

		const brushes: Record<string, d3.BrushBehavior<unknown>> = {};
		const brushSelections: Record<string, [number, number] | null> = {};

		function getOpacity(d: any): number {
			const activeAxes = Object.keys(brushSelections).filter(
				(k) => brushSelections[k] !== null
			);
			if (activeAxes.length === 0) return 0.6;
			for (const axisKey of activeAxes) {
				const [y0, y1] = brushSelections[axisKey]!;
				const val = yScales[axisKey](d[axisKey]);
				if (val < y0 || val > y1) return 0.05;
			}
			return 0.85;
		}

		function updateLines() {
			paths.attr('opacity', getOpacity).attr('stroke-width', (d: any) => {
				const activeAxes = Object.keys(brushSelections).filter(
					(k) => brushSelections[k] !== null
				);
				if (activeAxes.length === 0) return 1.5;
				const op = getOpacity(d);
				return op > 0.1 ? 2.5 : 1;
			});
		}

		for (const axis of axisConfig) {
			const x = xScale(axis.key)!;

			const axisG = g
				.append('g')
				.attr('transform', `translate(${x},0)`);

			axisG
				.call(d3.axisLeft(yScales[axis.key]).ticks(5).tickSize(-4))
				.selectAll('text')
				.attr('fill', '#94a3b8')
				.attr('font-size', '10px');

			axisG.selectAll('.domain').attr('stroke', '#475569');
			axisG.selectAll('.tick line').attr('stroke', '#334155');

			axisG
				.append('text')
				.attr('y', -12)
				.attr('x', 0)
				.attr('text-anchor', 'end')
				.attr('fill', '#e2e8f0')
				.attr('font-size', '8px')
				.attr('font-weight', '600')
				.attr('transform', 'rotate(-45, 0, -12)')
				.text(axis.label);

			const brushWidth = 24;
			const brush = d3
				.brushY()
				.extent([
					[-brushWidth / 2, 0],
					[brushWidth / 2, innerHeight]
				])
				.on('brush end', function (event: d3.D3BrushEvent<unknown>) {
					if (event.selection) {
						brushSelections[axis.key] = event.selection as [number, number];
						const yScale = yScales[axis.key];
						const domainRange: [number, number] = [
							yScale.invert(event.selection[1] as number),
							yScale.invert(event.selection[0] as number)
						];
						dispatch('brushChange', { axis: axis.key, range: domainRange });
					} else {
						brushSelections[axis.key] = null;
						dispatch('brushChange', { axis: axis.key, range: null });
					}
					updateLines();
				});

			brushes[axis.key] = brush;

			axisG
				.append('g')
				.attr('class', 'brush')
				.call(brush)
				.selectAll('.selection')
				.attr('fill', '#8b5cf6')
				.attr('fill-opacity', 0.2)
				.attr('stroke', '#8b5cf6');
		}
	}

	function showTooltip(event: MouseEvent, d: any) {
		if (!tooltipEl) return;
		tooltipEl.style.display = 'block';
		tooltipEl.innerHTML = `
			<div class="font-semibold text-white mb-1">${d.date}</div>
			<div class="text-slate-300 text-xs space-y-0.5">
				<div>GDELT Events: <span class="text-white">${d.gdelt_events}</span></div>
				<div>Goldstein: <span class="text-white">${d.gdelt_avg_goldstein.toFixed(2)}</span></div>
				<div>Radio Vol: <span class="text-white">${d.radio_volume}</span></div>
				<div>Radio Sent: <span class="text-white">${d.radio_sentiment.toFixed(3)}</span></div>
				<div>Social Vol: <span class="text-white">${d.social_volume}</span></div>
				<div>Social Sent: <span class="text-white">${d.social_sentiment.toFixed(3)}</span></div>
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
		if (y + 120 > rect.height) y = y - 120;
		tooltipEl.style.left = `${x}px`;
		tooltipEl.style.top = `${y}px`;
	}

	function hideTooltip() {
		if (tooltipEl) tooltipEl.style.display = 'none';
	}
</script>

<div bind:this={container} class="relative w-full">
	{#if data.length === 0}
		<div class="flex items-center justify-center h-64 text-slate-500 text-sm">
			No data available for parallel coordinates
		</div>
	{:else}
		<svg bind:this={svg} class="w-full" {height}></svg>
		<div
			bind:this={tooltipEl}
			class="absolute pointer-events-none z-50 hidden bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs shadow-xl"
		></div>
	{/if}
</div>
