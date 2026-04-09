<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import * as d3 from 'd3';

	export let data: any[] = [];

	const dispatch = createEventDispatcher<{
		keywordClick: { keyword: string; gdelt_count: number; radio_count: number; social_count: number };
	}>();

	let container: HTMLDivElement;
	let svg: SVGSVGElement;
	let tooltipEl: HTMLDivElement;
	let containerWidth = 800;
	let simulation: d3.Simulation<any, any> | null = null;

	export let height: number = 220;
	const margin = { top: 10, right: 10, bottom: 10, left: 10 };

	onMount(() => {
		const ro = new ResizeObserver((entries) => {
			const rect = entries[0].contentRect;
			containerWidth = rect.width;
			if (data.length > 0) render();
		});
		ro.observe(container);
		return () => {
			ro.disconnect();
			if (simulation) simulation.stop();
		};
	});

	onDestroy(() => {
		if (simulation) simulation.stop();
	});

	$: effectiveWidth = containerWidth;
	$: if (data.length > 0 && effectiveWidth > 0 && svg) render();

	function sourceColor(d: any): string {
		const hasGdelt = (d.gdelt_count ?? 0) > 0;
		const hasRadio = (d.radio_count ?? 0) > 0;
		const hasSocial = (d.social_count ?? 0) > 0;

		const sources = [hasGdelt, hasRadio, hasSocial].filter(Boolean).length;

		if (sources <= 1) {
			if (hasGdelt) return '#64748b';
			if (hasRadio) return '#8b5cf6';
			if (hasSocial) return '#06d6a0';
			return '#475569';
		}

		if (sources === 2) {
			if (hasGdelt && hasRadio) return '#7c6faa';
			if (hasGdelt && hasSocial) return '#4a9e8e';
			if (hasRadio && hasSocial) return '#4fb0cb';
		}

		return '#f59e0b';
	}

	function totalCount(d: any): number {
		return (d.gdelt_count ?? 0) + (d.radio_count ?? 0) + (d.social_count ?? 0);
	}

	function sharedSources(a: any, b: any): number {
		let shared = 0;
		if ((a.gdelt_count ?? 0) > 0 && (b.gdelt_count ?? 0) > 0) shared++;
		if ((a.radio_count ?? 0) > 0 && (b.radio_count ?? 0) > 0) shared++;
		if ((a.social_count ?? 0) > 0 && (b.social_count ?? 0) > 0) shared++;
		return shared;
	}

	function render() {
		if (simulation) {
			simulation.stop();
			simulation = null;
		}

		const svgEl = d3.select(svg);
		svgEl.selectAll('*').remove();

		const innerWidth = effectiveWidth - margin.left - margin.right;
		const innerHeight = height - margin.top - margin.bottom;

		if (data.length === 0) return;

		const sizeScale = d3
			.scaleSqrt()
			.domain([0, d3.max(data, totalCount) ?? 1])
			.range([6, 35]);

		const nodes = data.map((d: any) => ({
			...d,
			radius: sizeScale(totalCount(d))
		}));

		const links: { source: number; target: number; weight: number }[] = [];
		for (let i = 0; i < nodes.length; i++) {
			for (let j = i + 1; j < nodes.length; j++) {
				const shared = sharedSources(nodes[i], nodes[j]);
				if (shared >= 2) {
					links.push({ source: i, target: j, weight: shared });
				}
			}
		}

		const g = svgEl
			.attr('width', effectiveWidth)
			.attr('height', height)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		simulation = d3
			.forceSimulation(nodes)
			.force(
				'link',
				d3
					.forceLink(links)
					.id((_: any, i: number) => i)
					.distance(80)
					.strength((d: any) => d.weight * 0.3)
			)
			.force('charge', d3.forceManyBody().strength(-120))
			.force('center', d3.forceCenter(innerWidth / 2, innerHeight / 2))
			.force(
				'collision',
				d3.forceCollide().radius((d: any) => d.radius + 4)
			)
			.force('x', d3.forceX(innerWidth / 2).strength(0.05))
			.force('y', d3.forceY(innerHeight / 2).strength(0.05));

		const linkElements = g
			.append('g')
			.selectAll('line')
			.data(links)
			.enter()
			.append('line')
			.attr('stroke', '#334155')
			.attr('stroke-width', (d: any) => d.weight * 1.5)
			.attr('stroke-opacity', 0.4);

		const nodeGroup = g
			.append('g')
			.selectAll('g')
			.data(nodes)
			.enter()
			.append('g')
			.style('cursor', 'pointer')
			.call(
				d3
					.drag<SVGGElement, any>()
					.on('start', (event: d3.D3DragEvent<SVGGElement, any, any>, d: any) => {
						if (!event.active) simulation!.alphaTarget(0.3).restart();
						d.fx = d.x;
						d.fy = d.y;
					})
					.on('drag', (event: d3.D3DragEvent<SVGGElement, any, any>, d: any) => {
						d.fx = event.x;
						d.fy = event.y;
					})
					.on('end', (event: d3.D3DragEvent<SVGGElement, any, any>, d: any) => {
						if (!event.active) simulation!.alphaTarget(0);
						d.fx = null;
						d.fy = null;
					})
			);

		nodeGroup
			.append('circle')
			.attr('r', (d: any) => d.radius)
			.attr('fill', sourceColor)
			.attr('stroke', '#0f172a')
			.attr('stroke-width', 1.5)
			.attr('opacity', 0.85);

		nodeGroup
			.append('text')
			.text((d: any) => {
				const label = d.keyword ?? '';
				return label.length > 12 ? label.slice(0, 11) + '...' : label;
			})
			.attr('text-anchor', 'middle')
			.attr('dy', '0.35em')
			.attr('fill', '#f1f5f9')
			.attr('font-size', (d: any) => Math.max(9, Math.min(13, d.radius * 0.6)) + 'px')
			.attr('font-weight', '500')
			.attr('pointer-events', 'none');

		nodeGroup
			.on('mouseenter', function (event: MouseEvent, d: any) {
				d3.select(this).select('circle').attr('opacity', 1).attr('stroke', '#e2e8f0').attr('stroke-width', 2.5);
				showTooltip(event, d);
			})
			.on('mousemove', (event: MouseEvent) => moveTooltip(event))
			.on('mouseleave', function () {
				d3.select(this).select('circle').attr('opacity', 0.85).attr('stroke', '#0f172a').attr('stroke-width', 1.5);
				hideTooltip();
			})
			.on('click', (_: MouseEvent, d: any) => {
				dispatch('keywordClick', {
					keyword: d.keyword,
					gdelt_count: d.gdelt_count ?? 0,
					radio_count: d.radio_count ?? 0,
					social_count: d.social_count ?? 0
				});
			});

		simulation.on('tick', () => {
			linkElements
				.attr('x1', (d: any) => clamp(d.source.x, 0, innerWidth))
				.attr('y1', (d: any) => clamp(d.source.y, 0, innerHeight))
				.attr('x2', (d: any) => clamp(d.target.x, 0, innerWidth))
				.attr('y2', (d: any) => clamp(d.target.y, 0, innerHeight));

			nodeGroup.attr('transform', (d: any) => {
				d.x = clamp(d.x, d.radius, innerWidth - d.radius);
				d.y = clamp(d.y, d.radius, innerHeight - d.radius);
				return `translate(${d.x},${d.y})`;
			});
		});

		const legend = g.append('g').attr('transform', `translate(8, ${innerHeight - 60})`);
		const legendItems = [
			{ label: 'GDELT', color: '#64748b' },
			{ label: 'Radio', color: '#8b5cf6' },
			{ label: 'Social', color: '#06d6a0' },
			{ label: 'Multi-source', color: '#f59e0b' }
		];
		legendItems.forEach((item, i) => {
			const row = legend.append('g').attr('transform', `translate(0, ${i * 16})`);
			row.append('circle').attr('r', 5).attr('cx', 5).attr('cy', 0).attr('fill', item.color);
			row
				.append('text')
				.attr('x', 14)
				.attr('y', 4)
				.attr('fill', '#94a3b8')
				.attr('font-size', '10px')
				.text(item.label);
		});
	}

	function clamp(val: number, min: number, max: number): number {
		return Math.max(min, Math.min(max, val));
	}

	function showTooltip(event: MouseEvent, d: any) {
		if (!tooltipEl) return;
		tooltipEl.style.display = 'block';
		tooltipEl.innerHTML = `
			<div class="font-semibold text-white mb-1">${d.keyword}</div>
			<div class="text-slate-300 text-xs space-y-0.5">
				<div>GDELT: <span class="text-white">${d.gdelt_count ?? 0}</span></div>
				<div>Radio: <span class="text-white">${d.radio_count ?? 0}</span></div>
				<div>Social: <span class="text-white">${d.social_count ?? 0}</span></div>
				<div class="mt-1 text-slate-400">Total: ${totalCount(d)}</div>
			</div>
		`;
		moveTooltip(event);
	}

	function moveTooltip(event: MouseEvent) {
		if (!tooltipEl || !container) return;
		const rect = container.getBoundingClientRect();
		let x = event.clientX - rect.left + 12;
		let y = event.clientY - rect.top - 10;
		if (x + 160 > rect.width) x = x - 180;
		if (y + 100 > rect.height) y = y - 100;
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
			No keyword data available
		</div>
	{:else}
		<svg bind:this={svg} class="w-full" {height}></svg>
		<div
			bind:this={tooltipEl}
			class="absolute pointer-events-none z-50 hidden bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs shadow-xl"
		></div>
	{/if}
</div>
