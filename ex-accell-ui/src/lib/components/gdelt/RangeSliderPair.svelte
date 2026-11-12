<script lang="ts">
  import { onDestroy } from 'svelte';
  import { clampRange } from '$lib/utils/gdeltFilters';

  /** The scale the sliders cover, and the step they move in */
  export let scaleMin: number;
  export let scaleMax: number;
  export let step: number;
  /** [low, high]; the sliders write to it, so bind it */
  export let range: number[];
  /** The manual entry fields; bind them to keep them in step with the sliders */
  export let min: number;
  export let max: number;
  /** Called when the range changes: right away after a manual entry, after a short pause while a slider moves */
  export let onApply: () => void;

  const SLIDER_DEBOUNCE_MS = 200;
  // Tailwind-only styling for the dual-handle range sliders (thumb and track pseudo-elements)
  const rangeSliderClass =
    'absolute w-full h-2 bg-transparent rounded-xl appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-linear-to-br [&::-webkit-slider-thumb]:from-violet-500 [&::-webkit-slider-thumb]:to-purple-500 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-linear-to-br [&::-moz-range-thumb]:from-violet-500 [&::-moz-range-thumb]:to-purple-500 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer [&::-webkit-slider-track]:h-1.5 [&::-webkit-slider-track]:bg-gray-300 [&::-webkit-slider-track]:rounded-sm [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:bg-gray-300 [&::-moz-range-track]:rounded-sm';

  let applyTimeout: ReturnType<typeof setTimeout> | undefined;

  function handleSliderChange() {
    // Ensure min <= max
    if (range[0] > range[1]) {
      const temp = range[0];
      range[0] = range[1];
      range[1] = temp;
    }

    // Update the manual entry fields
    min = range[0];
    max = range[1];

    // Debounce the filter update
    clearTimeout(applyTimeout);
    applyTimeout = setTimeout(() => {
      onApply();
    }, SLIDER_DEBOUNCE_MS);
  }

  function handleManualEntry() {
    // Validate and update range
    const [low, high] = clampRange(min, max, scaleMin, scaleMax);
    range = [low, high];
    min = low;
    max = high;

    onApply();
  }

  onDestroy(() => clearTimeout(applyTimeout));
</script>

<!-- Dual Range Slider -->
<div class="relative h-6">
  <input
    type="range"
    min={scaleMin}
    max={scaleMax}
    {step}
    bind:value={range[0]}
    on:input={handleSliderChange}
    class={rangeSliderClass}
    style="z-index: 2; pointer-events: auto;"
  />
  <input
    type="range"
    min={scaleMin}
    max={scaleMax}
    {step}
    bind:value={range[1]}
    on:input={handleSliderChange}
    class={rangeSliderClass}
    style="z-index: 3; pointer-events: auto;"
  />
  <div class="absolute top-1 w-full h-2 bg-gray-200 rounded-xl" style="z-index: 1;"></div>

  <!-- Scale Labels -->
  <div class="flex justify-between text-xs text-gray-500 mt-6">
    <span>{scaleMin}</span>
    <span>0</span>
    <span>+{scaleMax}</span>
  </div>
</div>

<!-- Manual Entry Fields -->
<div class="grid grid-cols-2 gap-2">
  <div>
    <label class="block text-xs text-gray-500 mb-1">Min</label>
    <input
      type="number"
      min={scaleMin}
      max={scaleMax}
      {step}
      bind:value={min}
      on:change={handleManualEntry}
      class="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
    />
  </div>
  <div>
    <label class="block text-xs text-gray-500 mb-1">Max</label>
    <input
      type="number"
      min={scaleMin}
      max={scaleMax}
      {step}
      bind:value={max}
      on:change={handleManualEntry}
      class="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
    />
  </div>
</div>
