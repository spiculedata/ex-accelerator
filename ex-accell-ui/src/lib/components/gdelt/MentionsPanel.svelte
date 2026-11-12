<script lang="ts">
  import DataLimitationNotice from './DataLimitationNotice.svelte';
  import MentionsPagination from './MentionsPagination.svelte';
  import MentionsTable from './MentionsTable.svelte';
  import {
    buildMentionsCsv,
    downloadCsv,
    filterAndSortMentions,
    mentionsCsvFilename,
    paginate,
    type GdeltMention,
    type SortDirection
  } from '$lib/utils/gdeltMentions';

  export let mentions: GdeltMention[];
  /** The event the mentions belong to, or null when they come from every filtered event */
  export let selectedEventId: number | null;
  export let loadingMentions = false;
  export let isBatchLoading = false;
  export let batchProgress = { current: 0, total: 0, loadedMentions: 0 };
  export let mentionsError = '';
  export let mentionsLimitationNotice = '';
  /** How many events the mentions of "all filtered events" were loaded for */
  export let visibleEventCount: number;
  /** The panel opens when the page sets this and closes itself, so bind it */
  export let showMentions = false;

  const itemsPerPageOptions = [25, 50, 100, 200, 500, 1000];
  const DEFAULT_ITEMS_PER_PAGE = 100;

  // Mentions table state
  let mentionsSortField = 'mentionTimeDate';
  let mentionsSortDirection: SortDirection = 'desc';
  let mentionsSearchTerm = '';
  let mentionsTypeFilter = '';
  let filteredMentions: GdeltMention[] = [];

  // Pagination state
  let currentPage = 1;
  let itemsPerPage = DEFAULT_ITEMS_PER_PAGE;
  let displayedMentions: GdeltMention[] = [];

  /** Back to the first page at the default page size, as when a new set of mentions is requested. */
  export function resetPagination() {
    currentPage = 1;
    itemsPerPage = DEFAULT_ITEMS_PER_PAGE;
  }

  // Reactive mentions filtering, sorting, and pagination
  $: {
    filteredMentions = filterAndSortMentions(mentions, {
      searchTerm: mentionsSearchTerm,
      typeFilter: mentionsTypeFilter,
      sortField: mentionsSortField,
      sortDirection: mentionsSortDirection
    });
    displayedMentions = paginate(filteredMentions, currentPage, itemsPerPage);
  }

  function sortMentions(field: string) {
    if (mentionsSortField === field) {
      mentionsSortDirection = mentionsSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      mentionsSortField = field;
      mentionsSortDirection = 'desc';
    }
    currentPage = 1; // Reset to first page when sorting
  }

  function goToPage(page: number) {
    currentPage = page;
  }

  function changeItemsPerPage(newItemsPerPage: number) {
    itemsPerPage = newItemsPerPage;
    currentPage = 1; // Reset to first page when changing page size
  }

  // Reset pagination when search or filter changes
  $: if (mentionsSearchTerm || mentionsTypeFilter) {
    currentPage = 1;
  }

  function exportMentionsToCSV() {
    if (filteredMentions.length === 0) return;
    downloadCsv(buildMentionsCsv(filteredMentions), mentionsCsvFilename(selectedEventId));
  }
</script>

