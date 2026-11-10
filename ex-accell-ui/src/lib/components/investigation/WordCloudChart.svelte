<script lang="ts">
  import { CHART } from '$lib/utils/chartColors';
	import { onMount, createEventDispatcher, tick } from 'svelte';
	import * as d3 from 'd3';
	import cloud from 'd3-cloud';

	import type { CrossFilter } from '$lib/stores/investigationStore';

	export let words: { text: string; size: number }[] = [];
	export let crossFilter: CrossFilter | null = null;
	export let highlightedKeywords: Set<string> = new Set();

	const dispatch = createEventDispatcher<{
		wordClick: { text: string; size: number };
		crossfilter: CrossFilter;
	}>();

	let container: HTMLDivElement;
	let svg: SVGSVGElement;
	let tooltipEl: HTMLDivElement;
	let containerWidth = 800;

	export let height: number = 250;
	const colors = [CHART.catGreen, CHART.catPink, CHART.catBlue, CHART.catOrange, CHART.catSky];

	onMount(() => {
		const ro = new ResizeObserver((entries) => {
			const rect = entries[0].contentRect;
			containerWidth = rect.width;
			if (words.length > 0) render();
		});
		ro.observe(container);
		return () => ro.disconnect();
	});

	$: effectiveWidth = containerWidth;
	$: if (words.length > 0 && effectiveWidth > 0 && svg) render();
	$: if (highlightedKeywords !== undefined && words.length > 0 && svg) render();

	function render() {
		const svgEl = d3.select(svg);
		svgEl.selectAll('*').remove();

		if (words.length === 0) return;

		const maxSize = d3.max(words, (d) => d.size) ?? 1;
		const minSize = d3.min(words, (d) => d.size) ?? 0;

		const fontScale = d3
			.scaleSqrt()
			.domain([minSize, maxSize])
			.range([12, Math.min(72, effectiveWidth / 8)]);

		const colorScale = d3
			.scaleOrdinal<string>()
			.domain(words.map((w) => w.text))
			.range(colors);

		const layoutWords = words.map((w) => ({
			text: w.text.replace(/%/g, '').trim(),
			size: fontScale(w.size),
			rawSize: w.size
		}));

		const layout = cloud()
			.size([effectiveWidth, height])
			.words(layoutWords as any)
			.padding(4)
			.rotate(() => (Math.random() > 0.6 ? 90 : 0))
			.font('Inter, system-ui, sans-serif')
			.fontSize((d: any) => d.size)
			.spiral('archimedean')
			.on('end', draw);

		layout.start();

		function draw(placedWords: any[]) {
			const g = svgEl
				.attr('width', effectiveWidth)
				.attr('height', height)
				.append('g')
				.attr('transform', `translate(${effectiveWidth / 2},${height / 2})`);

			g.selectAll('text')
				.data(placedWords)
				.enter()
				.append('text')
				.attr('text-anchor', 'middle')
				.attr('transform', (d: any) => `translate(${d.x},${d.y}) rotate(${d.rotate})`)
				.attr('font-size', (d: any) => d.size + 'px')
				.attr('font-family', 'Inter, system-ui, sans-serif')
				.attr('font-weight', (d: any) => (d.size > 36 ? '700' : '500'))
				.attr('fill', (d: any) => highlightedKeywords.size > 0 && highlightedKeywords.has(d.text) ? CHART.primary400 : colorScale(d.text))
				.attr('opacity', (d: any) => highlightedKeywords.size > 0 ? (highlightedKeywords.has(d.text) ? 1 : 0.25) : 0.9)
				.attr('stroke', 'none')
				.style('cursor', 'pointer')
				.text((d: any) => d.text)
				.on('mouseenter', function (event: MouseEvent, d: any) {
					d3.select(this).attr('opacity', 1).attr('font-weight', '800');
					showTooltip(event, d);
				})
				.on('mousemove', (event: MouseEvent) => moveTooltip(event))
				.on('mouseleave', function (event: MouseEvent, d: any) {
					d3.select(this)
						.attr('opacity', 0.9)
						.attr('font-weight', d.size > 36 ? '700' : '500');
					hideTooltip();
				})
				.on('click', (_: MouseEvent, d: any) => {
					dispatch('wordClick', { text: d.text, size: d.rawSize });
					dispatch('crossfilter', { dimension: 'keyword', value: d.text, label: d.text });
				});
		}
	}

	function showTooltip(event: MouseEvent, d: any) {
		if (!tooltipEl) return;
		tooltipEl.style.display = 'block';
		tooltipEl.innerHTML = `
			<div class="font-semibold text-white">${d.text}</div>
			<div class="text-slate-300 text-xs mt-0.5">Count: <span class="text-white">${d.rawSize}</span></div>
		`;
		moveTooltip(event);
	}

	function moveTooltip(event: MouseEvent) {
		if (!tooltipEl || !container) return;
		const rect = container.getBoundingClientRect();
		let x = event.clientX - rect.left + 12;
		let y = event.clientY - rect.top - 10;
		if (x + 140 > rect.width) x = x - 160;
		if (y + 50 > rect.height) y = y - 60;
		tooltipEl.style.left = `${x}px`;
		tooltipEl.style.top = `${y}px`;
	}

	function hideTooltip() {
		if (tooltipEl) tooltipEl.style.display = 'none';
	}
</script>

<div bind:this={container} class="relative w-full">
	{#if words.length === 0}
		<div class="flex items-center justify-center h-64 text-slate-500 text-sm">
			No words available for cloud visualization
		</div>
	{:else}
		<svg bind:this={svg} class="w-full" {height}></svg>
		<div
			bind:this={tooltipEl}
			class="absolute pointer-events-none z-50 hidden bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs shadow-xl"
		></div>
	{/if}
</div>
