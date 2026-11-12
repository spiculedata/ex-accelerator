<script lang="ts">
  import RangeSliderPair from './RangeSliderPair.svelte';

  /** [low, high] on the -50 to +50 average tone scale */
  export let range: number[];
  export let min: number;
  export let max: number;
  export let onApply: () => void;
</script>

<!-- Average Tone Filter -->
<div class="mb-6 xl:mb-8 pt-4 xl:pt-6 border-t border-gray-200">
  <div class="flex items-center mb-3 xl:mb-4">
    <svg class="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4V2a1 1 0 011-1h4a1 1 0 011 1v2m-6 0h8m-8 0a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V6a2 2 0 00-2-2m-8 0V4"></path>
    </svg>
    <span class="text-sm font-medium text-gray-900">Average Tone</span>
  </div>

  <div class="space-y-3">
    <!-- Range Display -->
    <div class="flex justify-between text-xs">
      <span class="text-red-600 font-medium">Negative: {range[0]}</span>
      <span class="text-blue-600 font-medium">Positive: {range[1]}</span>
    </div>

    <RangeSliderPair scaleMin={-50} scaleMax={50} step={0.5} bind:range bind:min bind:max {onApply} />

    <!-- Scale Description -->
    <div class="text-xs text-gray-500 space-y-1">
      <div class="flex items-center">
        <div class="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
        <span>Negative: Critical, pessimistic tone</span>
      </div>
      <div class="flex items-center">
        <div class="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
        <span>Positive: Supportive, optimistic tone</span>
      </div>
    </div>
  </div>
</div>
