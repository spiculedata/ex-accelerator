<script lang="ts">
  import { getSentimentColor } from '$lib/utils/colorUtils';
  import { investigationSelection, toggleSelectedId, setHoveredId } from '$lib/stores/investigationStore';
  import type { InvestigationSelection } from '$lib/stores/investigationStore';

  export let segments: {
    id: string | number;
    radio_name: string;
    state?: string;
    segment_start: string;
    duration_seconds: number;
    transcript: string;
    sentiment?: string;
    emotion?: string;
    confidence?: number;
    is_political?: boolean;
  }[] = [];

  let selection: InvestigationSelection;
  investigationSelection.subscribe((v) => (selection = v));

  let expandedIds = new Set<string>();

  function segmentId(seg: (typeof segments)[0]): string {
    return 'radio-' + seg.id;
  }

  function toggleExpand(id: string) {
    const next = new Set(expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    expandedIds = next;
  }

  function isSelected(seg: (typeof segments)[0]): boolean {
    return selection.selectedIds.has(segmentId(seg));
  }

  function isHovered(seg: (typeof segments)[0]): boolean {
    return selection.hoveredId === segmentId(seg);
  }

  function truncate(text: string, len: number): string {
    if (!text) return '';
    if (text.length <= len) return text;
    return text.slice(0, len) + '...';
  }

  // Sentiment takes the brand scale (blue to orange), never green and red
  const sentimentBadgeClass = (sentiment?: string): string => getSentimentColor(sentiment ?? 'neutral', 'tailwind');

  function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(Math.floor(s)).padStart(2, '0')}`;
  }

  function matchesFilters(seg: (typeof segments)[0]): boolean {
    if (selection.sentiment && selection.sentiment.length > 0) {
      const label = (seg.sentiment || 'neutral').toLowerCase();
      if (!selection.sentiment.includes(label)) return false;
    }

    if (selection.timeRange) {
      const segTime = seg.segment_start;
      if (segTime < selection.timeRange.start || segTime > selection.timeRange.end) return false;
    }

    return true;
  }

  $: visibleSegments = segments.filter(matchesFilters);
  $: segmentCount = visibleSegments.length;
</script>

<div class="flex flex-col h-full">
  <!-- Header -->
  <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
    <div class="flex items-center gap-2">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
      <h3 class="text-sm font-semibold text-gray-800">Radio Transcripts</h3>
    </div>
    <span class="text-xs font-medium text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
      {segmentCount.toLocaleString()} segment{segmentCount !== 1 ? 's' : ''}
    </span>
  </div>

  {#if segments.length === 0}
    <div class="flex flex-col items-center justify-center flex-1 py-12 text-gray-500">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
      <p class="text-sm">No radio transcript segments available</p>
    </div>
  {:else}
    <div class="overflow-auto flex-1 p-3 space-y-2">
      {#each visibleSegments as seg, idx}
        {@const sid = segmentId(seg)}
        {@const expanded = expandedIds.has(String(seg.id))}
        <div
          class="rounded-lg border p-3 transition-all duration-150 cursor-pointer
            {isSelected(seg) ? 'border-purple-400 border-2 bg-purple-50/30' : 'border-gray-200'}
            {isHovered(seg) ? 'ring-2 ring-purple-200' : ''}
            hover:border-gray-300 hover:shadow-sm"
          on:mouseenter={() => setHoveredId(sid)}
          on:mouseleave={() => setHoveredId(null)}
          on:click={() => toggleExpand(String(seg.id))}
          role="button"
          tabindex="0"
          on:keydown={(e) => { if (e.key === 'Enter') toggleExpand(String(seg.id)); }}
        >
          <!-- Top row: station, time, badges -->
          <div class="flex items-center justify-between mb-1.5">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-gray-800">{seg.radio_name}</span>
              {#if seg.state}
                <span class="text-xs text-gray-500">{seg.state}</span>
              {/if}
            </div>
            <div class="flex items-center gap-1.5">
              {#if seg.is_political}
                <span class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-700">Political</span>
              {/if}
              {#if seg.sentiment}
                <span class="text-[10px] font-medium px-1.5 py-0.5 rounded {sentimentBadgeClass(seg.sentiment)}">
                  {seg.sentiment}
                </span>
              {/if}
            </div>
          </div>

          <!-- Time and duration -->
          <div class="flex items-center gap-3 text-xs text-gray-500 mb-2">
            <span>{seg.segment_start}</span>
            <span>{formatDuration(seg.duration_seconds)}</span>
            {#if seg.confidence != null}
              <span class="text-gray-500">conf: {(seg.confidence * 100).toFixed(0)}%</span>
            {/if}
          </div>

          <!-- Transcript text -->
          <p class="text-xs text-gray-700 leading-relaxed">
            {#if expanded}
              {seg.transcript}
            {:else}
              {truncate(seg.transcript, 150)}
            {/if}
          </p>

          <!-- Actions -->
          <div class="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
            <button
              class="text-[10px] text-gray-500 hover:text-gray-600 transition-colors"
              on:click|stopPropagation={() => toggleExpand(String(seg.id))}
            >
              {expanded ? 'Collapse' : 'Expand'}
            </button>
            <button
              class="text-[10px] font-medium px-2 py-0.5 rounded transition-colors
                {isSelected(seg) ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-700'}"
              on:click|stopPropagation={() => toggleSelectedId(sid)}
            >
              {isSelected(seg) ? 'Selected' : 'Select'}
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
