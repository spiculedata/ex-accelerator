<script lang="ts" context="module">
	export interface TimelineEntry {
		date: string;
		gdelt_events: number;
		gdelt_avg_goldstein: number;
		gdelt_avg_tone: number;
		radio_segments: number;
		radio_positive: number;
		radio_negative: number;
		radio_neutral: number;
		social_posts: number;
		social_positive: number;
		social_negative: number;
		social_neutral: number;
	}
</script>

<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import { getSentimentColor } from '$lib/utils/colorUtils';
	import * as d3 from 'd3';

	export let data: TimelineEntry[] = [];
	export let width: number = 0;
	export let height: number = 80;

	const dispatch = createEventDispatcher<{
		brushChange: { start: Date; end: Date };
		dayClick: { date: string };
	}>();

	let container: HTMLDivElement;
	let svg: SVGSVGElement;
	let tooltipEl: HTMLDivElement;
	let containerWidth = 800;

	const margin = { top: 4, right: 20, bottom: 18, left: 50 };
	const laneGap = 6;

	const colors = {
		gdeltBar: '#64748b',
		goldsteinNeg: '#ef4444',
		goldsteinPos: '#22c55e',
		positive: getSentimentColor('positive'),
		negative: getSentimentColor('negative'),
		neutral: getSentimentColor('neutral')
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

	$: effectiveWidth = width > 0 ? width : containerWidth;
	$: if (data.length > 0 && effectiveWidth > 0 && svg) render();

	function formatNumber(n: number): string {
		if (n >= 1000) return d3.format(',.0f')(n);
		return String(n);
	}

	function render() {
		const svgEl = d3.select(svg);
		svgEl.selectAll('*').remove();

		const innerWidth = effectiveWidth - margin.left - margin.right;
		const innerHeight = height - margin.top - margin.bottom;
		const laneHeight = (innerHeight - 2 * laneGap) / 3;

		const parsedData = data.map((d) => ({
			...d,
			gdelt_events: d.gdelt_events ?? 0,
			gdelt_avg_goldstein: d.gdelt_avg_goldstein ?? 0,
			gdelt_avg_tone: d.gdelt_avg_tone ?? 0,
			radio_segments: d.radio_segments ?? 0,
			radio_positive: d.radio_positive ?? 0,
			radio_negative: d.radio_negative ?? 0,
			radio_neutral: d.radio_neutral ?? 0,
			social_posts: d.social_posts ?? 0,
			social_positive: d.social_positive ?? 0,
			social_negative: d.social_negative ?? 0,
			social_neutral: d.social_neutral ?? 0,
			parsedDate: d3.timeParse('%Y-%m-%d')(d.date) ?? new Date(d.date)
		}));

		parsedData.sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

		// Shared X scale
		const xExtent = d3.extent(parsedData, (d) => d.parsedDate) as [Date, Date];
		const xScale = d3.scaleTime().domain(xExtent).range([0, innerWidth]);

		const barWidth = Math.max(1, innerWidth / parsedData.length - 1);

		// Root group with clip path to prevent overflow
		const defs = svgEl.append('defs');
		defs.append('clipPath')
			.attr('id', 'timeline-clip')
			.append('rect')
			.attr('width', innerWidth)
			.attr('height', innerHeight);

		const g = svgEl
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`)
			.attr('clip-path', 'url(#timeline-clip)');

		// ---- LANE 1: GDELT (area chart with Goldstein colour encoding) ----
		const gdeltY = 0;
		const gdeltMaxEvents = d3.max(parsedData, (d) => d.gdelt_events) ?? 1;
		const yGdelt = d3.scaleLinear().domain([0, gdeltMaxEvents]).nice().range([laneHeight, 0]);

		const gdeltGroup = g.append('g').attr('transform', `translate(0,${gdeltY})`);

		// Lane background
		gdeltGroup
			.append('rect')
			.attr('width', innerWidth)
			.attr('height', laneHeight)
			.attr('fill', '#1e293b')
			.attr('rx', 4);

		// Lane label
		svgEl
			.append('text')
			.attr('x', margin.left - 4)
			.attr('y', margin.top + gdeltY + laneHeight / 2)
			.attr('text-anchor', 'end')
			.attr('dominant-baseline', 'middle')
			.attr('font-size', '9px')
			.attr('font-weight', '600')
			.attr('fill', '#94a3b8')
			.text('GDELT');

		// Goldstein colour scale: red (negative) → slate → green (positive)
		const goldsteinColor = d3.scaleLinear<string>()
			.domain([-10, 0, 10])
			.range([colors.goldsteinNeg, '#64748b', colors.goldsteinPos])
			.clamp(true);

		// Create per-segment gradient that encodes Goldstein as fill colour
		for (let i = 0; i < parsedData.length - 1; i++) {
			const d0 = parsedData[i];
			const d1 = parsedData[i + 1];
			const gradId = `gdelt-seg-${i}`;
			const segGrad = defs
				.append('linearGradient')
				.attr('id', gradId)
				.attr('x1', '0%').attr('x2', '100%');
			segGrad.append('stop').attr('offset', '0%').attr('stop-color', goldsteinColor(d0.gdelt_avg_goldstein));
			segGrad.append('stop').attr('offset', '100%').attr('stop-color', goldsteinColor(d1.gdelt_avg_goldstein));

			const segArea = d3.area<(typeof parsedData)[0]>()
				.x((d) => xScale(d.parsedDate))
				.y0(laneHeight)
				.y1((d) => yGdelt(d.gdelt_events))
				.curve(d3.curveMonotoneX);

			gdeltGroup
				.append('path')
				.datum([d0, d1])
				.attr('fill', `url(#${gradId})`)
				.attr('opacity', 0.75)
				.attr('d', segArea);
		}

		// Top stroke line for shape definition
		const gdeltLine = d3.line<(typeof parsedData)[0]>()
			.x((d) => xScale(d.parsedDate))
			.y((d) => yGdelt(d.gdelt_events))
			.curve(d3.curveMonotoneX);

		gdeltGroup
			.append('path')
			.datum(parsedData)
			.attr('fill', 'none')
			.attr('stroke', '#94a3b8')
			.attr('stroke-width', 1)
			.attr('opacity', 0.5)
			.attr('d', gdeltLine);

		// ---- LANE 2: Radio ----
		const radioY = laneHeight + laneGap;
		const radioMaxSegments = d3.max(parsedData, (d) => d.radio_positive + d.radio_negative + d.radio_neutral) ?? 1;
		const yRadio = d3.scaleLinear().domain([0, radioMaxSegments]).nice().range([laneHeight, 0]);

		const radioGroup = g.append('g').attr('transform', `translate(0,${radioY})`);

		radioGroup
			.append('rect')
			.attr('width', innerWidth)
			.attr('height', laneHeight)
			.attr('fill', '#1e293b')
			.attr('rx', 4);

		// Lane label: left of lane, vertically centered
		svgEl
			.append('text')
			.attr('x', margin.left - 4)
			.attr('y', margin.top + radioY + laneHeight / 2)
			.attr('text-anchor', 'end')
			.attr('dominant-baseline', 'middle')
			.attr('font-size', '9px')
			.attr('font-weight', '600')
			.attr('fill', '#94a3b8')
			.text('Radio');

		// Stacked area for radio
		const radioStack = d3
			.stack<(typeof parsedData)[0]>()
			.keys(['radio_negative', 'radio_neutral', 'radio_positive'])
			.order(d3.stackOrderNone)
			.offset(d3.stackOffsetNone);

		const radioStacked = radioStack(parsedData);
		const radioColorMap: Record<string, string> = {
			radio_negative: colors.negative,
			radio_neutral: colors.neutral,
			radio_positive: colors.positive
		};

		const radioArea = d3
			.area<d3.SeriesPoint<(typeof parsedData)[0]>>()
			.x((d) => xScale(d.data.parsedDate))
			.y0((d) => yRadio(d[0]))
			.y1((d) => yRadio(d[1]))
			.curve(d3.curveMonotoneX);

		radioGroup
			.selectAll('.radio-area')
			.data(radioStacked)
			.join('path')
			.attr('class', 'radio-area')
			.attr('fill', (d) => radioColorMap[d.key] ?? '#999')
			.attr('opacity', 0.75)
			.attr('d', radioArea);

		// ---- LANE 3: Social ----
		const socialY = 2 * (laneHeight + laneGap);
		const socialMaxPosts = d3.max(parsedData, (d) => d.social_positive + d.social_negative + d.social_neutral) ?? 1;
		const ySocial = d3.scaleLinear().domain([0, socialMaxPosts]).nice().range([laneHeight, 0]);

		const socialGroup = g.append('g').attr('transform', `translate(0,${socialY})`);

		socialGroup
			.append('rect')
			.attr('width', innerWidth)
			.attr('height', laneHeight)
			.attr('fill', '#1e293b')
			.attr('rx', 4);

		// Lane label: left of lane, vertically centered
		svgEl
			.append('text')
			.attr('x', margin.left - 4)
			.attr('y', margin.top + socialY + laneHeight / 2)
			.attr('text-anchor', 'end')
			.attr('dominant-baseline', 'middle')
			.attr('font-size', '9px')
			.attr('font-weight', '600')
			.attr('fill', '#94a3b8')
			.text('Social');

		// Stacked area for social
		const socialStack = d3
			.stack<(typeof parsedData)[0]>()
			.keys(['social_negative', 'social_neutral', 'social_positive'])
			.order(d3.stackOrderNone)
			.offset(d3.stackOffsetNone);

		const socialStacked = socialStack(parsedData);
		const socialColorMap: Record<string, string> = {
			social_negative: colors.negative,
			social_neutral: colors.neutral,
			social_positive: colors.positive
		};

		const socialArea = d3
			.area<d3.SeriesPoint<(typeof parsedData)[0]>>()
			.x((d) => xScale(d.data.parsedDate))
			.y0((d) => ySocial(d[0]))
			.y1((d) => ySocial(d[1]))
			.curve(d3.curveMonotoneX);

		socialGroup
			.selectAll('.social-area')
			.data(socialStacked)
			.join('path')
			.attr('class', 'social-area')
			.attr('fill', (d) => socialColorMap[d.key] ?? '#999')
			.attr('opacity', 0.75)
			.attr('d', socialArea);

		// ---- SHARED X AXIS ----
		g
			.append('g')
			.attr('transform', `translate(0,${innerHeight})`)
			.call(
				d3
					.axisBottom(xScale)
					.ticks(d3.timeDay.every(Math.max(1, Math.floor(parsedData.length / 8))) ?? 7)
					.tickFormat((d) => d3.timeFormat('%b %d')(d as Date))
			)
			.call((g2) => g2.select('.domain').attr('stroke', '#475569'))
			.call((g2) => g2.selectAll('.tick text').attr('fill', '#94a3b8').attr('font-size', '9px'))
			.call((g2) => g2.selectAll('.tick line').attr('stroke', '#475569'));

		// ---- BRUSH ----
		const fmtShort = d3.timeFormat('%b %d');

		// Brush date label — rendered outside clip group, inside a pill background
		const labelGroup = svgEl.append('g')
			.attr('pointer-events', 'none')
			.style('opacity', 0);

		const labelBg = labelGroup
			.append('rect')
			.attr('rx', 4)
			.attr('ry', 4)
			.attr('fill', '#1e293b')
			.attr('stroke', '#3b82f6')
			.attr('stroke-width', 1);

		const brushLabel = labelGroup
			.append('text')
			.attr('text-anchor', 'middle')
			.attr('dominant-baseline', 'middle')
			.attr('fill', '#e2e8f0')
			.attr('font-size', '11px')
			.attr('font-weight', '600');

		const brush = d3
			.brushX()
			.extent([
				[0, 0],
				[innerWidth, innerHeight]
			])
			.on('brush', (event: d3.D3BrushEvent<unknown>) => {
				// Hide tooltip during brush drag
				hoverLine.style('opacity', 0);
				if (tooltipEl) tooltipEl.style.opacity = '0';

				if (!event.selection) {
					labelGroup.style('opacity', 0);
					return;
				}
				const [x0, x1] = event.selection as [number, number];
				const s = d3.timeDay.floor(xScale.invert(x0));
				const e = d3.timeDay.ceil(xScale.invert(x1));
				const midX = margin.left + (x0 + x1) / 2;
				const labelY = margin.top + innerHeight / 2;
				const label = s.getTime() === e.getTime() || (e.getTime() - s.getTime()) < 86400000
					? fmtShort(s)
					: `${fmtShort(s)} – ${fmtShort(e)}`;
				brushLabel.attr('x', midX).attr('y', labelY).text(label);
				// Size background pill to fit text
				const bbox = (brushLabel.node() as SVGTextElement).getBBox();
				labelBg
					.attr('x', bbox.x - 6)
					.attr('y', bbox.y - 3)
					.attr('width', bbox.width + 12)
					.attr('height', bbox.height + 6);
				labelGroup.style('opacity', 1);
			})
			.on('end', (event: d3.D3BrushEvent<unknown>) => {
				labelGroup.style('opacity', 0);
				if (!event.selection) {
					// Click without drag — find nearest day
					if (event.sourceEvent) {
						const [mx] = d3.pointer(event.sourceEvent, g.node());
						const clickDate = xScale.invert(mx);
						const idx = bisect(parsedData, clickDate, 1);
						const d0 = parsedData[idx - 1];
						const d1 = parsedData[idx];
						const nearest = d1 && clickDate.getTime() - d0.parsedDate.getTime() > d1.parsedDate.getTime() - clickDate.getTime() ? d1 : d0;
						if (nearest) dispatch('dayClick', { date: nearest.date });
					}
					return;
				}
				const [x0, x1] = event.selection as [number, number];
				const rawStart = xScale.invert(x0);
				const rawEnd = xScale.invert(x1);

				// Snap to day boundaries
				const start = d3.timeDay.floor(rawStart);
				let end = d3.timeDay.ceil(rawEnd);

				// If selection spans less than ~12 hours, treat as a single day click
				const diffHours = (rawEnd.getTime() - rawStart.getTime()) / (1000 * 60 * 60);
				if (diffHours < 12) {
					// Find nearest day
					const nearestIdx = bisect(parsedData, rawStart, 1);
					const d0 = parsedData[nearestIdx - 1];
					const d1 = parsedData[nearestIdx];
					const nearest = d1 && rawStart.getTime() - d0.parsedDate.getTime() > d1.parsedDate.getTime() - rawStart.getTime() ? d1 : d0;
					if (nearest) {
						dispatch('dayClick', { date: nearest.date });
					}
					// Clear the brush visual
					brushGroup.call(brush.move, null);
					return;
				}

				// Ensure end is at least 1 day after start
				if (end.getTime() <= start.getTime()) {
					end = d3.timeDay.offset(start, 1);
				}
				dispatch('brushChange', { start, end });
				// Clear the brush visual (the parent handles the state)
				brushGroup.call(brush.move, null);
			});

		const brushGroup = g.append('g').attr('class', 'brush').call(brush);

		// Style brush
		brushGroup.selectAll('.selection').attr('fill', '#3b82f6').attr('fill-opacity', 0.15).attr('stroke', '#3b82f6').attr('stroke-width', 1);
		brushGroup.selectAll('.overlay').style('cursor', 'crosshair');

		// Vertical hover line (above brush, no pointer events)
		const hoverLine = g
			.append('line')
			.attr('y1', 0)
			.attr('y2', innerHeight)
			.attr('stroke', '#94a3b8')
			.attr('stroke-width', 1)
			.attr('stroke-dasharray', '4,3')
			.attr('pointer-events', 'none')
			.style('opacity', 0);

		const bisect = d3.bisector<(typeof parsedData)[0], Date>((d) => d.parsedDate).left;

		// Attach hover/click to the brush group's overlay (the transparent rect D3 creates)
		brushGroup.select('.overlay')
			.on('mousemove', (event: MouseEvent) => {
				const [mx] = d3.pointer(event);
				const hoveredDate = xScale.invert(mx);
				const idx = bisect(parsedData, hoveredDate, 1);
				const d0 = parsedData[idx - 1];
				const d1 = parsedData[idx];
				if (!d0) return;
				const closest =
					d1 && hoveredDate.getTime() - d0.parsedDate.getTime() > d1.parsedDate.getTime() - hoveredDate.getTime()
						? d1
						: d0;

				const xPos = xScale(closest.parsedDate);
				hoverLine.attr('x1', xPos).attr('x2', xPos).style('opacity', 1);

				// Position tooltip
				if (tooltipEl) {
					const dateStr = d3.timeFormat('%B %d, %Y')(closest.parsedDate);
					const gs = closest.gdelt_avg_goldstein ?? 0;
					const goldsteinSign = gs >= 0 ? '+' : '';
					tooltipEl.innerHTML = `
						<div class="font-semibold text-white mb-1">${dateStr}</div>
						<div class="text-sm text-slate-300">
							<div class="flex items-center gap-1.5 mb-0.5">
								<span class="inline-block w-2 h-2 rounded-sm" style="background:${colors.gdeltBar}"></span>
								GDELT: ${formatNumber(closest.gdelt_events ?? 0)} events (Goldstein: ${goldsteinSign}${gs.toFixed(1)})
							</div>
							<div class="flex items-center gap-1.5 mb-0.5">
								<span class="inline-block w-2 h-2 rounded-sm" style="background:${colors.negative}"></span>
								Radio: ${formatNumber(closest.radio_segments ?? 0)} segments
							</div>
							<div class="flex items-center gap-1.5">
								<span class="inline-block w-2 h-2 rounded-sm" style="background:${colors.neutral}"></span>
								Social: ${formatNumber(closest.social_posts ?? 0)} posts
							</div>
						</div>
					`;
					tooltipEl.style.opacity = '1';

					// Position relative to container
					const svgRect = svg.getBoundingClientRect();
					const containerRect = container.getBoundingClientRect();
					const tooltipX = xPos + margin.left + (svgRect.left - containerRect.left);
					const tooltipWidth = tooltipEl.offsetWidth;

					// Flip tooltip to left side if too close to right edge
					const effectiveLeft =
						tooltipX + tooltipWidth + 16 > containerRect.width
							? tooltipX - tooltipWidth - 12
							: tooltipX + 12;

					tooltipEl.style.left = `${effectiveLeft}px`;
					tooltipEl.style.top = `${margin.top + 4}px`;
				}
			})
			.on('mouseleave', () => {
				hoverLine.style('opacity', 0);
				if (tooltipEl) tooltipEl.style.opacity = '0';
			})
			.on('click', () => {
				// Day click is handled by the brush end event (small selection = day click)
			});

		// Ensure brush and hover line are on top
		brushGroup.raise();
		hoverLine.raise();
	}
</script>

<div bind:this={container} class="relative w-full" style="height: {height}px;">
	{#if data.length === 0}
		<div class="flex items-center justify-center h-full text-gray-400 text-sm">
			No timeline data
		</div>
	{:else}
		<svg bind:this={svg} width={effectiveWidth} {height} class="w-full"></svg>
		<div
			bind:this={tooltipEl}
			class="absolute pointer-events-none bg-slate-800 border border-slate-600 rounded-lg shadow-xl px-3 py-2 text-xs transition-opacity duration-150 z-10"
			style="opacity: 0; max-width: 340px;"
		></div>
	{/if}
</div>
