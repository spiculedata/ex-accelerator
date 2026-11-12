<script lang="ts">
  import { GDELT_EVENT_TYPES, getEventType } from '$lib/utils/gdeltEventTypes';
  import type { GdeltEvent } from '$lib/utils/gdeltFilters';

  export let events: GdeltEvent[];
  /** The events that pass every filter */
  export let visibleEvents: GdeltEvent[];
  export let activeEventTypes: Set<string>;
  export let isToggling = false;
  export let onToggle: (eventType: string) => void;
</script>

<!-- Event Types Section -->
<div class="mb-6 xl:mb-8">
  <h4 class="text-sm xl:text-base font-medium text-gray-900 mb-3 xl:mb-4">Event Types</h4>

  <!-- All Events Toggle -->
  <div class="mb-4">
    <button
      on:click={() => onToggle('all')}
      disabled={isToggling}
      class="flex items-center w-full p-3 rounded-xl transition-all duration-200 {activeEventTypes.has('all') ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200 shadow-sm' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'} border {isToggling ? 'opacity-60 cursor-not-allowed' : ''}"
    >
      <div class="w-4 h-4 rounded-full bg-gray-400 mr-3"></div>
      <div class="flex-1 text-left">
        <div class="text-sm font-medium text-gray-900">All Events</div>
        <div class="text-xs text-gray-500">Show all event types</div>
      </div>
      <div class="text-xs font-medium text-gray-600">
        {visibleEvents.length}
      </div>
    </button>
  </div>

  <!-- Individual Event Types -->
  <div class="space-y-2 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
    {#each Object.entries(GDELT_EVENT_TYPES) as [key, eventType]}
      {@const eventCount = visibleEvents.filter((e) => getEventType(e.eventCode) === key).length}
      {@const totalEventCount = events.filter((e) => getEventType(e.eventCode) === key).length}
      {#if totalEventCount > 0}
        <button
          on:click={() => onToggle(key)}
          disabled={isToggling}
          class="flex items-center w-full p-3 rounded-xl transition-all duration-200 {activeEventTypes.has(key) ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200 shadow-sm' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'} border text-left group {isToggling ? 'opacity-60 cursor-not-allowed' : ''}"
        >
          <div
            class="w-4 h-4 rounded-full mr-3 flex-shrink-0"
            style="background-color: {eventType.color}"
          ></div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-gray-900 truncate">
              {eventType.label}
            </div>
            <div class="text-xs text-gray-500 truncate">
              {eventType.description}
            </div>
          </div>
          <div class="text-xs font-medium text-gray-600 ml-2">
            {eventCount}
          </div>
        </button>
      {/if}
    {/each}
  </div>
</div>