<!-- Mentions Section -->
{#if showMentions}
  <div class="bg-white rounded-xl shadow-sm overflow-hidden mt-6">
    <div class="p-4 xl:p-6 bg-gradient-to-r from-gray-50 to-gray-100 border-b">
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <div class="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center mr-3">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
          </div>
          <h2 class="text-xl xl:text-2xl font-semibold text-gray-900">Related Mentions</h2>
        </div>
        <div class="flex items-center space-x-4 xl:space-x-6">
          <div class="text-sm xl:text-base text-gray-600">
            {#if selectedEventId}
              Event ID: {selectedEventId}
            {:else}
              All Filtered Events ({mentions.length} mentions)
            {/if}
          </div>
          <div class="flex items-center space-x-2">
            <button
              on:click={exportMentionsToCSV}
              disabled={filteredMentions.length === 0}
              class="text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400 bg-blue-50 hover:bg-blue-100 disabled:bg-gray-50 px-3 py-1 rounded transition-colors flex items-center gap-1"
              title="Export filtered mentions to CSV"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V11a2 2 0 01-2 2z"></path>
              </svg>
              Export CSV
            </button>
            <button
              on:click={() => showMentions = false}
              class="text-sm text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="p-4 xl:p-6">
      {#if loadingMentions}
        <div class="flex items-center justify-center py-16">
          <div class="text-center">
            <div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
            <div class="text-lg font-semibold text-gray-900 mb-2">
              {#if selectedEventId}
                Loading mentions for event {selectedEventId}...
              {:else}
                Processing {visibleEventCount} events for mentions...
              {/if}
            </div>
            <div class="text-sm text-gray-600 mb-3">
              {#if selectedEventId}
                Fetching related mentions and media sources
              {:else}
                Analyzing mentions across all filtered events
              {/if}
            </div>
            <div class="flex items-center justify-center space-x-2 text-xs text-gray-500">
              <div class="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              <span>Database query in progress</span>
              <div class="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style="animation-delay: 0.5s"></div>
            </div>
          </div>
        </div>
      {:else if mentionsError}
        {#if mentionsError.startsWith('Note:')}
          <!-- Information notice for data limitations -->
          <DataLimitationNotice message={mentionsError} />
        {:else}
          <!-- Regular error display -->
          <div class="bg-red-50 border border-red-200 rounded-xl p-4">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-red-800">Error Loading Mentions</h3>
                <p class="text-sm text-red-700 mt-1">{mentionsError}</p>
              </div>
            </div>
          </div>
        {/if}
      {:else if mentions.length === 0}
        <div class="text-center py-12">
          <svg class="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 class="mt-4 text-lg font-medium text-gray-900">No mentions found</h3>
          <p class="mt-2 text-sm text-gray-500">There are no mentions available for this event.</p>
        </div>
      {:else}
        <!-- Data Limitation Notice -->
        {#if mentionsLimitationNotice}
          <DataLimitationNotice message={mentionsLimitationNotice} />
        {/if}

        <!-- Search and Filter Controls -->
        <div class="mb-4 flex flex-col sm:flex-row gap-4">
          <div class="flex-1">
            <label class="block text-sm font-medium text-gray-700 mb-2">Search Sources & Identifiers</label>
            <input
              type="text"
              bind:value={mentionsSearchTerm}
              placeholder="Search by source name or identifier..."
              class="w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div class="sm:w-48">
            <label class="block text-sm font-medium text-gray-700 mb-2">Filter by Type</label>
            <select
              bind:value={mentionsTypeFilter}
              class="w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Types</option>
              <option value="1">Web News</option>
              <option value="2">Print News</option>
              <option value="3">Broadcast News</option>
            </select>
          </div>
        </div>

        <MentionsPagination
          position="top"
          total={filteredMentions.length}
          {currentPage}
          bind:itemsPerPage
          {itemsPerPageOptions}
          onGoToPage={goToPage}
          onChangeItemsPerPage={changeItemsPerPage}
        />

        <MentionsTable
          mentions={displayedMentions}
          sortField={mentionsSortField}
          sortDirection={mentionsSortDirection}
          onSort={sortMentions}
        />

        <MentionsPagination
          position="bottom"
          total={filteredMentions.length}
          {currentPage}
          bind:itemsPerPage
          {itemsPerPageOptions}
          onGoToPage={goToPage}
          onChangeItemsPerPage={changeItemsPerPage}
        />

        <div class="mt-4 text-sm text-gray-500 text-center">
          {#if filteredMentions.length > 0}
            {@const startIndex = (currentPage - 1) * itemsPerPage + 1}
            {@const endIndex = Math.min(currentPage * itemsPerPage, filteredMentions.length)}

            Showing {startIndex}-{endIndex} of {filteredMentions.length} filtered mention{filteredMentions.length !== 1 ? 's' : ''}
            ({mentions.length} total)
            {#if selectedEventId}
              for Event ID {selectedEventId}
            {:else}
              for {visibleEventCount} filtered events
              {#if isBatchLoading}
                <span class="text-blue-600 font-medium">
                  (batch {batchProgress.current}/{batchProgress.total} loading...)
                </span>
              {/if}
            {/if}
          {:else}
            No mentions to display
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}
