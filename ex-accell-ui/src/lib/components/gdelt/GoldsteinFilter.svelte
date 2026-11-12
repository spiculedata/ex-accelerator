<script lang="ts">
  import RangeSliderPair from './RangeSliderPair.svelte';

  /** [low, high] on the -10 to +10 Goldstein scale */
  export let range: number[];
  export let min: number;
  export let max: number;
  export let isUpdatingFilter = false;
  export let onApply: () => void;
  export let onRefresh: () => void;
</script>

<!-- Goldstein Scale Filter -->
<div class="mb-6 xl:mb-8 pt-4 xl:pt-6 border-t border-gray-200">
  <div class="flex items-center justify-between mb-3 xl:mb-4">
    <div class="flex items-center">
      <svg class="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
      </svg>
      <span class="text-sm font-medium text-gray-900">Goldstein Scale</span>
    </div>
    <button
      on:click={onRefresh}
      disabled={isUpdatingFilter}
      class="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
    >
      {#if isUpdatingFilter}
        <svg class="animate-spin w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Updating...
      {:else}
        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
        </svg>
        Refresh
      {/if}
    </button>
  </div>

  <div class="space-y-3">
    <!-- Range Display -->
    <div class="flex justify-between text-xs">
      <span class="text-red-600 font-medium">Conflict: {range[0]}</span>
      <span class="text-blue-600 font-medium">Cooperation: {range[1]}</span>
    </div>

    <RangeSliderPair scaleMin={-10} scaleMax={10} step={0.1} bind:range bind:min bind:max {onApply} />

    <!-- Scale Description -->
    <div class="text-xs text-gray-500 space-y-1">
      <div class="flex items-center">
        <div class="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
        <span>Negative: Conflict, threats, violence</span>
      </div>
      <div class="flex items-center">
        <div class="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
        <span>Positive: Cooperation, agreements, aid</span>
      </div>
    </div>
  </div>
</div>
