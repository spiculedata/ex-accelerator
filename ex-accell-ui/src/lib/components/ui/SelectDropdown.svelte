<script lang="ts">
  export let label: string;
  export let value: string;
  export let options: Array<{ label: string; value: string }>;
  export let error: string = '';
  export let tooltip: string = '';
  export let required: boolean = false;

  function handleChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    value = target.value;
  }
</script>

<div>
  <div class="flex items-center mb-2">
    <label class="block text-sm font-medium text-gray-700">
      {label}{#if required} *{/if}
    </label>
    {#if tooltip}
      <div class="group relative ml-2">
        <svg class="w-4 h-4 text-gray-500 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
          {tooltip}
        </div>
      </div>
    {/if}
  </div>
  <select
    {value}
    {required}
    on:change={handleChange}
    class="w-full px-3 py-2 border {error ? 'border-red-300' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
  >
    {#each options as option}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>
  {#if error}
    <p class="text-red-600 text-xs mt-1">{error}</p>
  {/if}
</div>
