<script lang="ts">
  /** [start, end] as YYYY-MM-DD; the inputs write to it, so bind it */
  export let dateRange: string[];
  /** The span of dates in the loaded events */
  export let availableDateRange: string[];
  export let isUpdatingFilter = false;

  const DAY_MS = 24 * 60 * 60 * 1000;
  const CALENDAR_PATH = 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z';

  function selectLastWeek() {
    const today = new Date();
    const lastWeek = new Date(today.getTime() - 7 * DAY_MS);
    dateRange[0] = lastWeek.toISOString().split('T')[0];
    dateRange[1] = today.toISOString().split('T')[0];
  }

  function selectAllDates() {
    dateRange = [...availableDateRange];
  }
</script>

<!-- Date Range Filter -->
<div class="mb-6 xl:mb-8 pb-4 xl:pb-6 border-b border-gray-200">
  <div class="flex items-center mb-4 xl:mb-6">
    <div class="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center mr-3">
      <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={CALENDAR_PATH}></path>
      </svg>
    </div>
    <span class="text-sm xl:text-base font-medium text-gray-900">Date Range</span>
  </div>

  <div class="space-y-4">
    <div class="grid grid-cols-1 gap-3">
      <!-- From Date -->
      <div class="relative">
        <label class="block text-xs xl:text-sm font-medium text-gray-700 mb-2">From Date</label>
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={CALENDAR_PATH}></path>
            </svg>
          </div>
          <input
            type="date"
            bind:value={dateRange[0]}
            min={availableDateRange[0]}
            max={availableDateRange[1]}
            disabled={isUpdatingFilter}
            class="w-full pl-10 pr-3 py-2.5 xl:py-3 text-sm xl:text-base border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      <!-- To Date -->
      <div class="relative">
        <label class="block text-xs xl:text-sm font-medium text-gray-700 mb-2">To Date</label>
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={CALENDAR_PATH}></path>
            </svg>
          </div>
          <input
            type="date"
            bind:value={dateRange[1]}
            min={availableDateRange[0]}
            max={availableDateRange[1]}
            disabled={isUpdatingFilter}
            class="w-full pl-10 pr-3 py-2.5 xl:py-3 text-sm xl:text-base border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
      </div>
    </div>

    {#if availableDateRange[0] && availableDateRange[1]}
      <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 border border-blue-200">
        <div class="flex items-center text-xs text-blue-700">
          <svg class="w-3 h-3 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
          </svg>
          <span class="font-medium">Available range: {availableDateRange[0]} to {availableDateRange[1]}</span>
        </div>
      </div>
    {/if}

    <!-- Quick Select Buttons -->
    <div class="grid grid-cols-2 gap-2">
      <button
        on:click={selectLastWeek}
        disabled={isUpdatingFilter}
        class="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Last 7 days
      </button>
      <button
        on:click={selectAllDates}
        disabled={isUpdatingFilter}
        class="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        All dates
      </button>
    </div>
  </div>
</div>
