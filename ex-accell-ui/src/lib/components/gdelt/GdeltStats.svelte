<script lang="ts">
  import { averageTone } from '$lib/utils/gdeltEvents';
  import { GDELT_EVENT_TYPES, getEventType } from '$lib/utils/gdeltEventTypes';
  import type { GdeltEvent } from '$lib/utils/gdeltFilters';
  import { getToneDescription } from '$lib/utils/gdeltMentions';

  /** The events that pass every filter */
  export let visibleEvents: GdeltEvent[];
  export let isUpdatingFilter = false;

  $: avgTone = averageTone(visibleEvents);
</script>

<!-- Stats Cards -->
<div class="grid grid-cols-4 gap-3">
  <div class="bg-white rounded-lg shadow-sm px-3 py-2 text-center relative {isUpdatingFilter ? 'opacity-75' : ''}">
    {#if isUpdatingFilter}
      <div class="absolute top-1 right-1">
        <div class="animate-spin rounded-full h-3 w-3 border border-blue-200 border-t-blue-600"></div>
      </div>
    {/if}
    <div class="text-xl xl:text-2xl font-bold text-blue-600">{visibleEvents.length.toLocaleString()}</div>
    <div class="text-xs text-gray-600">Visible Events</div>
  </div>
  <div class="bg-white rounded-lg shadow-sm px-3 py-2 text-center relative {isUpdatingFilter ? 'opacity-75' : ''}">
    {#if isUpdatingFilter}
      <div class="absolute top-1 right-1">
        <div class="animate-spin rounded-full h-3 w-3 border border-emerald-200 border-t-emerald-600"></div>
      </div>
    {/if}
    <div class="text-xl xl:text-2xl font-bold text-emerald-600">{new Set(visibleEvents.map((e) => e.country)).size}</div>
    <div class="text-xs text-gray-600">Countries</div>
  </div>
  <div class="bg-white rounded-lg shadow-sm px-3 py-2 text-center relative {isUpdatingFilter ? 'opacity-75' : ''}">
    {#if isUpdatingFilter}
      <div class="absolute top-1 right-1">
        <div class="animate-spin rounded-full h-3 w-3 border border-amber-200 border-t-amber-600"></div>
      </div>
    {/if}
    <div class="text-xl xl:text-2xl font-bold text-signal-700">{Object.keys(GDELT_EVENT_TYPES).filter((k) => visibleEvents.some((e) => getEventType(e.eventCode) === k)).length}</div>
    <div class="text-xs text-gray-600">Event Types</div>
  </div>
  <div class="bg-white rounded-lg shadow-sm px-3 py-2 text-center relative {isUpdatingFilter ? 'opacity-75' : ''}">
    {#if isUpdatingFilter}
      <div class="absolute top-1 right-1">
        <div class="animate-spin rounded-full h-3 w-3 border border-blue-200 border-t-blue-600"></div>
      </div>
    {/if}
    <div class="text-base xl:text-lg font-bold text-blue-600">{getToneDescription(avgTone)}</div>
    <div class="text-sm font-semibold text-blue-500">{avgTone}</div>
    <div class="text-xs text-gray-600">Avg Tone</div>
  </div>
</div>
