<script lang="ts">
  import { formatDay } from '$lib/utils/dayFormat';
  import SwimLaneTimeline from '$lib/components/investigation/SwimLaneTimeline.svelte';
  import type { TimelineEntry } from '$lib/components/investigation/SwimLaneTimeline.svelte';

  export let timelineData: TimelineEntry[];
  export let timelineLoading: boolean;
  /** The range currently brushed on the timeline, if any */
  export let timeRange: { start: string; end: string } | null;
</script>

<!-- ============ TIMELINE ============ -->
<div class="flex-shrink-0 bg-slate-900 border-b border-slate-700/50" style="height: 140px;">
  <div class="h-full flex flex-col">
    <div class="px-3 flex items-center justify-between flex-shrink-0" style="height: 16px;">
      <div class="flex items-center gap-2">
        <span class="text-[8px] uppercase tracking-wider text-slate-500 font-semibold">Timeline</span>
        {#if timeRange}
          <span class="text-[8px] font-mono text-slate-500">{formatDay(timeRange.start)} - {formatDay(timeRange.end)}</span>
        {/if}
      </div>
      <span class="text-[8px] font-mono text-slate-600">{timelineData.length} days</span>
    </div>
    <div class="flex-1 min-h-0 px-1">
      {#if timelineLoading}
        <div class="flex items-center justify-center h-full">
          <svg class="animate-spin h-3 w-3 text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
        </div>
      {:else}
        <SwimLaneTimeline data={timelineData} height={120} on:brushChange on:dayClick />
      {/if}
    </div>
  </div>
</div>
