<script lang="ts">
  import { getCountryNameWithFallback } from '$lib/countryMapping';
  import type { GdeltEvent } from '$lib/utils/gdeltFilters';

  export let events: GdeltEvent[];
  /** The events that pass every filter except the country one, which is what the counts show */
  export let eventsForCountryCounts: GdeltEvent[];
  export let availableCountries: string[];
  export let selectedCountries: Set<string>;
  export let globalSouthCountryCodes: string[];
  export let allGlobalSouthSelected: boolean;
  /** Kept by the page so the search survives the panel being rebuilt */
  export let countrySearchTerm = '';
  export let onToggleCountry: (country: string) => void;
  export let onToggleGlobalSouth: () => void;

  // Filter countries based on the search term
  $: filteredCountries = availableCountries.filter((country) => {
    if (!countrySearchTerm) return true;
    const countryName = getCountryNameWithFallback(country, country);
    return countryName.toLowerCase().includes(countrySearchTerm.toLowerCase());
  });
</script>

<!-- Country Filter -->
<div class="pt-4 xl:pt-6 border-t border-gray-200">
  <div class="flex items-center mb-3 xl:mb-4">
    <svg class="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
    </svg>
    <span class="text-sm font-medium text-gray-900">Countries</span>
  </div>

  <div class="space-y-2">
    <!-- Country Search Box -->
    <div class="mb-3">
      <div class="relative">
        <input
          type="text"
          placeholder="Search countries..."
          bind:value={countrySearchTerm}
          class="w-full pl-8 pr-3 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <svg class="absolute left-2.5 top-2.5 w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
        </svg>
      </div>
    </div>

    <!-- All Countries Toggle -->
    <button
      on:click={() => onToggleCountry('all')}
      class="flex items-center w-full p-2 rounded-xl transition-all duration-200 hover:bg-gray-100 border border-gray-200 text-left"
    >
      <div class="flex items-center justify-center w-4 h-4 mr-3 border border-gray-300 rounded {selectedCountries.has('all') ? 'bg-blue-600 border-blue-600' : 'bg-white'}">
        {#if selectedCountries.has('all')}
          <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
          </svg>
        {/if}
      </div>
      <span class="text-xs font-medium text-gray-900">All Countries</span>
      <span class="ml-auto text-xs text-gray-600">{new Set(eventsForCountryCounts.map((e) => e.country)).size}</span>
    </button>

    <!-- Individual Countries -->
    <div class="max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
      {#each filteredCountries as country}
        {@const countryEventCount = eventsForCountryCounts.filter((e) => e.country === country).length}
        {@const totalEventCount = events.filter((e) => e.country === country).length}
        {@const countryName = getCountryNameWithFallback(country, `Unknown (${country})`)}
        {#if totalEventCount > 0}
          <button
            on:click={() => onToggleCountry(country)}
            class="flex items-center w-full p-2 rounded-xl transition-all duration-200 hover:bg-gray-100 border border-gray-200 text-left"
          >
            <div class="flex items-center justify-center w-4 h-4 mr-3 border border-gray-300 rounded {selectedCountries.has(country) ? 'bg-blue-600 border-blue-600' : 'bg-white'}">
              {#if selectedCountries.has(country)}
                <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
              {/if}
            </div>
            <span class="text-xs font-medium text-gray-900 truncate flex-1">{countryName}</span>
            <span class="ml-2 text-xs text-gray-600">{countryEventCount}</span>
          </button>
        {/if}
      {/each}
    </div>

    <!-- Global South Countries Toggle -->
    <div class="mt-3 pt-3 border-t border-gray-100">
      <button
        on:click={onToggleGlobalSouth}
        class="flex items-center w-full p-2 rounded-xl transition-all duration-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-amber-50 border border-blue-200 text-left bg-gradient-to-r from-blue-25 to-amber-25"
      >
        <div class="flex items-center justify-center w-4 h-4 mr-3 border border-blue-300 rounded {allGlobalSouthSelected ? 'bg-blue-500 border-blue-500' : 'bg-white'}">
          {#if allGlobalSouthSelected}
            <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
          {/if}
        </div>
        <div class="flex-1">
          <span class="text-xs font-medium text-blue-800">All Global South Countries</span>
          <div class="text-xs text-blue-600 mt-0.5">
            {globalSouthCountryCodes.length} countries available
          </div>
        </div>
        <div class="flex items-center text-xs text-blue-700">
          <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          {globalSouthCountryCodes.filter((code) => selectedCountries.has(code)).length}/{globalSouthCountryCodes.length}
        </div>
      </button>
    </div>
  </div>
</div>
